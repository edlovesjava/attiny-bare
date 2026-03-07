# ATtiny85 Bare Metal

Bare-metal AVR programming on the ATtiny85 using C and inline assembly. No Arduino framework — just registers, timers, and interrupts.

## Why Bare Metal?

The Arduino IDE is great for getting started, but it hides everything — the build pipeline, the register-level hardware control, the linker, the fuses. You upload a sketch and it works (usually), but you don't know *why* it works.

Going bare metal means:

- **You understand every byte.** There's no hidden framework, no bloated core library. A blink program compiles to 204 bytes. You can read the disassembly and trace every instruction.
- **You control the hardware directly.** Registers, timers, interrupts, sleep modes — you configure them yourself instead of calling abstraction layers that may not do what you expect.
- **You learn skills that transfer.** The concepts here — cross-compilation, linker scripts, ISP programming, fuse configuration — apply to any embedded platform: STM32, ESP32, PIC, or custom ASICs. The Arduino API doesn't travel with you.
- **You can debug anything.** When something breaks, you have the tools and knowledge to investigate: read the disassembly, check the fuses, verify the compiler flags, inspect the ELF sections. No black boxes.

This project is a learning path — start with a blinking LED and build up to real applications, understanding every layer along the way.

## Hardware

- **MCU**: ATtiny85 @ 8MHz internal oscillator
- **Programmer**: Arduino Nano running ArduinoISP (stk500v1)
- **LED**: PB3 (physical pin 2) with current-limiting resistor

## Toolchain

- [Microchip AVR 8-bit GCC](https://www.microchip.com/en-us/tools-resources/develop/microchip-studio/gcc-compilers) — compiler
- [avrdude](https://github.com/avrdudes/avrdude) — flash programmer
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

## Project Structure

```
attiny-bare/
├── src/
│   └── main.c              # Interrupt-driven LED blink
├── Makefile                 # Build, flash, fuse targets
├── docs/
│   ├── plans/
│   │   └── 2026-02-28-blink-design.md
│   ├── tutorial-toolchain-setup.md
│   ├── tutorial-arduino-nano-isp.md
│   ├── tutorial-bit-manipulation.md
│   ├── tutorial-understanding-the-makefile.md
│   ├── tutorial-delay-to-interrupts.md
│   ├── glossary.md
│   ├── references.md
│   └── using-claude-code.md
└── README.md
```

## Make Targets

| Command | Description |
|---------|-------------|
| `make` | Compile to HEX |
| `make flash PORT=COMx` | Upload to ATtiny85 |
| `make fuses PORT=COMx` | Set 8MHz internal oscillator fuses |
| `make readfuses PORT=COMx` | Read current fuse values |
| `make size` | Show flash/RAM usage |
| `make disasm` | View disassembly |
| `make clean` | Remove build artifacts |

## Tutorials

- [Toolchain Setup](docs/tutorial-toolchain-setup.md) — installing AVR-GCC, avrdude, and Make on Windows
- [Arduino Nano as ISP Programmer](docs/tutorial-arduino-nano-isp.md) — wiring, configuration, and troubleshooting
- [Bit Manipulation](docs/tutorial-bit-manipulation.md) — setting, clearing, and testing bits in AVR registers
- [Understanding the Makefile](docs/tutorial-understanding-the-makefile.md) — the build pipeline, compiler flags, and Make mechanics
- [From Delay to Interrupts](docs/tutorial-delay-to-interrupts.md) — converting a blocking blink to timer interrupts
- [Glossary](docs/glossary.md) — definitions for all acronyms, registers, and technical terms
- [References & Resources](docs/references.md) — datasheets, tools, suppliers, and community links
- [Using Claude Code](docs/using-claude-code.md) — getting started with AI-assisted bare-metal development

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
