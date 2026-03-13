#ifndef FONT5X7_H
#define FONT5X7_H

#include <stdint.h>
#include <avr/pgmspace.h>

/*
 * Minimal 5x7 font for temperature/humidity/pressure display.
 * Each glyph is 5 bytes (columns), LSB = top row.
 * Characters: space 0-9 . ° F C % h P a
 *
 * To look up a character, use font_glyph(c) which returns
 * a pointer to 5 bytes in PROGMEM, or NULL if unsupported.
 */

// Character index mapping
// 0=space, 1-10=digits 0-9, 11='.', 12='°', 13='F', 14='C',
// 15='%', 16='h', 17='P', 18='a'
#define FONT_GLYPH_COUNT 19

static const uint8_t font_data[FONT_GLYPH_COUNT * 5] PROGMEM = {
    // space (0x20)
    0x00, 0x00, 0x00, 0x00, 0x00,
    // 0
    0x3E, 0x51, 0x49, 0x45, 0x3E,
    // 1
    0x00, 0x42, 0x7F, 0x40, 0x00,
    // 2
    0x42, 0x61, 0x51, 0x49, 0x46,
    // 3
    0x21, 0x41, 0x45, 0x4B, 0x31,
    // 4
    0x18, 0x14, 0x12, 0x7F, 0x10,
    // 5
    0x27, 0x45, 0x45, 0x45, 0x39,
    // 6
    0x3C, 0x4A, 0x49, 0x49, 0x30,
    // 7
    0x01, 0x71, 0x09, 0x05, 0x03,
    // 8
    0x36, 0x49, 0x49, 0x49, 0x36,
    // 9
    0x06, 0x49, 0x49, 0x29, 0x1E,
    // . (period)
    0x00, 0x60, 0x60, 0x00, 0x00,
    // ° (degree)
    0x00, 0x06, 0x09, 0x09, 0x06,
    // F
    0x7F, 0x09, 0x09, 0x09, 0x01,
    // C
    0x3E, 0x41, 0x41, 0x41, 0x22,
    // %
    0x23, 0x13, 0x08, 0x64, 0x62,
    // h
    0x7F, 0x08, 0x08, 0x08, 0x70,
    // P
    0x7F, 0x09, 0x09, 0x09, 0x06,
    // a
    0x20, 0x54, 0x54, 0x54, 0x78,
};

// Map ASCII character to font_data index. Returns -1 if unsupported.
static inline int8_t font_index(char c)
{
    if (c == ' ')  return 0;
    if (c >= '0' && c <= '9') return 1 + (c - '0');
    if (c == '.')  return 11;
    if (c == '\xB0') return 12;  // ° (Latin-1 degree sign)
    if (c == 'F')  return 13;
    if (c == 'C')  return 14;
    if (c == '%')  return 15;
    if (c == 'h')  return 16;
    if (c == 'P')  return 17;
    if (c == 'a')  return 18;
    return -1;
}

// Get pointer to 5 glyph bytes in PROGMEM. Returns NULL if unsupported.
static inline const uint8_t *font_glyph(char c)
{
    int8_t idx = font_index(c);
    if (idx < 0) return (const uint8_t *)0;
    return &font_data[idx * 5];
}

#endif
