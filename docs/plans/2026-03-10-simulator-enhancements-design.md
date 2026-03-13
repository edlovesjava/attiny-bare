# USI Simulator Enhancements Design

**Date:** 2026-03-10
**Status:** Approved

## Goal

Enhance the USI I2C simulator with an intro panel, richer step descriptions, and a clipboard-based bridge so Claude can answer contextual questions about any step.

## Changes

### 1. Collapsible Help Panel

A `<HelpPanel>` component at the top of `USISimulator`. Expanded by default, toggleable. Four subsections:

- **Oscilloscope** — SDA (green) / SCL (blue), HIGH = top, LOW = bottom, yellow marker = current step
- **Registers** — USIDR (shift register), USISR (status + counter), USICR (control). Glowing bits = changed this step.
- **Phases** — Color legend for IDLE, INIT, START, ADDR, DATA, ACK, STOP
- **Controls** — ← → Space to step, Play/Pause, speed slider, begin/end buttons

### 2. Two-Tier Step Descriptions

- Keep existing terse `desc` as the headline
- Add `anchor` field to each step (kebab-case, e.g. `"start-sda-fall"`)
- "Learn more" link next to description opens `guide.html#<anchor>` in new tab
- ~30-40 distinct anchors (clock steps share anchors like `addr-clock-rising`)

### 3. Copy State for Claude

Button in the controls bar copies a text block to clipboard:

```
USI Simulator — Step 5/42 [START]
SCL=HIGH  SDA=LOW  SDA_DIR=OUTPUT
USIDR=0xFF  USISR=0x80  USICR=0x2A
> PORTB.SDA ← 0 → SDA falls while SCL=HIGH (START!)
Paste this into Claude Code and ask your question.
```

### 4. guide.html

Static page in `simulator/public/`. Dark terminal aesthetic matching the simulator. Organized by phase, each section covers:

- What the hardware is physically doing
- Which registers change and why
- Common mistakes or misunderstandings
- Connection to the C code the learner will write

## Files Changed

- `simulator/src/USISimulator.jsx` — add HelpPanel, anchor fields, copy-state button
- `simulator/public/guide.html` — new static reference page

## Future

- Migrate guide.html content to `docs/` as markdown (anchors stay the same)
- Potential MCP bridge for direct Claude ↔ simulator communication
