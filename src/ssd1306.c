/*
 * ssd1306.c
 * Minimal SSD1306 OLED driver for 0.42" 72x40 display
 * Uses USI I2C master driver (usi_i2c.h)
 */

#include "ssd1306.h"
#include "usi_i2c.h"
#include "font5x7.h"
#include <avr/pgmspace.h>

// Send a single command byte
static void oled_cmd(uint8_t c)
{
    i2c_start();
    i2c_send_byte(OLED_ADDR << 1);  // address + write
    i2c_send_byte(0x00);            // control: command
    i2c_send_byte(c);
    i2c_stop();
}

// Send a command byte followed by one argument
static void oled_cmd2(uint8_t c, uint8_t arg)
{
    i2c_start();
    i2c_send_byte(OLED_ADDR << 1);
    i2c_send_byte(0x00);
    i2c_send_byte(c);
    i2c_send_byte(arg);
    i2c_stop();
}

void oled_init(void)
{
    oled_cmd (0xAE);        // display off
    oled_cmd2(0xD5, 0x80);  // clock divider
    oled_cmd2(0xA8, 0x27);  // mux ratio: 40 rows (0x27 = 39)
    oled_cmd2(0xD3, 0x00);  // display offset 0
    oled_cmd (0x40);        // start line 0
    oled_cmd2(0x8D, 0x14);  // charge pump on (internal VCC)
    oled_cmd2(0x20, 0x00);  // horizontal addressing mode
    oled_cmd (0xA1);        // segment remap (flip horizontal)
    oled_cmd (0xC8);        // COM scan reversed (flip vertical)
    oled_cmd2(0xDA, 0x12);  // COM pins: alternative config
    oled_cmd2(0x81, 0xCF);  // contrast
    oled_cmd2(0xD9, 0xF1);  // precharge period
    oled_cmd2(0xDB, 0x40);  // VCOMH deselect level
    oled_cmd (0xA4);        // output follows RAM
    oled_cmd (0xA6);        // normal display (not inverted)
    oled_cmd (0xAF);        // display on
}

void oled_sleep(void) { oled_cmd(0xAE); }
void oled_wake(void)  { oled_cmd(0xAF); }

void oled_clear(uint8_t fill)
{
    // Set column address window: 28–99
    i2c_start();
    i2c_send_byte(OLED_ADDR << 1);
    i2c_send_byte(0x00);                        // control: command
    i2c_send_byte(0x21);                         // set column address
    i2c_send_byte(OLED_COL_OFF);                 // start = 28
    i2c_send_byte(OLED_COL_OFF + OLED_COLS - 1); // end = 99
    i2c_stop();

    // Set page address window: 0–4
    i2c_start();
    i2c_send_byte(OLED_ADDR << 1);
    i2c_send_byte(0x00);
    i2c_send_byte(0x22);                         // set page address
    i2c_send_byte(0x00);                         // start = 0
    i2c_send_byte(OLED_PAGES - 1);               // end = 4
    i2c_stop();

    // Stream fill byte: 72 x 5 = 360 bytes
    i2c_start();
    i2c_send_byte(OLED_ADDR << 1);
    i2c_send_byte(0x40);                         // control: data
    for (uint16_t i = 0; i < OLED_COLS * OLED_PAGES; i++) {
        i2c_send_byte(fill);
    }
    i2c_stop();
}

void oled_set_cursor(uint8_t col, uint8_t page)
{
    // Set column address window
    i2c_start();
    i2c_send_byte(OLED_ADDR << 1);
    i2c_send_byte(0x00);
    i2c_send_byte(0x21);                         // set column address
    i2c_send_byte(OLED_COL_OFF + col);           // start
    i2c_send_byte(OLED_COL_OFF + OLED_COLS - 1); // end (allow wrapping)
    i2c_stop();

    // Set page address
    i2c_start();
    i2c_send_byte(OLED_ADDR << 1);
    i2c_send_byte(0x00);
    i2c_send_byte(0x22);                         // set page address
    i2c_send_byte(page);                         // start
    i2c_send_byte(OLED_PAGES - 1);               // end
    i2c_stop();
}

void oled_putc(char c)
{
    const uint8_t *glyph = font_glyph(c);

    i2c_start();
    i2c_send_byte(OLED_ADDR << 1);
    i2c_send_byte(0x40);                         // control: data

    if (glyph) {
        for (uint8_t i = 0; i < 5; i++) {
            i2c_send_byte(pgm_read_byte(&glyph[i]));
        }
    } else {
        for (uint8_t i = 0; i < 5; i++) {
            i2c_send_byte(0x00);
        }
    }
    i2c_send_byte(0x00);                         // 1px gap between chars

    i2c_stop();
}

void oled_puts(const char *s)
{
    while (*s) {
        oled_putc(*s++);
    }
}

void oled_text(uint8_t col, uint8_t page, const char *s)
{
    oled_set_cursor(col, page);
    oled_puts(s);
}
