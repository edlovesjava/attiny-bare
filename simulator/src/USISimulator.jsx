import { useState, useEffect, useCallback, useRef } from "react";

// === I2C Transaction Parameters ===
const ADDR = 0x3c;
const ADDR_BYTE = (ADDR << 1) | 0; // 0x78 write
const DATA_BYTE = 0x42;

const USICR_INIT = 0b00101010; // TWI mode, sw strobe, no USITC
const USICR_TICK = 0b00101011; // same + USITC=1

function bits8(val) {
  return Array.from({ length: 8 }, (_, i) => (val >> (7 - i)) & 1);
}

// === Step Generator ===
function generateSteps() {
  const s = [];
  const add = (phase, desc, sda, scl, usidr, counter, flags, ddrSda, usicr, anchor) =>
    s.push({ phase, desc, sda, scl, usidr, counter, flags, ddrSda, usicr: usicr || USICR_INIT, anchor: anchor || "idle-bus" });

  // IDLE
  add("IDLE", "Bus idle — both lines pulled HIGH by resistors", 1, 1, 0xff, 0, 0x00, 1, USICR_INIT, "idle-bus");
  // INIT
  add("INIT", "i2c_init(): USIDR ← 0xFF, configure USICR for TWI mode", 1, 1, 0xff, 0, 0x00, 1, USICR_INIT, "init-usidr");
  add("INIT", "Clear USISR flags (write 1s to bits 7‑4), counter ← 0", 1, 1, 0xff, 0, 0x00, 1, USICR_INIT, "init-usisr");

  // START CONDITION
  add("START", "PORTB.SDA ← 0 → SDA falls while SCL=HIGH (START!)", 0, 1, 0xff, 0, 0x80, 1, USICR_INIT, "start-sda-fall");
  add("START", "PORTB.SCL ← 0 → SCL falls — start complete, USISIF set", 0, 0, 0xff, 0, 0x80, 1, USICR_INIT, "start-scl-fall");

  // LOAD ADDRESS
  add("ADDR", `USIDR ← 0x${ADDR_BYTE.toString(16).toUpperCase()} (0x${ADDR.toString(16).toUpperCase()}≪1 | W), DDRB.SDA=output`, 0, 0, ADDR_BYTE, 0, 0x00, 1, USICR_INIT, "addr-load-usidr");

  // CLOCK 8 ADDRESS BITS
  // With USICS1=1: data shifts on rising edge (positive edge of external clock)
  // Counter increments on both edges (via USICLK software strobe)
  let dr = ADDR_BYTE;
  for (let i = 0; i < 8; i++) {
    const bit = (dr >> 7) & 1;
    const label = i < 7 ? `A${6 - i}` : "R/W̄";
    const cntHi = ((i * 2 + 1) & 0xf);
    const cntLo = ((i * 2 + 2) & 0xf);
    const overflow = i === 7;

    dr = ((dr << 1) & 0xff) | 1;
    add("ADDR", `SCL ↑  slave samples ${label} = ${bit}, USIDR shifts left   [counter=${cntHi}]`, bit, 1, dr, cntHi, 0x00, 1, USICR_TICK, "addr-clock-rising");
    add("ADDR",
      overflow
        ? `SCL ↓  counter overflow → USIOIF set`
        : `SCL ↓  counter increments   [counter=${cntLo}]`,
      (dr >> 7) & 1, 0, dr, overflow ? 0 : cntLo, overflow ? 0x40 : 0x00, 1, USICR_TICK,
      overflow ? "addr-overflow" : "addr-clock-falling");
  }

  // ACK from slave
  add("ACK", "DDRB.SDA ← 0 (input) — release SDA for slave ACK", 1, 0, 0xff, 14, 0x00, 0, USICR_INIT, "ack-release-sda");
  add("ACK", "SCL ↑  slave pulls SDA LOW → ACK!  [counter=15]", 0, 1, 0xfe, 15, 0x00, 0, USICR_TICK, "ack-clock-rising");
  add("ACK", "SCL ↓  USIOIF set, DDRB.SDA ← 1 (output)", 0, 0, 0xfe, 0, 0x40, 1, USICR_TICK, "ack-clock-falling");

  // LOAD DATA
  add("DATA", `USIDR ← 0x${DATA_BYTE.toString(16).toUpperCase()}, counter reset`, 0, 0, DATA_BYTE, 0, 0x00, 1, USICR_INIT, "data-load-usidr");

  // CLOCK 8 DATA BITS
  // Same timing as address: shift on rising edge, counter on both
  dr = DATA_BYTE;
  for (let i = 0; i < 8; i++) {
    const bit = (dr >> 7) & 1;
    const cntHi = ((i * 2 + 1) & 0xf);
    const cntLo = ((i * 2 + 2) & 0xf);
    const overflow = i === 7;

    dr = ((dr << 1) & 0xff) | 1;
    add("DATA", `SCL ↑  slave samples D${7 - i} = ${bit}, USIDR shifts left   [counter=${cntHi}]`, bit, 1, dr, cntHi, 0x00, 1, USICR_TICK, "data-clock-rising");
    add("DATA",
      overflow
        ? `SCL ↓  counter overflow → USIOIF set`
        : `SCL ↓  counter increments   [counter=${cntLo}]`,
      (dr >> 7) & 1, 0, dr, overflow ? 0 : cntLo, overflow ? 0x40 : 0x00, 1, USICR_TICK,
      overflow ? "data-overflow" : "data-clock-falling");
  }

  // ACK from slave
  add("ACK", "DDRB.SDA ← 0 (input) — release SDA for slave ACK", 1, 0, 0xff, 14, 0x00, 0, USICR_INIT, "ack-release-sda");
  add("ACK", "SCL ↑  slave pulls SDA LOW → ACK!  [counter=15]", 0, 1, 0xfe, 15, 0x00, 0, USICR_TICK, "ack-clock-rising");
  add("ACK", "SCL ↓  USIOIF set, DDRB.SDA ← 1 (output)", 0, 0, 0xfe, 0, 0x40, 1, USICR_TICK, "ack-clock-falling");

  // STOP CONDITION
  add("STOP", "PORTB.SDA ← 0 → force SDA LOW", 0, 0, 0xff, 0, 0x00, 1, USICR_INIT, "stop-sda-low");
  add("STOP", "PORTB.SCL ← 1 → SCL rises", 0, 1, 0xff, 0, 0x00, 1, USICR_INIT, "stop-scl-rise");
  add("STOP", "PORTB.SDA ← 1 → SDA rises while SCL=HIGH (STOP!), USIPF set", 1, 1, 0xff, 0, 0x20, 1, USICR_INIT, "stop-sda-rise");
  add("IDLE", "Transaction complete — bus returned to idle", 1, 1, 0xff, 0, 0x00, 1, USICR_INIT, "idle-bus");

  return s;
}

const STEPS = generateSteps();

// === Phase Colors ===
const PHASE_COLORS = {
  IDLE: "#586e75",
  INIT: "#6c71c4",
  START: "#dc322f",
  ADDR: "#b58900",
  DATA: "#268bd2",
  ACK: "#2aa198",
  STOP: "#d33682",
};

// === Register Bit Names ===
const USISR_BITS = ["USISIF", "USIOIF", "USIPF", "USIDC", "CNT3", "CNT2", "CNT1", "CNT0"];
const USICR_BITS = ["USISIE", "USIOIE", "USIWM1", "USIWM0", "USICS1", "USICS0", "USICLK", "USITC"];

// === Help Panel ===
function HelpPanel() {
  const [open, setOpen] = useState(true);

  const sectionStyle = {
    marginBottom: 10,
  };
  const headingStyle = {
    fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4,
    fontFamily: "'IBM Plex Mono', monospace",
  };
  const textStyle = {
    fontSize: 11, color: "#93a1a1", lineHeight: 1.6,
    fontFamily: "'IBM Plex Mono', monospace",
  };
  const kbd = (key) => (
    <span style={{
      background: "#1a2a1a", border: "1px solid #2a3a2a", borderRadius: 3,
      padding: "1px 5px", fontSize: 10, color: "#c0d0c0", fontWeight: 700,
    }}>{key}</span>
  );

  return (
    <div style={{
      background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 12px", color: "#6c71c4", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12, fontWeight: 700, letterSpacing: 1,
        }}
      >
        <span>{open ? "▼" : "▶"} HOW TO READ THIS SIMULATOR</span>
        <span style={{ fontSize: 9, color: "#586e75", fontWeight: 400 }}>
          {open ? "click to collapse" : "click to expand"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 12px 12px 12px" }}>
          {/* Oscilloscope */}
          <div style={sectionStyle}>
            <div style={{ ...headingStyle, color: "#00ccff" }}>OSCILLOSCOPE</div>
            <div style={textStyle}>
              The waveform display shows two signal lines over time, like a logic analyzer.{" "}
              <span style={{ color: "#00ff66", fontWeight: 700 }}>SDA</span> (green) is the data line and{" "}
              <span style={{ color: "#00ccff", fontWeight: 700 }}>SCL</span> (blue) is the clock line.
              HIGH is at the top, LOW at the bottom. The{" "}
              <span style={{ color: "#ffb800" }}>yellow dashed line</span> marks the current step.
              Colored labels above the waveform show which phase of the I2C transaction you're in.
              The bright portion of each waveform is "already happened"; the dim portion is "still ahead."
            </div>
          </div>

          {/* Registers */}
          <div style={sectionStyle}>
            <div style={{ ...headingStyle, color: "#00ff66" }}>REGISTERS</div>
            <div style={textStyle}>
              Three USI registers are shown as 8-bit rows:{" "}
              <span style={{ color: "#00ff66", fontWeight: 700 }}>USIDR</span> (data/shift register — bits shift out onto SDA),{" "}
              <span style={{ color: "#00ccff", fontWeight: 700 }}>USISR</span> (status flags in bits 7‑4, 4-bit counter in bits 3‑0),{" "}
              <span style={{ color: "#ffb800", fontWeight: 700 }}>USICR</span> (control — wire mode + clock source).
              Each box shows a single bit (1 or 0). Hex and binary values are shown to the right of the register name.
              When a bit <span style={{ color: "#fff", background: "#333", padding: "0 3px", borderRadius: 2 }}>glows</span>,
              it changed from the previous step — watch for these to understand what each step modifies.
            </div>
          </div>

          {/* Phases */}
          <div style={sectionStyle}>
            <div style={{ ...headingStyle, color: "#d33682" }}>I2C PHASES</div>
            <div style={{ ...textStyle, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {Object.entries(PHASE_COLORS).map(([phase, color]) => (
                <span key={phase}>
                  <span style={{ color, fontWeight: 700 }}>{phase}</span>
                  <span style={{ color: "#586e75" }}>{" — "}{
                    { IDLE: "bus free", INIT: "configure USI", START: "claim bus",
                      ADDR: "send address", DATA: "send payload", ACK: "slave responds",
                      STOP: "release bus" }[phase]
                  }</span>
                </span>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={sectionStyle}>
            <div style={{ ...headingStyle, color: "#ffb800" }}>CONTROLS</div>
            <div style={textStyle}>
              {kbd("←")} previous step {" · "} {kbd("→")} or {kbd("Space")} next step {" · "}
              {kbd("⏮")} jump to start {" · "} {kbd("⏭")} jump to end {" · "}
              {kbd("▶ Play")} auto-advance at the selected speed.
              Each step shows what the firmware or hardware does. Click{" "}
              <span style={{ color: "#6c71c4", fontWeight: 700 }}>Learn more</span> next to any step
              description for a detailed explanation. Use{" "}
              <span style={{ color: "#2aa198", fontWeight: 700 }}>Ask Claude</span> to copy
              the current simulator state to your clipboard — paste it into Claude Code and ask
              any question about what's happening.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Components ===

function BitBox({ value, label, active, changed, accent }) {
  const bg = changed
    ? (value ? "#b8ff00" : "#ff3b3b")
    : active
      ? (value ? "#00ff66" : "#1a3a1a")
      : (value ? "#2a5a2a" : "#111a11");
  const border = changed ? "#fff" : active ? "#00ff66" : "#2a3a2a";
  const color = value ? "#000" : (changed ? "#ff3b3b" : "#3a5a3a");

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2
    }}>
      <div style={{
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        background: bg, border: `1.5px solid ${border}`, borderRadius: 3,
        fontFamily: "'IBM Plex Mono', 'Courier New', monospace", fontSize: 14, fontWeight: 700,
        color, transition: "all 0.15s ease",
        boxShadow: changed ? `0 0 8px ${accent || "#b8ff00"}` : "none",
      }}>
        {value}
      </div>
      {label && (
        <div style={{
          fontSize: 8, color: "#586e75", fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: -0.3, textAlign: "center", lineHeight: 1,
          maxWidth: 32, overflow: "hidden",
        }}>{label}</div>
      )}
    </div>
  );
}

function RegisterRow({ name, value, bitLabels, prevValue, accent }) {
  const currentBits = bits8(value);
  const prevBits = prevValue != null ? bits8(prevValue) : currentBits;
  const hex = "0x" + value.toString(16).toUpperCase().padStart(2, "0");
  const bin = value.toString(2).padStart(8, "0");

  return (
    <div style={{
      background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
      padding: "8px 10px", flex: 1, minWidth: 0,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 6,
      }}>
        <span style={{
          color: accent || "#00ff66", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13, fontWeight: 700, letterSpacing: 1,
        }}>{name}</span>
        <span style={{
          color: "#586e75", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
        }}>{hex} = {bin}</span>
      </div>
      <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
        {currentBits.map((b, i) => (
          <BitBox
            key={i} value={b}
            label={bitLabels ? bitLabels[i] : `b${7 - i}`}
            changed={b !== prevBits[i]}
            accent={accent}
          />
        ))}
      </div>
    </div>
  );
}

function Waveform({ steps, currentStep }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const stepW = 32;
  const h = 120;
  const topY = 20;
  const sdaHi = 30;
  const sdaLo = 55;
  const sclHi = 72;
  const sclLo = 97;
  const totalW = Math.max(steps.length * stepW + 60, 600);

  useEffect(() => {
    if (containerRef.current) {
      const scrollX = Math.max(0, currentStep * stepW - 300);
      containerRef.current.scrollTo({ left: scrollX, behavior: "smooth" });
    }
  }, [currentStep]);

  // Build waveform paths
  let sdaPath = `M ${30} ${steps[0]?.sda ? sdaHi : sdaLo}`;
  let sclPath = `M ${30} ${steps[0]?.scl ? sclHi : sclLo}`;

  for (let i = 1; i < steps.length; i++) {
    const x = 30 + i * stepW;
    const prevSda = steps[i - 1].sda;
    const curSda = steps[i].sda;
    const prevScl = steps[i - 1].scl;
    const curScl = steps[i].scl;

    if (curSda !== prevSda) {
      sdaPath += ` L ${x} ${prevSda ? sdaHi : sdaLo} L ${x} ${curSda ? sdaHi : sdaLo}`;
    } else {
      sdaPath += ` L ${x} ${curSda ? sdaHi : sdaLo}`;
    }
    if (curScl !== prevScl) {
      sclPath += ` L ${x} ${prevScl ? sclHi : sclLo} L ${x} ${curScl ? sclHi : sclLo}`;
    } else {
      sclPath += ` L ${x} ${curScl ? sclHi : sclLo}`;
    }
  }

  // Phase regions
  const phaseRegions = [];
  let pi = 0;
  while (pi < steps.length) {
    const phase = steps[pi].phase;
    const start = pi;
    while (pi < steps.length && steps[pi].phase === phase) pi++;
    phaseRegions.push({ phase, start, end: pi - 1 });
  }

  return (
    <div ref={containerRef} style={{
      overflowX: "auto", overflowY: "hidden",
      background: "#050a05",
      border: "1px solid #1a2a1a",
      borderRadius: 6,
      position: "relative",
    }}>
      <svg width={totalW} height={h} ref={svgRef} style={{ display: "block" }}>
        {/* Grid lines */}
        {Array.from({ length: Math.ceil(totalW / stepW) }, (_, i) => (
          <line key={i} x1={30 + i * stepW} y1={topY} x2={30 + i * stepW} y2={h - 5}
            stroke="#0d1a0d" strokeWidth={1} />
        ))}

        {/* Phase backgrounds */}
        {phaseRegions.map((r, i) => (
          <g key={i}>
            <rect
              x={30 + r.start * stepW - 2} y={topY - 14}
              width={(r.end - r.start + 1) * stepW + 4} height={14}
              rx={3} fill={PHASE_COLORS[r.phase] + "33"}
            />
            <text
              x={30 + ((r.start + r.end) / 2) * stepW + stepW / 2} y={topY - 3}
              textAnchor="middle" fill={PHASE_COLORS[r.phase]}
              fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}
            >{r.phase}</text>
          </g>
        ))}

        {/* Labels */}
        <text x={4} y={sdaHi + 5} fill="#00ff66" fontSize={10}
          fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>SDA</text>
        <text x={4} y={sclHi + 5} fill="#00ccff" fontSize={10}
          fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>SCL</text>

        {/* SDA waveform */}
        <path d={sdaPath} fill="none" stroke="#00ff6644" strokeWidth={2} />
        {/* Active portion of SDA */}
        <clipPath id="sda-clip">
          <rect x={0} y={0} width={30 + (currentStep + 1) * stepW} height={h} />
        </clipPath>
        <path d={sdaPath} fill="none" stroke="#00ff66" strokeWidth={2.5}
          clipPath="url(#sda-clip)" style={{ filter: "drop-shadow(0 0 3px #00ff6688)" }} />

        {/* SCL waveform */}
        <path d={sclPath} fill="none" stroke="#00ccff44" strokeWidth={2} />
        <clipPath id="scl-clip">
          <rect x={0} y={0} width={30 + (currentStep + 1) * stepW} height={h} />
        </clipPath>
        <path d={sclPath} fill="none" stroke="#00ccff" strokeWidth={2.5}
          clipPath="url(#scl-clip)" style={{ filter: "drop-shadow(0 0 3px #00ccff88)" }} />

        {/* Current step marker */}
        <line
          x1={30 + currentStep * stepW} y1={topY - 16}
          x2={30 + currentStep * stepW} y2={h}
          stroke="#ffb800" strokeWidth={1.5} strokeDasharray="3,3" opacity={0.7}
        />
        <circle
          cx={30 + currentStep * stepW} cy={steps[currentStep]?.sda ? sdaHi : sdaLo}
          r={4} fill="#00ff66" stroke="#fff" strokeWidth={1.5}
        />
        <circle
          cx={30 + currentStep * stepW} cy={steps[currentStep]?.scl ? sclHi : sclLo}
          r={4} fill="#00ccff" stroke="#fff" strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}

// === Byte Breakdown Display ===
function ByteBreakdown({ step, steps, currentStep }) {
  // Determine which byte we're in and which bit
  const phase = step.phase;
  if (phase !== "ADDR" && phase !== "DATA") return null;

  const byte = phase === "ADDR" ? ADDR_BYTE : DATA_BYTE;
  const byteLabel = phase === "ADDR"
    ? `Addr 0x${ADDR.toString(16).toUpperCase()} + W = 0x${ADDR_BYTE.toString(16).toUpperCase()}`
    : `Data = 0x${DATA_BYTE.toString(16).toUpperCase()}`;
  const byteBits = bits8(byte);

  // Find which bit is being clocked by looking at step descriptions
  let activeBit = -1;
  const m = step.desc.match(/samples (?:A\d|R\/W̄|D(\d)) = (\d)/);
  if (m) {
    if (step.desc.includes("R/W")) activeBit = 7;
    else if (step.desc.includes("A")) {
      const am = step.desc.match(/A(\d)/);
      if (am) activeBit = 7 - (6 - parseInt(am[1]));
    } else if (step.desc.includes("D")) {
      const dm = step.desc.match(/D(\d)/);
      if (dm) activeBit = 7 - parseInt(dm[1]);
    }
  }
  // Also highlight on the falling edge (same bit as previous rising edge)
  const mFalling = step.desc.match(/counter (increments|overflow)/);
  if (mFalling && currentStep > 0) {
    const prev = steps[currentStep - 1];
    const pm = prev.desc.match(/samples (?:A\d|R\/W̄|D(\d)) = (\d)/);
    if (pm) {
      if (prev.desc.includes("R/W")) activeBit = 7;
      else if (prev.desc.includes("A")) {
        const am = prev.desc.match(/A(\d)/);
        if (am) activeBit = 7 - (6 - parseInt(am[1]));
      } else if (prev.desc.includes("D")) {
        const dm = prev.desc.match(/D(\d)/);
        if (dm) activeBit = 7 - parseInt(dm[1]);
      }
    }
  }

  const bitLabels = phase === "ADDR"
    ? ["A6", "A5", "A4", "A3", "A2", "A1", "A0", "R/W̄"]
    : ["D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"];

  return (
    <div style={{
      background: "#0a140a", border: `1px solid ${PHASE_COLORS[phase]}44`,
      borderRadius: 6, padding: "6px 10px",
    }}>
      <div style={{
        fontSize: 10, color: PHASE_COLORS[phase], fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 700, marginBottom: 4, letterSpacing: 0.5,
      }}>{byteLabel}</div>
      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
        {byteBits.map((b, i) => {
          const isActive = i === activeBit;
          const isPast = i < activeBit;
          return (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}>
              <div style={{
                width: 26, height: 26,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isActive ? (b ? "#00ff66" : "#1a3a1a") : isPast ? "#1a2a1a" : "#0d1a0d",
                border: `1.5px solid ${isActive ? "#fff" : isPast ? "#2a3a2a" : "#1a2a1a"}`,
                borderRadius: 3,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700,
                color: isActive ? (b ? "#000" : "#00ff66") : isPast ? "#3a5a3a" : "#2a3a2a",
                boxShadow: isActive ? `0 0 10px ${PHASE_COLORS[phase]}88` : "none",
                transition: "all 0.15s",
              }}>{b}</div>
              <div style={{
                fontSize: 8, color: isActive ? PHASE_COLORS[phase] : "#3a5a3a",
                fontFamily: "'IBM Plex Mono', monospace", fontWeight: isActive ? 700 : 400,
              }}>{bitLabels[i]}</div>
              {isActive && (
                <div style={{
                  fontSize: 7, color: "#00ff66",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>→SDA</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === Pin State Display ===
function PinState({ sda, scl, ddrSda }) {
  const Pin = ({ label, value, color }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <span style={{
        fontSize: 10, color: "#586e75", fontFamily: "'IBM Plex Mono', monospace",
        width: 30, textAlign: "right",
      }}>{label}</span>
      <div style={{
        width: 14, height: 14, borderRadius: "50%",
        background: value ? color : "#1a1a1a",
        border: `1.5px solid ${value ? color : "#333"}`,
        boxShadow: value ? `0 0 8px ${color}88` : "none",
        transition: "all 0.15s",
      }} />
      <span style={{
        fontSize: 11, color: value ? color : "#333",
        fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
      }}>{value ? "HIGH" : "LOW"}</span>
    </div>
  );

  return (
    <div style={{
      background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
      padding: "8px 12px", display: "flex", gap: 16, alignItems: "center",
      flexWrap: "wrap",
    }}>
      <Pin label="SDA" value={sda} color="#00ff66" />
      <Pin label="SCL" value={scl} color="#00ccff" />
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{
          fontSize: 10, color: "#586e75", fontFamily: "'IBM Plex Mono', monospace",
        }}>SDA dir:</span>
        <span style={{
          fontSize: 11, color: ddrSda ? "#ffb800" : "#b58900",
          fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
          background: "#1a1a0a", padding: "1px 6px", borderRadius: 3,
          border: `1px solid ${ddrSda ? "#ffb80044" : "#b5890044"}`,
        }}>{ddrSda ? "OUTPUT" : "INPUT"}</span>
      </div>
    </div>
  );
}

// === Copy State Helper ===
function buildStateText(step, stepIndex, total, usisrVal) {
  const hex = (v) => "0x" + v.toString(16).toUpperCase().padStart(2, "0");
  return [
    `USI Simulator — Step ${stepIndex + 1}/${total} [${step.phase}]`,
    `SCL=${step.scl ? "HIGH" : "LOW"}  SDA=${step.sda ? "HIGH" : "LOW"}  SDA_DIR=${step.ddrSda ? "OUTPUT" : "INPUT"}`,
    `USIDR=${hex(step.usidr)}  USISR=${hex(usisrVal)}  USICR=${hex(step.usicr)}`,
    `> ${step.desc}`,
    ``,
    `Paste this into Claude Code and ask your question.`,
  ].join("\n");
}

// === Main Simulator ===
export default function USISimulator() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [copied, setCopied] = useState(false);

  const current = STEPS[step];
  const prev = step > 0 ? STEPS[step - 1] : null;

  const goNext = useCallback(() => {
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }, []);
  const goPrev = useCallback(() => {
    setStep(s => Math.max(s - 1, 0));
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (step >= STEPS.length - 1) { setPlaying(false); return; }
    const id = setTimeout(goNext, speed);
    return () => clearTimeout(id);
  }, [playing, step, speed, goNext]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Build USISR from flags + counter
  const usisrVal = current.flags | (current.counter & 0x0f);
  const prevUsisrVal = prev ? (prev.flags | (prev.counter & 0x0f)) : usisrVal;

  const handleCopyState = useCallback(() => {
    const text = buildStateText(current, step, STEPS.length, usisrVal);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [current, step, usisrVal]);

  return (
    <div style={{
      background: "#070d07", color: "#c0d0c0", minHeight: "100vh",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{
            fontSize: 16, fontWeight: 800, color: "#00ff66", margin: 0, letterSpacing: 1.5,
            textShadow: "0 0 10px #00ff6644",
          }}>ATtiny85 USI ◆ I2C SIMULATOR</h1>
          <div style={{ fontSize: 10, color: "#3a5a3a", marginTop: 2 }}>
            Write 0x{DATA_BYTE.toString(16).toUpperCase()} to device 0x{ADDR.toString(16).toUpperCase()} — step through every register change
          </div>
        </div>
        <div style={{
          fontSize: 11, color: "#586e75", textAlign: "right",
        }}>
          PB0=SDA &nbsp; PB2=SCL
        </div>
      </div>

      {/* Help Panel */}
      <HelpPanel />

      {/* Phase + Description */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
        padding: "8px 12px", flexWrap: "wrap",
      }}>
        <div style={{
          background: PHASE_COLORS[current.phase] + "33",
          border: `1.5px solid ${PHASE_COLORS[current.phase]}`,
          borderRadius: 4, padding: "2px 10px",
          fontSize: 12, fontWeight: 800, color: PHASE_COLORS[current.phase],
          letterSpacing: 1.5, minWidth: 60, textAlign: "center",
          textShadow: `0 0 8px ${PHASE_COLORS[current.phase]}44`,
        }}>{current.phase}</div>
        <div style={{ flex: 1, fontSize: 12, color: "#c0d0c0", minWidth: 200 }}>
          {current.desc}
          <a
            href={`guide.html#${current.anchor}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: 8, fontSize: 10, color: "#6c71c4",
              textDecoration: "none", fontWeight: 700,
            }}
            title="Open detailed explanation in new tab"
          >Learn more ↗</a>
        </div>
        <div style={{
          fontSize: 11, color: "#586e75", whiteSpace: "nowrap",
        }}>Step {step + 1} / {STEPS.length}</div>
      </div>

      {/* Oscilloscope */}
      <Waveform steps={STEPS} currentStep={step} />

      {/* Byte breakdown */}
      <ByteBreakdown step={current} steps={STEPS} currentStep={step} />

      {/* Pin States */}
      <PinState sda={current.sda} scl={current.scl} ddrSda={current.ddrSda} />

      {/* Registers */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <RegisterRow
          name="USIDR" value={current.usidr}
          prevValue={prev?.usidr} accent="#00ff66"
        />
        <RegisterRow
          name="USISR" value={usisrVal}
          bitLabels={USISR_BITS}
          prevValue={prevUsisrVal} accent="#00ccff"
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <RegisterRow
          name="USICR" value={current.usicr}
          bitLabels={USICR_BITS}
          prevValue={prev?.usicr} accent="#ffb800"
        />
        <div style={{
          background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
          padding: "8px 10px", flex: 1, minWidth: 0,
        }}>
          <div style={{
            color: "#d33682", fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 6,
          }}>LEGEND</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 10, color: "#586e75" }}>
            <span><span style={{ color: "#00ff66" }}>■</span> USIDR — shift register</span>
            <span><span style={{ color: "#00ccff" }}>■</span> USISR — status + counter</span>
            <span><span style={{ color: "#ffb800" }}>■</span> USICR — control</span>
            <span><span style={{ color: "#fff", background: "#333", padding: "0 3px", borderRadius: 2 }}>glow</span> = changed</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
        padding: "8px 12px", flexWrap: "wrap", justifyContent: "center",
      }}>
        <button onClick={() => { setStep(0); setPlaying(false); }} style={btnStyle} title="Reset">⏮</button>
        <button onClick={goPrev} style={btnStyle} disabled={step === 0} title="Previous (←)">◀</button>
        <button
          onClick={() => { if (step >= STEPS.length - 1) setStep(0); setPlaying(p => !p); }}
          style={{ ...btnStyle, width: 80, background: playing ? "#2a1a0a" : "#0a2a0a", border: `1.5px solid ${playing ? "#ffb800" : "#00ff66"}`, color: playing ? "#ffb800" : "#00ff66" }}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button onClick={goNext} style={btnStyle} disabled={step >= STEPS.length - 1} title="Next (→ or Space)">▶</button>
        <button onClick={() => { setStep(STEPS.length - 1); setPlaying(false); }} style={btnStyle} title="End">⏭</button>

        <div style={{ width: 1, height: 24, background: "#1a2a1a", margin: "0 4px" }} />

        <label style={{ fontSize: 10, color: "#586e75", display: "flex", alignItems: "center", gap: 6 }}>
          Speed
          <input
            type="range" min={100} max={1500} step={50} value={1600 - speed}
            onChange={e => setSpeed(1600 - parseInt(e.target.value))}
            style={{ width: 80, accentColor: "#00ff66" }}
          />
        </label>

        <div style={{ width: 1, height: 24, background: "#1a2a1a", margin: "0 4px" }} />

        {/* Ask Claude button */}
        <button
          onClick={handleCopyState}
          style={{
            ...btnStyle,
            background: copied ? "#0a2a1a" : "#0a1a2a",
            border: `1.5px solid ${copied ? "#00ff66" : "#2aa198"}`,
            color: copied ? "#00ff66" : "#2aa198",
            fontSize: 11,
            padding: "4px 10px",
          }}
          title="Copy current simulator state to clipboard for pasting into Claude Code"
        >
          {copied ? "✓ Copied!" : "📋 Ask Claude"}
        </button>

        <div style={{
          fontSize: 9, color: "#3a5a3a", marginLeft: 8,
        }}>← → or Space to step</div>
      </div>
    </div>
  );
}

const btnStyle = {
  background: "#0a140a", border: "1.5px solid #2a3a2a", borderRadius: 4,
  color: "#c0d0c0", fontFamily: "'IBM Plex Mono', monospace", fontSize: 14,
  padding: "4px 12px", cursor: "pointer", transition: "all 0.1s",
  minWidth: 36, textAlign: "center",
};
