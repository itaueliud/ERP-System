import { ValidationService } from './validationService';

// Mock logger to avoid file system / config dependencies in tests
jest.mock('../utils/logger', () => {
  const mock = { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { __esModule: true, default: mock };
});

describe('ValidationService', () => {
  let svc: ValidationService;

  beforeEach(() => {
    svc = new ValidationService();
  });

  // ─── validateEmail ────────────────────────────────────────────────────────

  describe('validateEmail', () => {
    it('accepts a standard valid email', () => {
      expect(svc.validateEmail('user@example.com').valid).toBe(true);
    });

    it('accepts email with sub-domain', () => {
      expect(svc.validateEmail('user@mail.example.co.uk').valid).toBe(true);
    });

    it('accepts email with special chars in local part', () => {
      expect(svc.validateEmail('user+tag@example.com').valid).toBe(true);
    });

    it('rejects email without @', () => {
      const r = svc.validateEmail('userexample.com');
      expect(r.valid).toBe(false);
      expect(r.errors[0].field).toBe('email');
    });

    it('rejects email without domain', () => {
      expect(svc.validateEmail('user@').valid).toBe(false);
    });

    it('rejects empty string', () => {
      const r = svc.validateEmail('');
      expect(r.valid).toBe(false);
      expect(r.errors[0].message).toMatch(/required/i);
    });

    it('rejects email with spaces', () => {
      expect(svc.validateEmail('user @example.com').valid).toBe(false);
    });

    it('rejects double-dot domain', () => {
      expect(svc.validateEmail('user@exam..ple.com').valid).toBe(false);
    });
  });

  // ─── validatePhone ────────────────────────────────────────────────────────

  describe('validatePhone', () => {
    it('accepts valid E.164 US number', () => {
      expect(svc.validatePhone('+12025551234').valid).toBe(true);
    });

    it('accepts valid E.164 UK number', () => {
      expect(svc.validatePhone('+447911123456').valid).toBe(true);
    });

    it('accepts minimum length E.164 (7 digits after country code)', () => {
      expect(svc.validatePhone('+12345678').valid).toBe(true);
    });

    it('rejects number without leading +', () => {
      expect(svc.validatePhone('12025551234').valid).toBe(false);
    });

    it('rejects number with letters', () => {
      expect(svc.validatePhone('+1202ABC1234').valid).toBe(false);
    });

    it('rejects empty string', () => {
      const r = svc.validatePhone('');
      expect(r.valid).toBe(false);
      expect(r.errors[0].message).toMatch(/required/i);
    });

    it('rejects number that is too short', () => {
      expect(svc.validatePhone('+123456').valid).toBe(false);
    });

    it('rejects number that is too long (>15 digits)', () => {
      expect(svc.validatePhone('+1234567890123456').valid).toBe(false);
    });

    it('rejects number starting with +0', () => {
      expect(svc.validatePhone('+01234567890').valid).toBe(false);
    });
  });

  // ─── validateAmount ───────────────────────────────────────────────────────

  describe('validateAmount', () => {
    it('accepts zero', () => {
      expect(svc.validateAmount(0).valid).toBe(true);
    });

    it('accepts positive amount', () => {
      expect(svc.validateAmount(99.99).valid).toBe(true);
    });

    it('rejects negative amount by default', () => {
      const r = svc.validateAmount(-1);
      expect(r.valid).toBe(false);
      expect(r.errors[0].field).toBe('amount');
    });

    it('accepts negative amount when allowNegative is true', () => {
      expect(svc.validateAmount(-50, true).valid).toBe(true);
    });

    it('rejects NaN', () => {
      expect(svc.validateAmount(NaN).valid).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(svc.validateAmount(Infinity).valid).toBe(false);
    });

    it('rejects -Infinity', () => {
      expect(svc.validateAmount(-Infinity).valid).toBe(false);
    });
  });

  // ─── validateDateRange ────────────────────────────────────────────────────

  describe('validateDateRange', () => {
    it('accepts equal start and end dates', () => {
      const d = new Date('2024-01-01');
      expect(svc.validateDateRange(d, d).valid).toBe(true);
    });

    it('accepts start before end', () => {
      expect(
        svc.validateDateRange(new Date('2024-01-01'), new Date('2024-12-31')).valid
      ).toBe(true);
    });

    it('rejects start after end', () => {
      const r = svc.validateDateRange(new Date('2024-12-31'), new Date('2024-01-01'));
      expect(r.valid).toBe(false);
      expect(r.errors[0].field).toBe('dateRange');
    });

    it('rejects invalid start date', () => {
      const r = svc.validateDateRange(new Date('not-a-date'), new Date('2024-01-01'));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.field === 'startDate')).toBe(true);
    });

    it('rejects invalid end date', () => {
      const r = svc.validateDateRange(new Date('2024-01-01'), new Date('not-a-date'));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.field === 'endDate')).toBe(true);
    });
  });

  // ─── validateRequired ─────────────────────────────────────────────────────

  describe('validateRequired', () => {
    it('accepts a non-empty string', () => {
      expect(svc.validateRequired('hello', 'name').valid).toBe(true);
    });

    it('accepts a number (including 0)', () => {
      expect(svc.validateRequired(0, 'count').valid).toBe(true);
    });

    it('accepts a non-empty array', () => {
      expect(svc.validateRequired([1], 'items').valid).toBe(true);
    });

    it('rejects null', () => {
      expect(svc.validateRequired(null, 'name').valid).toBe(false);
    });

    it('rejects undefined', () => {
      expect(svc.validateRequired(undefined, 'name').valid).toBe(false);
    });

    it('rejects empty string', () => {
      expect(svc.validateRequired('', 'name').valid).toBe(false);
    });

    it('rejects whitespace-only string', () => {
      expect(svc.validateRequired('   ', 'name').valid).toBe(false);
    });

    it('rejects empty array', () => {
      expect(svc.validateRequired([], 'items').valid).toBe(false);
    });

    it('includes the field name in the error', () => {
      const r = svc.validateRequired(null, 'companyName');
      expect(r.errors[0].field).toBe('companyName');
    });
  });

  // ─── validateMaxLength ────────────────────────────────────────────────────

  describe('validateMaxLength', () => {
    it('accepts string within limit', () => {
      expect(svc.validateMaxLength('hello', 10, 'name').valid).toBe(true);
    });

    it('accepts string exactly at limit', () => {
      expect(svc.validateMaxLength('hello', 5, 'name').valid).toBe(true);
    });

    it('rejects string exceeding limit', () => {
      const r = svc.validateMaxLength('toolongstring', 5, 'name');
      expect(r.valid).toBe(false);
      expect(r.errors[0].field).toBe('name');
    });

    it('accepts empty string', () => {
      expect(svc.validateMaxLength('', 5, 'name').valid).toBe(true);
    });

    it('rejects non-string value', () => {
      expect(svc.validateMaxLength(123 as any, 5, 'name').valid).toBe(false);
    });
  });

  // ─── validateEnum ─────────────────────────────────────────────────────────

  describe('validateEnum', () => {
    const statuses = ['active', 'inactive', 'pending'];

    it('accepts a valid enum value', () => {
      expect(svc.validateEnum('active', statuses, 'status').valid).toBe(true);
    });

    it('rejects a value not in the list', () => {
      const r = svc.validateEnum('deleted', statuses, 'status');
      expect(r.valid).toBe(false);
      expect(r.errors[0].field).toBe('status');
    });

    it('is case-sensitive', () => {
      expect(svc.validateEnum('Active', statuses, 'status').valid).toBe(false);
    });

    it('includes allowed values in error message', () => {
      const r = svc.validateEnum('bad', statuses, 'status');
      expect(r.errors[0].message).toContain('active');
    });
  });

  // ─── validateAll ──────────────────────────────────────────────────────────

  describe('validateAll', () => {
    it('returns valid when all rules pass', () => {
      const result = svc.validateAll([
        { field: 'email', value: 'user@example.com', rules: [{ type: 'required' }, { type: 'email' }] },
        { field: 'amount', value: 100, rules: [{ type: 'amount' }] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('collects errors from multiple failing rules', () => {
      const result = svc.validateAll([
        { field: 'email', value: '', rules: [{ type: 'required' }, { type: 'email' }] },
        { field: 'amount', value: -5, rules: [{ type: 'amount' }] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('validates phone via validateAll', () => {
      const result = svc.validateAll([
        { field: 'phone', value: '+12025551234', rules: [{ type: 'phone' }] },
      ]);
      expect(result.valid).toBe(true);
    });

    it('validates dateRange via validateAll', () => {
      const result = svc.validateAll([
        {
          field: 'startDate',
          value: new Date('2024-12-31'),
          rules: [{ type: 'dateRange', endDate: new Date('2024-01-01') }],
        },
      ]);
      expect(result.valid).toBe(false);
    });

    it('validates maxLength via validateAll', () => {
      const result = svc.validateAll([
        { field: 'name', value: 'a very long name that exceeds limit', rules: [{ type: 'maxLength', maxLength: 10 }] },
      ]);
      expect(result.valid).toBe(false);
    });

    it('validates enum via validateAll', () => {
      const result = svc.validateAll([
        { field: 'status', value: 'unknown', rules: [{ type: 'enum', allowedValues: ['active', 'inactive'] }] },
      ]);
      expect(result.valid).toBe(false);
    });

    it('returns empty errors array when rules list is empty', () => {
      const result = svc.validateAll([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('allows negative amount when allowNegative is set', () => {
      const result = svc.validateAll([
        { field: 'adjustment', value: -10, rules: [{ type: 'amount', allowNegative: true }] },
      ]);
      expect(result.valid).toBe(true);
    });
  });
});
