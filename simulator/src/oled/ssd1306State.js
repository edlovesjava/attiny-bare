// SSD1306 display constants for 72x40 OLED module

export const OLED_COLS = 72;
export const OLED_ROWS = 40;
export const OLED_PAGES = 5;
export const OLED_COL_OFF = 28;
export const OLED_ADDR = 0x3C;

// Default state after power-on reset (datasheet defaults)
export function createInitialState() {
  return {
    display_on: false,
    clock_div: 0x80,
    mux_ratio: 63,
    display_offset: 0,
    start_line: 0,
    charge_pump: false,
    addr_mode: 0x02,
    seg_remap: false,
    com_scan_dir: 0,
    com_pins: 0x12,
    contrast: 0x7F,
    precharge: 0x22,
    vcomh: 0x20,
    output_follows_ram: true,
    inverted: false,
    col_start: 0,
    col_end: 127,
    page_start: 0,
    page_end: 7,
    cursor_col: 0,
    cursor_page: 0,
    gddram: new Uint8Array(128 * 8),
  };
}

// Apply a step to state, returning a new state object (immutable)
export function applyStep(state, step) {
  const changes = step.changes;
  if (!changes) return { ...state };

  // Clone state and gddram
  const next = { ...state, gddram: new Uint8Array(state.gddram) };

  if (changes._action === 'clear_gddram') {
    const fill = changes.fill || 0x00;
    for (let page = next.page_start; page <= next.page_end; page++) {
      for (let col = next.col_start; col <= next.col_end; col++) {
        next.gddram[page * 128 + col] = fill;
      }
    }
    next.cursor_col = next.col_start;
    next.cursor_page = next.page_start;
  } else if (changes._action === 'putc') {
    const glyph = changes.glyph;
    // Write 5 glyph bytes + 1 gap byte at cursor position
    for (let i = 0; i < 5; i++) {
      next.gddram[next.cursor_page * 128 + next.cursor_col] = glyph[i];
      next.cursor_col++;
    }
    // Gap byte
    next.gddram[next.cursor_page * 128 + next.cursor_col] = 0x00;
    next.cursor_col++;
  } else {
    // Regular register changes — merge into state
    for (const [key, value] of Object.entries(changes)) {
      next[key] = value;
    }
  }

  return next;
}
