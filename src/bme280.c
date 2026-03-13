/*
 * bme280.c
 * Minimal BME280 driver for ATtiny85 (I2C, forced mode)
 *
 * Uses the official Bosch compensation formulas (integer only).
 * Reads temperature, humidity, and pressure.
 */

#include "bme280.h"
#include "usi_i2c.h"
#include <util/delay.h>

// ── Register addresses ──
#define REG_ID          0xD0
#define REG_RESET       0xE0
#define REG_CTRL_HUM    0xF2
#define REG_STATUS      0xF3
#define REG_CTRL_MEAS   0xF4
#define REG_CONFIG      0xF5
#define REG_DATA_START  0xF7  // 8 bytes: press[2:0], temp[2:0], hum[1:0]
#define REG_CALIB_00    0x88  // T and P calibration (26 bytes)
#define REG_CALIB_26    0xE1  // H calibration (7 bytes)

#define BME280_CHIP_ID  0x60

// ── Calibration data ──
static struct {
    uint16_t dig_T1;
    int16_t  dig_T2, dig_T3;
    uint16_t dig_P1;
    int16_t  dig_P2, dig_P3, dig_P4, dig_P5, dig_P6, dig_P7, dig_P8, dig_P9;
    uint8_t  dig_H1, dig_H3;
    int16_t  dig_H2, dig_H4, dig_H5;
    int8_t   dig_H6;
} cal;

// Shared variable for temperature compensation (used by pressure & humidity)
static int32_t t_fine;

// ── I2C helpers ──

static void bme_write_reg(uint8_t reg, uint8_t val)
{
    i2c_start();
    i2c_send_byte(BME280_ADDR << 1);       // write
    i2c_send_byte(reg);
    i2c_send_byte(val);
    i2c_stop();
}

static uint8_t bme_read_reg(uint8_t reg)
{
    i2c_start();
    i2c_send_byte(BME280_ADDR << 1);       // write
    i2c_send_byte(reg);
    i2c_stop();

    i2c_start();
    i2c_send_byte((BME280_ADDR << 1) | 1); // read
    uint8_t val = i2c_receive_byte(0);      // NACK (single byte)
    i2c_stop();
    return val;
}

static void bme_read_burst(uint8_t reg, uint8_t *buf, uint8_t len)
{
    i2c_start();
    i2c_send_byte(BME280_ADDR << 1);
    i2c_send_byte(reg);
    i2c_stop();

    i2c_start();
    i2c_send_byte((BME280_ADDR << 1) | 1);
    for (uint8_t i = 0; i < len; i++) {
        buf[i] = i2c_receive_byte(i < len - 1);  // ACK all but last
    }
    i2c_stop();
}

// ── Read calibration data ──

static void read_calibration(void)
{
    uint8_t buf[26];

    // Temperature and pressure calibration: 0x88–0xA1 (26 bytes)
    bme_read_burst(REG_CALIB_00, buf, 26);

    cal.dig_T1 = (uint16_t)buf[1]  << 8 | buf[0];
    cal.dig_T2 = (int16_t)((uint16_t)buf[3]  << 8 | buf[2]);
    cal.dig_T3 = (int16_t)((uint16_t)buf[5]  << 8 | buf[4]);

    cal.dig_P1 = (uint16_t)buf[7]  << 8 | buf[6];
    cal.dig_P2 = (int16_t)((uint16_t)buf[9]  << 8 | buf[8]);
    cal.dig_P3 = (int16_t)((uint16_t)buf[11] << 8 | buf[10]);
    cal.dig_P4 = (int16_t)((uint16_t)buf[13] << 8 | buf[12]);
    cal.dig_P5 = (int16_t)((uint16_t)buf[15] << 8 | buf[14]);
    cal.dig_P6 = (int16_t)((uint16_t)buf[17] << 8 | buf[16]);
    cal.dig_P7 = (int16_t)((uint16_t)buf[19] << 8 | buf[18]);
    cal.dig_P8 = (int16_t)((uint16_t)buf[21] << 8 | buf[20]);
    cal.dig_P9 = (int16_t)((uint16_t)buf[23] << 8 | buf[22]);

    cal.dig_H1 = buf[25];  // 0xA1

    // Humidity calibration: 0xE1–0xE7 (7 bytes)
    uint8_t hbuf[7];
    bme_read_burst(REG_CALIB_26, hbuf, 7);

    cal.dig_H2 = (int16_t)((uint16_t)hbuf[1] << 8 | hbuf[0]);
    cal.dig_H3 = hbuf[2];
    cal.dig_H4 = (int16_t)((uint16_t)hbuf[3] << 4 | (hbuf[4] & 0x0F));
    cal.dig_H5 = (int16_t)((uint16_t)hbuf[5] << 4 | (hbuf[4] >> 4));
    cal.dig_H6 = (int8_t)hbuf[6];
}

// ── Bosch compensation formulas (32-bit integer) ──

static int32_t compensate_temp(int32_t adc_T)
{
    int32_t var1, var2;
    var1 = ((((adc_T >> 3) - ((int32_t)cal.dig_T1 << 1))) * (int32_t)cal.dig_T2) >> 11;
    var2 = (((((adc_T >> 4) - (int32_t)cal.dig_T1) * ((adc_T >> 4) - (int32_t)cal.dig_T1)) >> 12) * (int32_t)cal.dig_T3) >> 14;
    t_fine = var1 + var2;
    return (t_fine * 5 + 128) >> 8;  // temperature in 0.01°C
}

static uint32_t compensate_press(int32_t adc_P)
{
    int32_t var1, var2;
    uint32_t p;
    var1 = (t_fine >> 1) - 64000;
    var2 = (((var1 >> 2) * (var1 >> 2)) >> 11) * (int32_t)cal.dig_P6;
    var2 = var2 + ((var1 * (int32_t)cal.dig_P5) << 1);
    var2 = (var2 >> 2) + ((int32_t)cal.dig_P4 << 16);
    var1 = ((((int32_t)cal.dig_P3 * (((var1 >> 2) * (var1 >> 2)) >> 13)) >> 3) +
            (((int32_t)cal.dig_P2 * var1) >> 1)) >> 18;
    var1 = ((32768 + var1) * (int32_t)cal.dig_P1) >> 15;
    if (var1 == 0) return 0;
    p = (uint32_t)(((int32_t)1048576 - adc_P) - (var2 >> 12)) * 3125;
    if (p < 0x80000000UL) {
        p = (p << 1) / (uint32_t)var1;
    } else {
        p = (p / (uint32_t)var1) * 2;
    }
    var1 = ((int32_t)cal.dig_P9 * ((int32_t)(((p >> 3) * (p >> 3)) >> 13))) >> 12;
    var2 = ((int32_t)(p >> 2) * (int32_t)cal.dig_P8) >> 13;
    return (uint32_t)((int32_t)p + ((var1 + var2 + (int32_t)cal.dig_P7) >> 4));
}

static uint32_t compensate_hum(int32_t adc_H)
{
    int32_t v;
    v = t_fine - 76800;
    v = (((((adc_H << 14) - ((int32_t)cal.dig_H4 << 20) - ((int32_t)cal.dig_H5 * v)) +
           16384) >> 15) *
         (((((((v * (int32_t)cal.dig_H6) >> 10) *
              (((v * (int32_t)cal.dig_H3) >> 11) + 32768)) >> 10) + 2097152) *
           (int32_t)cal.dig_H2 + 8192) >> 14));
    v = v - (((((v >> 15) * (v >> 15)) >> 7) * (int32_t)cal.dig_H1) >> 4);
    v = (v < 0) ? 0 : v;
    v = (v > 419430400) ? 419430400 : v;
    return (uint32_t)(v >> 12);  // Q22.10 format: divide by 1024 to get %
}

// ── Public API ──

uint8_t bme280_init(void)
{
    // Verify chip ID
    if (bme_read_reg(REG_ID) != BME280_CHIP_ID) {
        return 0;
    }

    // Soft reset
    bme_write_reg(REG_RESET, 0xB6);
    _delay_ms(10);

    // Wait for NVM copy
    while (bme_read_reg(REG_STATUS) & 0x01) {
        _delay_ms(1);
    }

    // Read factory calibration
    read_calibration();

    // Configure: humidity oversampling x1 (must be set before ctrl_meas)
    bme_write_reg(REG_CTRL_HUM, 0x01);

    // Config: no filter, no standby (forced mode)
    bme_write_reg(REG_CONFIG, 0x00);

    return 1;
}

void bme280_read(bme280_reading_t *r)
{
    // Trigger forced measurement: temp x1, press x1, forced mode
    bme_write_reg(REG_CTRL_MEAS, (0x01 << 5) | (0x01 << 2) | 0x01);

    // Wait for measurement to complete
    _delay_ms(10);
    while (bme_read_reg(REG_STATUS) & 0x08) {
        _delay_ms(1);
    }

    // Read all 8 data bytes: press[19:12] press[11:4] press[3:0]
    //                        temp[19:12]  temp[11:4]  temp[3:0]
    //                        hum[15:8]    hum[7:0]
    uint8_t buf[8];
    bme_read_burst(REG_DATA_START, buf, 8);

    int32_t adc_P = ((int32_t)buf[0] << 12) | ((int32_t)buf[1] << 4) | (buf[2] >> 4);
    int32_t adc_T = ((int32_t)buf[3] << 12) | ((int32_t)buf[4] << 4) | (buf[5] >> 4);
    int32_t adc_H = ((int32_t)buf[6] << 8)  | buf[7];

    // Compensate (must do temp first — sets t_fine for press & hum)
    int32_t temp_100 = compensate_temp(adc_T);
    uint32_t press = compensate_press(adc_P);
    uint32_t hum_1024 = compensate_hum(adc_H);

    r->temp_c_x100 = (int16_t)temp_100;
    r->press_pa = press;
    r->hum_x100 = (uint16_t)((hum_1024 * 100) / 1024);
}
