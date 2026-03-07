# Tutorial 4: USI I2C Master Driver

In this tutorial you'll build an I2C master driver using the ATtiny85's USI (Universal Serial Interface) peripheral, reassign the button to PB4 to free up PB0 for I2C data, and verify the driver with a bus scan.

**What you'll learn:**
- How the I2C protocol works at the signal level
- What the USI peripheral does and the registers that control it
- How to structure a multi-file C project
- How to scan an I2C bus to discover connected devices

**Starting point:** `git checkout v3-button-led`
**Completed reference:** `git checkout v4-i2c-driver`
**See what changed:** `git diff v3-button-led v4-i2c-driver`

## What You Need

Everything from previous tutorials, plus:
- An I2C device to test with (SSD1306 OLED or BME280 — we'll use these in later tutorials)

If you don't have an I2C device yet, you can still build the driver and verify it compiles. The bus scan will just report no devices found.

## Working with Claude Code

This tutorial is designed to be worked through interactively with Claude Code. Rather than giving you every line of code, the tutorial explains the concepts and sets checkpoints. You write the code, and Claude Code acts as your coach.

**Set the output style:**
```
/config output-style learning
```

**Useful prompts:**
- "Give me a hint" — get a nudge in the right direction
- "Explain [concept]" — deep dive into a register, protocol, or technique
- "Review my code" — get feedback on what you've written
- "What's wrong?" — debug an error or unexpected behavior
- "Show me the answer" — when you're truly stuck and want the solution

**If you get completely lost**, you can always see the completed code:
```bash
git diff v3-button-led v4-i2c-driver   # see all changes
git checkout v4-i2c-driver -- src/      # grab the finished files
```

## Part 1: Pin Reassignment

### The Problem

I2C needs two pins for its bus:
- **SDA** (Serial Data) — bidirectional data line
- **SCL** (Serial Clock) — clock driven by the master

On the ATtiny85, the USI peripheral uses specific pins for these signals:
- **PB0** — SDA (also called DI/SDA in the datasheet)
- **PB2** — SCL (also called USCK/SCL in the datasheet)

PB0 is currently our button input. It needs to become SDA, so the button must move.

### Your Task

1. Move `BUTTON_PIN` from PB0 to PB4
2. Remove the button LED — there's no spare pin for it now (it'll move to the OLED display in Tutorial 5)
3. Instead of lighting an LED, make the button toggle the blink speed between 500ms (normal) and 250ms (fast)
4. Update the file header comment to reflect the new pin assignments

### Checkpoint

```bash
make clean && make
```

- Should compile with no warnings
- Flash should be ~340–360 bytes
- When flashed: PB3 blinks at 500ms. Press button on PB4 — blink speeds up. Release — returns to normal.

**Hint prompt:** "How do I make the blink speed change based on button_pressed?"

## Part 2: Understanding I2C

Before writing any code, make sure you understand what I2C signals look like on the wire. This background will make the USI register configuration make sense.

### The Bus

I2C uses two open-drain lines, both pulled HIGH by resistors when idle:

```
        VCC
         │
        [R]  ← pull-up resistor (typically 4.7kΩ)
         │
SDA ─────┤──────── Device 1 ──── Device 2 ──── ...
         │
        [R]
         │
SCL ─────┤──────── Device 1 ──── Device 2 ──── ...
```

Any device can pull a line LOW, but no device drives it HIGH — the resistor does that. This is what "open-drain" means.

> **Note:** Most I2C breakout boards (OLED modules, BME280 boards) include pull-up resistors on the module. You typically don't need to add your own. If you're connecting bare chips, add 4.7kΩ pull-ups from SDA and SCL to VCC.

### Start and Stop Conditions

Every I2C transaction begins with a **start condition** and ends with a **stop condition**:

```
         Start                             Stop
         condition                         condition
           │                                 │
SDA ───────╲_____________________________╱───────
                                        ╱
SCL ──────────╲___╱──╲___╱──╲___╱──╲___╱─────────
               bit     bit     bit
```

- **Start:** SDA goes LOW while SCL is HIGH
- **Stop:** SDA goes HIGH while SCL is HIGH
- **Data:** SDA changes only while SCL is LOW; SDA is read while SCL is HIGH

### Address + Read/Write

After the start condition, the master sends a 7-bit device address followed by a R/W bit:

```
  7   6   5   4   3   2   1   0
├───┬───┬───┬───┬───┬───┬───┬───┤
│ A6│ A5│ A4│ A3│ A2│ A1│ A0│R/W│
├───┴───┴───┴───┴───┴───┴───┴───┤
```

- **R/W = 0** — master will write to the device
- **R/W = 1** — master will read from the device
- The SSD1306 OLED at address 0x3C becomes `0x78` for write (`0x3C << 1 | 0`) and `0x79` for read (`0x3C << 1 | 1`)

### ACK / NACK

After each byte, the *receiver* pulls SDA LOW for one clock cycle to acknowledge (ACK). If it doesn't (SDA stays HIGH), that's a NACK — something went wrong.

```
  Byte (8 bits)           ACK
├───────────────────────┬───────┤
│ D7 D6 D5 D4 D3 D2 D1 D0 │  0  │ ← receiver pulls SDA LOW = ACK
├───────────────────────┬───────┤
│ D7 D6 D5 D4 D3 D2 D1 D0 │  1  │ ← SDA stays HIGH = NACK
```

**Explore further:** "Explain the difference between 7-bit and 10-bit I2C addressing" or "Why is I2C open-drain instead of push-pull?"

## Part 3: The USI Peripheral

The ATtiny85 doesn't have a dedicated I2C (TWI) module like the ATmega328P. Instead it has the **USI** — a simpler, more flexible serial interface that can be configured for I2C.

### USI Registers

Three registers control the USI:

| Register | Purpose |
|----------|---------|
| **USICR** | Control — selects wire mode, clock source, and triggers |
| **USISR** | Status — flags for start condition, overflow, and counter |
| **USIDR** | Data — the shift register (MSB shifts out on SDA, bits shift in from SDA) |

### USICR — Control Register

```
  Bit:    7      6      5      4      3      2      1      0
       ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
       │USISIE│USIOIE│USIWM1│USIWM0│USICS1│USICS0│USICLK│USITC│
       └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

Key bits for I2C:
- **USIWM1:USIWM0** — Wire Mode. `10` = Two-wire (I2C) mode
- **USICS1:USICS0** — Clock Source. `10` = External clock (SCL pin), positive edge
- **USICLK** — Clock strobe. Writing 1 shifts the data register by one bit
- **USITC** — Toggle Clock. Writing 1 toggles SCL (drives it HIGH or LOW)

### USISR — Status Register

```
  Bit:    7      6      5      4      3      2      1      0
       ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
       │USISIF│USIOIF│USIPF │USIDC │USICNT3│USICNT2│USICNT1│USICNT0│
       └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

Key bits:
- **USISIF** — Start condition detected flag
- **USIOIF** — Counter overflow flag (fires after the number of edges you set)
- **USICNT3:0** — 4-bit counter. Counts clock edges. Overflows (sets USIOIF) when it rolls from 15 to 0

To transfer 8 bits: set the counter to 0 (16 edges needed — 2 per bit × 8 bits = 16). The counter overflows after 16 edges, telling you the byte is done.

To transfer 1 bit (ACK/NACK): set the counter to 14 (2 edges needed — 1 bit).

### USIDR — Data Register

The 8-bit shift register. On each clock edge, MSB shifts out onto SDA and a new bit shifts in from SDA. After 8 clocks (16 edges), the byte has been fully transferred and a new byte has been received simultaneously.

**Explore further:** "Walk me through what happens in USIDR during a single byte transfer" or "Why does the counter count edges instead of bits?"

## Part 4: Building the I2C Driver

Now write the driver. Create two new files:

```
src/usi_i2c.h    ← function declarations
src/usi_i2c.c    ← implementation
```

### The API

Your driver needs these functions:

```c
void    i2c_init(void);           // Configure pins and USI for I2C
uint8_t i2c_start(uint8_t addr);  // Send start condition + address byte
uint8_t i2c_write(uint8_t data);  // Send one byte, return 0=ACK 1=NACK
uint8_t i2c_read_ack(void);       // Read one byte, send ACK (more to read)
uint8_t i2c_read_nack(void);      // Read one byte, send NACK (last byte)
void    i2c_stop(void);           // Send stop condition
```

### Suggested Order

Write and test one function at a time:

1. **`i2c_init`** — set PB0 (SDA) and PB2 (SCL) as outputs, drive HIGH, configure USIDR and USICR
2. **`i2c_start`** — pull SDA LOW while SCL is HIGH, then send the address byte
3. **`i2c_write`** — load USIDR, clock out 8 bits, read ACK
4. **`i2c_stop`** — pull SDA LOW, release SCL, then release SDA
5. **`i2c_read_ack` / `i2c_read_nack`** — clock in 8 bits, send ACK or NACK

Each function is small (10–20 lines). The core operation — clocking bits through the USI — will be a helper function that both `i2c_write` and `i2c_read_*` call.

### The Transfer Helper

The heart of the driver is a function that clocks a specified number of bits through the USI. It:

1. Sets USISR to clear flags and set the counter
2. Loops: toggle SCL HIGH (USITC), strobe data (USICLK + USITC toggles SCL LOW)
3. Until USIOIF (overflow flag) is set
4. Returns the received byte from USIDR

**Hint prompts:**
- "What value do I write to USISR to transfer 8 bits?"
- "How do I toggle SCL using USICR?"
- "Explain the timing between USITC and USICLK"

### Checkpoint

After writing the driver:

```bash
make clean && make
```

- Should compile with no warnings
- Should build as a multi-file project (you'll see both `main.o` and `usi_i2c.o` in the output)
- Flash will be larger — the I2C driver adds code even before you call it

**Common mistakes:**
- Forgetting to `#include "usi_i2c.h"` in both `usi_i2c.c` and `main.c`
- Not setting SDA as input before reading ACK (the device needs to drive the line)
- Counter value off by one — 8 bits needs counter = 0 (16 edges), 1 bit needs counter = 14 (2 edges)

## Part 5: I2C Bus Scan

Now test the driver. Add a bus scan to `main.c` that runs once at startup — before the main loop. It tries every address from 0x01 to 0x7F and reports which devices respond with ACK.

### Your Task

After `timer0_init()` and before the `while(1)` loop, add code that:

1. Loops through addresses 0x01 to 0x7F
2. For each address: send start + address (write mode), check for ACK, send stop
3. If ACK received: indicate the device was found

### How to Indicate "Found"

Without a serial port or display, showing scan results is tricky. Options:

- **Blink a count** — blink the LED N times for each found device. Slow but visible.
- **Set blink speed** — if any device is found, switch to fast blink permanently. No devices = slow blink.
- **Just trust the code** — verify it works when the OLED display arrives in Tutorial 5.

Pick whichever approach you like. The simplest is: if any device ACKs, set `blink_speed = 1` (fast blink).

### Checkpoint

With an I2C device connected:

```bash
make flash PORT=COMx
```

- OLED at 0x3C — LED should blink fast after startup
- BME280 at 0x76 — LED should blink fast after startup
- No device connected — LED blinks at normal speed

**Hint prompt:** "How do I check if i2c_start returned ACK or NACK?"

### Wiring for I2C

```
ATtiny85 Pinout (v4):
            ┌───────┐
(RESET) PB5 │1  o  8│ VCC
  (LED) PB3 │2     7│ PB2 (SCL) ──→ I2C device SCL
  (BTN) PB4 │3     6│ PB1 (unused)
        GND │4     5│ PB0 (SDA) ──→ I2C device SDA
            └───────┘

I2C device (OLED or BME280 breakout):
  VCC → ATtiny85 pin 8 (VCC)
  GND → ATtiny85 pin 4 (GND)
  SDA → ATtiny85 pin 5 (PB0)
  SCL → ATtiny85 pin 7 (PB2)
```

Most breakout boards include pull-up resistors. If using bare chips, add 4.7kΩ pull-ups from SDA to VCC and SCL to VCC.

## Summary

By the end of this tutorial you should have:

- [ ] Button moved to PB4, blink speed toggles on press
- [ ] `src/usi_i2c.h` with the driver API
- [ ] `src/usi_i2c.c` with the full implementation
- [ ] I2C bus scan on startup that indicates found devices
- [ ] Clean build, no warnings

### What's Next

In [Tutorial 5](tutorial-05-oled-display.md), you'll use this I2C driver to initialize an SSD1306 OLED display, draw text on screen, and move the button press indicator from a dedicated LED to the display.

### Flash Budget

| Stage | Flash | RAM | What Changed |
|-------|-------|-----|-------------|
| v3-button-led | 322B | 5B | Button + LED |
| v4-i2c-driver | ~?B | ~?B | Pin reassignment + I2C driver + bus scan |

Run `make size` after completing the tutorial and fill in your numbers.
