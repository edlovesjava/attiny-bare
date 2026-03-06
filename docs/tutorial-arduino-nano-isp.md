# Turning an Arduino Nano into an ATtiny85 Programmer

The Arduino Nano can act as an ISP (In-System Programmer) to flash code onto ATtiny85 chips. This is the cheapest way to program bare AVR chips — no dedicated programmer needed.

## How ISP Programming Works

ISP uses the SPI (Serial Peripheral Interface) protocol to write directly to the chip's flash memory while it sits in your circuit. The Arduino runs a special sketch that translates serial commands from your PC (via avrdude) into SPI signals the ATtiny85 understands.

The protocol uses 4 signal lines plus power:

| Signal | Direction | Purpose |
|--------|-----------|---------|
| SCK    | Nano -> ATtiny | Clock — synchronizes data transfer |
| MOSI   | Nano -> ATtiny | Master Out, Slave In — data to the chip |
| MISO   | ATtiny -> Nano | Master In, Slave Out — data from the chip |
| RESET  | Nano -> ATtiny | Active low — holds chip in programming mode |

## What You Need

- Arduino Nano (or Uno, Pro Mini — any AVR-based Arduino)
- USB cable for the Nano
- Breadboard and jumper wires
- 10uF electrolytic capacitor (or 120 ohm resistor — see below)
- ATtiny85 chip

## Step 1: Upload ArduinoISP to the Nano

The ArduinoISP sketch comes built into the Arduino IDE.

1. Connect the Nano to your PC via USB
2. Open the Arduino IDE
3. Go to **File > Examples > 11.ArduinoISP > ArduinoISP**
4. Select your board: **Tools > Board > Arduino Nano**
5. Select processor: **Tools > Processor > ATmega328P** (or "Old Bootloader" for clones)
6. Select port: **Tools > Port > COMx** (whichever your Nano is on)
7. Click **Upload**

Once uploaded, the Nano is now a programmer. It stays a programmer until you upload a different sketch.

> **Reference:** Arduino's official guide — https://docs.arduino.cc/built-in-examples/arduino-isp/ArduinoISP/

## Step 2: Prevent Nano Auto-Reset

When avrdude opens the serial connection, the Nano's DTR line toggles, which resets the Nano via its auto-reset circuit. This interrupts programming. You need to disable it.

**Option A: 10uF capacitor (recommended)**

Place a 10uF electrolytic capacitor between the Nano's **RESET** and **GND** pins. The capacitor absorbs the reset pulse.

- **Positive leg (longer)** goes to RESET
- **Negative leg (stripe)** goes to GND

```
Nano RESET ──── [10uF +] ──── GND
```

**Option B: 120 ohm resistor**

Place a 120 ohm resistor between the Nano's **RESET** and **5V**. This holds RESET high and overpowers the DTR pull-down.

```
Nano RESET ──── [120R] ──── 5V
```

**Important:** Remove the capacitor/resistor when you need to upload a new sketch to the Nano itself — it blocks normal Arduino uploads too.

## Step 3: Wire the Nano to the ATtiny85

### ATtiny85 Pinout

```
            ┌───────┐
(RESET) PB5 │1  o  8│ VCC
        PB3 │2     7│ PB2 (SCK)
        PB4 │3     6│ PB1 (MISO)
        GND │4     5│ PB0 (MOSI)
            └───────┘
```

Pin 1 is marked with a dot on the physical chip.

### Connections

| Nano Pin | ATtiny85 Pin | Signal | Wire Color (suggestion) |
|----------|-------------|--------|------------------------|
| D13      | Pin 7 (PB2) | SCK    | Orange |
| D12      | Pin 6 (PB1) | MISO   | Yellow |
| D11      | Pin 5 (PB0) | MOSI   | Green |
| D10      | Pin 1 (PB5) | RESET  | White |
| 5V       | Pin 8 (VCC) | Power  | Red |
| GND      | Pin 4 (GND) | Ground | Black |

### Breadboard Layout

```
        Nano                          ATtiny85
    ┌──────────┐                    ┌───────────┐
    │       D13├── orange ─────────►│7  SCK     │
    │       D12├── yellow ◄────────►│6  MISO    │
    │       D11├── green  ─────────►│5  MOSI    │
    │       D10├── white  ─────────►│1  RESET   │
    │        5V├── red    ─────────►│8  VCC     │
    │       GND├── black  ─────────►│4  GND     │
    │          │                    └───────────┘
    │    [10uF]│
    │  RST─┤+├─GND
    └──────────┘
```

### Status LEDs (optional)

The ArduinoISP sketch drives three status LEDs if you want visual feedback:

| Nano Pin | LED Color (suggestion) | Meaning |
|----------|----------------------|---------|
| D9       | Green | Heartbeat — slow pulse means ISP is ready |
| D8       | Blue  | Programming — lights during flash write |
| D7       | Red   | Error — lights if something went wrong |

Wire each as: `Nano pin ── [220R] ── LED+ ── GND`

These are optional but helpful for debugging connection issues.

## Step 4: Test the Connection

With everything wired, test that avrdude can talk to the ATtiny85:

```bash
avrdude -c stk500v1 -p attiny85 -P COM21 -b 19200
```

Replace `COM21` with your Nano's COM port.

**Success looks like:**

```
avrdude: AVR device initialized and ready to accept instructions
avrdude: device signature = 0x1e930b (probably t85)

avrdude done.  Thank you.
```

**If you see `0x000000`:** wiring problem — double-check all 6 connections.

**If you see a serial port error:** wrong COM port or missing reset-disable capacitor.

## Step 5: Use with Our Makefile

The project Makefile is already configured for this setup:

```makefile
PROGRAMMER = stk500v1
BAUD       = 19200
PORT       ?= COM21
```

Flash a program:
```bash
make flash PORT=COM21
```

Set fuses (once per new chip):
```bash
make fuses PORT=COM21
```

Read fuses to verify:
```bash
make readfuses PORT=COM21
```

## Protocol Details

For those curious about what's happening under the hood:

1. **avrdude** on your PC sends commands over USB serial to the Nano
2. The Nano's **ArduinoISP sketch** translates these into the **STK500v1** protocol
3. The Nano bit-bangs **SPI signals** on pins D10-D13
4. The ATtiny85 receives the SPI data and writes it to its internal flash
5. The ATtiny85 sends verification data back over MISO

The baud rate (19200) is between your PC and the Nano. The SPI clock to the ATtiny85 is separate and slower — ArduinoISP handles this automatically.

## Troubleshooting

### "programmer is not responding"
- Check the reset-disable capacitor/resistor is in place
- Try a lower baud rate: add `-b 9600` to the avrdude command
- Make sure ArduinoISP is actually uploaded to the Nano (re-upload it)

### "can't open device COMx"
- Check Device Manager for the correct port number
- Close any other program using the serial port (Arduino IDE Serial Monitor, etc.)
- For clone Nanos: install CH340 USB-serial drivers

### Signature reads as 0x000000
- MOSI, MISO, or SCK is disconnected or swapped
- RESET line not connected
- ATtiny85 not receiving power — check VCC and GND
- Check for bent pins if the chip doesn't seat firmly in the breadboard

### "Yikes! Invalid device signature"
- A valid but unexpected signature means you have a different chip. Common ones:
  - `0x1e930b` = ATtiny85 (correct)
  - `0x1e9206` = ATtiny45
  - `0x1e910a` = ATtiny25
- If you're sure it's an ATtiny85, try adding `-F` to force, but investigate first

### Programming works once then fails
- A previous upload may have disabled the RESET pin (RSTDISBL fuse). This bricks ISP access — you need a high-voltage programmer to recover.
- Our Makefile fuse values (HFUSE=0xDF) keep RESET enabled. Don't change HFUSE unless you know what you're doing.

### Nano keeps resetting during programming
- The 10uF cap may be too small, backwards, or not making contact
- Try the 120 ohm resistor method instead
- Some Nano clones have different reset circuits — a larger cap (47uF) may help
