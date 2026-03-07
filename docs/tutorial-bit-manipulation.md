# Bit Manipulation: Setting and Clearing Bits on AVR

## Prerequisites

This tutorial assumes you know what bits, bytes, and registers are. If any of these concepts are new, these resources will get you up to speed:

- [Bits, Bytes, and Binary — Sparkfun](https://learn.sparkfun.com/tutorials/binary) — what bits and bytes are, how binary and hexadecimal notation work
- [Bitwise Operators in C — GeeksforGeeks](https://www.geeksforgeeks.org/bitwise-operators-in-c-cpp/) — AND, OR, NOT, XOR, and shift operators with examples
- [What is a Microcontroller? — Sparkfun](https://learn.sparkfun.com/tutorials/what-is-a-microcontroller) — the difference between an MCU and a general-purpose CPU, and what registers, flash, and RAM mean on a chip

See also the [Glossary](glossary.md) for quick definitions of terms used throughout.

---

Every register on the ATtiny85 is 8 bits wide. Each bit controls something — a pin direction, an output voltage, a timer setting. To change one bit without disturbing the others, you need three tools: a **shift** to create a mask, **OR** to set a bit, and **AND-NOT** to clear a bit.

This tutorial walks through exactly what happens, bit by bit, when you write:

```c
DDRB |= (1 << PB3);    // set PB3 as output
PORTB |= (1 << PB3);   // set PB3 HIGH
PORTB &= ~(1 << PB3);  // set PB3 LOW
```

## The Three Port Registers: DDRB, PORTB, and PINB

The ATtiny85 has one I/O port — Port B — with six pins (PB0–PB5). Three registers work together to control these pins:

| Register | Purpose | Read/Write |
|----------|---------|-----------|
| **DDRB** | **Data Direction** — sets each pin as input or output | Read/Write |
| **PORTB** | **Data Output** — sets the voltage on output pins (HIGH or LOW). On input pins, enables the internal pull-up resistor. | Read/Write |
| **PINB** | **Pin Input** — reads the actual voltage level on each pin right now | Read-only |

Think of it this way: **DDRB** decides *what* each pin does (listen or drive). **PORTB** decides *what to say* on output pins. **PINB** tells you *what you're hearing* on input pins.

The relationship between them:

```
                      DDRB bit = 0 (input)        DDRB bit = 1 (output)
                    ┌─────────────────────┐     ┌──────────────────────┐
  PORTB bit = 0     │ Floating input       │     │ Pin drives LOW (0V)  │
  PORTB bit = 1     │ Pull-up enabled      │     │ Pin drives HIGH (5V) │
                    └─────────────────────┘     └──────────────────────┘
  PINB bit          │ Reads actual voltage │     │ Reads actual voltage │
```

In our blink program, we use all three roles:
- `DDRB |= (1 << PB3)` — PB3 is an **output** (drives the LED)
- `PORTB |= (1 << PB3)` — PB3 drives **HIGH** (LED on)
- `PORTB &= ~(1 << PB3)` — PB3 drives **LOW** (LED off)

In the button program, we also use the input side:
- `DDRB &= ~(1 << PB0)` — PB0 is an **input** (reads the button)
- `PORTB |= (1 << PB0)` — enables the **pull-up** on PB0 (holds pin HIGH when button is open)
- `PINB & (1 << PB0)` — **reads** PB0 (HIGH = released, LOW = pressed)

## Pin Names vs. Physical Pins — Don't Mix Them Up

This is a common source of confusion. The ATtiny85 has two completely different numbering systems for its pins, and they don't match:

- **Port bit names** (PB0–PB5) — the *logical* names used in code. PB3 means "bit 3 of Port B." These map to register bit positions: `(1 << PB3)` shifts to bit 3.
- **Physical pin numbers** (1–8) — the *package* numbers printed on the datasheet and stamped on the chip. Pin 1 is marked with a dot on the DIP package.

```
              ┌───────┐
        PB5   │1  o  8│   VCC          Physical pin 1 = PB5 (not PB1!)
        PB3   │2     7│   PB2          Physical pin 2 = PB3 (not PB2!)
        PB4   │3     6│   PB1          Physical pin 5 = PB0 (not PB5!)
        GND   │4     5│   PB0
              └───────┘
```

Notice: **physical pin 2 is PB3**, not PB2. **Physical pin 5 is PB0**, not PB5. There is no logical pattern — the mapping is determined by the chip's internal silicon layout, not by anything intuitive.

The full mapping:

| Physical Pin | Port Name | Common Use in This Project |
|-------------|-----------|---------------------------|
| 1 | PB5 | RESET (don't use as I/O) |
| 2 | PB3 | Blink LED |
| 3 | PB4 | Button LED |
| 4 | GND | Ground (not a GPIO pin) |
| 5 | PB0 | Button input / MOSI (ISP) |
| 6 | PB1 | MISO (ISP) |
| 7 | PB2 | SCK (ISP) |
| 8 | VCC | Power (not a GPIO pin) |

**The rule:** code always uses port bit names (PB0–PB5). Physical pin numbers are only for wiring. When you write `DDRB |= (1 << PB3)`, you don't need to know that PB3 is physical pin 2 — the compiler doesn't care. But when you plug a wire into the breadboard, you need the physical number.

Keep the pinout diagram handy until the mapping is second nature. Getting physical pin 3 (PB4) and port bit 3 (PB3, physical pin 2) confused is one of the most common wiring mistakes.

## Bit Positions: 8 Bits, 8 Controls

DDRB has one bit per pin. Each bit controls whether that pin is **input** (0) or **output** (1):

```
DDRB:
  Bit:    7    6    5    4    3    2    1    0
  Pin:    —    —   PB5  PB4  PB3  PB2  PB1  PB0
```

Bits 7 and 6 don't exist on the ATtiny85 (it only has 6 pins), so they're always 0.

At power-on, all bits are 0 — all pins start as inputs:

```
DDRB = 0b00000000
```

## Step 1: Creating the Mask with `(1 << PB3)`

`PB3` is just a number — it's defined as `3` in the AVR headers. The expression `(1 << PB3)` means "shift the number 1 left by 3 positions":

```
Start:    0b00000001    ← the number 1
Shift 1:  0b00000010    ← shifted left once
Shift 2:  0b00000100    ← shifted left twice
Shift 3:  0b00001000    ← shifted left three times — this is (1 << 3)
```

The result is a byte with **only bit 3 set**. This is called a **bitmask** — it selects the one bit we care about.

Different pins, different masks:

```
(1 << PB0) = 0b00000001    ← bit 0
(1 << PB1) = 0b00000010    ← bit 1
(1 << PB2) = 0b00000100    ← bit 2
(1 << PB3) = 0b00001000    ← bit 3
(1 << PB4) = 0b00010000    ← bit 4
(1 << PB5) = 0b00100000    ← bit 5
```

## Step 2: Setting a Bit with `|=` (OR)

To make PB3 an output, we need to set bit 3 in DDRB to 1 — without changing any other bits.

```c
DDRB |= (1 << PB3);
```

This is shorthand for `DDRB = DDRB | (1 << PB3)`. The `|` operator is **bitwise OR** — for each bit position, the result is 1 if *either* input is 1:

```
OR truth table:
  0 | 0 = 0
  0 | 1 = 1
  1 | 0 = 1
  1 | 1 = 1
```

Let's trace it. Suppose DDRB currently has PB0 set as output (from some earlier code):

```
  DDRB         = 0b00000001    ← PB0 is already output
  (1 << PB3)   = 0b00001000    ← our mask

  OR each bit:
  Bit 7:  0 | 0 = 0
  Bit 6:  0 | 0 = 0
  Bit 5:  0 | 0 = 0
  Bit 4:  0 | 0 = 0
  Bit 3:  0 | 1 = 1  ← SET (this is the bit we wanted)
  Bit 2:  0 | 0 = 0
  Bit 1:  0 | 0 = 0
  Bit 0:  1 | 0 = 1  ← unchanged (OR with 0 preserves the original)

  Result       = 0b00001001    ← PB3 is now output, PB0 still output
```

**Key insight:** ORing with 0 leaves a bit unchanged. ORing with 1 forces it to 1. That's why the mask has 1 only where we want to set, and 0 everywhere else.

## Step 3: Turning the LED On with `PORTB |= (1 << PB3)`

Same technique, different register. PORTB controls the output voltage on each pin — 1 means HIGH (5V), 0 means LOW (0V):

```c
PORTB |= (1 << PB3);   // set PB3 HIGH — LED turns on
```

```
  PORTB        = 0b00000000    ← all pins LOW
  (1 << PB3)   = 0b00001000

  OR each bit:
  Bit 7:  0 | 0 = 0
  Bit 6:  0 | 0 = 0
  Bit 5:  0 | 0 = 0
  Bit 4:  0 | 0 = 0
  Bit 3:  0 | 1 = 1  ← SET — PB3 goes HIGH, LED turns on
  Bit 2:  0 | 0 = 0
  Bit 1:  0 | 0 = 0
  Bit 0:  0 | 0 = 0

  Result       = 0b00001000    ← PB3 is HIGH
```

Current flows from pin 2 (PB3 at 5V) through the resistor, through the LED, to GND. The LED lights up.

## Step 4: Turning the LED Off with `PORTB &= ~(1 << PB3)`

To turn PB3 LOW, we need to clear bit 3 to 0 — without changing any other bits. This takes two operations chained together: **NOT** to invert the mask, then **AND** to apply it.

```c
PORTB &= ~(1 << PB3);   // set PB3 LOW — LED turns off
```

### First: `~` Inverts the Mask

The `~` operator flips every bit:

```
  (1 << PB3)   = 0b00001000
  ~(1 << PB3)  = 0b11110111    ← every bit flipped
```

Now we have a mask with 1 everywhere *except* the bit we want to clear.

### Then: `&` Clears the Target Bit

The `&` operator is **bitwise AND** — the result is 1 only if *both* inputs are 1:

```
AND truth table:
  0 & 0 = 0
  0 & 1 = 0
  1 & 0 = 0
  1 & 1 = 1
```

Let's say PB3 and PB0 are both HIGH:

```
  PORTB        = 0b00001001    ← PB3 and PB0 are HIGH
  ~(1 << PB3)  = 0b11110111    ← inverted mask

  AND each bit:
  Bit 7:  0 & 1 = 0
  Bit 6:  0 & 1 = 0
  Bit 5:  0 & 1 = 0
  Bit 4:  0 & 1 = 0
  Bit 3:  1 & 0 = 0  ← CLEARED (this is the bit we wanted)
  Bit 2:  0 & 1 = 0
  Bit 1:  0 & 1 = 0
  Bit 0:  1 & 1 = 1  ← unchanged (AND with 1 preserves the original)

  Result       = 0b00000001    ← PB3 is LOW (LED off), PB0 still HIGH
```

**Key insight:** ANDing with 1 leaves a bit unchanged. ANDing with 0 forces it to 0. The inverted mask has 0 only where we want to clear, and 1 everywhere else.

## Step 5: Testing a Bit with `&`

To check if a button is pressed, you read the pin and test a specific bit:

```c
if (PINB & (1 << PB0)) {
    // PB0 is HIGH
}
```

This uses the same AND mask, but without the NOT:

```
  PINB         = 0b00001001    ← PB3 and PB0 are HIGH
  (1 << PB0)   = 0b00000001    ← mask for bit 0

  AND each bit:
  Bit 7:  0 & 0 = 0
  Bit 6:  0 & 0 = 0
  Bit 5:  0 & 0 = 0
  Bit 4:  0 & 0 = 0
  Bit 3:  1 & 0 = 0  ← masked out
  Bit 2:  0 & 0 = 0
  Bit 1:  0 & 0 = 0
  Bit 0:  1 & 1 = 1  ← preserved

  Result       = 0b00000001    ← nonzero, so the if-condition is true
```

If PB0 were LOW, the result would be `0b00000000` — zero — and the if-condition would be false. The AND mask isolates just the bit you care about.

## Summary: The Three Patterns

| Operation | Code | What It Does |
|-----------|------|-------------|
| **Set** a bit | `REG \|= (1 << n)` | Forces bit n to 1, others unchanged |
| **Clear** a bit | `REG &= ~(1 << n)` | Forces bit n to 0, others unchanged |
| **Test** a bit | `REG & (1 << n)` | Returns nonzero if bit n is 1 |

These three patterns are used hundreds of times in any bare-metal program. Once they're second nature, reading and writing register code becomes straightforward.

## Why Not Just Assign the Whole Register?

You might wonder: why not write `DDRB = 0b00001000` instead of `DDRB |= (1 << PB3)`?

You can — if you want to set the *entire register* at once. But assignment overwrites all 8 bits. If another part of your code already configured PB0 as output:

```c
DDRB = (1 << PB0);    // PB0 output ← set earlier
DDRB = (1 << PB3);    // PB3 output — but this CLEARS PB0!
```

After the second line, DDRB is `0b00001000`. PB0 is no longer an output — its bit got overwritten. Using `|=` avoids this:

```c
DDRB |= (1 << PB0);   // PB0 output
DDRB |= (1 << PB3);   // PB3 output — PB0 is still output
```

The OR preserves whatever was already set. This is essential when multiple parts of your code configure different pins in the same register.

## Combining Multiple Bits

You can set multiple bits in one operation using OR on the masks:

```c
DDRB |= (1 << PB3) | (1 << PB4);   // PB3 and PB4 as output
```

The two masks OR together first:

```
  (1 << PB3) = 0b00001000
  (1 << PB4) = 0b00010000
  Combined   = 0b00011000    ← both bits set
```

Then this combined mask is ORed into DDRB, setting both bits at once. This is common in timer configuration where you set multiple control bits in a single register:

```c
TCCR0B = (1 << CS01) | (1 << CS00);   // set bits 1 and 0 = prescaler 64
```
