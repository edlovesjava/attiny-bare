# Tutorial Series Plan

## Overview

Progressive bare-metal tutorial series on the ATtiny85. Each stage builds on the previous, tagged on the `tutorial` branch. Tutorial docs live on `main`. Readers can check out any tag and diff between stages.

## Stage Progression

```
Tag                 Summary                           New Concepts
──────────────────────────────────────────────────────────────────────
v0-project-seed     Project setup                     Makefile, toolchain
v1-blink-delay      Busy-wait blink                   DDRB, PORTB, _delay_ms
v2-interrupts       Timer interrupt blink             CTC, ISR, volatile, cli/sei
v3-button-led       Button + second LED               PINB, pull-up, debounce
v4-i2c-driver       USI I2C + pin reassignment        USI registers, multi-file build
v5-oled-display     SSD1306 OLED                      Display memory, fonts, PROGMEM
v6-bme280           BME280 sensor + auto-read         Forced mode, compensation math
```

v0–v3 are complete and tagged. v4–v6 are planned.

## Pin Assignments

### v1–v3

```
PB0 — Button input (with pull-up)
PB1 — (unused)
PB2 — (ISP only)
PB3 — Blink LED
PB4 — Button LED
PB5 — RESET
```

### v4 onward

```
PB0 — SDA (I2C data)
PB1 — (unused)
PB2 — SCL (I2C clock) / ISP SCK
PB3 — Blink LED
PB4 — Button input (moved from PB0)
PB5 — RESET
```

Button LED removed — indicator moves to OLED in v5.

## Button Role Progression

| Stage | Button Does |
|-------|-----------|
| v3 | Lights dedicated LED on PB4 |
| v4 | Toggles blink speed (500ms / 100ms) |
| v5 | Shows press indicator on OLED |
| v6 | Triggers immediate sensor read + resets auto-read timer |

## ISR Counter Progression

All counters share the 1ms timer tick — cooperative multitasking:

| Counter | Added In | Purpose |
|---------|----------|---------|
| `wait_time_ms` | v2 | Blink timing (500ms or 100ms) |
| `debounce_time_ms` | v3 | Button debounce (50ms) |
| `measurement_wait_ms` | v6 | BME280 settling time (~20ms) |
| `auto_read_ms` | v6 | Auto-read interval (60,000ms = 1 minute) |

## Source File Progression

```
v1–v3:  src/main.c (single file)
v4:     + src/usi_i2c.c, src/usi_i2c.h
v5:     + src/ssd1306.c, src/ssd1306.h, src/font5x7.h
v6:     + src/bme280.c, src/bme280.h
```

## v4: USI I2C Master Driver

### Code

- Reassign `BUTTON_PIN` from PB0 to PB4
- Remove `BUTTON_LED_PIN` (moves to OLED in v5)
- Button press toggles blink rate between 500ms and 100ms
- New files: `src/usi_i2c.c` + `src/usi_i2c.h`
- I2C bus scan on startup — loops 0x01–0x7F, reports responding addresses
- First multi-file build (tests the Makefile's wildcard pattern)

### Driver API

```c
void    i2c_init(void);
uint8_t i2c_start(uint8_t addr);
uint8_t i2c_write(uint8_t data);
uint8_t i2c_read_ack(void);
uint8_t i2c_read_nack(void);
void    i2c_stop(void);
```

### Tutorial Topics

- What I2C is — SDA, SCL, start/stop conditions, ACK/NACK
- The USI peripheral — USICR, USISR, USIDR register walkthrough
- Each driver function explained register by register
- Multi-file project structure — headers, separation of concerns
- Testing with bus scan

## v5: OLED Display (SSD1306 128x64)

### Code

- New files: `src/ssd1306.c`, `src/ssd1306.h`, `src/font5x7.h`
- Initialize SSD1306 over I2C (0x3C default, 0x3D noted as alternative)
- Draw text, show button press indicator on screen
- Blink LED on PB3 continues independently

### Display Layout

```
┌────────────────────────┐
│ ATtiny85 Bare Metal    │
│                        │
│                        │
│ Button: [PRESSED]      │
└────────────────────────┘
```

### Tutorial Topics

**Display fundamentals:**
- SSD1306 initialization sequence — what each command byte does
- Display memory layout — 128 columns × 8 pages, each byte is a vertical 8-pixel strip
- Commands vs data — control byte 0x00 vs 0x40
- Page and column addressing modes

**Font and flash budgeting:**
- Standard 5x7 font cost — ~480 bytes (6% of flash) for full ASCII
- `PROGMEM` — storing font data in flash, not RAM
- `pgm_read_byte()` — reading flash data at runtime
- Rolling a minimal font — only the characters we actually use
- `make size` before and after font trim

**RAM budgeting and partial updates:**
- No framebuffer — 128x64 = 1024 bytes, exceeds 512 bytes RAM
- Writing directly to SSD1306's internal GDDRAM
- Partial screen updates — set page/column window, write only changed characters
- I2C bus time — full screen (~80ms at 100kHz) vs single character (~0.5ms)

May split into sub-parts if too long. Natural breakpoints: basic init → text + font trim → partial updates.

## v6: BME280 Sensor

### Code

- New files: `src/bme280.c`, `src/bme280.h`
- Read calibration data from sensor NVM on init
- Button press triggers forced-mode measurement
- Auto-read every 60 seconds via ISR counter
- Non-blocking measurement: trigger read, set 20ms wait counter, read results when ready
- Compensation formulas — 32-bit integer math (no floating point)
- Display on OLED

### Display Layout

```
┌────────────────────────┐
│ Temp:    72.4 F        │
│ Humidity: 45 %         │
│ Pressure: 1013 hPa     │
│                        │
│ [Press for new reading]│
└────────────────────────┘
```

### I2C Bus

Both devices share the bus at different addresses:

| Device | Address | Purpose |
|--------|---------|---------|
| SSD1306 | 0x3C | OLED display |
| BME280 | 0x76 | Temp/humidity/pressure sensor |

### Tutorial Topics

- BME280 register map — chip ID, control, status, data registers
- Forced mode vs normal mode — power management
- Calibration constants (trimming parameters) — factory-stored, read once
- Compensation formulas — integer-only math on an 8-bit CPU
- Multi-byte I2C burst read — 8 bytes of sensor data
- Non-blocking measurement — trigger, wait via timer, read
- Auto-read timer — `auto_read_ms` counter in ISR, button resets it
- `make disasm` — seeing 32-bit math compiled for 8-bit architecture

### BME280 Measurement Flow

```
Button press or auto_read_ms == 0
  │
  ├── Write forced mode to BME280 control register
  ├── Set measurement_wait_ms = 20
  │
  (ISR counts down 20ms)
  │
  ├── Read 8 bytes of raw sensor data
  ├── Apply compensation formulas
  ├── Update OLED (partial — only changed values)
  └── Reset auto_read_ms = 60000
```

## Flash Budget Progression

Each stage's `make size` output is part of the tutorial narrative:

| Stage | Flash | RAM | What Grew |
|-------|-------|-----|-----------|
| v1 | 96B | 0B | Minimal — just a delay loop |
| v2 | 204B | 2B | Vector table + ISR overhead |
| v3 | 322B | 5B | Debounce state machine |
| v4 | ~? | ~? | I2C driver |
| v5 | ~? | ~? | Font data, display driver |
| v6 | ~? | ~? | 32-bit compensation math |

## Tutorial Docs

On `main` branch, each references its tag:

```
docs/tutorial-bit-manipulation.md       ← foundational (exists)
docs/tutorial-toolchain-setup.md        ← setup (exists)
docs/tutorial-arduino-nano-isp.md       ← setup (exists)
docs/tutorial-understanding-the-makefile.md  ← setup (exists)
docs/tutorial-delay-to-interrupts.md    ← v1→v2 (exists)
docs/tutorial-04-i2c-driver.md          ← v4 (planned)
docs/tutorial-05-oled-display.md        ← v5 (planned)
docs/tutorial-06-bme280-sensor.md       ← v6 (planned)
```

## Future (Not In Scope)

- **v7: Pure bit-bang I2C** — reimplement without USI for deeper learning
- **Sleep modes** — `SLEEP_MODE_IDLE` between timer ticks
- **EEPROM** — store sensor reading history
- **Watchdog timer** — recovery from hangs
