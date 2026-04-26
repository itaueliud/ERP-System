/**
 * Unit tests for data validation – task 28.4
 * Requirements: 44.1-44.12
 *
 * Covers:
 *  - Email validation: valid RFC 5322 emails, invalid formats (44.3)
 *  - Phone number validation: valid E.164 format, invalid formats (44.4)
 *  - Amount validation: positive amounts, negative rejection, zero, decimal precision (44.5)
 *  - Date range validation: valid/invalid ranges, edge cases (44.6)
 *  - Input sanitization: XSS prevention, SQL injection prevention (44.9)
 *  - Specific error messages for invalid fields (44.11)
 */

// Mock logger before any imports
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { ValidationService } from './validationService';
import { SanitizationService } from './sanitizationService';

const validation = new ValidationService();
const sanitization = new SanitizationService();

// ============================================================================
// Email Validation – Requirements 44.3
// ============================================================================

describe('Email validation (Req 44.3)', () => {
  // ── Valid RFC 5322 emails ──────────────────────────────────────────────────

  describe('valid RFC 5322 emails are accepted', () => {
    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.co.ke',
      'user_name@sub.domain.org',
      'firstname.lastname@company.io',
      'user123@numbers123.net',
      'a@b.co',                          // minimal valid email
      'user@mail.example.co.uk',         // multi-level TLD
      'user!#$%&\'*+/=?^_`{|}~@example.com', // special chars in local part
    ];

    it.each(validEmails)('accepts "%s"', (email) => {
      const result = validation.validateEmail(email);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ── Invalid email formats ─────────────────────────────────────────────────

  describe('invalid email formats are rejected', () => {
    it('rejects email missing @ symbol', () => {
      const result = validation.validateEmail('userexample.com');
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('email');
    });

    it('rejects email missing domain after @', () => {
      const result = validation.validateEmail('user@');
      expect(result.valid).toBe(false);
    });

    it('rejects email missing TLD', () => {
      const result = validation.validateEmail('user@domain');
      expect(result.valid).toBe(false);
    });

    it('rejects email with space in local part', () => {
      expect(validation.validateEmail('user name@example.com').valid).toBe(false);
    });

    it('rejects email with space before @', () => {
      expect(validation.validateEmail('user @example.com').valid).toBe(false);
    });

    it('rejects email with space after @', () => {
      expect(validation.validateEmail('user@ example.com').valid).toBe(false);
    });

    it('rejects email with double @', () => {
      expect(validation.validateEmail('user@@example.com').valid).toBe(false);
    });

    it('rejects email with consecutive dots in domain', () => {
      expect(validation.validateEmail('user@exam..ple.com').valid).toBe(false);
    });

    it('rejects email starting with a dot', () => {
      expect(validation.validateEmail('.user@example.com').valid).toBe(false);
    });

    it('rejects email ending with a dot before @', () => {
      expect(validation.validateEmail('user.@example.com').valid).toBe(false);
    });

    it('rejects empty string with "required" error', () => {
      const result = validation.validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toMatch(/required/i);
    });

    it('rejects whitespace-only string', () => {
      expect(validation.validateEmail('   ').valid).toBe(false);
    });

    it('rejects email with no local part (just @domain.com)', () => {
      expect(validation.validateEmail('@example.com').valid).toBe(false);
    });
  });

  // ── Error message quality (Req 44.11) ─────────────────────────────────────

  it('returns a descriptive error message for invalid email', () => {
    const result = validation.validateEmail('not-an-email');
    expect(result.errors[0].message).toBeTruthy();
    expect(result.errors[0].message.length).toBeGreaterThan(5);
  });
});

// ============================================================================
// Phone Number Validation – Requirements 44.4
// ============================================================================

describe('Phone number validation (Req 44.4)', () => {
  // ── Valid E.164 numbers ───────────────────────────────────────────────────

  describe('valid E.164 phone numbers are accepted', () => {
    const validPhones = [
      '+254700000000',   // Kenya (12 digits total)
      '+12025551234',    // US (12 digits total)
      '+447911123456',   // UK (12 digits total)
      '+27831234567',    // South Africa (11 digits total)
      '+2348012345678',  // Nigeria (13 digits total)
      '+12345678',       // minimum length (8 digits total = + + 7 digits)
      '+123456789012345', // maximum length (16 chars = + + 15 digits)
    ];

    it.each(validPhones)('accepts "%s"', (phone) => {
      const result = validation.validatePhone(phone);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ── Invalid phone formats ─────────────────────────────────────────────────

  describe('invalid phone formats are rejected', () => {
    it('rejects number without leading +', () => {
      expect(validation.validatePhone('254700000000').valid).toBe(false);
    });

    it('rejects number with letters', () => {
      expect(validation.validatePhone('+1800FLOWERS').valid).toBe(false);
    });

    it('rejects number with dashes', () => {
      expect(validation.validatePhone('+1-202-555-1234').valid).toBe(false);
    });

    it('rejects number with spaces', () => {
      expect(validation.validatePhone('+1 202 555 1234').valid).toBe(false);
    });

    it('rejects number with parentheses', () => {
      expect(validation.validatePhone('+1(202)5551234').valid).toBe(false);
    });

    it('rejects number starting with +0 (invalid country code)', () => {
      expect(validation.validatePhone('+01234567890').valid).toBe(false);
    });

    it('rejects number that is too short (fewer than 7 digits after country code)', () => {
      expect(validation.validatePhone('+123456').valid).toBe(false);
    });

    it('rejects number that is too long (more than 15 digits total)', () => {
      expect(validation.validatePhone('+1234567890123456').valid).toBe(false);
    });

    it('rejects empty string with "required" error', () => {
      const result = validation.validatePhone('');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toMatch(/required/i);
    });

    it('rejects whitespace-only string', () => {
      expect(validation.validatePhone('   ').valid).toBe(false);
    });

    it('rejects plain + with no digits', () => {
      expect(validation.validatePhone('+').valid).toBe(false);
    });
  });

  // ── Error message quality (Req 44.11) ─────────────────────────────────────

  it('returns a descriptive error message mentioning E.164 format', () => {
    const result = validation.validatePhone('0700000000');
    expect(result.errors[0].message).toMatch(/E\.164/i);
  });
});

// ============================================================================
// Amount Validation – Requirements 44.5
// ============================================================================

describe('Amount validation (Req 44.5)', () => {
  // ── Valid positive amounts ────────────────────────────────────────────────

  describe('valid positive amounts are accepted', () => {
    const validAmounts = [0.01, 1, 100, 999.99, 1000000, 0.1, 50000.50];

    it.each(validAmounts)('accepts %s', (amount) => {
      const result = validation.validateAmount(amount);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ── Zero handling ─────────────────────────────────────────────────────────

  it('accepts zero as a valid amount', () => {
    expect(validation.validateAmount(0).valid).toBe(true);
  });

  // ── Negative amounts rejected ─────────────────────────────────────────────

  describe('negative amounts are rejected by default', () => {
    const negativeAmounts = [-0.01, -1, -100, -999.99, -1000000];

    it.each(negativeAmounts)('rejects %s', (amount) => {
      const result = validation.validateAmount(amount);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('amount');
    });
  });

  it('accepts negative amount when allowNegative=true', () => {
    expect(validation.validateAmount(-50, true).valid).toBe(true);
    expect(validation.validateAmount(-0.01, true).valid).toBe(true);
  });

  // ── Decimal precision ─────────────────────────────────────────────────────

  it('accepts amounts with 2 decimal places', () => {
    expect(validation.validateAmount(99.99).valid).toBe(true);
    expect(validation.validateAmount(0.01).valid).toBe(true);
  });

  it('accepts amounts with more than 2 decimal places (precision is caller responsibility)', () => {
    // The validation service validates the number is valid; precision rounding
    // is handled at the serialization layer (Req 65.8)
    expect(validation.validateAmount(99.999).valid).toBe(true);
  });

  // ── Non-numeric / special values rejected ─────────────────────────────────

  it('rejects NaN', () => {
    const result = validation.validateAmount(NaN);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/valid number/i);
  });

  it('rejects Infinity', () => {
    const result = validation.validateAmount(Infinity);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/finite/i);
  });

  it('rejects -Infinity', () => {
    const result = validation.validateAmount(-Infinity);
    expect(result.valid).toBe(false);
  });

  it('rejects non-number type (string)', () => {
    const result = validation.validateAmount('100' as any);
    expect(result.valid).toBe(false);
  });

  // ── Error message quality (Req 44.11) ─────────────────────────────────────

  it('returns descriptive error for negative amount', () => {
    const result = validation.validateAmount(-5);
    expect(result.errors[0].message).toMatch(/negative/i);
  });
});

// ============================================================================
// Date Range Validation – Requirements 44.6
// ============================================================================

describe('Date range validation (Req 44.6)', () => {
  // ── Valid ranges ──────────────────────────────────────────────────────────

  it('accepts start date equal to end date (same day)', () => {
    const d = new Date('2024-06-15');
    expect(validation.validateDateRange(d, d).valid).toBe(true);
  });

  it('accepts start date before end date', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    expect(validation.validateDateRange(start, end).valid).toBe(true);
  });

  it('accepts start and end dates one millisecond apart', () => {
    const start = new Date('2024-06-01T00:00:00.000Z');
    const end = new Date('2024-06-01T00:00:00.001Z');
    expect(validation.validateDateRange(start, end).valid).toBe(true);
  });

  it('accepts dates spanning multiple years', () => {
    const start = new Date('2020-01-01');
    const end = new Date('2030-12-31');
    expect(validation.validateDateRange(start, end).valid).toBe(true);
  });

  // ── Invalid ranges ────────────────────────────────────────────────────────

  it('rejects start date after end date', () => {
    const result = validation.validateDateRange(
      new Date('2024-12-31'),
      new Date('2024-01-01')
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('dateRange');
  });

  it('rejects start date one millisecond after end date', () => {
    const end = new Date('2024-06-01T00:00:00.000Z');
    const start = new Date('2024-06-01T00:00:00.001Z');
    expect(validation.validateDateRange(start, end).valid).toBe(false);
  });

  // ── Invalid date objects ──────────────────────────────────────────────────

  it('rejects invalid start date (NaN date)', () => {
    const result = validation.validateDateRange(new Date('not-a-date'), new Date('2024-01-01'));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'startDate')).toBe(true);
  });

  it('rejects invalid end date (NaN date)', () => {
    const result = validation.validateDateRange(new Date('2024-01-01'), new Date('invalid'));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'endDate')).toBe(true);
  });

  it('rejects both invalid start and end dates', () => {
    const result = validation.validateDateRange(new Date('bad'), new Date('also-bad'));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects non-Date objects', () => {
    const result = validation.validateDateRange('2024-01-01' as any, '2024-12-31' as any);
    expect(result.valid).toBe(false);
  });

  // ── Error message quality (Req 44.11) ─────────────────────────────────────

  it('returns descriptive error message for invalid range', () => {
    const result = validation.validateDateRange(
      new Date('2024-12-31'),
      new Date('2024-01-01')
    );
    expect(result.errors[0].message).toMatch(/start date/i);
    expect(result.errors[0].message).toMatch(/end date/i);
  });
});

// ============================================================================
// Input Sanitization – Requirements 44.9
// ============================================================================

describe('Input sanitization (Req 44.9)', () => {
  // ── XSS prevention ────────────────────────────────────────────────────────

  describe('XSS prevention via sanitizeText', () => {
    it('strips <script> tags', () => {
      const result = sanitization.sanitizeText('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('strips <img> tags with onerror handler', () => {
      const result = sanitization.sanitizeText('<img src=x onerror=alert(1)>');
      expect(result).not.toContain('<img');
    });

    it('strips <iframe> tags', () => {
      const result = sanitization.sanitizeText('<iframe src="evil.com"></iframe>');
      expect(result).not.toContain('<iframe');
    });

    it('encodes < and > characters', () => {
      const result = sanitization.sanitizeText('1 < 2 > 0');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('encodes & character', () => {
      const result = sanitization.sanitizeText('Tom & Jerry');
      expect(result).toContain('&amp;');
    });

    it('encodes double quotes', () => {
      const result = sanitization.sanitizeText('"quoted"');
      expect(result).toContain('&quot;');
    });

    it('encodes single quotes', () => {
      const result = sanitization.sanitizeText("it's fine");
      expect(result).toContain('&#x27;');
    });

    it('preserves plain text without modification', () => {
      expect(sanitization.sanitizeText('Hello World 123')).toBe('Hello World 123');
    });

    it('handles empty string', () => {
      expect(sanitization.sanitizeText('')).toBe('');
    });

    it('strips javascript: protocol in text', () => {
      const result = sanitization.sanitizeText('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('<a');
    });
  });

  describe('XSS prevention via sanitizeHtml', () => {
    it('strips script tags and their content', () => {
      const result = sanitization.sanitizeHtml('<script>alert("xss")</script><p>safe</p>', ['p']);
      expect(result).not.toContain('alert');
      expect(result).toContain('safe');
    });

    it('strips event handler attributes (onclick, onload, etc.)', () => {
      const result = sanitization.sanitizeHtml('<p onclick="evil()">text</p>', ['p']);
      expect(result).not.toContain('onclick');
      expect(result).toContain('text');
    });

    it('strips javascript: href', () => {
      const result = sanitization.sanitizeHtml('<a href="javascript:void(0)">link</a>', ['a']);
      expect(result).not.toContain('javascript:');
    });

    it('keeps allowed tags', () => {
      const result = sanitization.sanitizeHtml('<p>Hello <b>World</b></p>', ['p', 'b']);
      expect(result).toContain('<p>');
      expect(result).toContain('<b>');
    });

    it('strips all tags when no allowed tags specified', () => {
      const result = sanitization.sanitizeHtml('<div><p>text</p></div>');
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<p>');
      expect(result).toContain('text');
    });
  });

  // ── SQL injection prevention ───────────────────────────────────────────────

  describe('SQL injection prevention via sanitizeSqlInput', () => {
    it("escapes single quotes to prevent ' OR '1'='1 injection", () => {
      const injection = "' OR '1'='1";
      const result = sanitization.sanitizeSqlInput(injection);
      expect(result).not.toBe(injection);
      expect(result).toContain("\\'");
    });

    it('escapes semicolons to prevent statement termination', () => {
      const injection = 'DROP TABLE users;';
      const result = sanitization.sanitizeSqlInput(injection);
      expect(result).toContain('\\;');
    });

    it('escapes classic SQL injection: SELECT * FROM users WHERE id=1 OR 1=1', () => {
      const injection = "1 OR '1'='1'; DROP TABLE users; --";
      const result = sanitization.sanitizeSqlInput(injection);
      expect(result).toContain("\\'");
      expect(result).toContain('\\;');
    });

    it('escapes double quotes', () => {
      const result = sanitization.sanitizeSqlInput('say "hello"');
      expect(result).toContain('\\"');
    });

    it('escapes backslashes', () => {
      const result = sanitization.sanitizeSqlInput('C:\\Users\\admin');
      expect(result).toContain('\\\\');
    });

    it('leaves safe alphanumeric strings unchanged', () => {
      expect(sanitization.sanitizeSqlInput('hello world 123')).toBe('hello world 123');
    });

    it('handles empty string', () => {
      expect(sanitization.sanitizeSqlInput('')).toBe('');
    });

    it('handles UNION-based injection attempt', () => {
      const injection = "1 UNION SELECT username, password FROM users; --";
      const result = sanitization.sanitizeSqlInput(injection);
      expect(result).toContain('\\;');
    });
  });

  // ── Object sanitization ───────────────────────────────────────────────────

  describe('sanitizeObject sanitizes all string fields recursively', () => {
    it('sanitizes string values in a flat object', () => {
      const obj = { name: '<script>xss</script>', age: 30 };
      const result = sanitization.sanitizeObject(obj);
      expect(result.name).not.toContain('<script>');
      expect(result.age).toBe(30);
    });

    it('sanitizes nested objects recursively', () => {
      const obj = { user: { bio: '<b>bold</b>', email: 'user@example.com' } };
      const result = sanitization.sanitizeObject(obj);
      expect(result.user.bio).not.toContain('<b>');
    });

    it('sanitizes strings inside arrays', () => {
      const obj = { tags: ['<script>bad</script>', 'safe'] };
      const result = sanitization.sanitizeObject(obj);
      expect(result.tags[0]).not.toContain('<script>');
      expect(result.tags[1]).toBe('safe');
    });

    it('preserves non-string values (numbers, booleans, null)', () => {
      const obj = { count: 42, active: true, value: null };
      const result = sanitization.sanitizeObject(obj);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.value).toBeNull();
    });
  });
});

// ============================================================================
// validateAll – combined validation (Req 44.1, 44.11)
// ============================================================================

describe('validateAll – combined field validation (Req 44.1, 44.11)', () => {
  it('returns valid when all fields pass', () => {
    const result = validation.validateAll([
      { field: 'email', value: 'user@example.com', rules: [{ type: 'required' }, { type: 'email' }] },
      { field: 'phone', value: '+254700000000', rules: [{ type: 'required' }, { type: 'phone' }] },
      { field: 'amount', value: 5000, rules: [{ type: 'amount' }] },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('collects errors from multiple failing fields', () => {
    const result = validation.validateAll([
      { field: 'email', value: 'not-an-email', rules: [{ type: 'email' }] },
      { field: 'phone', value: '0700000000', rules: [{ type: 'phone' }] },
      { field: 'amount', value: -100, rules: [{ type: 'amount' }] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('identifies which specific fields are invalid (Req 44.11)', () => {
    const result = validation.validateAll([
      { field: 'email', value: 'bad', rules: [{ type: 'email' }] },
      { field: 'phone', value: 'bad', rules: [{ type: 'phone' }] },
    ]);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain('email');
    expect(fields).toContain('phone');
  });

  it('validates date range via validateAll', () => {
    const result = validation.validateAll([
      {
        field: 'startDate',
        value: new Date('2024-12-31'),
        rules: [{ type: 'dateRange', endDate: new Date('2024-01-01') }],
      },
    ]);
    expect(result.valid).toBe(false);
  });

  it('returns empty errors array when no rules provided', () => {
    const result = validation.validateAll([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
