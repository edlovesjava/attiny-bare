# SSD1306 OLED Simulator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an OLED simulator tab to the existing React simulator that steps through SSD1306 init, clear, cursor, and text rendering — showing register state, memory budget, and a page map grid with pixel preview.

**Architecture:** New React component (`OLEDSimulator.jsx`) alongside existing `USISimulator.jsx`. A top-level `App.jsx` with tab switching replaces the direct `USISimulator` render in `main.jsx`. The OLED sim uses a data-driven step array and a pure state-reducer for the SSD1306 controller.

**Tech Stack:** React 19, Vite, same styling patterns as `USISimulator.jsx` (inline styles, IBM Plex Mono, green-on-dark theme).

---

### Task 1: App Shell with Tab Navigation

**Files:**
- Create: `simulator/src/App.jsx`
- Modify: `simulator/src/main.jsx`

**Step 1: Create `App.jsx` with tab switching**

```jsx
// simulator/src/App.jsx
import { useState } from "react";
import USISimulator from "./USISimulator.jsx";
import OLEDSimulator from "./OLEDSimulator.jsx";

const TABS = [
  { id: "usi", label: "USI I2C" },
  { id: "oled", label: "SSD1306 OLED" },
];

const tabStyle = (active) => ({
  background: active ? "#0a2a0a" : "#0a140a",
  border: `1.5px solid ${active ? "#00ff66" : "#2a3a2a"}`,
  borderBottom: active ? "1.5px solid #0a2a0a" : "1.5px solid #2a3a2a",
  borderRadius: "6px 6px 0 0",
  color: active ? "#00ff66" : "#586e75",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
  fontWeight: active ? 700 : 400,
  letterSpacing: 1,
  padding: "6px 16px",
  cursor: "pointer",
  transition: "all 0.15s",
});

export default function App() {
  const [tab, setTab] = useState("usi");

  return (
    <div style={{ background: "#070d07", minHeight: "100vh" }}>
      <div style={{
        display: "flex", gap: 4, padding: "8px 16px 0",
        borderBottom: "1.5px solid #2a3a2a",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "usi" ? <USISimulator /> : <OLEDSimulator />}
    </div>
  );
}
```

**Step 2: Update `main.jsx` to render `App`**

Replace the `USISimulator` import/render with `App`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Step 3: Create stub `OLEDSimulator.jsx`**

```jsx
// simulator/src/OLEDSimulator.jsx
export default function OLEDSimulator() {
  return (
    <div style={{
      color: "#c0d0c0", padding: "12px 16px",
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <h1 style={{ fontSize: 16, color: "#00ff66", fontWeight: 800, letterSpacing: 1.5 }}>
        SSD1306 OLED ◆ COMMAND SIMULATOR
      </h1>
      <div style={{ fontSize: 11, color: "#586e75", marginTop: 4 }}>
        Coming soon...
      </div>
    </div>
  );
}
```

**Step 4: Update `index.html` title**

Change title from "ATtiny85 USI I2C Simulator" to "ATtiny85 Simulator".

**Step 5: Verify**

Run: `cd simulator && npm run dev`
Expected: App loads, two tabs visible, can switch between USI and OLED stub.

**Step 6: Commit**

```bash
git add simulator/src/App.jsx simulator/src/OLEDSimulator.jsx simulator/src/main.jsx simulator/index.html
git commit -m "Add tab navigation and OLED simulator stub"
```

---

### Task 2: SSD1306 State Model and Step Data

**Files:**
- Create: `simulator/src/oled/ssd1306State.js`
- Create: `simulator/src/oled/oledSteps.js`
- Create: `simulator/src/oled/font5x7.js`

**Step 1: Create font data module**

Port the font table from `font5x7.h` to JavaScript. Same byte values, same index mapping.

```js
// simulator/src/oled/font5x7.js

export const FONT_DATA = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
  '0': [0x3E, 0x51, 0x49, 0x45, 0x3E],
  '1': [0x00, 0x42, 0x7F, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4B, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7F, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3C, 0x4A, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1E],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  '°': [0x00, 0x06, 0x09, 0x09, 0x06],
  'F': [0x7F, 0x09, 0x09, 0x09, 0x01],
  'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
  '%': [0x23, 0x13, 0x08, 0x64, 0x62],
  'h': [0x7F, 0x08, 0x08, 0x08, 0x70],
  'P': [0x7F, 0x09, 0x09, 0x09, 0x06],
  'a': [0x20, 0x54, 0x54, 0x54, 0x78],
};

// Returns 5-byte glyph array or null
export function fontGlyph(c) {
  return FONT_DATA[c] || null;
}
```

**Step 2: Create SSD1306 state model**

```js
// simulator/src/oled/ssd1306State.js

// Display constants
export const OLED_COLS = 72;
export const OLED_ROWS = 40;
export const OLED_PAGES = 5;
export const OLED_COL_OFF = 28;
export const OLED_ADDR = 0x3C;

// Default state after power-on reset (datasheet defaults)
export function createInitialState() {
  return {
    display_on: false,
    clock_div: 0x80,       // default per datasheet
    mux_ratio: 63,         // default: 64 rows
    display_offset: 0,
    start_line: 0,
    charge_pump: false,
    addr_mode: 0x02,       // default: page addressing
    seg_remap: false,       // default: col 0 = SEG0
    com_scan_dir: 0,        // default: normal (0 to N-1)
    com_pins: 0x12,
    contrast: 0x7F,         // default
    precharge: 0x22,        // default
    vcomh: 0x20,            // default
    output_follows_ram: true,
    inverted: false,
    // Addressing window
    col_start: 0,
    col_end: 127,
    page_start: 0,
    page_end: 7,
    // Cursor (internal pointer)
    cursor_col: 0,
    cursor_page: 0,
    // GDDRAM: 128 columns × 8 pages
    gddram: new Uint8Array(128 * 8),
  };
}
```

**Step 3: Create step definitions**

```js
// simulator/src/oled/oledSteps.js
import { fontGlyph } from './font5x7.js';
import { OLED_COL_OFF, OLED_COLS, OLED_PAGES } from './ssd1306State.js';

// Each step: { phase, hex, name, desc, why, apply(state) → mutates state }
export function generateOLEDSteps() {
  const steps = [];

  // Helper: add a step
  const add = (phase, hex, name, desc, why, changes) => {
    steps.push({ phase, hex, name, desc, why, changes });
  };

  // === INIT PHASE ===
  add('INIT', [0xAE], 'Display Off',
    'Turn display off during configuration',
    'Prevents glitches while registers are being set',
    { display_on: false });

  add('INIT', [0xD5, 0x80], 'Clock Divider',
    'Set oscillator frequency and divide ratio to defaults',
    'Default clock is fine for our low refresh rate',
    { clock_div: 0x80 });

  add('INIT', [0xA8, 0x27], 'MUX Ratio → 39',
    'Set multiplex ratio to 40 rows (0x27 = 39)',
    'Display is 40px tall, not the default 64',
    { mux_ratio: 39 });

  add('INIT', [0xD3, 0x00], 'Display Offset → 0',
    'No vertical shift of the display',
    'First row of RAM maps to first row of pixels',
    { display_offset: 0 });

  add('INIT', [0x40], 'Start Line → 0',
    'Display starts at RAM row 0',
    'No scrolling offset needed',
    { start_line: 0 });

  add('INIT', [0x8D, 0x14], 'Charge Pump ON',
    'Enable internal DC-DC charge pump',
    'Display needs ~7V to drive OLEDs — charge pump generates it from 3.3V',
    { charge_pump: true });

  add('INIT', [0x20, 0x00], 'Horizontal Addressing',
    'Set horizontal addressing mode',
    'Column auto-increments, wraps to next page — ideal for streaming text',
    { addr_mode: 0x00 });

  add('INIT', [0xA1], 'Segment Remap',
    'Map column 127 to SEG0 (flip horizontal)',
    'Physical wiring of this display is mirrored — this corrects it',
    { seg_remap: true });

  add('INIT', [0xC8], 'COM Scan Reversed',
    'Scan COM from N-1 to 0 (flip vertical)',
    'Paired with segment remap to get correct orientation',
    { com_scan_dir: 0xC8 });

  add('INIT', [0xDA, 0x12], 'COM Pins Config',
    'Alternative COM pin configuration',
    'Matches the physical layout of this display panel',
    { com_pins: 0x12 });

  add('INIT', [0x81, 0xCF], 'Contrast → 0xCF',
    'Set contrast to 207/255',
    'Good brightness without excessive current draw',
    { contrast: 0xCF });

  add('INIT', [0xD9, 0xF1], 'Precharge Period',
    'Set precharge to phase1=1, phase2=15',
    'Tuned for internal charge pump operation',
    { precharge: 0xF1 });

  add('INIT', [0xDB, 0x40], 'VCOMH Deselect',
    'Set VCOMH deselect level to ~0.89×VCC',
    'Higher deselect level improves display contrast',
    { vcomh: 0x40 });

  add('INIT', [0xA4], 'Output Follows RAM',
    'Display output follows GDDRAM content',
    'As opposed to "entire display on" test mode',
    { output_follows_ram: true });

  add('INIT', [0xA6], 'Normal Display',
    'Normal display (not inverted)',
    '0 in RAM = pixel off, 1 = pixel on',
    { inverted: false });

  add('INIT', [0xAF], 'Display ON',
    'Turn the display on',
    'Configuration complete — display now showing RAM contents',
    { display_on: true });

  // === CLEAR PHASE ===
  add('CLEAR', [0x21, OLED_COL_OFF, OLED_COL_OFF + OLED_COLS - 1],
    'Set Column Window',
    `Set column address range: ${OLED_COL_OFF}–${OLED_COL_OFF + OLED_COLS - 1}`,
    '72 visible columns sit at offset 28 in the 128-column address space',
    { col_start: OLED_COL_OFF, col_end: OLED_COL_OFF + OLED_COLS - 1, cursor_col: OLED_COL_OFF });

  add('CLEAR', [0x22, 0x00, OLED_PAGES - 1],
    'Set Page Window',
    `Set page address range: 0–${OLED_PAGES - 1}`,
    '5 pages × 8 bits = 40 rows',
    { page_start: 0, page_end: OLED_PAGES - 1, cursor_page: 0 });

  add('CLEAR', ['DATA', '360× 0x00'],
    'Stream 360 Zero Bytes',
    'Fill 72 columns × 5 pages with 0x00 (all black)',
    'No frame buffer in MCU RAM — bytes stream directly over I2C to GDDRAM',
    { _action: 'clear_gddram', fill: 0x00 });

  // === CURSOR PHASE ===
  const textCol = 0;
  const textPage = 0;
  const textStr = "23.5";

  add('CURSOR', [0x21, OLED_COL_OFF + textCol, OLED_COL_OFF + OLED_COLS - 1],
    'Set Column Start',
    `Set column window: ${OLED_COL_OFF + textCol}–${OLED_COL_OFF + OLED_COLS - 1}`,
    'Position cursor at pixel column 0 (display-relative)',
    { col_start: OLED_COL_OFF + textCol, col_end: OLED_COL_OFF + OLED_COLS - 1, cursor_col: OLED_COL_OFF + textCol });

  add('CURSOR', [0x22, textPage, OLED_PAGES - 1],
    'Set Page Start',
    `Set page window: ${textPage}–${OLED_PAGES - 1}`,
    'Position cursor at page 0 (top of display)',
    { page_start: textPage, page_end: OLED_PAGES - 1, cursor_page: textPage });

  // === TEXT PHASE ===
  for (const ch of textStr) {
    const glyph = fontGlyph(ch);
    const glyphHex = glyph ? glyph.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ') : '5× 0x00';

    add('TEXT', ['DATA', glyphHex, '0x00'],
      `putc('${ch}')`,
      `Read glyph '${ch}' from Flash, send 5 data bytes + 1 gap byte`,
      `Font data lives in PROGMEM — pgm_read_byte() fetches each column from Flash, not RAM`,
      { _action: 'putc', char: ch, glyph: glyph || [0,0,0,0,0] });
  }

  return steps;
}
```

**Step 4: Verify**

Run: `cd simulator && npm run dev`
Expected: No build errors. OLED tab still shows stub (steps not wired yet).

**Step 5: Commit**

```bash
git add simulator/src/oled/
git commit -m "Add SSD1306 state model, step definitions, and font data"
```

---

### Task 3: Step Controls and Register State Panel

**Files:**
- Modify: `simulator/src/OLEDSimulator.jsx`

**Step 1: Wire up step navigation and state reducer**

Build the main `OLEDSimulator` component with:
- Step state (index into steps array)
- SSD1306 state computed by applying steps 0..currentStep
- Keyboard navigation (arrow keys, space)
- Play/pause with speed slider
- Phase label + step counter
- Step detail panel (what, hex, register change, why)

Follow the same control layout as `USISimulator.jsx` (reuse `btnStyle` pattern).

**Step 2: Add SSD1306 register state panel**

Show current values of all display registers in a grid:
- addressing_mode, mux_ratio, display_offset, contrast
- charge_pump, seg_remap, com_scan_dir, display_on
- Highlight registers that changed on the current step

Use the same `BitBox`-style visual for on/off registers, and hex values for numeric ones.

**Step 3: Verify**

Run: `cd simulator && npm run dev`
Expected: OLED tab shows step controls, can step through init commands, register values update and highlight on change.

**Step 4: Commit**

```bash
git add simulator/src/OLEDSimulator.jsx
git commit -m "Add OLED step controls and register state panel"
```

---

### Task 4: Memory Budget Panel

**Files:**
- Modify: `simulator/src/OLEDSimulator.jsx`

**Step 1: Add MemoryBudget component**

Persistent panel showing Flash (8192B) and RAM (512B) usage:
- Flash breakdown: function sizes (approximate from real build), font table
- RAM breakdown: stack, cursor variables
- Progress bar visualization
- Active function highlights based on current step phase
- "PROGMEM read" annotation during TEXT phase

Use approximate sizes from actual compiled output:
- i2c_init: 14B, i2c_start: 18B, i2c_stop: 16B, i2c_send_byte: 48B
- oled_init: 86B, oled_clear: 42B, oled_putc: 38B, oled_puts: 22B, oled_text: 28B
- font5x7: 95B, main: ~50B

**Step 2: Verify**

Run: `cd simulator && npm run dev`
Expected: Memory panel visible, active function highlights as steps progress, PROGMEM annotation appears during text rendering.

**Step 3: Commit**

```bash
git add simulator/src/OLEDSimulator.jsx
git commit -m "Add memory budget panel with flash/RAM breakdown"
```

---

### Task 5: Page Map Grid

**Files:**
- Modify: `simulator/src/OLEDSimulator.jsx`

**Step 1: Add PageMapGrid component**

72-column × 5-row grid showing GDDRAM state:
- Each cell shows hex byte value (compact, ~20px wide)
- Cells default to `00`, highlight briefly when written
- Current cursor position gets a distinct outline
- Column axis labels (0, 10, 20, ... 70) and page axis labels (P0–P4)
- Offset annotation showing +28 for internal addressing

The grid should scroll horizontally if it overflows the viewport (72 columns of ~20px = 1440px).

**Step 2: Wire grid to state**

After each step, recalculate the GDDRAM slice (columns 28–99, pages 0–4) from the state model and pass to the grid. Track which cells changed on the current step for highlight animation.

**Step 3: Verify**

Run: `cd simulator && npm run dev`
Expected: Grid visible. During CLEAR phase, all cells go to 00. During TEXT phase, glyph bytes appear left-to-right. Cursor position visible.

**Step 4: Commit**

```bash
git add simulator/src/OLEDSimulator.jsx
git commit -m "Add page map grid showing GDDRAM state"
```

---

### Task 6: Pixel Preview Tooltip

**Files:**
- Modify: `simulator/src/OLEDSimulator.jsx`

**Step 1: Add PixelPreview tooltip component**

On hover of any grid cell, show a popup with:
- 8-pixel-tall vertical column visualization
- Filled squares for set bits, empty for cleared
- LSB at top (matching SSD1306 layout)
- Bit labels: "bit 0 (top)" through "bit 7 (bottom)"
- Hex value and binary representation
- Note: "LSB = top row — SSD1306 maps bit 0 to the top pixel of each page"

Position the tooltip above or below the hovered cell, staying within viewport.

**Step 2: Verify**

Run: `cd simulator && npm run dev`
Expected: Hovering a glyph byte (e.g. 0x7F during 'F' rendering) shows 7 filled pixels + 1 empty. LSB-at-top layout is clearly shown.

**Step 3: Commit**

```bash
git add simulator/src/OLEDSimulator.jsx
git commit -m "Add pixel preview tooltip on page map grid hover"
```

---

### Task 7: Polish and Build Verification

**Files:**
- Modify: `simulator/src/OLEDSimulator.jsx` (if needed)

**Step 1: Visual consistency pass**

- Verify color scheme matches USI simulator (green-on-dark, same accent colors)
- Phase colors for OLED: INIT=#6c71c4, CLEAR=#dc322f, CURSOR=#b58900, TEXT=#268bd2
- Font consistency: IBM Plex Mono throughout
- Responsive: panels stack vertically on narrow viewports

**Step 2: Production build**

Run: `cd simulator && npm run build`
Expected: Build succeeds with no errors or warnings.

**Step 3: Test the built output**

Run: `cd simulator && npm run preview`
Expected: Both tabs work correctly in production build.

**Step 4: Commit**

```bash
git add simulator/
git commit -m "Polish OLED simulator styling and verify production build"
```
