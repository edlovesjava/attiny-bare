import { useState, useEffect, useCallback, useMemo } from "react";
import { generateOLEDSteps } from "./oled/oledSteps.js";
import { createInitialState, applyStep } from "./oled/ssd1306State.js";

const PHASE_COLORS = {
  INIT: "#6c71c4",
  CLEAR: "#dc322f",
  CURSOR: "#b58900",
  TEXT: "#268bd2",
};

const btnStyle = {
  background: "#0a140a", border: "1.5px solid #2a3a2a", borderRadius: 4,
  color: "#c0d0c0", fontFamily: "'IBM Plex Mono', monospace", fontSize: 14,
  padding: "4px 12px", cursor: "pointer", transition: "all 0.1s",
  minWidth: 36, textAlign: "center",
};

// Format hex bytes for display
function formatHex(hex) {
  if (!hex || !Array.isArray(hex)) return "";
  return hex.map(b => {
    if (typeof b === "number") return "0x" + b.toString(16).toUpperCase().padStart(2, "0");
    return String(b);
  }).join(", ");
}

// Registers to display in the state panel
const LEFT_REGS = [
  { key: "addr_mode", label: "addressing_mode", type: "hex" },
  { key: "mux_ratio", label: "mux_ratio", type: "num" },
  { key: "display_offset", label: "display_offset", type: "num" },
  { key: "start_line", label: "start_line", type: "num" },
  { key: "contrast", label: "contrast", type: "hex" },
  { key: "precharge", label: "precharge", type: "hex" },
  { key: "vcomh", label: "vcomh", type: "hex" },
  { key: "com_pins", label: "com_pins", type: "hex" },
];

const RIGHT_REGS = [
  { key: "display_on", label: "display_on", type: "bool" },
  { key: "charge_pump", label: "charge_pump", type: "bool" },
  { key: "seg_remap", label: "seg_remap", type: "bool" },
  { key: "com_scan_dir", label: "com_scan_dir", type: "hex" },
  { key: "output_follows_ram", label: "output_follows_ram", type: "bool" },
  { key: "inverted", label: "inverted", type: "bool" },
  { key: "col_window", label: "col window", type: "range", startKey: "col_start", endKey: "col_end" },
  { key: "page_window", label: "page window", type: "range", startKey: "page_start", endKey: "page_end" },
];

function formatRegValue(reg, state) {
  if (reg.type === "bool") {
    return state[reg.key] ? "ON" : "OFF";
  }
  if (reg.type === "hex") {
    const v = state[reg.key];
    return "0x" + v.toString(16).toUpperCase().padStart(2, "0");
  }
  if (reg.type === "num") {
    return String(state[reg.key]);
  }
  if (reg.type === "range") {
    return `${state[reg.startKey]}–${state[reg.endKey]}`;
  }
  return "";
}

function didRegChange(reg, current, prev) {
  if (reg.type === "range") {
    return current[reg.startKey] !== prev[reg.startKey] || current[reg.endKey] !== prev[reg.endKey];
  }
  return current[reg.key] !== prev[reg.key];
}

// Register value cell
function RegCell({ reg, state, prevState }) {
  const changed = didRegChange(reg, state, prevState);
  const value = formatRegValue(reg, state);
  const isBool = reg.type === "bool";
  const boolOn = isBool && state[reg.key];

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "3px 8px", borderRadius: 3,
      background: changed ? "#1a1a00" : "transparent",
      border: changed ? "1px solid #ffb800" : "1px solid transparent",
      boxShadow: changed ? "0 0 8px #ffb80044" : "none",
      transition: "all 0.2s",
    }}>
      <span style={{
        fontSize: 11, color: "#586e75",
        fontFamily: "'IBM Plex Mono', monospace",
      }}>{reg.label}</span>
      <span style={{
        fontSize: 12, fontWeight: 700,
        fontFamily: "'IBM Plex Mono', monospace",
        color: isBool ? (boolOn ? "#00ff66" : "#dc322f") : (changed ? "#ffb800" : "#c0d0c0"),
      }}>
        {isBool && (
          <span style={{
            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
            background: boolOn ? "#00ff66" : "#dc322f",
            marginRight: 5, verticalAlign: "middle",
            boxShadow: boolOn ? "0 0 6px #00ff6688" : "0 0 6px #dc322f88",
          }} />
        )}
        {value}
      </span>
    </div>
  );
}

// Memory budget data
const FLASH_TOTAL = 8192;
const RAM_TOTAL = 512;

const FLASH_FUNCTIONS = [
  { name: "i2c_init", size: 14 },
  { name: "i2c_start", size: 18 },
  { name: "i2c_stop", size: 16 },
  { name: "i2c_send_byte", size: 48 },
  { name: "font5x7", size: 95 },
  { name: "oled_init", size: 86 },
  { name: "oled_clear", size: 42 },
  { name: "oled_putc", size: 38 },
  { name: "oled_puts", size: 22 },
  { name: "oled_text", size: 28 },
  { name: "oled_set_cursor", size: 34 },
  { name: "main", size: 50, approx: true },
];

const PHASE_ACTIVE_FUNCTIONS = {
  INIT: ["oled_init", "i2c_start", "i2c_send_byte", "i2c_stop"],
  CLEAR: ["oled_clear", "i2c_start", "i2c_send_byte", "i2c_stop"],
  CURSOR: ["oled_set_cursor", "i2c_start", "i2c_send_byte", "i2c_stop"],
  TEXT: ["oled_putc", "font5x7", "i2c_start", "i2c_send_byte", "i2c_stop"],
};

const RAM_ITEMS = [
  { name: "Stack", size: 30, approx: true, note: "(grows down)" },
  { name: "cursor_col", size: 1 },
  { name: "cursor_page", size: 1 },
];

function MemoryProgressBar({ used, total, label }) {
  const pct = (used / total) * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#00ff66", letterSpacing: 1,
        marginBottom: 4,
      }}>{label}</div>
      <div style={{
        height: 10, background: "#1a2a1a", borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: "#00ff66",
          borderRadius: 4, transition: "width 0.3s",
          boxShadow: "0 0 6px #00ff6644",
        }} />
      </div>
    </div>
  );
}

function MemoryBudget({ currentPhase }) {
  const activeSet = new Set(PHASE_ACTIVE_FUNCTIONS[currentPhase] || []);
  const flashUsed = FLASH_FUNCTIONS.reduce((s, f) => s + f.size, 0);
  const ramUsed = RAM_ITEMS.reduce((s, f) => s + f.size, 0);
  const isText = currentPhase === "TEXT";

  // Split flash functions into two columns: left = i2c + font, right = oled + main
  const leftFns = FLASH_FUNCTIONS.filter(f =>
    f.name.startsWith("i2c_") || f.name === "font5x7"
  );
  const rightFns = FLASH_FUNCTIONS.filter(f =>
    !f.name.startsWith("i2c_") && f.name !== "font5x7"
  );
  const maxRows = Math.max(leftFns.length, rightFns.length);

  const fnStyle = (name) => ({
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', monospace",
    color: activeSet.has(name) ? "#00ff66" : "#3a5a3a",
    borderLeft: activeSet.has(name)
      ? `2px solid ${PHASE_COLORS[currentPhase] || "#586e75"}`
      : "2px solid transparent",
    paddingLeft: 6,
    padding: "1px 6px",
    transition: "all 0.2s",
  });

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
    }}>
      {/* Flash panel */}
      <div style={{
        background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
        padding: "10px 14px",
      }}>
        <MemoryProgressBar used={flashUsed} total={FLASH_TOTAL} label={`FLASH (${FLASH_TOTAL.toLocaleString()}B)`} />
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px",
        }}>
          {Array.from({ length: maxRows }).map((_, i) => {
            const lf = leftFns[i];
            const rf = rightFns[i];
            return [
              lf ? (
                <div key={`l-${lf.name}`} style={{ display: "flex", justifyContent: "space-between", ...fnStyle(lf.name) }}>
                  <span>{lf.name}:</span>
                  <span>{lf.approx ? "~" : ""}{lf.size}B</span>
                </div>
              ) : <div key={`l-empty-${i}`} />,
              rf ? (
                <div key={`r-${rf.name}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...fnStyle(rf.name) }}>
                  <span>{rf.name}:</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {rf.approx ? "~" : ""}{rf.size}B
                  </span>
                </div>
              ) : <div key={`r-empty-${i}`} />,
            ];
          })}
        </div>
        {isText && (
          <div style={{
            fontSize: 10, color: "#586e75", fontStyle: "italic",
            marginTop: 4, paddingLeft: 8,
          }}>
            font5x7 <span style={{ color: "#3a5a3a" }}>← pgm_read_byte()</span>
          </div>
        )}
        <div style={{
          fontSize: 10, color: "#586e75", marginTop: 8,
          borderTop: "1px solid #1a2a1a", paddingTop: 6,
        }}>
          Total: ~{flashUsed}B ({((flashUsed / FLASH_TOTAL) * 100).toFixed(1)}%)
          {" "} Remaining: {(FLASH_TOTAL - flashUsed).toLocaleString()}B
        </div>
      </div>

      {/* RAM panel */}
      <div style={{
        background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
        padding: "10px 14px",
      }}>
        <MemoryProgressBar used={ramUsed} total={RAM_TOTAL} label={`RAM (${RAM_TOTAL}B)`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {RAM_ITEMS.map(item => (
            <div key={item.name} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 11, color: "#c0d0c0", padding: "1px 6px",
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              <span>{item.name}:</span>
              <span style={{ color: "#586e75" }}>
                {item.approx ? "~" : ""}{item.size}B
                {item.note ? ` ${item.note}` : ""}
              </span>
            </div>
          ))}
        </div>
        <div style={{
          fontSize: 10, color: "#586e75", marginTop: 8,
          borderTop: "1px solid #1a2a1a", paddingTop: 6,
        }}>
          Used: ~{ramUsed}B ({((ramUsed / RAM_TOTAL) * 100).toFixed(1)}%)
          {" "} Remaining: ~{RAM_TOTAL - ramUsed}B
        </div>
        <div style={{
          fontSize: 9, color: "#3a5a3a", marginTop: 6, fontStyle: "italic",
        }}>
          Display GDDRAM: 1024B (in SSD1306, not MCU)
        </div>
      </div>
    </div>
  );
}

export default function OLEDSimulator() {
  const steps = useMemo(() => generateOLEDSteps(), []);

  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);

  // Compute SSD1306 state by applying steps 0..currentStep
  const ssd1306State = useMemo(() => {
    let state = createInitialState();
    for (let i = 0; i <= currentStep; i++) {
      state = applyStep(state, steps[i]);
    }
    return state;
  }, [steps, currentStep]);

  // Previous state for change detection
  const prevState = useMemo(() => {
    let state = createInitialState();
    for (let i = 0; i < currentStep; i++) {
      state = applyStep(state, steps[i]);
    }
    return state;
  }, [steps, currentStep]);

  const step = steps[currentStep];

  const goNext = useCallback(() => {
    setCurrentStep(s => Math.min(s + 1, steps.length - 1));
  }, [steps.length]);

  const goPrev = useCallback(() => {
    setCurrentStep(s => Math.max(s - 1, 0));
  }, []);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    if (currentStep >= steps.length - 1) { setPlaying(false); return; }
    const id = setTimeout(goNext, speed);
    return () => clearTimeout(id);
  }, [playing, currentStep, speed, goNext, steps.length]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  return (
    <div style={{
      background: "#070d07", color: "#c0d0c0", minHeight: "100vh",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header */}
      <div>
        <h1 style={{
          fontSize: 16, fontWeight: 800, color: "#00ff66", margin: 0, letterSpacing: 1.5,
          textShadow: "0 0 10px #00ff6644",
        }}>SSD1306 OLED ◆ COMMAND SIMULATOR</h1>
        <div style={{ fontSize: 10, color: "#3a5a3a", marginTop: 2 }}>
          Initialize, clear, and render text — step through every command
        </div>
      </div>

      {/* Phase + Step Description Panel */}
      <div style={{
        background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
        padding: "10px 14px",
      }}>
        {/* Top row: phase badge + step counter */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
          flexWrap: "wrap",
        }}>
          <div style={{
            background: (PHASE_COLORS[step.phase] || "#586e75") + "33",
            border: `1.5px solid ${PHASE_COLORS[step.phase] || "#586e75"}`,
            borderRadius: 4, padding: "2px 10px",
            fontSize: 12, fontWeight: 800, color: PHASE_COLORS[step.phase] || "#586e75",
            letterSpacing: 1.5, minWidth: 60, textAlign: "center",
            textShadow: `0 0 8px ${(PHASE_COLORS[step.phase] || "#586e75")}44`,
          }}>{step.phase}</div>
          <div style={{ flex: 1 }} />
          <div style={{
            fontSize: 11, color: "#586e75", whiteSpace: "nowrap",
          }}>Step {currentStep + 1} / {steps.length}</div>
        </div>

        {/* Step details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 12, color: "#c0d0c0" }}>
            <span style={{ color: "#586e75", fontWeight: 700, marginRight: 8 }}>What:</span>
            {step.name}
          </div>
          <div style={{ fontSize: 12, color: "#c0d0c0" }}>
            <span style={{ color: "#586e75", fontWeight: 700, marginRight: 8 }}>Hex:</span>
            <span style={{ color: "#00ccff" }}>{formatHex(step.hex)}</span>
          </div>
          <div style={{ fontSize: 12, color: "#c0d0c0" }}>
            <span style={{ color: "#586e75", fontWeight: 700, marginRight: 8 }}>Why:</span>
            <span style={{ color: "#93a1a1" }}>{step.why}</span>
          </div>
        </div>
      </div>

      {/* Memory Budget Panel */}
      <MemoryBudget currentPhase={step.phase} />

      {/* SSD1306 Register State Panel */}
      <div style={{
        background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
        padding: "10px 14px",
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: "#00ff66", letterSpacing: 1,
          marginBottom: 8,
        }}>SSD1306 REGISTER STATE</div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2px 16px",
        }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {LEFT_REGS.map(reg => (
              <RegCell key={reg.key} reg={reg} state={ssd1306State} prevState={prevState} />
            ))}
          </div>
          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {RIGHT_REGS.map(reg => (
              <RegCell key={reg.key || reg.label} reg={reg} state={ssd1306State} prevState={prevState} />
            ))}
          </div>
        </div>
      </div>

      {/* Step Controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#0a140a", border: "1px solid #1a2a1a", borderRadius: 6,
        padding: "8px 12px", flexWrap: "wrap", justifyContent: "center",
      }}>
        <button onClick={() => { setCurrentStep(0); setPlaying(false); }} style={btnStyle} title="Reset">⏮</button>
        <button onClick={goPrev} style={btnStyle} disabled={currentStep === 0} title="Previous (←)">◀</button>
        <button
          onClick={() => { if (currentStep >= steps.length - 1) setCurrentStep(0); setPlaying(p => !p); }}
          style={{
            ...btnStyle, width: 80,
            background: playing ? "#2a1a0a" : "#0a2a0a",
            border: `1.5px solid ${playing ? "#ffb800" : "#00ff66"}`,
            color: playing ? "#ffb800" : "#00ff66",
          }}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button onClick={goNext} style={btnStyle} disabled={currentStep >= steps.length - 1} title="Next (→ or Space)">▶</button>
        <button onClick={() => { setCurrentStep(steps.length - 1); setPlaying(false); }} style={btnStyle} title="End">⏭</button>

        <div style={{ width: 1, height: 24, background: "#1a2a1a", margin: "0 4px" }} />

        <label style={{ fontSize: 10, color: "#586e75", display: "flex", alignItems: "center", gap: 6 }}>
          Speed
          <input
            type="range" min={100} max={1500} step={50} value={1600 - speed}
            onChange={e => setSpeed(1600 - parseInt(e.target.value))}
            style={{ width: 80, accentColor: "#00ff66" }}
          />
        </label>

        <div style={{
          fontSize: 9, color: "#3a5a3a", marginLeft: 8,
        }}>← → or Space to step</div>
      </div>
    </div>
  );
}
