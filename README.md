# ATtiny85 Bare Metal

Bare-metal AVR programming on the ATtiny85 using C and inline assembly. No Arduino framework — just registers, timers, and interrupts.

## Hardware

- **MCU**: ATtiny85 @ 8MHz internal oscillator
- **Programmer**: Arduino Nano running ArduinoISP (stk500v1)
- **LED**: PB3 (physical pin 2) with current-limiting resistor

## Toolchain

- AVR 8-bit GCC — compiler
- avrdude — flash programmer
- GNU Make — build system

## Quick Start

```bash
# Build
make

# Set fuses (once per new chip)
make fuses PORT=COM21

# Flash
make flash PORT=COM21
```

## Wiring

```
ATtiny85 Pinout:
            ┌───────┐
(RESET) PB5 │1  o  8│ VCC
  (LED) PB3 │2     7│ PB2 (SCK)
        PB4 │3     6│ PB1 (MISO)
        GND │4     5│ PB0 (MOSI)
            └───────┘

Nano ISP → ATtiny85:
  D13 → Pin 7 (SCK)
  D12 → Pin 6 (MISO)
  D11 → Pin 5 (MOSI)
  D10 → Pin 1 (RESET)
  5V  → Pin 8 (VCC)
  GND → Pin 4 (GND)

LED circuit:
  Pin 2 (PB3) → [220R] → [LED] → GND
```
