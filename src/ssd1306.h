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

#endif
