/*
 * ATtiny85 OLED Display Test
 * I2C OLED on PB0 (SDA) / PB2 (SCL)
 * 8MHz internal oscillator
 */

#include <avr/io.h>
#include "usi_i2c.h"
#include "ssd1306.h"
#include <util/delay.h>

int main(void)
{
    // Initialize I2C and OLED
    i2c_init();
    oled_init();

    // Fill white, pause, then draw text on black
    oled_clear(0xFF);
    _delay_ms(1000);
    oled_clear(0x00);
    oled_text(6, 2, "75\xB0""F");  // page 2 = middle, col 6 to avoid left cutoff

    while (1) {
        // nothing for now
    }
}
