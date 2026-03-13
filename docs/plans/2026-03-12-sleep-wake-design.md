# Sleep/Wake Weather Display Design

**Date:** 2026-03-12
**Branch:** feature/oled-display
**Status:** planned

## Goal

Minimize power consumption by sleeping between readings. Wake every 5 minutes to refresh the BME280 data. Button press toggles display on/off.

## Behavior

1. **Startup:** init I2C, OLED, BME280. Take first reading, display it, then sleep OLED and enter MCU sleep.
2. **Every 5 minutes:** watchdog timer wakes MCU → read BME280 → update display RAM (display stays off if user hasn't toggled it on) → sleep again.
3. **Button press (PB4):** pin-change interrupt wakes MCU → toggle display state:
   - If display was off: turn OLED on, take fresh reading, display it. Stay awake in idle loop (display remains on).
   - If display was on: turn OLED off, enter sleep.
4. **While display is on:** continue refreshing every 5 minutes via watchdog. Button press turns it off.

## Implementation

### Watchdog Timer (5-minute wake)

- ATtiny85 watchdog max is ~8 seconds (WDP3:0 = 1001).
- Count 37 watchdog interrupts ≈ 296 seconds ≈ ~5 minutes.
- Use `WDTCR` to configure watchdog interrupt mode (not reset mode).
- ISR increments a volatile counter. Main loop checks if counter >= 37, reads BME280, resets counter.

### Power-Down Sleep

- Use `set_sleep_mode(SLEEP_MODE_PWR_DOWN)` — deepest sleep, only watchdog and pin-change interrupts wake.
- Before sleep: disable ADC (`ADCSRA &= ~(1 << ADEN)`), disable USI.
- After wake: re-enable peripherals as needed.

### Button (PB4) — Pin-Change Interrupt

- PB4 already has internal pull-up enabled.
- Enable PCINT4 in `GIMSK` and `PCMSK`.
- ISR sets a volatile flag. Main loop handles the toggle logic.
- Debounce: simple 50ms delay after interrupt, re-read pin to confirm.

### OLED Sleep/Wake

- Already have `oled_sleep()` (0xAE) and `oled_wake()` (0xAF).
- Display RAM persists during sleep — no need to redraw on wake unless data changed.

### BME280 Power

- Already using forced mode — sensor sleeps between measurements automatically.
- No changes needed.

### State Machine

```
         ┌─────────────────────┐
         │                     │
         ▼                     │
    ┌─────────┐  button   ┌─────────┐
    │ DISPLAY │ ────────► │ DISPLAY │
    │   OFF   │           │   ON    │
    │ (sleep) │ ◄──────── │ (idle)  │
    └────┬────┘  button   └────┬────┘
         │                     │
         │ watchdog            │ watchdog
         │ (every 5min)        │ (every 5min)
         ▼                     ▼
    read BME280           read BME280
    update RAM            update RAM
    (display stays off)   update display
    sleep again           continue idle
```

### Main Loop Pseudocode

```c
volatile uint8_t wdt_count = 0;
volatile uint8_t button_flag = 0;
uint8_t display_on = 0;

// After init:
take_reading();
display_reading();
oled_sleep();
display_on = 0;

while (1) {
    if (display_on) {
        // Idle with interrupts enabled, wait for button or watchdog
    } else {
        enter_power_down_sleep();
    }

    if (button_flag) {
        button_flag = 0;
        debounce();
        display_on = !display_on;
        if (display_on) {
            take_reading();
            display_reading();
            oled_wake();
        } else {
            oled_sleep();
        }
    }

    if (wdt_count >= 37) {
        wdt_count = 0;
        take_reading();
        if (display_on) {
            display_reading();
        }
    }
}
```

### Files to Modify

- `src/main.c` — sleep/wake logic, watchdog setup, pin-change ISR, state machine
- No new files needed. Existing `oled_sleep()`/`oled_wake()` and BME280 forced mode handle peripherals.

### Flash/RAM Budget Estimate

- Current: 3762 bytes flash, 45 bytes RAM
- Added: watchdog ISR, PCINT ISR, sleep setup, state logic — ~200-300 bytes
- Expected: ~4100 bytes flash (50%), ~50 bytes RAM (10%)

## Testing

1. Flash and verify display shows reading on startup then goes dark
2. Press button — display turns on with fresh reading
3. Press button again — display turns off
4. Wait 5+ minutes with display on — reading should update
5. Measure current in sleep mode (should be <1µA MCU + BME280 idle)
