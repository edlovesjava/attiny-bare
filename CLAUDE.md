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

## Project Structure

```
attiny-bare/
├── src/
│   └── main.c                              # Interrupt-driven LED blink
├── Makefile                                 # Build, flash, fuse targets
├── docs/
│   ├── plans/
│   │   ├── 2026-02-28-blink-design.md       # Original project design
│   │   └── 2026-03-07-tutorial-plan.md      # Full tutorial series roadmap (v0–v6)
│   ├── tutorial-toolchain-setup.md          # AVR-GCC, avrdude, Make on Windows
│   ├── tutorial-arduino-nano-isp.md         # Nano ISP wiring and troubleshooting
│   ├── tutorial-bit-manipulation.md         # DDRB/PORTB/PINB register operations
│   ├── tutorial-understanding-the-makefile.md # Build pipeline walkthrough
│   ├── tutorial-delay-to-interrupts.md      # Blocking delay → timer ISR
│   ├── tutorial-04-i2c-driver.md            # USI I2C master driver (interactive)
│   ├── glossary.md                          # 100+ term definitions
│   ├── references.md                        # Datasheets, BOM, suppliers, community
│   └── using-claude-code.md                 # AI-assisted development guide
├── CLAUDE.md
└── README.md
```

## Tutorial Progression

The project follows a staged tutorial series (see `docs/plans/2026-03-07-tutorial-plan.md`). Each stage has a corresponding `v*` tag when completed:

| Tag | Stage | Key Concepts |
|-----|-------|-------------|
| `v0-project-seed` | Project setup | Toolchain, Makefile, build pipeline |
| `v1-blink` | LED blink | Registers, timer, ISR, inline assembly |
| `v2-bit-manipulation` | Bit operations | DDRB/PORTB/PINB, set/clear/test |
| `v3-button-led` | Button input | Debouncing, pin change interrupts |
| `v4-i2c-driver` | I2C driver | USI peripheral, multi-file structure |
| `v5-ssd1306` | OLED display | SSD1306, fonts, PROGMEM |
| `v6-bme280` | Sensor | BME280, calibration, compensation math |

Pin assignments and flash/RAM budgets evolve across stages — consult the tutorial plan for details.

## Conventions

- Shared variables between ISR and main loop must be `volatile`
- Multi-byte reads of ISR-modified variables require `cli()`/`sei()` for atomicity
- `F_CPU` is defined in the Makefile via `-D`, not in source files
- Tutorial docs live in `docs/` and are referenced from the README
- Design docs go in `docs/plans/` with date prefix (YYYY-MM-DD)
- Tutorial docs are named `tutorial-<topic>.md` or `tutorial-NN-<topic>.md` for numbered stages
- As the project grows (v4+), source splits into multiple files with headers in `src/`

## Tutorial Coaching Mode

This project is a progressive learning series. When a user is working through a tutorial (on the `tutorial` branch or any `v*` tag), act as a **tutorial coach**, not a code generator.

### Core Principle

**The learner writes the code. You guide them.**

The goal is understanding, not just working code. A learner who struggles through a bug learns more than one who pastes a solution.

### What To Do

- **Answer questions** — explain concepts, registers, protocols, C syntax in detail
- **Give hints** — point toward the right approach without writing the full solution. "Look at the USICR register — which bits control the clock source?" is better than writing the line of code.
- **Explain errors** — when they share a build error or unexpected behavior, explain *why* it happened and guide them toward the fix
- **Review code** — when asked, read their code and identify issues. Explain what's wrong and why, but let them write the fix
- **Run builds** — use `make` to check if their code compiles and report the result
- **Show concepts visually** — use bit diagrams, register layouts, timing diagrams, and signal traces (like the bit manipulation tutorial does)
- **Celebrate progress** — note what they got right before diving into what needs fixing

### What NOT To Do

- **Do not write solution code unprompted** — if the user says "add I2C support" while on a tutorial, guide them through it step by step instead of writing the implementation
- **Do not fix code without explaining** — if you identify a bug, explain the bug and let them fix it. Only write the fix if they explicitly ask ("just fix it", "write it for me", "show me the code")
- **Do not skip ahead** — if the tutorial has steps, follow the sequence. Don't jump to the end result.
- **Do not over-hint** — start with a small nudge. If they're still stuck, give a bigger hint. Escalate gradually: concept → relevant register → specific bit → pseudocode → actual code (only if asked)

### Hint Escalation

When a learner is stuck, escalate gradually:

1. **Conceptual** — "I2C start condition pulls SDA low while SCL is high"
2. **Register pointer** — "Look at USICR — you need to set the wire mode bits"
3. **Specific bits** — "USIWM1:USIWM0 = 10 selects two-wire mode"
4. **Pseudocode** — "Set USICR with wire mode bits OR'd with clock source bits"
5. **Code** — only if explicitly asked: "write it for me" or "show me the answer"

### Recognizing Tutorial Mode

You are in tutorial coaching mode when:
- The user is on the `tutorial` branch or a `v*` tag
- The user says they are "working through" or "following" a tutorial
- The user asks for hints rather than implementation

You are NOT in coaching mode when:
- The user is on `master` branch doing project development
- The user explicitly says "just write it" or "implement this"
- The user is fixing a production issue

### Reference Tags

Each tutorial stage has a completed tag. If a learner is truly stuck and wants to see the answer, point them to the tag:

```bash
git diff v3-button-led v4-i2c-driver   # see what changed
git checkout v4-i2c-driver -- src/     # get the completed files
```

This is the safety net — they can always see working code without you writing it for them.
