/*
 * ATtiny85 Bare Metal Blink + Button
 * Blink LED on PB3 (physical pin 2)
 * Button on PB4 (physical pin 3) with internal pull-up
 * 8MHz internal oscillator
 *
 * Timer interrupt blinks PB3 independently. Button input on PB4
 * with 50ms debounce controls speed of blinking. Both tasks
 * share the same 1ms timer ISR — cooperative multitasking.
 */

#include <avr/io.h>
#include <avr/interrupt.h>
#include "usi_i2c.h"
#include <util/delay.h>

#define BUTTON_PIN     PB4
#define LED_PIN        PB3

#define BLINK_DELAY_MS 500


void timer0_init(void)
{
    TCCR0A = (1 << WGM01);              // CTC mode
    TCCR0B = (1 << CS01) | (1 << CS00); // prescaler = 64
    OCR0A = 124;                        // compare value for 1ms
    TIMSK = (1 << OCIE0A);              // enable compare match A interrupt
    sei();                              // enable global interrupts
}

volatile uint16_t wait_time_ms = BLINK_DELAY_MS; // .5 second delay
volatile uint16_t debounce_time_ms = 50; // debounce time counter
volatile uint8_t button_pressed = 0; // button pressed flag
volatile uint8_t blink_speed = 0; // variable to control blink speed 0 = normal, 1 = fast


#define LED_ON()  __asm__ volatile("sbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN))
#define LED_OFF() __asm__ volatile("cbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN))

#define MAX_DEVICES 8

// Blink one bit: long flash = 1, short blip = 0
void blink_bit(uint8_t bit) {
    LED_ON();
    if (bit) {
        _delay_ms(400);  // long flash = 1
    } else {
        _delay_ms(80);   // short blip = 0
    }
    LED_OFF();
    _delay_ms(200);      // gap between bits
}

// Blink 8 bits of a byte, MSB first
void blink_byte(uint8_t byte) {
    for (int8_t i = 7; i >= 0; i--) {
        blink_bit((byte >> i) & 1);
    }
}

// Blink sync pattern: 00000000
void blink_sync(void) {
    blink_byte(0x00);
}

// Scan I2C bus and blink found addresses in binary
void scan_and_report(void) {
    uint8_t found[MAX_DEVICES];
    uint8_t count = 0;

    // Scan all valid addresses
    for (uint8_t address = 0x08; address <= 0x77; address++) {
        i2c_start();
        uint8_t ack = i2c_send_byte(address << 1);
        i2c_stop();
        if (ack && count < MAX_DEVICES) {
            found[count++] = address;
        }
    }

    // 2 second delay before start
    LED_OFF();
    _delay_ms(2000);

    // Sync: 00000000
    blink_sync();
    _delay_ms(800);

    // Blink each found address
    for (uint8_t i = 0; i < count; i++) {
        blink_byte(found[i]);
        _delay_ms(800);  // long pause between addresses
    }

    // End sync: 00000000
    blink_sync();

    // 2 second delay after end
    _delay_ms(2000);
}


int main(void)
{
    DDRB |= (1 << LED_PIN); // Set PB3 as output for LED control
    DDRB &= ~(1 << BUTTON_PIN); // Set PB as input for button
    PORTB |= (1 << BUTTON_PIN);  // Enable internal pull-up on button pin

    timer0_init(); // Initialize Timer0 for 1ms interrupts

    uint8_t led_on = 0;

    // Scan I2C bus and blink found addresses in binary
    i2c_init();
    scan_and_report();
    while (1)
    {
        cli();
        uint16_t current_wait_time = wait_time_ms; // Read the current wait time
        sei();

        if (current_wait_time == 0) {
            wait_time_ms = blink_speed ? BLINK_DELAY_MS / 2 : BLINK_DELAY_MS; // Reset to .5 second or .25 second based on blink speed
                                           // Toggle the LED using C register manipulation
            if (led_on) {
                LED_OFF();
                led_on = 0;
            } else {
                LED_ON();
                led_on = 1;
            }
        }

        // Set the button LED state based on the button pressed flag
        if (button_pressed == 1) {
            if (blink_speed == 0) {
                blink_speed = 1; // Set to fast blink
            }
        } else {
            if (blink_speed == 1) {
                blink_speed = 0; // Set to normal blink
            }
        }
        
    }
}


// Interrupt Service Routine (ISR) for Timer0 Compare Match A
ISR(TIMER0_COMPA_vect)
{
    // Manage wait time counter for LED blinking
    if (wait_time_ms > 0) {
        wait_time_ms--;
    }

    // Button debounce: only change state after 50ms of stable input
    if (!(PINB & (1 << BUTTON_PIN))) {
        // Pin is LOW — button pressed (active-low with pull-up)
        if (!button_pressed) {
            if (debounce_time_ms == 0) {
                button_pressed = 1;
                debounce_time_ms = 50; // Reset debounce time
            } else {
                debounce_time_ms--; // Decrement debounce timer
            }
        }
    } else {
        // Pin is HIGH — button released (pull-up)
        if (button_pressed) {
            if (debounce_time_ms == 0) {
                button_pressed = 0;
                debounce_time_ms = 50; // Reset debounce time
            } else {
                debounce_time_ms--; // Decrement debounce timer
            }
        }
    }
}
