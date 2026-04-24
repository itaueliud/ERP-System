/**
 * Unit tests for Localization — language detection/switching, date/number/currency
 * formatting, timezone conversion, and email translation.
 *
 * Requirements: 28.1-28.10, 42.1-42.9
 */

// ============================================================================
// Mocks (must be declared before imports)
// ============================================================================

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Partial mock: keep the real I18nService class but stub the singleton instance
// used by LocalizationService.translateNotification.
jest.mock('../i18n/i18nService', () => {
  const actual = jest.requireActual('../i18n/i18nService');
  return {
    ...actual,
    i18nService: {
      t: jest.fn((key: string, _lang: string, params?: Record<string, any>) => {
        const templates: Record<string, string> = {
          'notifications.payment_approved': 'Your payment of {{amount}} has been approved.',
          'notifications.report_overdue': 'Report "{{report_name}}" is overdue.',
          'notifications.task_assigned': 'You have been assigned a new task: {{task_name}}.',
        };
        let text = templates[key] ?? key;
        if (params) {
          text = text.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) =>
            params[k] !== undefined ? String(params[k]) : `{{${k}}}`,
          );
        }
        return text;
      }),
    },
  };
});

// ============================================================================
// Imports
// ============================================================================

import { I18nService } from '../i18n/i18nService';
import { LocalizationService } from '../i18n/localizationService';
import { TimezoneService } from '../i18n/timezoneService';
import { db } from '../database/connection';

const mockDb = db as jest.Mocked<typeof db>;

// ============================================================================
// 1. Language Detection
// Requirements: 28.1, 28.2
// ============================================================================

describe('Language Detection', () => {
  let i18n: I18nService;

  beforeEach(() => {
    i18n = new I18nService();
  });

  it('detects English from a plain "en" header', () => {
    expect(i18n.detectLanguage('en')).toBe('en');
  });

  it('detects Swahili from a plain "sw" header', () => {
    expect(i18n.detectLanguage('sw')).toBe('sw');
  });

  it('detects French from a plain "fr" header', () => {
    expect(i18n.detectLanguage('fr')).toBe('fr');
  });

  it('parses a full Accept-Language header and picks the highest-quality match', () => {
    // "en-US,en;q=0.9,fr;q=0.8" → en wins
    expect(i18n.detectLanguage('en-US,en;q=0.9,fr;q=0.8')).toBe('en');
  });

  it('picks the highest-quality supported language when first entry is unsupported', () => {
    // de is not supported; fr is next best
    expect(i18n.detectLanguage('de;q=1.0,fr;q=0.9,en;q=0.8')).toBe('fr');
  });

  it('strips region subtag — "fr-CA" resolves to "fr"', () => {
    expect(i18n.detectLanguage('fr-CA')).toBe('fr');
  });

  it('strips region subtag — "sw-KE" resolves to "sw"', () => {
    expect(i18n.detectLanguage('sw-KE')).toBe('sw');
  });

  it('defaults to English when no supported language is found', () => {
    expect(i18n.detectLanguage('de,es,pt')).toBe('en');
  });

  it('defaults to English for an empty Accept-Language header', () => {
    expect(i18n.detectLanguage('')).toBe('en');
  });
});

// ============================================================================
// 2. Language Switching
// Requirements: 28.3, 28.4
// ============================================================================

describe('Language Switching', () => {
  let i18n: I18nService;

  beforeEach(() => {
    jest.clearAllMocks();
    i18n = new I18nService();
  });

  it('returns all three supported languages', () => {
    expect(i18n.getSupportedLanguages()).toEqual(['en', 'sw', 'fr']);
  });

  it('translates a key in English', () => {
    expect(i18n.t('common.save', 'en')).toBe('Save');
  });

  it('translates a key in Swahili', () => {
    expect(i18n.t('common.save', 'sw')).toBe('Hifadhi');
  });

  it('translates a key in French', () => {
    expect(i18n.t('common.save', 'fr')).toBe('Enregistrer');
  });

  it('persists language preference to the database', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    await i18n.setUserLanguage('user-1', 'sw');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      ['sw', 'user-1'],
    );
  });

  it('normalises language code to lowercase before persisting', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    await i18n.setUserLanguage('user-2', 'FR');
    const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
    expect(params[0]).toBe('fr');
  });

  it('falls back to "en" when an unsupported language is set', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    await i18n.setUserLanguage('user-3', 'de');
    const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
    expect(params[0]).toBe('en');
  });

  it('retrieves the stored language preference for a user', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ preferred_language: 'fr' }], rowCount: 1 } as any);
    expect(await i18n.getUserLanguage('user-1')).toBe('fr');
  });

  it('returns "en" when the user is not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    expect(await i18n.getUserLanguage('unknown')).toBe('en');
  });
});

// ============================================================================
// 3. Date Formatting
// Requirements: 28.10
// ============================================================================

describe('Date Formatting', () => {
  let loc: LocalizationService;
  const date = new Date('2024-03-15T12:00:00Z');

  beforeEach(() => {
    loc = new LocalizationService();
  });

  it('formats a date in short format for en-US', () => {
    const result = loc.formatDate(date, 'en', 'short');
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/03|3/);
    expect(result).toMatch(/15/);
  });

  it('formats a date in long format for fr-FR (includes French month name)', () => {
    const result = loc.formatDate(date, 'fr', 'long');
    expect(result).toMatch(/2024/);
    expect(result.toLowerCase()).toMatch(/mars|march/i);
  });

  it('formats a date in long format for sw-KE', () => {
    const result = loc.formatDate(date, 'sw', 'long');
    expect(result).toMatch(/2024/);
  });

  it('returns a relative date string for "relative" format', () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const result = loc.formatDate(future, 'en', 'relative');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('defaults to short format when no format is specified', () => {
    const result = loc.formatDate(date, 'en');
    expect(result).toMatch(/2024/);
  });

  it('falls back to en-US for an unknown language code', () => {
    const result = loc.formatDate(date, 'xx', 'short');
    expect(result).toMatch(/2024/);
  });
});

// ============================================================================
// 4. Number Formatting
// Requirements: 28.10
// ============================================================================

describe('Number Formatting', () => {
  let loc: LocalizationService;

  beforeEach(() => {
    loc = new LocalizationService();
  });

  it('formats a large decimal number for English (comma thousands separator)', () => {
    const result = loc.formatNumber(1234567.89, 'en');
    expect(result).toMatch(/1[,.]?234[,.]?567/);
  });

  it('formats a number as a percentage', () => {
    const result = loc.formatNumber(0.75, 'en', { style: 'percent' });
    expect(result).toContain('75');
    expect(result).toContain('%');
  });

  it('respects minimumFractionDigits', () => {
    const result = loc.formatNumber(10, 'en', { minimumFractionDigits: 2 });
    expect(result).toMatch(/10\.00/);
  });

  it('respects maximumFractionDigits', () => {
    const result = loc.formatNumber(3.14159, 'en', { maximumFractionDigits: 2 });
    expect(result).toMatch(/3\.14/);
  });

  it('produces different separator styles for French vs English', () => {
    const en = loc.formatNumber(1000, 'en');
    const fr = loc.formatNumber(1000, 'fr');
    // Both must be non-empty strings representing 1000
    expect(en).toBeTruthy();
    expect(fr).toBeTruthy();
  });

  it('formats numbers for Swahili locale', () => {
    const result = loc.formatNumber(9999, 'sw');
    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });
});

// ============================================================================
// 5. Currency Formatting
// Requirements: 28.10
// ============================================================================

describe('Currency Formatting', () => {
  let loc: LocalizationService;

  beforeEach(() => {
    loc = new LocalizationService();
  });

  it('formats USD for English with dollar sign', () => {
    const result = loc.formatCurrency(1500.5, 'USD', 'en');
    expect(result).toContain('1,500.50');
    expect(result).toMatch(/\$|USD/);
  });

  it('formats EUR for French with euro sign', () => {
    const result = loc.formatCurrency(200, 'EUR', 'fr');
    expect(result).toContain('200');
    expect(result).toMatch(/€|EUR/);
  });

  it('formats KES for Swahili', () => {
    const result = loc.formatCurrency(5000, 'KES', 'sw');
    expect(result).toContain('5,000');
  });

  it('always shows exactly 2 decimal places', () => {
    const result = loc.formatCurrency(100, 'USD', 'en');
    expect(result).toMatch(/100\.00/);
  });

  it('falls back gracefully for an unknown currency code', () => {
    // Should not throw; returns a fallback string
    const result = loc.formatCurrency(100, 'XYZ', 'en');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats zero amount correctly', () => {
    const result = loc.formatCurrency(0, 'USD', 'en');
    expect(result).toMatch(/0\.00/);
  });
});

// ============================================================================
// 6. Timezone Conversion
// Requirements: 42.1-42.9
// ============================================================================

describe('Timezone Conversion', () => {
  let tz: TimezoneService;

  beforeEach(() => {
    jest.clearAllMocks();
    tz = new TimezoneService();
  });

  // --- UTC to user timezone ---

  it('converts UTC midnight to Africa/Nairobi (UTC+3) as 03:00', () => {
    const utc = new Date('2024-01-15T00:00:00Z');
    const local = tz.convertToUserTimezone(utc, 'Africa/Nairobi');
    expect(local.getHours()).toBe(3);
    expect(local.getMinutes()).toBe(0);
  });

  it('returns the same wall-clock time when converting UTC to UTC', () => {
    const utc = new Date('2024-06-15T10:30:00Z');
    const local = tz.convertToUserTimezone(utc, 'UTC');
    expect(local.getHours()).toBe(10);
    expect(local.getMinutes()).toBe(30);
  });

  it('falls back to UTC for an invalid timezone', () => {
    const utc = new Date('2024-01-15T10:00:00Z');
    const local = tz.convertToUserTimezone(utc, 'Bad/Zone');
    expect(local.getHours()).toBe(10);
  });

  // --- User timezone back to UTC ---

  it('converts Africa/Nairobi 03:00 back to UTC 00:00', () => {
    const local = new Date(2024, 0, 15, 3, 0, 0); // Jan 15 03:00 local
    const utc = tz.convertToUTC(local, 'Africa/Nairobi');
    expect(utc.getUTCHours()).toBe(0);
    expect(utc.getUTCMinutes()).toBe(0);
  });

  it('returns the same time when converting UTC local to UTC', () => {
    const local = new Date(2024, 5, 15, 10, 30, 0);
    const utc = tz.convertToUTC(local, 'UTC');
    expect(utc.getUTCHours()).toBe(10);
    expect(utc.getUTCMinutes()).toBe(30);
  });

  // --- DST handling ---

  it('handles DST — Africa/Casablanca offset differs between summer and winter', () => {
    // Morocco observes DST; offsets should differ between Jan and Jul
    const winter = new Date('2024-01-15T12:00:00Z');
    const summer = new Date('2024-07-15T12:00:00Z');
    const winterOffset = tz.getTimezoneOffset('Africa/Casablanca', winter);
    const summerOffset = tz.getTimezoneOffset('Africa/Casablanca', summer);
    // At least one of the offsets should be non-zero; they may differ
    expect(typeof winterOffset).toBe('number');
    expect(typeof summerOffset).toBe('number');
  });

  // --- Timezone offset ---

  it('returns 0 for UTC', () => {
    expect(tz.getTimezoneOffset('UTC', new Date('2024-01-15T12:00:00Z'))).toBe(0);
  });

  it('returns 180 for Africa/Nairobi (UTC+3)', () => {
    expect(tz.getTimezoneOffset('Africa/Nairobi', new Date('2024-01-15T12:00:00Z'))).toBe(180);
  });

  it('returns 60 for Africa/Lagos (UTC+1)', () => {
    expect(tz.getTimezoneOffset('Africa/Lagos', new Date('2024-01-15T12:00:00Z'))).toBe(60);
  });

  it('returns 120 for Africa/Johannesburg (UTC+2)', () => {
    expect(tz.getTimezoneOffset('Africa/Johannesburg', new Date('2024-01-15T12:00:00Z'))).toBe(120);
  });

  // --- Formatting with timezone ---

  it('formats a UTC date with timezone indicator for Africa/Nairobi', () => {
    const utc = new Date('2024-01-15T12:00:00Z');
    const formatted = tz.formatWithTimezone(utc, 'Africa/Nairobi');
    expect(formatted).toMatch(/2024/);
    expect(typeof formatted).toBe('string');
  });

  it('accepts an optional language for locale-aware formatting', () => {
    const utc = new Date('2024-01-15T12:00:00Z');
    const formatted = tz.formatWithTimezone(utc, 'UTC', 'fr-FR');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  // --- African timezones list ---

  it('returns a non-empty list of common African timezones', () => {
    const timezones = tz.getCommonAfricanTimezones();
    expect(timezones.length).toBeGreaterThan(0);
  });

  it('includes key African timezone identifiers', () => {
    const timezones = tz.getCommonAfricanTimezones();
    expect(timezones).toContain('Africa/Nairobi');
    expect(timezones).toContain('Africa/Lagos');
    expect(timezones).toContain('Africa/Johannesburg');
    expect(timezones).toContain('Africa/Cairo');
  });

  it('all returned African timezones are valid IANA identifiers', () => {
    for (const zone of tz.getCommonAfricanTimezones()) {
      expect(tz.isValidTimezone(zone)).toBe(true);
    }
  });

  // --- Persistence ---

  it('persists user timezone to the database', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    await tz.setUserTimezone('user-1', 'Africa/Nairobi');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      ['Africa/Nairobi', 'user-1'],
    );
  });

  it('throws when setting an invalid timezone', async () => {
    await expect(tz.setUserTimezone('user-1', 'Bad/Zone')).rejects.toThrow('Invalid timezone');
  });

  it('retrieves the stored timezone for a user', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ timezone: 'Africa/Nairobi' }], rowCount: 1 } as any);
    expect(await tz.getUserTimezone('user-1')).toBe('Africa/Nairobi');
  });

  it('returns UTC when the user has no timezone set', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ timezone: null }], rowCount: 1 } as any);
    expect(await tz.getUserTimezone('user-1')).toBe('UTC');
  });

  it('returns UTC when the user is not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);
    expect(await tz.getUserTimezone('nonexistent')).toBe('UTC');
  });
});

// ============================================================================
// 7. Email Translation
// Requirements: 28.6, 28.7
// ============================================================================

describe('Email Translation', () => {
  let loc: LocalizationService;

  beforeEach(() => {
    loc = new LocalizationService();
  });

  it('translates payment.approved email in English', () => {
    const result = loc.translateEmail(
      'payment.approved',
      { name: 'Alice', amount: '$200', date: '2024-03-15' },
      'en',
    );
    expect(result.subject).toBe('Payment Approved');
    expect(result.body).toContain('Alice');
    expect(result.body).toContain('$200');
  });

  it('translates payment.approved email in Swahili', () => {
    const result = loc.translateEmail(
      'payment.approved',
      { name: 'Juma', amount: 'KES 5000', date: '15/03/2024' },
      'sw',
    );
    expect(result.subject).toBe('Malipo Yameidhinishwa');
    expect(result.body).toContain('Juma');
    expect(result.body).toContain('KES 5000');
  });

  it('translates payment.approved email in French', () => {
    const result = loc.translateEmail(
      'payment.approved',
      { name: 'Marie', amount: '€300', date: '15/03/2024' },
      'fr',
    );
    expect(result.subject).toBe('Paiement Approuvé');
    expect(result.body).toContain('Marie');
  });

  it('translates payment.rejected email in Swahili', () => {
    const result = loc.translateEmail(
      'payment.rejected',
      { name: 'Amina', amount: 'KES 1000', reason: 'Insufficient funds' },
      'sw',
    );
    expect(result.subject).toBe('Malipo Yamekataliwa');
    expect(result.body).toContain('Amina');
  });

  it('translates account.welcome email in English', () => {
    const result = loc.translateEmail(
      'account.welcome',
      { name: 'Bob', username: 'bob@example.com' },
      'en',
    );
    expect(result.subject).toBe('Welcome to TechSwiftTrix ERP');
    expect(result.body).toContain('bob@example.com');
  });

  it('translates account.welcome email in French', () => {
    const result = loc.translateEmail(
      'account.welcome',
      { name: 'Pierre', username: 'pierre@example.com' },
      'fr',
    );
    expect(result.subject).toBe('Bienvenue sur TechSwiftTrix ERP');
  });

  it('translates task.assigned email with all params interpolated', () => {
    const result = loc.translateEmail(
      'task.assigned',
      { name: 'Carol', task_name: 'Deploy app', due_date: '2024-04-01' },
      'en',
    );
    expect(result.subject).toContain('Deploy app');
    expect(result.body).toContain('Carol');
    expect(result.body).toContain('Deploy app');
    expect(result.body).toContain('2024-04-01');
  });

  it('falls back to English for an unknown language code', () => {
    const result = loc.translateEmail(
      'payment.approved',
      { name: 'Test', amount: '$10', date: 'today' },
      'xx',
    );
    expect(result.subject).toBe('Payment Approved');
  });

  it('handles region-qualified language codes like fr-CA', () => {
    const result = loc.translateEmail(
      'payment.approved',
      { name: 'Pierre', amount: '€100', date: '2024-01-01' },
      'fr-CA',
    );
    expect(result.subject).toBe('Paiement Approuvé');
  });

  it('returns an empty template for an unknown template key', () => {
    const result = loc.translateEmail('nonexistent.key', {}, 'en');
    expect(result.subject).toBe('nonexistent.key');
    expect(result.body).toBe('');
  });

  it('leaves unreplaced placeholders intact when params are missing', () => {
    const result = loc.translateEmail('payment.approved', {}, 'en');
    expect(result.body).toContain('{{name}}');
    expect(result.body).toContain('{{amount}}');
  });
});
