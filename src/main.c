/*
 * ATtiny85 Bare Metal Blink — Busy Wait
 * LED on PB3 (physical pin 2)
 * 8MHz internal oscillator
 *
 * Simple delay-based blink using _delay_ms().
 * The CPU spins in a tight loop during each delay —
 * it can't do anything else while waiting.
 */

#include <avr/io.h>
#include <util/delay.h>

#define LED_PIN PB3
#define BLINK_DELAY_MS 500

int main(void)
{
    /* Set PB3 as output */
    DDRB |= (1 << LED_PIN);

    while (1)
    {
        PORTB |= (1 << LED_PIN);   // LED ON
        _delay_ms(BLINK_DELAY_MS);
        PORTB &= ~(1 << LED_PIN);  // LED OFF
        _delay_ms(BLINK_DELAY_MS);
    }
}
