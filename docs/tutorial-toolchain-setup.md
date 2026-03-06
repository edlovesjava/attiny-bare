# ATtiny85 Toolchain Setup on Windows

How to set up a bare-metal AVR development environment from scratch using the Microchip AVR-GCC toolchain, avrdude, and an Arduino Nano as a programmer.

## What You Need

### Hardware
- **ATtiny85** microcontroller
- **Arduino Nano** (or Uno) — used as an ISP programmer
- **Breadboard and jumper wires**
- **LED + resistor** (~220-470 ohm) for testing
- **USB cable** for the Arduino

### Software
- **AVR-GCC** — the compiler (C to machine code)
- **avrdude** — the flasher (uploads code to the chip)
- **GNU Make** — the build system (runs the Makefile)
- **Git Bash / MSYS2** — Unix shell on Windows

## Step 1: Install AVR-GCC

Download the Microchip AVR 8-bit GCC toolchain for Windows:

1. Go to the Microchip website and find "AVR and Arm Toolchains (C Compilers)" under Tools and Software
2. Download the AVR 8-bit Toolchain for Windows (the `.zip`, not the `.exe` Atmel Studio installer)
3. Extract to a permanent location, e.g. `C:\avr-gcc`
4. Add the `bin` folder to your system PATH:
   - Open **System Properties > Environment Variables**
   - Edit `Path` under User or System variables
   - Add `C:\avr-gcc\bin`

### Verify

```bash
avr-gcc --version
```

You should see something like `avr-gcc (AVR_8_bit_GNU_Toolchain_3.x.x) ...`

This gives you:
- `avr-gcc` — compiler
- `avr-objcopy` — converts ELF to HEX for flashing
- `avr-objdump` — disassembler (for inspecting generated code)
- `avr-size` — shows flash/RAM usage

## Step 2: Install avrdude

avrdude is the tool that talks to the programmer and writes your code to the chip.

1. Download from the avrdude GitHub releases page (look for a Windows build, e.g. `avrdude-vX.X-mingw32.zip`)
2. Extract to a permanent location, e.g. `C:\avrdude`
3. Add to PATH: `C:\avrdude`

Alternatively, if you have the Arduino IDE installed, avrdude is bundled at:
```
C:\Users\<you>\AppData\Local\Arduino15\packages\arduino\tools\avrdude\<version>\bin\
```

### Verify

```bash
avrdude -v
```

## Step 3: Install Make

You need GNU Make to run the Makefile.

**Option A: Git Bash (if you already have Git for Windows)**

Git Bash includes a minimal set of Unix tools but not always `make`. If `make --version` doesn't work, install via option B.

**Option B: MSYS2**

1. Install MSYS2 from https://www.msys2.org
2. In the MSYS2 terminal, run:
   ```bash
   pacman -S make
   ```
3. Add `C:\msys64\usr\bin` to your PATH

**Option C: Chocolatey**

```powershell
choco install make
```

### Verify

```bash
make --version
```

## Step 4: Set Up Arduino Nano as ISP Programmer

The Arduino Nano acts as a bridge between your PC and the ATtiny85. It speaks the ISP (In-System Programming) protocol.

### Flash ArduinoISP onto the Nano

1. Open the **Arduino IDE**
2. Go to **File > Examples > 11.ArduinoISP > ArduinoISP**
3. Select your Nano's board and port
4. Upload the sketch

The Nano is now an ISP programmer.

### Wiring: Nano to ATtiny85

```
ATtiny85 Pinout:
                ┌──────┐
  (RESET) PB5  1│o     │8  VCC
          PB3  2│      │7  PB2 (SCK)
          PB4  3│      │6  PB1 (MISO)
          GND  4│      │5  PB0 (MOSI)
                └──────┘

Connections:
  Nano Pin    ATtiny85 Pin    Function
  ────────    ────────────    ────────
  D13         Pin 7 (PB2)    SCK
  D12         Pin 6 (PB1)    MISO
  D11         Pin 5 (PB0)    MOSI
  D10         Pin 1 (PB5)    RESET
  5V          Pin 8 (VCC)    Power
  GND         Pin 4 (GND)    Ground
```

**Important:** Put a 10uF capacitor between the Nano's RESET and GND pins. This prevents the Nano from resetting during programming. If you don't have a cap, a 120 ohm resistor between RESET and 5V also works.

### LED circuit for testing

Connect an LED + resistor from **PB3 (pin 2)** to **GND**:

```
ATtiny85 Pin 2 (PB3) ──── [220R] ──── [LED+] ──── GND
```

## Step 5: Find Your COM Port

1. Plug in the Arduino Nano via USB
2. Open **Device Manager** > Ports (COM & LPT)
3. Note the COM port (e.g. `COM21`)

Or from Git Bash / MSYS2:
```bash
ls /dev/tty*
```

## Step 6: Set Fuses (Once Per New Chip)

ATtiny85 chips ship with the clock divided by 8 (1MHz). We want the full 8MHz internal oscillator.

```bash
make fuses PORT=COM21
```

This writes:
- **LFUSE = 0xE2** — 8MHz internal oscillator, no clock prescaler
- **HFUSE = 0xDF** — SPI programming enabled, no watchdog
- **EFUSE = 0xFF** — self-programming disabled

**Only do this once per chip.** Getting fuse values wrong can brick the chip (especially the clock source bits). The values in our Makefile are safe.

### Verify fuses

```bash
make readfuses PORT=COM21
```

## Step 7: Build and Flash

### Build

```bash
make
```

This compiles `src/main.c` into `build/blink.hex` and prints flash/RAM usage:

```
Program:     142 bytes (1.7% Full)
Data:          2 bytes (0.4% Full)
```

### Flash

```bash
make flash PORT=COM21
```

avrdude uploads the HEX file through the Nano to the ATtiny85. You should see `avrdude done. Thank you.` and the LED starts blinking.

### Other useful targets

```bash
make clean        # Delete build artifacts
make size         # Show flash/RAM usage
make disasm       # Disassemble — see the generated instructions
```

## Troubleshooting

### "avr-gcc: command not found"
The toolchain `bin` folder isn't in your PATH. Verify with `echo $PATH` and check the folder actually contains `avr-gcc.exe`.

### avrdude: "can't open device"
- Wrong COM port — check Device Manager
- Arduino Nano driver issue — you may need CH340 drivers for clone Nanos

### avrdude: "Device signature = 0x000000"
- Wiring problem — double-check SCK, MISO, MOSI, RESET connections
- Missing capacitor on Nano RESET pin
- ATtiny85 not powered (check VCC/GND)

### avrdude: "Yikes! Invalid device signature" (but not 0x000000)
- Wrong MCU specified. The ATtiny85 signature is `0x1E930B`. If you see a different valid signature, you might have a different chip.

### LED doesn't blink after flashing
- Check LED polarity (long leg = anode = positive)
- Check resistor value isn't too high
- Verify the LED is on the correct pin (PB3 = physical pin 2)
- Run `make readfuses` to confirm 8MHz clock — if fuses weren't set, the chip runs at 1MHz and blinks 8x slower

### Build compiles but flash/RAM seems wrong
- Run `make clean` then `make` — stale object files can cause issues

## Project Structure

```
attiny-chrono-bare/
├── src/
│   └── main.c              # Your program
├── build/                   # Generated by make
│   ├── main.o               # Compiled object file
│   ├── blink.elf            # Linked binary
│   └── blink.hex            # Final flashable image
├── Makefile                 # Build, flash, fuse targets
└── docs/
    ├── plans/
    │   └── 2026-02-28-blink-design.md
    ├── tutorial-delay-to-interrupts.md
    └── tutorial-toolchain-setup.md
```

## Quick Reference

| Command | What it does |
|---------|-------------|
| `make` | Compile to HEX |
| `make flash PORT=COMx` | Upload to ATtiny85 |
| `make fuses PORT=COMx` | Set 8MHz fuses (once) |
| `make readfuses PORT=COMx` | Read current fuse values |
| `make size` | Show flash/RAM usage |
| `make disasm` | View disassembly |
| `make clean` | Remove build files |
