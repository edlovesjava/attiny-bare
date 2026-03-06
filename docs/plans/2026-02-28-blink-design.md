# ATtiny85 Bare Metal Blink - Design

## Overview
Bare metal blink project for ATtiny85 using the Microchip AVR-GCC toolchain and avrdude.
First project in a series - establishes the toolchain, build system, and flash workflow.

## Hardware
- **MCU**: ATtiny85 @ 8MHz internal oscillator
- **LED**: Connected to PB3 (physical pin 2) with current-limiting resistor
- **Programmer**: Arduino Nano running ArduinoISP (stk500v1 protocol)

## Toolchain
- **Compiler**: Microchip AVR 8-bit GCC toolchain (avr-gcc, avr-objcopy, avr-size)
- **Flasher**: avrdude (separate install - GitHub releases or Arduino IDE bundled)
- **Build system**: GNU Make

## Project Structure
```
attiny-chrono-bare/
├── src/
│   └── main.c          # Blink - C with inline assembly
├── Makefile             # Build, flash, fuse targets
├── README.md            # Setup and usage
└── docs/plans/
    └── 2026-02-28-blink-design.md
```

## Makefile Targets
- `make` / `make all` - Compile to .hex
- `make flash PORT=COMx` - Upload via Arduino-as-ISP
- `make fuses PORT=COMx` - Set 8MHz internal oscillator fuses
- `make clean` - Remove build artifacts
- `make size` - Show flash/RAM usage

## Fuse Configuration
- Low: 0xE2 (8MHz internal oscillator, no clock divide)
- High: 0xDF (default - SPI enabled, no watchdog)
- Extended: 0xFF (self-program disabled)

## Code Approach
- C with `<avr/io.h>` for register definitions
- Inline assembly (`asm volatile`) for the toggle/delay to demonstrate both styles
- Direct register manipulation (DDRB, PORTB) - no Arduino abstractions

## Programmer Settings
- Protocol: stk500v1
- Baud: 19200
- Port: user-specified via make variable
