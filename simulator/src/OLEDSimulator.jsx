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
