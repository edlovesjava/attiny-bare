# ATtiny85 Bare Metal

Bare-metal AVR programming on the ATtiny85 using C and inline assembly. No Arduino framework — just registers, timers, and interrupts.

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
│   └── tutorial-delay-to-interrupts.md
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
- [From Delay to Interrupts](docs/tutorial-delay-to-interrupts.md) — converting a blocking blink to timer interrupts

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
