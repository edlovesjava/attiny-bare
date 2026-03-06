# Glossary

Quick reference for terms, acronyms, and register names used throughout the tutorials.

## General

| Term | Definition |
|------|-----------|
| **AVR** | A family of 8-bit microcontrollers designed by Atmel (now Microchip). The ATtiny85 is an AVR chip. |
| **MCU** | Microcontroller Unit — a small computer on a single chip with CPU, memory, and I/O peripherals. |
| **Bare metal** | Programming directly on the hardware without an operating system or framework like Arduino. You control registers and interrupts yourself. |
| **Toolchain** | The set of programs used to build software — compiler, linker, and related tools. Our toolchain is AVR-GCC + avrdude + Make. |
| **Cross-compilation** | Compiling code on one platform (your PC) to run on a different platform (the ATtiny85). The compiled code can't run on your PC — it contains AVR instructions, not x86. |

## Communication Protocols

| Term | Definition |
|------|-----------|
| **SPI** | Serial Peripheral Interface — a 4-wire protocol for communication between chips. Used by ISP programming to write code to the ATtiny85. |
| **SCK** | Serial Clock — the SPI clock line. The master (Nano) generates this signal to synchronize data transfer. |
| **MOSI** | Master Out, Slave In — the SPI data line from the programmer to the target chip. |
| **MISO** | Master In, Slave Out — the SPI data line from the target chip back to the programmer. |
| **ISP** | In-System Programming — a method of programming a chip while it's sitting in your circuit, using SPI. No need to remove the chip from the breadboard. |
| **USB** | Universal Serial Bus — the connection between your PC and the Arduino Nano. Carries serial data that avrdude uses to send commands. |
| **DTR** | Data Terminal Ready — a serial control signal. When your PC opens a serial connection, DTR toggles, which triggers the Nano's auto-reset circuit. This is why you need a capacitor on the Nano's RESET pin during programming. |
| **Baud rate** | The speed of serial communication in symbols per second. Our setup uses 19200 baud between the PC and the Nano. |
| **STK500v1** | The programming protocol spoken by the ArduinoISP sketch. avrdude sends STK500v1 commands over serial; the Nano translates them into SPI signals for the ATtiny85. |

## Electrical

| Term | Definition |
|------|-----------|
| **VCC** | Supply voltage — the positive power rail. We run the ATtiny85 at 5V from the Nano's USB power. |
| **GND** | Ground — the zero-voltage reference. All signals are measured relative to GND. Every chip in the circuit must share a common GND connection. |
| **RESET** | An active-low pin that restarts the chip. Normally held high by an internal pull-up resistor. Pulling it low puts the chip into programming mode. On the ATtiny85, this is pin 1 (PB5). |
| **LED** | Light Emitting Diode — a component that lights up when current flows through it in the correct direction (anode to cathode). |
| **Anode** | The positive terminal of an LED (the longer leg). Connect to the I/O pin through a resistor. |
| **Cathode** | The negative terminal of an LED (the shorter leg, flat side of the casing). Connect to GND. |
| **Current-limiting resistor** | A resistor (typically 220-470 ohm) placed in series with an LED to prevent it from drawing too much current and burning out. |
| **Breadboard** | A prototyping board with rows of connected holes. Components and jumper wires plug in without soldering. |
| **COMx** | The name Windows assigns to serial ports (COM1, COM21, etc.). This is how avrdude addresses the Arduino Nano. Find yours in Device Manager > Ports. |

## ATtiny85 Pins

| Term | Definition |
|------|-----------|
| **PB0–PB5** | Port B, bits 0 through 5 — the six I/O pins on the ATtiny85. Each can be configured as input or output. PB0–PB2 double as SPI lines (MOSI, MISO, SCK). |
| **Pin 1–Pin 8** | Physical pin numbers on the DIP package. Pin 1 is marked with a dot on the chip. Don't confuse physical pin numbers with port bit numbers — PB3 is physical pin 2. |

## ATtiny85 Registers

### I/O Registers

| Register | Full Name | Purpose |
|----------|-----------|---------|
| **DDRB** | Data Direction Register B | Controls whether each pin is input (0) or output (1). `DDRB \|= (1 << PB3)` makes PB3 an output. |
| **PORTB** | Port B Data Register | Sets output pins high (1) or low (0). For input pins, enables (1) or disables (0) the internal pull-up resistor. |
| **PINB** | Port B Input Register | Reads the current state of the pins. Read-only — reflects actual voltage levels. |

### Timer Registers

| Register | Full Name | Purpose |
|----------|-----------|---------|
| **TCCR0A** | Timer/Counter0 Control Register A | Selects the timer mode. We set `WGM01` for CTC mode. |
| **TCCR0B** | Timer/Counter0 Control Register B | Selects the clock prescaler. `CS01 \| CS00` gives a prescaler of 64. |
| **TCNT0** | Timer/Counter0 Count | The current count value. Hardware increments this every clock tick (after prescaling). You rarely read or write this directly. |
| **OCR0A** | Output Compare Register 0A | The compare value. In CTC mode, the timer resets to 0 when `TCNT0` matches this value. We set it to 124 for a 1ms interval. |
| **TIMSK** | Timer Interrupt Mask Register | Enables timer interrupts. Setting `OCIE0A` enables the compare match A interrupt. Note: on ATmega chips this register is called `TIMSK0`. |

### Register Bit Names

| Bit | Register | Meaning |
|-----|----------|---------|
| **WGM01** | TCCR0A | Waveform Generation Mode bit 1 — selects CTC mode when set alone. |
| **CS01, CS00** | TCCR0B | Clock Select bits — together (`011`) select a prescaler of 64. |
| **OCIE0A** | TIMSK | Output Compare Interrupt Enable 0A — enables the interrupt that fires when `TCNT0` matches `OCR0A`. |

## Timer Concepts

| Term | Definition |
|------|-----------|
| **Timer/Counter** | A hardware peripheral that counts clock cycles independently of the CPU. The ATtiny85 has two: Timer/Counter0 (8-bit) and Timer/Counter1 (8-bit with PLL). |
| **CTC mode** | Clear Timer on Compare — the timer counts up to `OCR0A`, fires an interrupt, and resets to 0. This gives precise, repeatable intervals. |
| **Prescaler** | A clock divider that slows the timer's count rate. With an 8MHz CPU clock and a prescaler of 64, the timer counts at 125kHz (8,000,000 / 64). |
| **Interrupt** | A hardware signal that pauses the CPU's current work, runs a handler function (ISR), then resumes. Used for time-critical or background tasks. |
| **ISR** | Interrupt Service Routine — the function that runs when an interrupt fires. Declared with `ISR(TIMER0_COMPA_vect)` in avr-libc. Keep ISRs short and fast. |
| **Vector table** | A table at the start of flash memory listing the address of each ISR. When an interrupt fires, the hardware jumps to the corresponding address in this table. |
| **sei()** | Set Enable Interrupts — enables global interrupts. No ISR will fire until this is called. |
| **cli()** | Clear Interrupts — disables global interrupts. Used to protect multi-byte reads from being corrupted by an ISR firing mid-read. |
| **Atomic read** | Reading a multi-byte value with interrupts disabled so the ISR can't modify it between byte reads. Essential for any shared variable wider than 8 bits on an 8-bit CPU. |

## C Programming Concepts

| Term | Definition |
|------|-----------|
| **volatile** | A C keyword that tells the compiler: "this variable can change at any time (e.g., in an ISR), so always read it from RAM — don't cache it in a register." Without it, the compiler may optimize away reads of ISR-modified variables. |
| **uint8_t, uint16_t** | Fixed-width unsigned integer types. `uint8_t` is 1 byte (0–255), `uint16_t` is 2 bytes (0–65535). Defined in `<stdint.h>`. These are preferred over `int` in embedded code because their size is explicit and predictable. |
| **UL** | Unsigned Long suffix — appended to numeric literals (e.g., `8000000UL`) to ensure the compiler treats them as unsigned long integers. Prevents overflow in arithmetic with large values. |
| **Bit manipulation** | Using bitwise operators to set, clear, or test individual bits in a register. Common patterns: `\|= (1 << n)` sets bit n, `&= ~(1 << n)` clears bit n, `& (1 << n)` tests bit n. |
| **sbi / cbi** | AVR assembly instructions — Set Bit in I/O register / Clear Bit in I/O register. Each executes in a single clock cycle. The compiler generates these from C bit operations when optimizing with `-Os`. |

## Build Pipeline

| Term | Definition |
|------|-----------|
| **GCC** | GNU Compiler Collection. `avr-gcc` is the AVR cross-compiler variant that produces machine code for AVR chips. |
| **Object file (.o)** | The output of compiling a single `.c` file. Contains machine code but with unresolved references to functions and variables in other files. |
| **ELF** | Executable and Linkable Format — the standard binary format produced by the linker. Contains machine code, symbol tables, section headers, and debug info. Not directly flashable. |
| **Intel HEX (.hex)** | A text-based format specifying raw bytes and memory addresses. This is what avrdude writes to the chip's flash. Converted from ELF by `avr-objcopy`. |
| **Linker** | Combines object files into a single binary. Resolves cross-file references, assigns memory addresses, adds startup code, and checks that the program fits in the chip's memory. |
| **avrdude** | AVR Downloader/Uploader — the tool that communicates with the programmer (Nano) and writes HEX files to the chip's flash memory. Also reads/writes fuses. |
| **Flash** | Non-volatile program memory. The ATtiny85 has 8KB. Your compiled code lives here and persists without power. |
| **RAM (SRAM)** | Volatile data memory — 512 bytes on the ATtiny85. Holds global variables, the stack, and local variables at runtime. Contents are lost when power is removed. |
| **EEPROM** | Electrically Erasable Programmable Read-Only Memory — 512 bytes on the ATtiny85. Non-volatile storage for data that should survive power cycles (calibration values, settings). Slower to write than RAM. |

## Fuses

| Term | Definition |
|------|-----------|
| **Fuse** | Configuration bits stored in special non-volatile memory on the chip. They control hardware behavior like clock source, reset pin function, and programming access. Set with avrdude, not from your program. |
| **LFUSE** | Low Fuse byte — controls clock source and startup time. Our value `0xE2` selects the 8MHz internal oscillator with no clock divider. |
| **HFUSE** | High Fuse byte — controls features like SPI programming, watchdog, and the RESET pin. Our value `0xDF` keeps SPI programming enabled and RESET functioning normally. |
| **EFUSE** | Extended Fuse byte — controls self-programming. Our value `0xFF` disables it. |
| **RSTDISBL** | Reset Disable — a fuse bit in HFUSE that repurposes the RESET pin as a regular I/O pin (PB5). **Setting this disables ISP programming permanently** — you need a high-voltage programmer to recover. Our fuse values keep this disabled. |
| **Clock prescaler** | A fuse-controlled divider on the system clock. New ATtiny85 chips ship with the prescaler set to divide-by-8, running at 1MHz instead of 8MHz. Setting LFUSE to `0xE2` removes this divider. |
| **High-voltage programmer** | A special programmer that applies 12V to the RESET pin to recover chips with RSTDISBL set or other fuse misconfigurations. Not needed if you use safe fuse values. |

## Make

| Term | Definition |
|------|-----------|
| **Target** | Something Make can build or run — a file (`build/main.o`) or an action (`clean`, `flash`). |
| **Prerequisite** | A file or target that must be up-to-date before the target's recipe runs. If a prerequisite is newer than the target, Make rebuilds the target. |
| **Recipe** | The shell command(s) that Make runs to build a target. Must be indented with a tab character. |
| **Pattern rule** | A rule with `%` as a wildcard. `$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c` matches any `.c` file and knows how to compile it. |
| **.PHONY** | Declares targets that aren't files. Without this, `make clean` would do nothing if a file named `clean` existed. |
| **?=** | Conditional assignment — sets a variable only if it isn't already defined. Lets command-line values (`make flash PORT=COM7`) override Makefile defaults. |
| **$@, $<, $^** | Automatic variables — `$@` is the target, `$<` is the first prerequisite, `$^` is all prerequisites. |
| **Order-only prerequisite** | A prerequisite after `\|` that must exist but whose timestamp doesn't trigger rebuilds. Used for directories. |

## ELF Sections

| Section | Location | Purpose |
|---------|----------|---------|
| **.text** | Flash | Compiled code and the interrupt vector table. |
| **.data** | Flash + RAM | Initialized global variables. Stored in flash, copied to RAM at startup. |
| **.bss** | RAM | Zero-initialized global variables. Not stored in flash — the startup code zeroes this region. |
| **.noinit** | RAM | Uninitialized global variables. Not zeroed at startup — retains whatever value was in RAM. |
| **.eeprom** | EEPROM | Data destined for EEPROM. Stripped out by `avr-objcopy -R .eeprom` during the build. |
