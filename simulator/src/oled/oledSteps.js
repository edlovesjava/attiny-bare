// Step definitions for SSD1306 OLED init, clear, cursor, and text rendering
import { fontGlyph } from './font5x7.js';
import { OLED_COL_OFF, OLED_COLS, OLED_PAGES } from './ssd1306State.js';

// Each step: { phase, hex, name, desc, why, changes }
export function generateOLEDSteps() {
  const steps = [];

  const add = (phase, hex, name, desc, why, changes) => {
    steps.push({ phase, hex, name, desc, why, changes });
  };

  // === INIT PHASE (16 commands) ===
  add('INIT', [0xAE], 'Display Off',
    'Turn display off during configuration',
    'Prevents glitches while registers are being set',
    { display_on: false });

  add('INIT', [0xD5, 0x80], 'Clock Divider',
    'Set oscillator frequency and divide ratio to defaults',
    'Default clock is fine for our low refresh rate',
    { clock_div: 0x80 });

  add('INIT', [0xA8, 0x27], 'MUX Ratio \u2192 39',
    'Set multiplex ratio to 40 rows (0x27 = 39)',
    'Display is 40px tall, not the default 64',
    { mux_ratio: 39 });

  add('INIT', [0xD3, 0x00], 'Display Offset \u2192 0',
    'No vertical shift of the display',
    'First row of RAM maps to first row of pixels',
    { display_offset: 0 });

  add('INIT', [0x40], 'Start Line \u2192 0',
    'Display starts at RAM row 0',
    'No scrolling offset needed',
    { start_line: 0 });

  add('INIT', [0x8D, 0x14], 'Charge Pump ON',
    'Enable internal DC-DC charge pump',
    'Display needs ~7V to drive OLEDs \u2014 charge pump generates it from 3.3V',
    { charge_pump: true });

  add('INIT', [0x20, 0x00], 'Horizontal Addressing',
    'Set horizontal addressing mode',
    'Column auto-increments, wraps to next page \u2014 ideal for streaming text',
    { addr_mode: 0x00 });

  add('INIT', [0xA1], 'Segment Remap',
    'Map column 127 to SEG0 (flip horizontal)',
    'Physical wiring of this display is mirrored \u2014 this corrects it',
    { seg_remap: true });

  add('INIT', [0xC8], 'COM Scan Reversed',
    'Scan COM from N-1 to 0 (flip vertical)',
    'Paired with segment remap to get correct orientation',
    { com_scan_dir: 0xC8 });

  add('INIT', [0xDA, 0x12], 'COM Pins Config',
    'Alternative COM pin configuration',
    'Matches the physical layout of this display panel',
    { com_pins: 0x12 });

  add('INIT', [0x81, 0xCF], 'Contrast \u2192 0xCF',
    'Set contrast to 207/255',
    'Good brightness without excessive current draw',
    { contrast: 0xCF });

  add('INIT', [0xD9, 0xF1], 'Precharge Period',
    'Set precharge to phase1=1, phase2=15',
    'Tuned for internal charge pump operation',
    { precharge: 0xF1 });

  add('INIT', [0xDB, 0x40], 'VCOMH Deselect',
    'Set VCOMH deselect level to ~0.89\u00D7VCC',
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
    'Configuration complete \u2014 display now showing RAM contents',
    { display_on: true });

  // === CLEAR PHASE (3 steps) ===
  add('CLEAR', [0x21, OLED_COL_OFF, OLED_COL_OFF + OLED_COLS - 1],
    'Set Column Window',
    `Set column address range: ${OLED_COL_OFF}\u2013${OLED_COL_OFF + OLED_COLS - 1}`,
    '72 visible columns sit at offset 28 in the 128-column address space',
    { col_start: OLED_COL_OFF, col_end: OLED_COL_OFF + OLED_COLS - 1, cursor_col: OLED_COL_OFF });

  add('CLEAR', [0x22, 0x00, OLED_PAGES - 1],
    'Set Page Window',
    `Set page address range: 0\u2013${OLED_PAGES - 1}`,
    '5 pages \u00D7 8 bits = 40 rows',
    { page_start: 0, page_end: OLED_PAGES - 1, cursor_page: 0 });

  add('CLEAR', ['DATA', '360\u00D7 0x00'],
    'Stream 360 Zero Bytes',
    'Fill 72 columns \u00D7 5 pages with 0x00 (all black)',
    'No frame buffer in MCU RAM \u2014 bytes stream directly over I2C to GDDRAM',
    { _action: 'clear_gddram', fill: 0x00 });

  // === CURSOR PHASE (2 steps) ===
  const textCol = 0;
  const textPage = 0;
  const textStr = '23.5';

  add('CURSOR', [0x21, OLED_COL_OFF + textCol, OLED_COL_OFF + OLED_COLS - 1],
    'Set Column Start',
    `Set column window: ${OLED_COL_OFF + textCol}\u2013${OLED_COL_OFF + OLED_COLS - 1}`,
    'Position cursor at pixel column 0 (display-relative)',
    { col_start: OLED_COL_OFF + textCol, col_end: OLED_COL_OFF + OLED_COLS - 1, cursor_col: OLED_COL_OFF + textCol });

  add('CURSOR', [0x22, textPage, OLED_PAGES - 1],
    'Set Page Start',
    `Set page window: ${textPage}\u2013${OLED_PAGES - 1}`,
    'Position cursor at page 0 (top of display)',
    { page_start: textPage, page_end: OLED_PAGES - 1, cursor_page: textPage });

  // === TEXT PHASE (4 steps, one per character in "23.5") ===
  for (const ch of textStr) {
    const glyph = fontGlyph(ch);
    const glyphHex = glyph
      ? glyph.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ')
      : '5\u00D7 0x00';

    add('TEXT', ['DATA', glyphHex, '0x00'],
      `putc('${ch}')`,
      `Read glyph '${ch}' from Flash, send 5 data bytes + 1 gap byte`,
      'Font data lives in PROGMEM \u2014 pgm_read_byte() fetches each column from Flash, not RAM',
      { _action: 'putc', char: ch, glyph: glyph || [0, 0, 0, 0, 0] });
  }

  return steps;
}
