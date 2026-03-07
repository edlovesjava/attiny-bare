# References & Resources

Datasheets, tools, suppliers, and community resources for ATtiny85 bare-metal development.

## Bill of Materials (BOM)

### Complete BOM — All Tutorials

Everything you need to complete the entire tutorial series. If you want to buy once and be set, get this list.

| Qty | Part | Notes |
|-----|------|-------|
| 1 | ATtiny85-20PU (DIP-8) | The microcontroller |
| 1 | Arduino Nano (or clone) | ISP programmer — CH340 clones work fine |
| 1 | USB cable for Nano | Type-A to Mini-B (most Nanos) |
| 1 | Breadboard (half or full size) | Prototyping platform |
| ~10 | Jumper wires (male-to-male) | Breadboard connections |
| 2 | LEDs (any standard 3mm or 5mm) | Blink LED + button indicator LED |
| 2 | 220 ohm resistors | Current limiters for LEDs |
| 1 | 10uF electrolytic capacitor | Nano auto-reset disable |
| 1 | Momentary pushbutton | Tactile switch, breadboard-friendly |
| 1 | SSD1306 OLED display (128x64, I2C) | 0.96" most common; 128x32 also works |
| 1 | BME280 breakout board (I2C) | Temperature, humidity, pressure sensor |

Total cost: ~$15–25 depending on sourcing (less with AliExpress, more with Adafruit/SparkFun).

### BOM by Tutorial Stage

Buy only what you need for the stage you're starting. Each stage adds to the previous.

**v1–v2: Blink (busy-wait and interrupts)**

| Qty | Part |
|-----|------|
| 1 | ATtiny85-20PU |
| 1 | Arduino Nano + USB cable |
| 1 | Breadboard |
| ~6 | Jumper wires |
| 1 | LED |
| 1 | 220 ohm resistor |
| 1 | 10uF electrolytic capacitor |

**v3: Button + second LED** — add:

| Qty | Part |
|-----|------|
| 1 | Momentary pushbutton |
| 1 | LED (second) |
| 1 | 220 ohm resistor (second) |

**v4: I2C driver** — no new hardware (reuses existing components, pin reassignment only)

**v5: OLED display** — add:

| Qty | Part |
|-----|------|
| 1 | SSD1306 OLED display module (I2C, 128x64) |

Most modules come with header pins. Solder them on or use a module with pre-soldered headers.

**v6: BME280 sensor** — add:

| Qty | Part |
|-----|------|
| 1 | BME280 breakout board (I2C) |

Use a breakout board (Adafruit, SparkFun, or generic) — not the bare sensor. The raw BME280 is a tiny BGA package that can't be breadboarded.

## Datasheets & Technical Documentation

| Resource | Description |
|----------|-------------|
| [ATtiny85 Datasheet (PDF)](https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-2586-AVR-8-bit-Microcontroller-ATtiny25-ATtiny45-ATtiny85_Datasheet.pdf) | The definitive reference — 234 pages covering every register, peripheral, electrical spec, and timing diagram. Chapters 11–12 cover Timer/Counter0 and Timer/Counter1. |
| [AVR Instruction Set Manual (PDF)](https://ww1.microchip.com/downloads/en/DeviceDoc/AVR-InstructionSet-Manual-DS40002198.pdf) | All AVR assembly instructions with cycle counts, opcodes, and descriptions. Essential for reading `make disasm` output. |
| [AVR Libc Reference](https://www.nongnu.org/avr-libc/user-manual/) | Documentation for the C library that ships with avr-gcc — covers `<avr/io.h>`, `<avr/interrupt.h>`, `<util/delay.h>`, and all the macros and functions available on AVR. |
| [AVR Libc FAQ](https://www.nongnu.org/avr-libc/user-manual/FAQ.html) | Common pitfalls and questions — why `volatile` matters, how to use progmem, interrupt caveats. |

## Software Downloads

| Tool | Source | Notes |
|------|--------|-------|
| [AVR 8-bit GCC Toolchain](https://www.microchip.com/en-us/tools-resources/develop/microchip-studio/gcc-compilers) | Microchip | Download the standalone `.zip` for Windows, not the Microchip Studio installer. Contains avr-gcc, avr-objcopy, avr-objdump, avr-size. |
| [avrdude](https://github.com/avrdudes/avrdude/releases) | GitHub | The flash programmer. Download the latest release for your platform. Also bundled with the Arduino IDE. |
| [GNU Make](https://www.gnu.org/software/make/) | GNU Project | The build system. On Windows, install via [MSYS2](https://www.msys2.org) (`pacman -S make`), [Chocolatey](https://chocolatey.org/) (`choco install make`), or use the copy bundled with Git Bash. |
| [Arduino IDE](https://www.arduino.cc/en/software) | Arduino | Needed only to upload the ArduinoISP sketch to the Nano. Not used for ATtiny85 development. |
| [Git for Windows](https://gitforwindows.org/) | GitHub | Provides Git Bash, a Unix-like shell on Windows. Useful for running Makefiles. |
| [CH340 USB-Serial Driver](http://www.wch-ic.com/downloads/CH341SER_EXE.html) | WCH | Required for Arduino Nano clones that use the CH340 USB-serial chip instead of FTDI. Windows may install this automatically. |

## Hardware Sourcing

### Microcontrollers

| Part | Package | Where to Buy |
|------|---------|-------------|
| ATtiny85-20PU | 8-pin DIP (breadboard-friendly) | [Mouser](https://www.mouser.com/ProductDetail/Microchip-Technology-Atmel/ATTINY85-20PU?qs=8jWQYweyg6NCiOaBG4Rmcg%3D%3D), [DigiKey](https://www.digikey.com/en/products/detail/microchip-technology/ATTINY85-20PU/735469), [Amazon](https://www.amazon.com/s?k=attiny85+dip) |
| Arduino Nano (or clone) | — | [Amazon](https://www.amazon.com/s?k=arduino+nano), [AliExpress](https://www.aliexpress.com/w/wholesale-arduino-nano.html). Clones with CH340 chip work fine and cost less. |

### Components

| Part | Value | Purpose |
|------|-------|---------|
| LED | Any standard 5mm or 3mm | Visual output for blink program |
| Resistor | 220–470 ohm | Current limiter for LED |
| Capacitor | 10uF electrolytic | Prevents Nano auto-reset during ISP programming |
| Resistor (alt) | 120 ohm | Alternative to capacitor for Nano reset disable |
| Breadboard | Half-size or full-size | Prototyping — no soldering needed |
| Jumper wires | Male-to-male | Connections between Nano and ATtiny85 |

General component kits from Amazon, Adafruit, or SparkFun cover all of the above.

### Suppliers

| Supplier | Best For |
|----------|----------|
| [DigiKey](https://www.digikey.com/) | Specific part numbers, datasheets, fast US shipping |
| [Mouser](https://www.mouser.com/) | Same as DigiKey — large catalog, reliable |
| [Adafruit](https://www.adafruit.com/) | Beginner-friendly kits, tutorials, good documentation |
| [SparkFun](https://www.sparkfun.com/) | Breakout boards, learning kits, hookup guides |
| [Amazon](https://www.amazon.com/) | Bulk packs of common components (LEDs, resistors, Nano clones) |
| [AliExpress](https://www.aliexpress.com/) | Cheapest option for bulk components and clones. Slower shipping. |

## AVR Fuse Calculators

| Tool | Description |
|------|-------------|
| [Engbedded Fuse Calculator](https://www.engbedded.com/fusecalc/) | Web-based tool — select your chip, check boxes for clock source, prescaler, and features. Generates LFUSE/HFUSE/EFUSE values and the avrdude command. |
| [ElectroDragon Fuse Calculator](https://www.electrodragon.com/w/AVR_Fuse_Calculator) | Alternative web calculator with a similar interface. |

These are invaluable when you need to change fuse values — much safer than decoding the datasheet bit tables by hand.

## Arduino as ISP

| Resource | Description |
|----------|-------------|
| [ArduinoISP Official Guide](https://docs.arduino.cc/built-in-examples/arduino-isp/ArduinoISP/) | Arduino's documentation for using an Arduino board as an ISP programmer. Covers the sketch, wiring, and IDE setup. |
| [Arduino SPI Library Reference](https://docs.arduino.cc/language-reference/en/functions/communication/SPI/) | Background on the SPI protocol as implemented by Arduino. Useful for understanding the ISP communication layer. |

## Community & Learning

| Resource | Description |
|----------|-------------|
| [AVRFreaks Forum](https://www.avrfreaks.net/) | The main community forum for AVR development. Active since the early 2000s — decades of troubleshooting posts and project examples. |
| [r/avr](https://www.reddit.com/r/avr/) | Reddit community for AVR microcontroller projects and questions. |
| [r/embedded](https://www.reddit.com/r/embedded/) | Broader embedded systems community — good for questions that go beyond AVR. |

## Books

| Title | Author | Notes |
|-------|--------|-------|
| *Make: AVR Programming* | Elliot Williams | Practical introduction to bare-metal AVR using ATmega chips. Covers the same concepts (registers, timers, interrupts, ADC) with hands-on projects. |
| *The AVR Microcontroller and Embedded Systems* | Muhammad Ali Mazidi | More academic — covers AVR architecture, assembly language, and peripherals in textbook format. |
