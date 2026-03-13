/** 
 * @file usi_i2c.h
 * @brief I2C master driver using ATtiny85's USI peripheral
 * 
 * Provides basic I2C master operations; start, stop, send byte
 * receive byte.  Uses USI two-wire mode with software clock strobe.
 * 
 * Pin assignments:
 *   SDA - PB0 (physical pin 5)
 *   SCL - PB2 (physical pin 7)
*/
#ifndef USI_I2C_H
#define USI_I2C_H

#include <stdint.h>

void    i2c_init(void);           // Configure pins and USI for I2C
void    i2c_start(void);          // Generate I2C start condition
void    i2c_stop(void);           // Generate I2C stop condition
uint8_t i2c_send_byte(uint8_t data); // Send byte, return 1 if ACK received
uint8_t i2c_receive_byte(uint8_t ack); // Receive byte, send ACK if ack=1

#endif // USI_I2C_H

