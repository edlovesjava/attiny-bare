/*
 * ATtiny85 Bare Metal Blink
 * LED on PB3 (physical pin 2)
 * 8MHz internal oscillator
 */

#include <avr/io.h>
#include <avr/interrupt.h>

#define BUTTON_PIN     PB0
#define LED_PIN        PB3
#define BUTTON_LED_PIN PB4

#define BLINK_DELAY_MS 500


void timer0_init(void)
{
    TCCR0A = (1 << WGM01);              // CTC mode
    TCCR0B = (1 << CS01) | (1 << CS00); // prescaler = 64
    OCR0A = 124;                        // compare value
    TIMSK = (1 << OCIE0A);              // enable compare match A interrupt
    sei();                              // enable global interrupts
}

volatile uint16_t wait_time_ms = BLINK_DELAY_MS; // .5 second delay
volatile uint16_t debounce_time_ms = 50; // debounce time counter
volatile uint8_t button_pressed = 0; // button pressed flag

int main(void)
{
    DDRB |= (1 << LED_PIN); // Set PB3 as output for LED control
    DDRB |= (1 << BUTTON_LED_PIN); // Set PB4 as output for button state indication
    DDRB &= ~(1 << BUTTON_PIN); // Set PB0 as input for button

    PORTB |= (1 << BUTTON_PIN);  // Enable internal pull-up on button pin

    timer0_init(); // Initialize Timer0 for 1ms interrupts

    uint8_t led_on = 0;

    while (1)
    {
        cli();
        uint16_t current_wait_time = wait_time_ms; // Read the current wait time
        sei();

        if (current_wait_time == 0) {
            wait_time_ms = BLINK_DELAY_MS; // Reset to .5 second
                                           // Toggle the LED using C register manipulation
            if (led_on) {
                // Turn LED OFF
                // also can be done with: PORTB &= ~(1 << LED_PIN);
                __asm__ volatile("cbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN)); // Turn LED OFF
                led_on = 0;
            } else {
                // Turn LED ON
                // also can be done with: PORTB |= (1 << LED_PIN);
                __asm__ volatile("sbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN)); // Turn LED ON
                led_on = 1;
            }
        }

        // set the buttton LED state based on the button pressed flag
        if (button_pressed == 1) {
            PORTB |= (1 << BUTTON_LED_PIN); // Turn button LED ON
        } else {
            PORTB &= ~(1 << BUTTON_LED_PIN); // Turn button LED OFF
        }
    }
}

// Interrupt Service Routine (ISR) for Timer0 Compare Match A
ISR(TIMER0_COMPA_vect)
{
    // manage wait time counter for LED blinking
    // decrement the wait time
    if (wait_time_ms > 0) {
        wait_time_ms--;
    }

    if (!(PINB & (1 << BUTTON_PIN))) {
        if (!button_pressed) {
            if( debounce_time_ms == 0) {
                // Button is pressed, turn on the button LED
                button_pressed = 1;
                debounce_time_ms = 50; // Reset debounce time
            } else  {
                debounce_time_ms--; // Decrement debounce timer
            }
        }

    } else {
        if (button_pressed) {
            if( debounce_time_ms == 0) {
                button_pressed = 0;
                debounce_time_ms = 50; // Reset debounce time
            } else {
                debounce_time_ms--; // Decrement debounce timer
            }
        }
    }


}