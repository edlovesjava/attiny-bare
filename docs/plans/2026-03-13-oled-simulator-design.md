# SSD1306 OLED Simulator Design

**Date:** 2026-03-13
**Purpose:** Tutorial teaching tool — learners step through the SSD1306 init sequence, display clear, cursor positioning, and text rendering, seeing what each command does to the display controller state.

## Platform

New tab/view in the existing React simulator (`simulator/`). Same Vite app, consistent look and controls with the USI bit-level simulator.

## Core State Model

An `SSD1306State` object tracking:

- **Display registers:** addressing mode, mux ratio, display offset, contrast, charge pump, segment remap, COM scan direction, precharge, VCOMH, display on/off
- **Cursor:** current column, current page, column start/end, page start/end
- **Frame buffer:** `Uint8Array(128 × 8)` — full 128-column, 8-page GDDRAM (the controller's internal memory, even though only 72×40 is visible)
- A `step()` function that takes the next command/data byte and returns updated state + human-readable description

## Scripted Sequence (~58 steps)

1. **Init phase** — 13 commands from `oled_init()`
2. **Clear phase** — `oled_clear(0x00)`: sets addressing window, sends 360 zero bytes (represented as a batch)
3. **Cursor positioning** — `oled_set_cursor(col, page)`
4. **Text rendering** — `oled_text(0, 0, "23.5")`: sets cursor, sends font bytes for each character

### Step Script Structure

Steps defined as data, not code:

```js
const STEPS = [
  { phase: 'INIT', hex: [0xAE], name: 'Display Off',
    desc: 'Turn display off during configuration',
    register: 'display_on', before: true, after: false },
  { phase: 'INIT', hex: [0xD5, 0x80], name: 'Clock Divider',
    desc: 'Default oscillator frequency, divide ratio 1',
    register: 'clock_div', before: 0x00, after: 0x80 },
  // ... ~58 total steps
]
```

## Three-Layer Data Flow

The simulator makes visible the path data takes:

```
Flash (PROGMEM)  →  MCU RAM (working vars)  →  I2C bus  →  GDDRAM (display)
   font5x7              cursor_col/page          bytes        128×8 buffer
```

Key teaching point: "The display has 1KB of its own RAM. Your MCU has 512B. You can't buffer the screen — you stream to it."

## Memory Budget Panel

Persistent panel showing resource consumption, updated as each step executes.

### Flash (8,192 bytes)

```
[████████░░░░░░░░░░░░]
i2c_init:      14B    oled_init:     86B
i2c_start:     18B    oled_clear:    42B
i2c_stop:      16B    oled_putc:     38B
i2c_send_byte: 48B    oled_puts:     22B
font5x7:       95B    oled_text:     28B
                       main:         ~50B
Total: ~457B (5.6%)    Remaining: 7,735B
```

### RAM (512 bytes)

```
[██░░░░░░░░░░░░░░░░░░]
Stack:          ~30B   (grows down)
cursor_col:      1B    (volatile)
cursor_page:     1B    (volatile)
Remaining:    ~480B
```

### Behaviors

- Active function highlights in the flash breakdown as code executes
- Font reads briefly highlight `font5x7: 95B` with a "PROGMEM read" annotation
- RAM panel emphasizes how little RAM the driver uses — no frame buffer copy on the MCU side

## Page Map Grid

### Main View (page-column grid)

- 5 rows (pages 0–4) × 72 columns, matching the visible display area
- Each cell shows hex byte value (e.g. `7F`, `09`, `00`)
- Cells default to `00` (dark), updated cells get a brief highlight animation
- Current cursor position outlined/highlighted
- Column and page axis labels with SSD1306 offset (+28) shown subtly

### Pixel Preview (hover tooltip)

- Hover any byte cell → popup shows an 8-pixel-tall column with bits visualized
- LSB at top (matching SSD1306's layout — this surprises learners, worth calling out)
- Set bits shown as filled squares, cleared bits as empty
- Each bit labeled: "bit 0 (top) = 1, bit 1 = 1, ..."

### Text Rendering Visualization

- As `oled_putc('F')` executes, 5 byte cells fill left-to-right: `7F 09 09 09 01`
- 6th blank column (`00`) written as inter-character gap
- Cursor advances visibly
- Page boundary wraps show cursor jump with annotation: "Horizontal addressing mode wraps column → next page automatically"

## Step Controls

Reuse existing USI simulator patterns:

- **Arrow keys:** step forward/back
- **Play/pause** with speed slider
- **Step counter:** "Step 12 / 58"
- **Phase label:** "INIT", "CLEAR", "CURSOR", "TEXT"
- **Phase color coding** (same approach as USI sim)

### Step Detail Panel

Each step shows:

- **What:** `"Set MUX Ratio → 39 (40 rows)"` — plain English
- **Hex:** `0xA8, 0x27` — raw command bytes
- **Register change:** `mux_ratio: 63 → 39` — before/after
- **Why:** One-line explanation — `"Display is 40px tall, not the default 64"`

The "why" is the tutorial value — it turns a hex dump into understanding.

## Future Enhancements (parked)

- **I2C bus view:** Show raw I2C transactions (control byte 0x00/0x40, command bytes) alongside register state, connecting "bytes on the wire" to "what happens in the controller"
- **Free-run mode:** Feed arbitrary hex command sequences and see resulting display state — development/debugging tool without hardware
- **Phase grouping:** Group related commands into collapsible phases for higher-level overview
