/*
 * ATtiny85 OLED + BME280 Weather Display
 * I2C bus: PB0 (SDA), PB2 (SCL)
 * Devices: SSD1306 0.42" OLED @ 0x3C, BME280 @ 0x76
 * 8MHz internal oscillator
 */

#include <avr/io.h>
#include "usi_i2c.h"
#include "ssd1306.h"
#include "bme280.h"
#include <util/delay.h>
#include <stdlib.h>

// Convert Celsius x100 to Fahrenheit x100
static int16_t c_to_f(int16_t c_x100)
{
    return (int16_t)(((int32_t)c_x100 * 9) / 5 + 3200);
}

// Format integer into string buffer (right-aligned, no leading zeros)
static void int_to_str(int16_t val, char *buf, uint8_t len)
{
    uint8_t neg = 0;
    if (val < 0) { neg = 1; val = -val; }

    for (uint8_t i = len; i > 0; i--) {
        buf[i - 1] = '0' + (val % 10);
        val /= 10;
        if (val == 0 && i > 1) {
            // Fill remaining with spaces
            for (uint8_t j = 0; j < i - 1; j++) {
                buf[j] = ' ';
            }
            if (neg && i >= 2) buf[i - 2] = '-';
            break;
        }
    }
    buf[len] = '\0';
}

int main(void)
{
    i2c_init();
    oled_init();
    oled_clear(0x00);

    if (!bme280_init()) {
        oled_text(6, 2, "NO BME");
        while (1);
    }

    char line[10];
    bme280_reading_t reading;

    while (1) {
        bme280_read(&reading);

        // Line 1: "75F 41%" (temp + humidity)
        int16_t temp_f = c_to_f(reading.temp_c_x100);
        int_to_str(temp_f / 100, line, 3);
        line[3] = 'F';
        line[4] = ' ';
        int_to_str(reading.hum_x100 / 100, &line[5], 3);
        line[8] = '%';
        line[9] = '\0';
        oled_text(6, 1, line);

        // Line 2: "1013hPa" centered
        // 7 chars × 6px = 42px, centered in 72px → col (72-42)/2 = 15
        int_to_str((int16_t)(reading.press_pa / 100), line, 4);
        line[4] = 'h';
        line[5] = 'P';
        line[6] = 'a';
        line[7] = '\0';
        oled_text(15, 3, line);

        _delay_ms(2000);  // update every 2 seconds
    }
}
