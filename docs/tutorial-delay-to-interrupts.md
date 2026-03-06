# From _delay_ms to Timer Interrupts on ATtiny85

A step-by-step walkthrough of converting a blocking blink program into an interrupt-driven one.

## Part 1: The Delay-Based Blink

Our first working blink used `_delay_ms()` — the simplest approach.

```c
#include <avr/io.h>
#include <util/delay.h>

#define F_CPU 8000000UL
#define LED_PIN PB3

int main(void)
{
    DDRB |= (1 << LED_PIN);  // PB3 as output

    while (1)
    {
        PORTB |= (1 << LED_PIN);   // LED ON
        _delay_ms(500);
        PORTB &= ~(1 << LED_PIN);  // LED OFF
        _delay_ms(500);
    }
}
```

This works, but `_delay_ms()` is a **busy-wait** — the CPU spins in a tight loop doing nothing for 500ms. That means:

- The CPU can't do anything else while waiting
- You can't read buttons, update a display, or respond to input during the delay
- For a stopwatch (our end goal), this is a dead end

## Part 2: Understanding Timer/Counter0

The ATtiny85 has an 8-bit Timer/Counter0 that counts up independently of the CPU. We can configure it to fire an **interrupt** at a precise interval, giving us a background clock tick.

### Key registers

| Register | Purpose |
|----------|---------|
| `TCCR0A` | Timer mode (we use CTC — Clear Timer on Compare) |
| `TCCR0B` | Clock prescaler selection |
| `OCR0A`  | Compare value — timer resets when it hits this number |
| `TIMSK`  | Interrupt enable bits |
| `TCNT0`  | Current count (managed by hardware) |

### CTC mode in a nutshell

In CTC (Clear Timer on Compare) mode:

1. The timer counts up from 0: `0, 1, 2, 3 ... OCR0A`
2. When `TCNT0` matches `OCR0A`, it resets to 0 and fires an interrupt
3. This repeats forever in hardware — no CPU involvement

### Choosing a 1ms tick

We want the interrupt to fire every 1 millisecond. The formula is:

```
interval = (prescaler x (OCR0A + 1)) / F_CPU
```

With F_CPU = 8MHz and prescaler = 64:

```
0.001 = (64 x (OCR0A + 1)) / 8,000,000
OCR0A + 1 = 8,000,000 x 0.001 / 64
OCR0A + 1 = 125
OCR0A = 124
```

So the timer counts 0 to 124 (125 steps), taking exactly 1ms per cycle.

## Part 3: Setting Up the Timer

```c
void timer0_init(void)
{
    TCCR0A = (1 << WGM01);              // CTC mode
    TCCR0B = (1 << CS01) | (1 << CS00); // prescaler = 64
    OCR0A = 124;                        // compare value for 1ms
    TIMSK = (1 << OCIE0A);              // enable compare match A interrupt
    sei();                              // enable global interrupts
}
```

Breaking this down:

- **`WGM01`** — Waveform Generation Mode bit 1. Setting this alone selects CTC mode.
- **`CS01 | CS00`** — Clock Select bits. `011` in binary = prescaler of 64.
- **`OCR0A = 124`** — The timer counts to 124, then resets. 125 counts at 125kHz (8MHz/64) = 1ms.
- **`OCIE0A`** — Output Compare Interrupt Enable for channel A.
- **`sei()`** — Set Enable Interrupts. Nothing fires until this is called.

## Part 4: Writing the ISR

An ISR (Interrupt Service Routine) is a function that runs automatically when the interrupt fires. The CPU pauses `main()`, runs the ISR, then resumes `main()` where it left off.

```c
volatile uint16_t wait_time_ms = BLINK_DELAY_MS;

ISR(TIMER0_COMPA_vect)
{
    if (wait_time_ms > 0) {
        wait_time_ms--;
    }
}
```

Two critical details:

### Why `volatile`?

Without `volatile`, the compiler sees that `main()` never writes to `wait_time_ms`, so it optimizes the check away — it loads the value once into a register and never re-reads it from RAM. The `volatile` keyword forces it to re-read from RAM every time, which is essential because the ISR modifies it behind the scenes.

### Why the `> 0` guard?

`wait_time_ms` is `uint16_t` (unsigned). If the ISR decrements 0, it wraps to 65535, causing a ~65 second hang before the next blink. The guard prevents this.

## Part 5: The Interrupt-Driven Main Loop

```c
#define BLINK_DELAY_MS 500

int main(void)
{
    DDRB |= (1 << LED_PIN);
    timer0_init();

    uint8_t led_on = 0;

    while (1)
    {
        cli();
        uint16_t t = wait_time_ms;
        sei();

        if (t == 0)
        {
            wait_time_ms = BLINK_DELAY_MS;

            if (led_on)
            {
                asm volatile("cbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN));
                led_on = 0;
            }
            else
            {
                asm volatile("sbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN));
                led_on = 1;
            }
        }
    }
}
```

### Why `cli()` / `sei()` around the read?

`uint16_t` is 2 bytes, but the ATtiny85 is an 8-bit CPU — it reads one byte at a time. If the ISR fires between reading the high byte and the low byte, you get a corrupted value (half old, half new). Disabling interrupts briefly guarantees an atomic read.

For example, if `wait_time_ms` is `0x0100` (256) and the ISR decrements it to `0x00FF` (255):
- Without protection: you might read high byte `0x00` (new), then low byte `0x00` (old) = `0x0000`. The timer fires 256ms early.
- With `cli()`/`sei()`: you read both bytes as a consistent pair.

### Why inline assembly?

The `sbi` and `cbi` instructions set/clear a single bit in an I/O register in one cycle. This is the same thing the compiler generates for `PORTB |= (1 << PB3)`, but writing it explicitly demonstrates both C and assembly approaches — a learning goal for this project.

- `sbi` — **S**et **B**it in **I**/O register
- `cbi` — **C**lear **B**it in **I**/O register

## Part 6: The Complete Program

```c
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
    OCR0A = 124;                        // compare value for 1ms
    TIMSK = (1 << OCIE0A);              // enable compare match A interrupt
    sei();                              // enable global interrupts
}

volatile uint16_t wait_time_ms = BLINK_DELAY_MS;

int main(void)
{
    DDRB |= (1 << LED_PIN);
    timer0_init();

    uint8_t led_on = 0;

    while (1)
    {
        cli();
        uint16_t t = wait_time_ms;
        sei();

        if (t == 0)
        {
            wait_time_ms = BLINK_DELAY_MS;

            if (led_on)
            {
                asm volatile("cbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN));
                led_on = 0;
            }
            else
            {
                asm volatile("sbi %0, %1" : : "I"(_SFR_IO_ADDR(PORTB)), "I"(LED_PIN));
                led_on = 1;
            }
        }
    }
}

ISR(TIMER0_COMPA_vect)
{
    if (wait_time_ms > 0) {
        wait_time_ms--;
    }
}
```

## What We Gained

| | Delay-based | Interrupt-driven |
|---|---|---|
| CPU during wait | Busy (100%) | Free (idle loop) |
| Can do other work | No | Yes |
| Timing accuracy | Affected by other code | Hardware-precise |
| Code complexity | Simple | Moderate |
| Scales to stopwatch | No | Yes |

The main loop is now **non-blocking**. The CPU checks a variable, toggles if needed, and loops. This is the foundation for adding button input, display updates, and stopwatch logic — the CPU is available to handle all of these between timer ticks.
