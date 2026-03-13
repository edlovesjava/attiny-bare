#ifndef SSD1306_H
#define SSD1306_H

#include <stdint.h>

// 0.42" OLED: 72x40 pixels, SSD1306 controller at 0x3C
#define OLED_ADDR     0x3C
#define OLED_COLS     72
#define OLED_ROWS     40
#define OLED_PAGES    (OLED_ROWS / 8)   // 5
#define OLED_COL_OFF  28  // 72 cols sit at offset 28 in the 128-col driver space

void oled_init(void);
void oled_clear(uint8_t fill);
void oled_sleep(void);
void oled_wake(void);

// Set cursor position for text (col in pixels, page 0-4)
void oled_set_cursor(uint8_t col, uint8_t page);

// Draw a single character at current cursor position (advances cursor)
void oled_putc(char c);

// Draw a string at current cursor position
void oled_puts(const char *s);

// Draw a string at a specific position (col in pixels, page 0-4)
void oled_text(uint8_t col, uint8_t page, const char *s);

#endif
