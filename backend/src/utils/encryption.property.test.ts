/**
 * Property-Based Tests for Encryption/Decryption
 *
 * Property 12: Encryption/Decryption Inverse
 * Validates: Requirements 20.2
 *
 * Uses random input generation (Math.random) to verify encryption properties
 * hold across many inputs using Node.js built-in crypto (AES-256-CBC).
 */

import * as crypto from 'crypto';

// ─── Encryption helpers ──────────────────────────────────────────────────────

/**
 * Encrypts plaintext using AES-256-CBC.
 * @param plaintext - The string to encrypt
 * @param key - 32-byte key buffer
 * @param iv - 16-byte initialization vector buffer
 * @returns Base64-encoded ciphertext
 */
function encrypt(plaintext: string, key: Buffer, iv: Buffer): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return encrypted.toString('base64');
}

/**
 * Decrypts AES-256-CBC ciphertext.
 * @param ciphertext - Base64-encoded ciphertext
 * @param key - 32-byte key buffer
 * @param iv - 16-byte initialization vector buffer
 * @returns Decrypted plaintext string
 */
function decrypt(ciphertext: string, key: Buffer, iv: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fixed 32-byte test key */
const TEST_KEY = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');

/** Generate a random 16-byte IV */
function randomIV(): Buffer {
  return crypto.randomBytes(16);
}

/** Generate a random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Character sets for random string generation */
const CHAR_SETS = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  special: '!@#$%^&*()_+-=[]{}|;\':",.<>?/`~\\',
  unicode: 'αβγδεζηθικλμνξοπρστυφχψωАБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ你好世界日本語한국어',
  mixed: 'ABCabc123!@#αβγ你好',
};

/** Generate a random string of given length from a character set */
function randomStringFromSet(length: number, chars: string): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/** Generate a random string (1–500 chars) with varied content */
function randomSensitiveData(): string {
  const length = randInt(1, 500);
  const setKeys = Object.keys(CHAR_SETS) as Array<keyof typeof CHAR_SETS>;
  const chosenSet = CHAR_SETS[setKeys[Math.floor(Math.random() * setKeys.length)]];
  return randomStringFromSet(length, chosenSet);
}

// ─── Property 12: Encryption/Decryption Inverse ───────────────────────────────

describe('Property 12 (Encryption/Decryption Inverse): decrypt(encrypt(data)) === data', () => {
  /**
   * Validates: Requirements 20.2
   * For 200 random sensitive data strings, encrypting then decrypting must
   * return the exact original plaintext.
   */
  it('decrypt(encrypt(data)) === data for 200 random strings', () => {
    const failures: string[] = [];

    for (let i = 0; i < 200; i++) {
      const plaintext = randomSensitiveData();
      const iv = randomIV();

      const ciphertext = encrypt(plaintext, TEST_KEY, iv);
      const recovered = decrypt(ciphertext, TEST_KEY, iv);

      if (recovered !== plaintext) {
        failures.push(
          `[${i}] length=${plaintext.length}: ` +
          `expected "${plaintext.slice(0, 30)}...", got "${recovered.slice(0, 30)}..."`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Different plaintexts produce different ciphertexts ──────────────────────

describe('Different plaintexts produce different ciphertexts', () => {
  it('encrypt(a) !== encrypt(b) when a !== b for 100 random pairs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      let a = randomSensitiveData();
      let b = randomSensitiveData();

      // Ensure a and b are actually different
      while (b === a) {
        b = randomSensitiveData();
      }

      // Use different IVs per the task spec
      const ivA = randomIV();
      const ivB = randomIV();

      const ciphertextA = encrypt(a, TEST_KEY, ivA);
      const ciphertextB = encrypt(b, TEST_KEY, ivB);

      if (ciphertextA === ciphertextB) {
        failures.push(
          `[${i}] a="${a.slice(0, 20)}", b="${b.slice(0, 20)}": ciphertexts are equal`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Same plaintext with different IVs produces different ciphertexts ────────

describe('Same plaintext with different IVs produces different ciphertexts', () => {
  it('encrypt(data, iv1) !== encrypt(data, iv2) for 100 random strings', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const plaintext = randomSensitiveData();

      let iv1 = randomIV();
      let iv2 = randomIV();

      // Ensure IVs are different
      while (iv1.equals(iv2)) {
        iv2 = randomIV();
      }

      const ciphertext1 = encrypt(plaintext, TEST_KEY, iv1);
      const ciphertext2 = encrypt(plaintext, TEST_KEY, iv2);

      if (ciphertext1 === ciphertext2) {
        failures.push(
          `[${i}] plaintext="${plaintext.slice(0, 20)}": same ciphertext with different IVs`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Encrypted data is not equal to plaintext ────────────────────────────────

describe('Encrypted data is not equal to plaintext', () => {
  it('encrypt(data) !== data for 100 random strings', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const plaintext = randomSensitiveData();
      const iv = randomIV();

      const ciphertext = encrypt(plaintext, TEST_KEY, iv);

      if (ciphertext === plaintext) {
        failures.push(
          `[${i}] plaintext="${plaintext.slice(0, 20)}": ciphertext equals plaintext`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});
