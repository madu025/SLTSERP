import { randomBytes } from 'crypto';

/**
 * Generates a time-ordered RFC 9562 compliant UUID v7 in Node.js / TypeScript.
 * Useful for client-side / service DTO generation before database persistence.
 */
export function generateUuidV7(): string {
  const timestampMs = Date.now();
  const bytes = randomBytes(16);

  // Set 48-bit timestamp (bytes 0 to 5)
  bytes[0] = Math.floor(timestampMs / 0x100000000) & 0xff;
  bytes[1] = Math.floor(timestampMs / 0x1000000) & 0xff;
  bytes[2] = Math.floor(timestampMs / 0x10000) & 0xff;
  bytes[3] = Math.floor(timestampMs / 0x100) & 0xff;
  bytes[4] = timestampMs & 0xff;

  // Set version to 7 (bits 4-7 of byte 6 = 0111 -> 0x70)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;

  // Set variant to IETF (bits 6-7 of byte 8 = 10 -> 0x80)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
}
