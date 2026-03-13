/*
 * ATtiny85 OLED + BME280 Weather Display
 * I2C bus: PB0 (SDA), PB2 (SCL)
 * Button: PB4 (pin 3) — toggles display on/off
 * Devices: SSD1306 0.42" OLED @ 0x3C, BME280 @ 0x76
 * 8MHz internal oscillator
 *
 * Sleeps in power-down between readings. Watchdog wakes every ~8s,
 * counts to 37 (~5 min) then refreshes BME280. Button press toggles
 * display on/off via pin-change interrupt.
 */

#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>
#include <avr/wdt.h>
#include <util/delay.h>
#include "usi_i2c.h"
#include "ssd1306.h"
#include "bme280.h"

// ── Shared state (ISR ↔ main) ──

volatile uint8_t wdt_count = 0;
volatile uint8_t button_flag = 0;

// ── ISRs ──

ISR(WDT_vect)
{
    wdt_count++;
}

ISR(PCINT0_vect)
{
    button_flag = 1;
}

// ── Helpers ──

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
            for (uint8_t j = 0; j < i - 1; j++) {
                buf[j] = ' ';
            }
            if (neg && i >= 2) buf[i - 2] = '-';
            break;
        }
    }
    buf[len] = '\0';
}

static void take_and_display(char *line, uint8_t update_display)
{
    bme280_reading_t reading;
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
    int_to_str((int16_t)(reading.press_pa / 100), line, 4);
    line[4] = 'h';
    line[5] = 'P';
    line[6] = 'a';
    line[7] = '\0';
    oled_text(15, 3, line);

    (void)update_display;  // display RAM always updated; wake/sleep controls visibility
}

static void setup_watchdog(void)
{
    cli();
    wdt_reset();
    // Timed sequence: set WDCE+WDE, then write config within 4 cycles
    WDTCR = (1 << WDCE) | (1 << WDE);
    // Interrupt mode (no reset), ~8s timeout (WDP3:0 = 1001)
    WDTCR = (1 << WDIE) | (1 << WDP3) | (1 << WDP0);
    sei();
}

static void setup_button(void)
{
    // PB4 as input with pull-up
    DDRB &= ~(1 << PB4);
    PORTB |= (1 << PB4);

    // Enable pin-change interrupt on PCINT4
    GIMSK |= (1 << PCIE);
    PCMSK |= (1 << PCINT4);
}

static void enter_sleep(void)
{
    // Disable ADC to save power
    ADCSRA &= ~(1 << ADEN);

    set_sleep_mode(SLEEP_MODE_PWR_DOWN);
    sleep_enable();
    sei();
    sleep_cpu();
    // ... wakes here ...
    sleep_disable();

    // Re-enable ADC
    ADCSRA |= (1 << ADEN);
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
    uint8_t display_on = 0;

    // First reading, then sleep display
    take_and_display(line, 1);
    oled_sleep();

    setup_watchdog();
    setup_button();
    sei();

    while (1) {
        if (button_flag) {
            button_flag = 0;
            _delay_ms(50);  // debounce
            // Only toggle on actual press (PB4 low = pressed)
            if (!(PINB & (1 << PB4))) {
                display_on = !display_on;
                if (display_on) {
                    take_and_display(line, 1);
                    oled_wake();
                } else {
                    oled_sleep();
                }
            }
        }

        if (wdt_count >= 37) {
            wdt_count = 0;
            take_and_display(line, display_on);
        }

        if (display_on) {
            // Light sleep — stay responsive to button
            set_sleep_mode(SLEEP_MODE_IDLE);
            sleep_enable();
            sei();
            sleep_cpu();
            sleep_disable();
        } else {
            enter_sleep();  // deep power-down
        }
    }
}
