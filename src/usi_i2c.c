/*
 * usi_i2c.c
 * I2C master driver using ATtiny85's USI peripheral
 *
 * Based on Atmel AVR310 / TinyWireM reference implementation.
 * Two-wire mode open-drain on SDA, PORT-based control for start/stop.
 * Same USICR value for both clock edges (USICS1+USICLK+USITC).
 * Counter: 0x00 for 8-bit transfer (16 edges), 0x0E for 1-bit (2 edges).
 */

#include <avr/io.h>
#include "usi_i2c.h"
#include <util/delay.h>

#define SDA_PIN PB0
#define SCL_PIN PB2

// Clock strobe: two-wire mode + software clock + toggle SCL
// Same value used for both rising and falling edges
#define USI_CLOCK (1 << USIWM1) | (1 << USICS1) | (1 << USICLK) | (1 << USITC)

// Clear all flags in USISR (write 1 to clear)
#define USISR_CLEAR (1 << USISIF) | (1 << USIOIF) | (1 << USIPF) | (1 << USIDC)

// Transfer a number of bits via USI. Returns USIDR contents after transfer.
static uint8_t usi_transfer(uint8_t usisr_count)
{
    USISR = USISR_CLEAR | usisr_count;

    do {
        _delay_us(5);
        USICR = USI_CLOCK;                    // Rising SCL edge
        while (!(PINB & (1 << SCL_PIN)));     // Wait for SCL HIGH (clock stretching)
        _delay_us(4);
        USICR = USI_CLOCK;                    // Falling SCL edge
    } while (!(USISR & (1 << USIOIF)));       // Until counter overflows

    _delay_us(5);
    uint8_t data = USIDR;
    USIDR = 0xFF;                             // Release SDA
    DDRB |= (1 << SDA_PIN);                  // SDA as output

    return data;
}

void i2c_init(void)
{
    // Release both lines HIGH
    PORTB |= (1 << SDA_PIN) | (1 << SCL_PIN);
    DDRB  |= (1 << SDA_PIN) | (1 << SCL_PIN);

    USIDR = 0xFF;
    USICR = (1 << USIWM1) | (1 << USICS1) | (1 << USICLK);
    USISR = USISR_CLEAR;
}

void i2c_start(void)
{
    // Release SCL HIGH
    PORTB |= (1 << SCL_PIN);
    while (!(PINB & (1 << SCL_PIN)));  // Wait for SCL HIGH
    _delay_us(5);

    // START: pull SDA LOW while SCL is HIGH
    PORTB &= ~(1 << SDA_PIN);
    _delay_us(4);

    // Pull SCL LOW
    PORTB &= ~(1 << SCL_PIN);

    // Release SDA (hand control to USI)
    PORTB |= (1 << SDA_PIN);
}

void i2c_stop(void)
{
    // Ensure SDA LOW
    PORTB &= ~(1 << SDA_PIN);
    _delay_us(5);

    // Release SCL HIGH
    PORTB |= (1 << SCL_PIN);
    while (!(PINB & (1 << SCL_PIN)));  // Wait for SCL HIGH
    _delay_us(4);

    // STOP: release SDA HIGH while SCL is HIGH
    PORTB |= (1 << SDA_PIN);
    _delay_us(5);
}

uint8_t i2c_send_byte(uint8_t data)
{
    // Pull SCL LOW
    PORTB &= ~(1 << SCL_PIN);

    // Load data and clock out 8 bits (counter=0x00 → 16 edges)
    USIDR = data;
    usi_transfer(0x00);

    // Read ACK: release SDA, clock 1 bit (counter=0x0E → 2 edges)
    DDRB &= ~(1 << SDA_PIN);  // SDA as input for slave to drive ACK
    uint8_t ack_bit = usi_transfer(0x0E);

    return (ack_bit & 0x01) == 0;  // ACK = SDA was LOW (bit 0 = 0)
}

uint8_t i2c_receive_byte(uint8_t ack)
{
    // Release SDA for slave to drive data
    DDRB &= ~(1 << SDA_PIN);

    // Clock in 8 bits (counter=0x00 → 16 edges)
    uint8_t received = usi_transfer(0x00);

    // Send ACK or NACK (counter=0x0E → 2 edges)
    USIDR = ack ? 0x00 : 0xFF;
    usi_transfer(0x0E);

    return received;
}
