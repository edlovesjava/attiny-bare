# ATtiny85 Bare Metal - Makefile
# Toolchain: Microchip AVR-GCC + avrdude

# MCU settings
MCU        = attiny85
F_CPU      = 8000000UL

# Toolchain - adjust paths if not in PATH
CC         = avr-gcc
OBJCOPY    = avr-objcopy
OBJDUMP    = avr-objdump
SIZE       = avr-size
AVRDUDE    = avrdude

# Compiler flags
CFLAGS     = -mmcu=$(MCU) -DF_CPU=$(F_CPU) -Os -Wall -Wextra -std=c11
LDFLAGS    = -mmcu=$(MCU)

# Programmer settings (Arduino Nano as ISP)
PROGRAMMER = stk500v1
BAUD       = 19200
PORT       ?= COM39

# Fuse values (8MHz internal oscillator)
LFUSE      = 0xE2
HFUSE      = 0xDF
EFUSE      = 0xFF

# Source files
SRC_DIR    = src
BUILD_DIR  = build
TARGET     = blink

SOURCES    = $(wildcard $(SRC_DIR)/*.c)
OBJECTS    = $(patsubst $(SRC_DIR)/%.c,$(BUILD_DIR)/%.o,$(SOURCES))

# Default target
all: $(BUILD_DIR)/$(TARGET).hex size

# Compile .c to .o
$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

# Link .o to .elf
$(BUILD_DIR)/$(TARGET).elf: $(OBJECTS)
	$(CC) $(LDFLAGS) $^ -o $@

# Convert .elf to .hex
$(BUILD_DIR)/$(TARGET).hex: $(BUILD_DIR)/$(TARGET).elf
	$(OBJCOPY) -O ihex -R .eeprom $< $@

# Create build directory
$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

# Flash the hex file
flash: $(BUILD_DIR)/$(TARGET).hex
	$(AVRDUDE) -c $(PROGRAMMER) -p $(MCU) -P $(PORT) -b $(BAUD) -U flash:w:$<:i

# Set fuses (run once for new chips)
fuses:
	$(AVRDUDE) -c $(PROGRAMMER) -p $(MCU) -P $(PORT) -b $(BAUD) \
		-U lfuse:w:$(LFUSE):m -U hfuse:w:$(HFUSE):m -U efuse:w:$(EFUSE):m

# Read current fuses
readfuses:
	$(AVRDUDE) -c $(PROGRAMMER) -p $(MCU) -P $(PORT) -b $(BAUD) \
		-U lfuse:r:-:h -U hfuse:r:-:h -U efuse:r:-:h

# Show flash/RAM usage
size: $(BUILD_DIR)/$(TARGET).elf
	$(SIZE) --mcu=$(MCU) --format=avr $<

# Disassemble (useful for learning)
disasm: $(BUILD_DIR)/$(TARGET).elf
	$(OBJDUMP) -d -S $<

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)

.PHONY: all flash fuses readfuses size disasm clean
