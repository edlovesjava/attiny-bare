/*
 * usi_i2c.c
 * I2C master driver using ATtiny85's USI peripheral
 *
 * Two-wire mode open-drain on SDA:
 *   SDA driven LOW when PORT=0 OR USIDR_MSB=0
 *   SDA released (HIGH via pull-up) when PORT=1 AND USIDR_MSB=1
 *
 * Uses software clock strobe (USICS=00, USICLK=1) on rising edge only.
 * Falling edge uses USITC alone (no shift, no counter increment).
 * This gives 8 shifts per byte with counter starting at 8.
 */

#include <avr/io.h>
#include "usi_i2c.h"
#include <util/delay.h>

#define SDA_PIN PB0
#define SCL_PIN PB2

// Rising edge: toggle SCL HIGH + shift data + increment counter
#define USI_SCL_RISE (1 << USIWM1) | (1 << USICLK) | (1 << USITC)
// Falling edge: toggle SCL LOW only (no shift, no counter)
#define USI_SCL_FALL (1 << USIWM1) | (1 << USITC)

void i2c_init(void)
{
    // Release both lines HIGH via PORT (open-drain released in two-wire mode)
    PORTB |= (1 << SDA_PIN) | (1 << SCL_PIN);
    DDRB  |= (1 << SDA_PIN) | (1 << SCL_PIN);

    USIDR = 0xFF; // Don't pull SDA low via shift register
    USICR = (1 << USIWM1); // Two-wire mode, no clock source (software only)

    // Clear all flags, counter to 0
    USISR = (1 << USISIF) | (1 << USIOIF) | (1 << USIPF) | (1 << USIDC);
}

void i2c_start(void)
{
    // Ensure SCL HIGH
    PORTB |= (1 << SCL_PIN);
    _delay_us(5);

    // START: pull SDA LOW while SCL is HIGH
    PORTB &= ~(1 << SDA_PIN);
    _delay_us(5);

    // Pull SCL LOW
    PORTB &= ~(1 << SCL_PIN);
    _delay_us(5);

    // Hand SDA back to USI for data transfer
    PORTB |= (1 << SDA_PIN);
    USIDR = 0xFF;
}

void i2c_stop(void)
{
    // Ensure SDA LOW
    PORTB &= ~(1 << SDA_PIN);
    _delay_us(5);

    // Release SCL HIGH
    PORTB |= (1 << SCL_PIN);
    _delay_us(5);

    // STOP: release SDA HIGH while SCL is HIGH
    PORTB |= (1 << SDA_PIN);
    _delay_us(5);
}

uint8_t i2c_send_byte(uint8_t data)
{
    USIDR = data;
    // Clear flags, counter = 8 (need 8 rising-edge shifts to overflow at 16)
    USISR = (1 << USIOIF) | (1 << USISIF) | (1 << USIPF) | (1 << USIDC) | 0x08;

    while (!(USISR & (1 << USIOIF))) {
        USICR = USI_SCL_RISE; // SCL HIGH — shift data out, counter++
        _delay_us(5);
        USICR = USI_SCL_FALL; // SCL LOW — no shift
        _delay_us(5);
    }

    // Read ACK: release SDA, clock 1 bit
    USIDR = 0xFF; // SDA released (PORT=1 + USIDR_MSB=1)
    // Counter = 15: one rising-edge shift to overflow
    USISR = (1 << USIOIF) | (1 << USISIF) | (1 << USIPF) | (1 << USIDC) | 0x0F;

    USICR = USI_SCL_RISE; // SCL HIGH — ACK bit shifts into USIDR bit 0
    _delay_us(5);
    USICR = USI_SCL_FALL; // SCL LOW
    _delay_us(5);

    // After 1 left-shift of 0xFF: USIDR = 0xFE | ACK_bit
    // ACK = slave pulled SDA low, so bit 0 = 0
    return (USIDR & 0x01) == 0;
}

uint8_t i2c_receive_byte(uint8_t ack)
{
    // Release SDA for slave to drive
    USIDR = 0xFF;
    USISR = (1 << USIOIF) | (1 << USISIF) | (1 << USIPF) | (1 << USIDC) | 0x08;

    while (!(USISR & (1 << USIOIF))) {
        USICR = USI_SCL_RISE; // SCL HIGH — data shifts in
        _delay_us(5);
        USICR = USI_SCL_FALL; // SCL LOW
        _delay_us(5);
    }

    uint8_t received = USIDR;

    // Send ACK or NACK
    USIDR = ack ? 0x00 : 0xFF;
    USISR = (1 << USIOIF) | (1 << USISIF) | (1 << USIPF) | (1 << USIDC) | 0x0F;

    USICR = USI_SCL_RISE; // SCL HIGH
    _delay_us(5);
    USICR = USI_SCL_FALL; // SCL LOW
    _delay_us(5);

    return received;
}
