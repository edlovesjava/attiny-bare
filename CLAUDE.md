# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bare-metal AVR project targeting the ATtiny85 microcontroller at 8MHz (internal oscillator). No Arduino framework — direct register manipulation with C and inline assembly. Uses an Arduino Nano as an ISP programmer via the stk500v1 protocol.

## Build Commands

```bash
make                    # Compile src/*.c → build/blink.hex, print size
make flash PORT=COMx    # Upload hex to ATtiny85 via Arduino Nano ISP
make fuses PORT=COMx    # Set fuses for 8MHz internal oscillator (once per chip)
make readfuses PORT=COMx # Verify fuse values
make size               # Show flash/RAM usage
make disasm             # View generated AVR assembly
make clean              # Remove build/ directory
```

Default port is COM21. Override with `PORT=COMx` on any target that needs it.

## Toolchain

- **avr-gcc** — cross-compiler (must be in PATH)
- **avrdude** — flash programmer
- **GNU Make** — build system

Compiler flags: `-mmcu=attiny85 -DF_CPU=8000000UL -Os -Wall -Wextra -std=c11`

## Architecture

This is a single-file embedded project (`src/main.c`) with a Makefile-driven build pipeline:

```
src/main.c → build/main.o → build/blink.elf → build/blink.hex → chip
          compile          link             objcopy           avrdude
```

The program uses Timer/Counter0 in CTC mode with a 1ms interrupt tick. The ISR decrements a shared counter; the main loop polls it and toggles the LED (PB3) via inline `sbi`/`cbi` assembly when it hits zero.

Key hardware details:
- **LED pin**: PB3 (physical pin 2)
- **Timer config**: prescaler=64, OCR0A=124 → 1ms tick
- **Fuses**: LFUSE=0xE2, HFUSE=0xDF, EFUSE=0xFF
- **ISP wiring**: Nano D10-D13 → ATtiny85 RESET/MOSI/MISO/SCK

## Conventions

- Shared variables between ISR and main loop must be `volatile`
- Multi-byte reads of ISR-modified variables require `cli()`/`sei()` for atomicity
- `F_CPU` is defined in the Makefile via `-D`, not in source files
- Tutorial docs live in `docs/` and are referenced from the README
- Design docs go in `docs/plans/` with date prefix (YYYY-MM-DD)
