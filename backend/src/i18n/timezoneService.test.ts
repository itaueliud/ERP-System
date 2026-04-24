/**
 * Tests for TimezoneService
 * Requirements: 42.1-42.9
 */

import { TimezoneService } from './timezoneService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import { db } from '../database/connection';

const mockDb = db as jest.Mocked<typeof db>;

// ============================================================================
// Tests
// ============================================================================

describe('TimezoneService', () => {
  let service: TimezoneService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TimezoneService();
  });

  // --------------------------------------------------------------------------
  // isValidTimezone
  // --------------------------------------------------------------------------

  describe('isValidTimezone', () => {
    it('returns true for valid IANA timezone strings', () => {
      expect(service.isValidTimezone('UTC')).toBe(true);
      expect(service.isValidTimezone('Africa/Nairobi')).toBe(true);
      expect(service.isValidTimezone('America/New_York')).toBe(true);
      expect(service.isValidTimezone('Europe/London')).toBe(true);
    });

    it('returns false for invalid timezone strings', () => {
      expect(service.isValidTimezone('Not/ATimezone')).toBe(false);
      expect(service.isValidTimezone('invalid')).toBe(false);
      expect(service.isValidTimezone('')).toBe(false);
    });

    it('returns false for non-string inputs', () => {
      expect(service.isValidTimezone(null as any)).toBe(false);
      expect(service.isValidTimezone(undefined as any)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // getTimezoneOffset
  // --------------------------------------------------------------------------

  describe('getTimezoneOffset', () => {
    it('returns 0 for UTC', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(service.getTimezoneOffset('UTC', date)).toBe(0);
    });

    it('returns 180 for Africa/Nairobi (UTC+3)', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(service.getTimezoneOffset('Africa/Nairobi', date)).toBe(180);
    });

    it('returns 60 for Africa/Lagos (UTC+1)', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(service.getTimezoneOffset('Africa/Lagos', date)).toBe(60);
    });

    it('returns 120 for Africa/Johannesburg (UTC+2)', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(service.getTimezoneOffset('Africa/Johannesburg', date)).toBe(120);
    });

    it('returns 0 for invalid timezone (fallback to UTC)', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(service.getTimezoneOffset('Invalid/Zone', date)).toBe(0);
    });

    it('uses current time when no reference date is provided', () => {
      // Should not throw
      const offset = service.getTimezoneOffset('Africa/Nairobi');
      expect(typeof offset).toBe('number');
    });
  });

  // --------------------------------------------------------------------------
  // convertToUserTimezone
  // --------------------------------------------------------------------------

  describe('convertToUserTimezone', () => {
    it('converts UTC midnight to Africa/Nairobi (UTC+3) as 03:00', () => {
      const utc = new Date('2024-01-15T00:00:00Z');
      const local = service.convertToUserTimezone(utc, 'Africa/Nairobi');
      expect(local.getHours()).toBe(3);
      expect(local.getMinutes()).toBe(0);
    });

    it('returns same time for UTC timezone', () => {
      const utc = new Date('2024-06-15T10:30:00Z');
      const local = service.convertToUserTimezone(utc, 'UTC');
      expect(local.getHours()).toBe(10);
      expect(local.getMinutes()).toBe(30);
    });

    it('falls back to UTC for invalid timezone', () => {
      const utc = new Date('2024-01-15T10:00:00Z');
      const local = service.convertToUserTimezone(utc, 'Bad/Zone');
      expect(local.getHours()).toBe(10);
    });
  });

  // --------------------------------------------------------------------------
  // convertToUTC
  // --------------------------------------------------------------------------

  describe('convertToUTC', () => {
    it('converts Africa/Nairobi 03:00 back to UTC 00:00', () => {
      // Create a local date representing 03:00 wall-clock in Nairobi (UTC+3)
      // We pass year/month/day/hour as plain numbers (no timezone context)
      const local = new Date(2024, 0, 15, 3, 0, 0); // Jan 15 03:00
      const utc = service.convertToUTC(local, 'Africa/Nairobi');
      // Nairobi is UTC+3, so 03:00 local → 00:00 UTC
      expect(utc.getUTCHours()).toBe(0);
      expect(utc.getUTCMinutes()).toBe(0);
    });

    it('returns same time when converting UTC to UTC', () => {
      const local = new Date(2024, 5, 15, 10, 30, 0);
      const utc = service.convertToUTC(local, 'UTC');
      expect(utc.getUTCHours()).toBe(10);
      expect(utc.getUTCMinutes()).toBe(30);
    });
  });

  // --------------------------------------------------------------------------
  // formatWithTimezone
  // --------------------------------------------------------------------------

  describe('formatWithTimezone', () => {
    it('returns a formatted string with timezone info for Africa/Nairobi', () => {
      const utc = new Date('2024-01-15T12:00:00Z');
      const formatted = service.formatWithTimezone(utc, 'Africa/Nairobi');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
      // Should contain the date and some timezone indicator (EAT, GMT+3, UTC+3, etc.)
      expect(formatted).toMatch(/2024/);
    });

    it('falls back to UTC formatting for invalid timezone', () => {
      const utc = new Date('2024-01-15T12:00:00Z');
      const formatted = service.formatWithTimezone(utc, 'Bad/Zone');
      // Falls back to UTC — still a valid formatted string
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).toMatch(/2024/);
    });

    it('accepts an optional language parameter', () => {
      const utc = new Date('2024-01-15T12:00:00Z');
      const formatted = service.formatWithTimezone(utc, 'UTC', 'fr-FR');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // getCommonAfricanTimezones
  // --------------------------------------------------------------------------

  describe('getCommonAfricanTimezones', () => {
    it('returns a non-empty array', () => {
      const timezones = service.getCommonAfricanTimezones();
      expect(Array.isArray(timezones)).toBe(true);
      expect(timezones.length).toBeGreaterThan(0);
    });

    it('includes key African timezones', () => {
      const timezones = service.getCommonAfricanTimezones();
      expect(timezones).toContain('Africa/Nairobi');
      expect(timezones).toContain('Africa/Lagos');
      expect(timezones).toContain('Africa/Johannesburg');
      expect(timezones).toContain('Africa/Cairo');
    });

    it('returns only valid IANA timezone strings', () => {
      const timezones = service.getCommonAfricanTimezones();
      for (const tz of timezones) {
        expect(service.isValidTimezone(tz)).toBe(true);
      }
    });

    it('returns a copy (mutations do not affect the original)', () => {
      const first = service.getCommonAfricanTimezones();
      first.push('Fake/Zone');
      const second = service.getCommonAfricanTimezones();
      expect(second).not.toContain('Fake/Zone');
    });
  });

  // --------------------------------------------------------------------------
  // setUserTimezone
  // --------------------------------------------------------------------------

  describe('setUserTimezone', () => {
    it('updates the database with a valid timezone', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.setUserTimezone('user-1', 'Africa/Nairobi');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['Africa/Nairobi', 'user-1'],
      );
    });

    it('throws for an invalid timezone', async () => {
      await expect(service.setUserTimezone('user-1', 'Bad/Zone')).rejects.toThrow(
        'Invalid timezone: Bad/Zone',
      );
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // getUserTimezone
  // --------------------------------------------------------------------------

  describe('getUserTimezone', () => {
    it('returns the stored timezone when found', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: 'Africa/Nairobi' }],
        rowCount: 1,
      } as any);

      const tz = await service.getUserTimezone('user-1');
      expect(tz).toBe('Africa/Nairobi');
    });

    it('returns UTC when user has no timezone set (null)', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ timezone: null }],
        rowCount: 1,
      } as any);

      const tz = await service.getUserTimezone('user-1');
      expect(tz).toBe('UTC');
    });

    it('returns UTC when user is not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const tz = await service.getUserTimezone('nonexistent');
      expect(tz).toBe('UTC');
    });
  });
});
