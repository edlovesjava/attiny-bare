/*
 * ATtiny85 Bare Metal Blink
 * LED on PB3 (physical pin 2)
 * 8MHz internal oscillator
 */

#include <avr/io.h>
#include <avr/interrupt.h>

#define LED_PIN PB3
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

int main(void)
{
    /* Set PB3 as output */
    DDRB |= (1 << LED_PIN);

    timer0_init(); // Initialize Timer0 for 1ms interrupts

    uint8_t led_on = 0;

    while (1)
    {
        cli();
        uint16_t current_wait_time = wait_time_ms; // Read the current wait time
        sei();
        if (current_wait_time == 0)
        {
            wait_time_ms = BLINK_DELAY_MS; // Reset to .5 second
                                           // Toggle the LED using C register manipulation
            if (led_on)
            {
                // Turn LED OFF
                // also can be done with: PORTB &= ~(1 << LED_PIN);
                __asm__ volatile("cbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN)); // Turn LED OFF
                led_on = 0;
            }
            else
            {
                // Turn LED ON
                // also can be done with: PORTB |= (1 << LED_PIN);
                __asm__ volatile("sbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN)); // Turn LED ON
                led_on = 1;
            }
        }
    }
}

// Interrupt Service Routine (ISR) for Timer0 Compare Match A
ISR(TIMER0_COMPA_vect)
{
    // decrement the wait time
    if (wait_time_ms > 0) {
        wait_time_ms--;
    }
}