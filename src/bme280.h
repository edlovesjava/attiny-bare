#ifndef BME280_H
#define BME280_H

#include <stdint.h>

#define BME280_ADDR 0x76

// Readings in fixed-point to avoid float on ATtiny85
typedef struct {
    int16_t  temp_c_x100;   // temperature in C * 100 (e.g., 2375 = 23.75°C)
    uint16_t hum_x100;      // humidity in % * 100 (e.g., 4520 = 45.20%)
    uint32_t press_pa;      // pressure in Pa (e.g., 101325 = 1013.25 hPa)
} bme280_reading_t;

// Initialize BME280: verify chip ID, read calibration, configure
// Returns 1 on success, 0 if chip not found
uint8_t bme280_init(void);

// Trigger a measurement and read results
void bme280_read(bme280_reading_t *r);

#endif
