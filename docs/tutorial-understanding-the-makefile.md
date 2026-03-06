# Understanding the Makefile

A line-by-line walkthrough of the project Makefile — what each piece does, why it's there, and how the build pipeline turns `main.c` into a blinking LED.

## The Big Picture

When you type `make`, four things happen in sequence:

```
main.c ──→ main.o ──→ blink.elf ──→ blink.hex ──→ ATtiny85
        compile      link          convert         flash
       (avr-gcc)   (avr-gcc)    (avr-objcopy)   (avrdude)
```

Each step transforms the code into a format closer to what the hardware needs. The Makefile automates this pipeline and tracks dependencies so only changed files get rebuilt.

## Variables & Configuration

The top of the Makefile defines everything that might change between projects.

### MCU Settings

```makefile
MCU        = attiny85
F_CPU      = 8000000UL
```

- **`MCU`** tells the compiler and programmer which chip we're targeting. This flows into `-mmcu=attiny85` for the compiler and `-p attiny85` for avrdude.
- **`F_CPU`** is the CPU clock frequency in Hz. `8000000UL` = 8MHz. The `UL` suffix makes it an unsigned long constant, which prevents integer overflow in timing calculations. This isn't a hardware setting — it's a promise to the code that you've configured the chip to run at this speed (via fuses).

### Toolchain

```makefile
CC         = avr-gcc
OBJCOPY    = avr-objcopy
OBJDUMP    = avr-objdump
SIZE       = avr-size
AVRDUDE    = avrdude
```

These name the tools. If your toolchain is installed somewhere unusual, you can change these to full paths (e.g., `CC = /opt/avr/bin/avr-gcc`) without touching the rest of the Makefile.

## Compiler Flags

```makefile
CFLAGS     = -mmcu=$(MCU) -DF_CPU=$(F_CPU) -Os -Wall -Wextra -std=c11
LDFLAGS    = -mmcu=$(MCU)
```

`CFLAGS` are passed to every compile step, `LDFLAGS` to the linker. Let's unpack each flag.

### `-mmcu=attiny85`

This is the most important flag. It tells avr-gcc which chip you're compiling for, and it affects everything:

- **Register definitions** — the ATtiny85 has `TIMSK` while the ATmega328P has `TIMSK0`. The `-mmcu` flag selects the right header files so `#include <avr/io.h>` gives you the correct register names.
- **Instruction set** — the ATtiny85 supports a reduced set of AVR instructions compared to larger chips. The compiler won't emit instructions your chip can't execute.
- **Memory limits** — the linker knows the ATtiny85 has 8KB flash and 512 bytes of RAM, and will error if your program doesn't fit.
- **Interrupt vectors** — the startup code and vector table are generated to match the ATtiny85's interrupt layout.

This flag appears in both `CFLAGS` (compile) and `LDFLAGS` (link) because both stages need to know the target.

### `-DF_CPU=8000000UL`

The `-D` flag defines a preprocessor macro, just like writing `#define F_CPU 8000000UL` at the top of every source file. The code never uses this directly — it flows into library macros. For example, if you were using `_delay_ms()`, the delay library would use `F_CPU` to calculate how many loop iterations equal the requested delay.

Defining it in the Makefile rather than in source code means you can change the clock speed in one place. If you switched to a 1MHz clock, you'd change `F_CPU` here and the entire project adjusts.

### `-Os` — Optimize for Size

This tells the compiler to make the binary as small as possible. On a chip with only 8,192 bytes of flash, this matters.

How much difference does it make? Our blink program compiles to **204 bytes** with `-Os`. Rebuild with no optimization (`-O0`) and it grows to **296 bytes** — a 45% increase from a 68-line program. In a larger project, the difference is even more dramatic.

You can try this yourself:

```bash
# Normal build (with -Os)
make clean && make
# → Program: 204 bytes (2.5% Full)

# Rebuild with no optimization
make clean
mkdir -p build
avr-gcc -mmcu=attiny85 -DF_CPU=8000000UL -O0 -Wall -Wextra -std=c11 \
    -c src/main.c -o build/main.o
avr-gcc -mmcu=attiny85 build/main.o -o build/blink.elf
avr-size --mcu=attiny85 --format=avr build/blink.elf
# → Program: 296 bytes (3.6% Full)

# Restore the normal build
make clean && make
```

Some of what `-Os` does: inlines small functions, eliminates dead code, reuses common instruction sequences, and chooses shorter instruction encodings. The AVR architecture has single-cycle `sbi`/`cbi` instructions for setting and clearing I/O bits — with `-Os`, the compiler will use these instead of the longer load-modify-store sequence that `-O0` generates.

### `-Wall -Wextra`

Enable compiler warnings. `-Wall` catches common issues (unused variables, missing return statements). `-Wextra` adds stricter checks (unused function parameters, sign comparison issues). On a microcontroller, where bugs are hard to debug, you want every warning the compiler can give you.

### `-std=c11`

Use the C11 standard. This is mostly a consistency choice — it ensures the code compiles the same way regardless of the compiler's default. C11 gives us features like `_Static_assert` and anonymous structs if we need them later.

## The Build Pipeline

Now let's trace how Make uses these variables to build the project.

### Source and Output Files

```makefile
SRC_DIR    = src
BUILD_DIR  = build
TARGET     = blink

SOURCES    = $(wildcard $(SRC_DIR)/*.c)
OBJECTS    = $(patsubst $(SRC_DIR)/%.c,$(BUILD_DIR)/%.o,$(SOURCES))
```

- **`$(wildcard $(SRC_DIR)/*.c)`** — finds all `.c` files in `src/`. Right now that's just `src/main.c`, but if you add more source files, they'll get picked up automatically.
- **`$(patsubst ...)`** — transforms the list of source paths into object paths. `src/main.c` becomes `build/main.o`. This tells Make what it needs to build.

### The Default Target

```makefile
all: $(BUILD_DIR)/$(TARGET).hex size
```

When you type `make` with no arguments, Make runs the first target — `all`. This says: build `build/blink.hex`, then run `size` to print memory usage. The `size` target depends on the `.elf` file, which depends on the `.o` files, which depend on the `.c` files. Make traces this chain automatically.

### Step 1: Compile `.c` → `.o`

```makefile
$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@
```

This is a **pattern rule** — the `%` matches any filename. It says: to build `build/main.o`, compile `src/main.c`.

The symbols:
- **`$<`** — the first prerequisite (the `.c` file)
- **`$@`** — the target (the `.o` file)
- **`-c`** — compile only, don't link

The **`| $(BUILD_DIR)`** is an order-only prerequisite. It means "make sure `build/` exists before compiling, but don't recompile just because the directory's timestamp changed." Without the `|`, touching the build directory would trigger a rebuild of everything.

What the compiler produces: an **object file** containing machine code for the ATtiny85, but with unresolved references. If `main.c` calls a function from another file, the `.o` won't have the actual address yet — that's the linker's job.

### Step 2: Link `.o` → `.elf`

```makefile
$(BUILD_DIR)/$(TARGET).elf: $(OBJECTS)
	$(CC) $(LDFLAGS) $^ -o $@
```

The linker combines all object files into a single ELF binary. **`$^`** means "all prerequisites" — if you had `main.o` and `display.o`, both would be passed to the linker.

The linker does several things:
- **Resolves references** between object files (function calls, shared variables)
- **Adds startup code** — the `__vectors` table and `__init` routine that runs before `main()`. This is where the interrupt vector table lives.
- **Assigns memory addresses** — places code in flash (starting at 0x0000) and variables in RAM (starting at 0x0060 on the ATtiny85)
- **Checks fit** — errors out if the program exceeds 8KB flash or 512 bytes RAM

The ELF file contains the machine code plus metadata: section names, symbol addresses, debug info. You can inspect it with `make disasm`.

### Step 3: Convert `.elf` → `.hex`

```makefile
$(BUILD_DIR)/$(TARGET).hex: $(BUILD_DIR)/$(TARGET).elf
	$(OBJCOPY) -O ihex -R .eeprom $< $@
```

avrdude can't flash an ELF file — it needs Intel HEX format, a text-based format that specifies raw bytes and their addresses. This is what actually gets written to the chip's flash memory.

- **`-O ihex`** — output Intel HEX format
- **`-R .eeprom`** — remove the EEPROM section. If your code stored data in EEPROM, it would go in a separate file. We don't use EEPROM, but the flag prevents an empty section from cluttering the output.

### Creating the Build Directory

```makefile
$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)
```

If `build/` doesn't exist, create it. The `-p` flag prevents an error if it already exists. This rule only runs when needed because it's an order-only prerequisite (`|`) in the compile step — Make checks that the directory exists, but won't rebuild source files just because the directory's timestamp changed.

### Why Understand the Pipeline?

Most Arduino users never see this — the IDE hides it behind a single "Upload" button. Knowing what's actually happening gives you real advantages:

- **Debugging build errors** — when the linker says "undefined reference to `timer0_init`", you know it's a Step 2 problem (missing object file), not a Step 1 problem (bad code).
- **Reading `make disasm`** — the disassembly shows you exactly what the compiler generated. You can verify your `sbi`/`cbi` instructions are there, spot unnecessary overhead, or understand why a function is larger than expected.
- **Porting to other chips** — change `MCU` and `F_CPU`, adjust fuse values, and the same Makefile works for an ATtiny13, ATmega328P, or any AVR target. The pipeline is identical.
- **Working with multi-file projects** — as your project grows, you'll add source files. The pattern rules and `$(wildcard ...)` handle this automatically, but when something breaks, you need to know which step failed and why.
- **Optimizing for a tight fit** — when your program approaches 8KB, understanding that `-Os` controls code generation and `avr-size` reads the ELF sections lets you make informed trade-offs instead of guessing.

## Flash & Fuse Targets

These targets handle getting code onto the chip through avrdude and the Arduino Nano ISP programmer.

### Programmer Settings

```makefile
PROGRAMMER = stk500v1
BAUD       = 19200
PORT       ?= COM21
```

- **`stk500v1`** — the protocol the ArduinoISP sketch speaks. This isn't the Nano itself — it's the protocol layer between avrdude and the sketch.
- **`19200`** — the baud rate between your PC and the Nano over USB serial. This is separate from the SPI clock speed to the ATtiny85 (ArduinoISP handles that internally).
- **`?=`** — "set only if not already defined." This lets you override the port from the command line (`make flash PORT=COM7`) without editing the Makefile. If you don't specify one, it defaults to `COM21`.

### Flashing

```makefile
flash: $(BUILD_DIR)/$(TARGET).hex
	$(AVRDUDE) -c $(PROGRAMMER) -p $(MCU) -P $(PORT) -b $(BAUD) -U flash:w:$<:i
```

This target depends on the `.hex` file — if you haven't built yet, Make builds first automatically.

The avrdude flags:
- **`-c stk500v1`** — programmer protocol
- **`-p attiny85`** — target chip (avrdude uses this to verify the device signature)
- **`-P COM21`** — serial port
- **`-b 19200`** — baud rate
- **`-U flash:w:$<:i`** — the memory operation. This reads as: memory type **`flash`**, operation **`w`** (write), file **`$<`** (the .hex file), format **`i`** (Intel HEX)

The `-U` flag is avrdude's Swiss Army knife. The format is always `memory:operation:file:format`. You can chain multiple `-U` flags in one command, which is exactly what the fuse targets do.

### Setting Fuses

```makefile
LFUSE      = 0xE2
HFUSE      = 0xDF
EFUSE      = 0xFF

fuses:
	$(AVRDUDE) -c $(PROGRAMMER) -p $(MCU) -P $(PORT) -b $(BAUD) \
		-U lfuse:w:$(LFUSE):m -U hfuse:w:$(HFUSE):m -U efuse:w:$(EFUSE):m
```

Three `-U` operations in one command, each writing a fuse byte. The format flag **`m`** means "immediate value" — the data comes from the command line rather than a file.

The fuse values configure hardware behavior that persists even when the chip is unpowered:
- **LFUSE = 0xE2** — 8MHz internal oscillator, no clock divider
- **HFUSE = 0xDF** — SPI programming stays enabled, RESET pin functions as reset
- **EFUSE = 0xFF** — self-programming disabled

Notice this target has no prerequisites — it doesn't depend on any built files. Fuses are a chip configuration step, not part of the build pipeline.

### Reading Fuses

```makefile
readfuses:
	$(AVRDUDE) -c $(PROGRAMMER) -p $(MCU) -P $(PORT) -b $(BAUD) \
		-U lfuse:r:-:h -U hfuse:r:-:h -U efuse:r:-:h
```

Same `-U` structure, but operation **`r`** (read), file **`-`** (stdout), format **`h`** (hex). This prints the current fuse values so you can verify they're correct without modifying anything.

## Utility Targets

### Size

```makefile
size: $(BUILD_DIR)/$(TARGET).elf
	$(SIZE) --mcu=$(MCU) --format=avr $<
```

Reads the ELF file's section headers and reports how much flash and RAM your program uses:

```
Program:     204 bytes (2.5% Full)    ← flash (code + constant data)
Data:          2 bytes (0.4% Full)    ← RAM (global/static variables)
```

The "Program" number comes from three ELF sections:
- **`.text`** — your compiled code and the interrupt vector table
- **`.data`** — initialized global variables (copied from flash to RAM at startup)
- **`.bootloader`** — empty for us, used by bootloader-based chips

The "Data" number comes from:
- **`.data`** — initialized globals (counted in both, because they occupy flash for storage and RAM at runtime)
- **`.bss`** — zero-initialized globals (RAM only — the startup code zeroes this region)
- **`.noinit`** — uninitialized globals (RAM only, not zeroed)

Our 2 bytes of data is `wait_time_ms` — a `uint16_t` sitting in `.bss`.

The `--format=avr` flag enables the percentage calculations. Without it, `avr-size` prints raw section sizes with no context for how close you are to the limit.

### Disassembly

```makefile
disasm: $(BUILD_DIR)/$(TARGET).elf
	$(OBJDUMP) -d -S $<
```

Dumps the generated machine code as human-readable AVR assembly. The flags:
- **`-d`** — disassemble executable sections
- **`-S`** — interleave source code with assembly (requires compiling with `-g`, which we don't use, so you'll see pure assembly)

This is how you verify the compiler is generating what you expect. For example, you can confirm that `PORTB |= (1 << PB3)` compiles down to a single `sbi` instruction rather than a load-or-store sequence.

### Clean

```makefile
clean:
	rm -rf $(BUILD_DIR)
```

Deletes the entire `build/` directory. Use this when you want a guaranteed fresh build, or if you've changed flags and want to make sure stale object files don't carry forward.

## Make Mechanics

A few Make-specific details that explain the syntax used throughout.

### `.PHONY`

```makefile
.PHONY: all flash fuses readfuses size disasm clean
```

Make normally checks whether a target's file exists and is up to date. But `flash`, `clean`, and `size` aren't files — they're actions. `.PHONY` tells Make: "always run this target's recipe when asked, don't look for a file with this name."

Without `.PHONY`, if you happened to create a file called `clean` in the project root, `make clean` would say "clean is up to date" and do nothing.

### Variable Assignment

The Makefile uses two types of assignment:

- **`=`** (and its shorthand `CFLAGS = ...`) — simple assignment. The value is set once. This is all you need for most variables.
- **`?=`** (`PORT ?= COM21`) — conditional assignment. Set the value only if the variable isn't already defined. This is what lets `make flash PORT=COM7` override the default — command-line variables are defined before the Makefile runs, so `?=` sees that `PORT` already has a value and skips the assignment.

### Automatic Variables

You've seen these in the recipes:

| Variable | Meaning | Example |
|----------|---------|---------|
| `$@` | The target being built | `build/main.o` |
| `$<` | The first prerequisite | `src/main.c` |
| `$^` | All prerequisites | `build/main.o build/display.o` |

These keep rules generic. The pattern rule `$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c` works for any source file because `$<` and `$@` adapt to whatever `%` matches.

### Pattern Rules

```makefile
$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c | $(BUILD_DIR)
```

The `%` is a wildcard that matches once and carries through. When Make needs `build/main.o`, it matches `%` to `main`, then looks for `src/main.c`. If you added `src/display.c`, the same rule would automatically know how to build `build/display.o`.

### Order-Only Prerequisites

The `| $(BUILD_DIR)` after the pipe symbol means: make sure `build/` exists, but don't treat its timestamp as a dependency. Normal prerequisites trigger a rebuild when they're newer than the target. A directory's timestamp changes whenever any file inside it is created or deleted — without the `|`, adding a new source file would recompile every existing file.
