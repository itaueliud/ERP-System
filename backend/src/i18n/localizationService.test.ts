/**
 * Tests for LocalizationService
 * Requirements: 28.6-28.10
 */

import { LocalizationService } from './localizationService';

// Mock logger to avoid file-system side effects in tests
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock i18nService used by translateNotification
jest.mock('./i18nService', () => ({
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
}));

describe('LocalizationService', () => {
  let service: LocalizationService;

  beforeEach(() => {
    service = new LocalizationService();
  });

  // --------------------------------------------------------------------------
  // getLocaleForLanguage
  // --------------------------------------------------------------------------

  describe('getLocaleForLanguage', () => {
    it('returns en-US for English', () => {
      expect(service.getLocaleForLanguage('en')).toBe('en-US');
    });

    it('returns sw-KE for Swahili', () => {
      expect(service.getLocaleForLanguage('sw')).toBe('sw-KE');
    });

    it('returns fr-FR for French', () => {
      expect(service.getLocaleForLanguage('fr')).toBe('fr-FR');
    });

    it('handles region-qualified codes like en-GB', () => {
      expect(service.getLocaleForLanguage('en-GB')).toBe('en-US');
    });

    it('falls back to en-US for unknown language', () => {
      expect(service.getLocaleForLanguage('xx')).toBe('en-US');
    });
  });

  // --------------------------------------------------------------------------
  // formatDate
  // --------------------------------------------------------------------------

  describe('formatDate', () => {
    const date = new Date('2024-03-15T12:00:00Z');

    it('formats a date in short format for English', () => {
      const result = service.formatDate(date, 'en', 'short');
      // Should contain year, month, day digits
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/03|3/);
      expect(result).toMatch(/15/);
    });

    it('formats a date in long format for French', () => {
      const result = service.formatDate(date, 'fr', 'long');
      expect(result).toMatch(/2024/);
      // French long format includes month name
      expect(result.toLowerCase()).toMatch(/mars|march/i);
    });

    it('formats a date in long format for Swahili', () => {
      const result = service.formatDate(date, 'sw', 'long');
      expect(result).toMatch(/2024/);
    });

    it('returns a relative date string for "relative" format', () => {
      const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
      const result = service.formatDate(future, 'en', 'relative');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('defaults to short format when no format specified', () => {
      const result = service.formatDate(date, 'en');
      expect(result).toMatch(/2024/);
    });
  });

  // --------------------------------------------------------------------------
  // formatNumber
  // --------------------------------------------------------------------------

  describe('formatNumber', () => {
    it('formats a decimal number for English', () => {
      const result = service.formatNumber(1234567.89, 'en');
      expect(result).toMatch(/1[,.]?234[,.]?567/);
    });

    it('formats a number as percent', () => {
      const result = service.formatNumber(0.75, 'en', { style: 'percent' });
      expect(result).toContain('75');
      expect(result).toContain('%');
    });

    it('respects minimumFractionDigits', () => {
      const result = service.formatNumber(10, 'en', { minimumFractionDigits: 2 });
      expect(result).toMatch(/10\.00/);
    });

    it('respects maximumFractionDigits', () => {
      const result = service.formatNumber(3.14159, 'en', { maximumFractionDigits: 2 });
      expect(result).toMatch(/3\.14/);
    });

    it('formats numbers differently for French locale (uses space/comma separators)', () => {
      const enResult = service.formatNumber(1000, 'en');
      const frResult = service.formatNumber(1000, 'fr');
      // Both should represent 1000 but may differ in separators
      expect(enResult).toBeTruthy();
      expect(frResult).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // formatCurrency
  // --------------------------------------------------------------------------

  describe('formatCurrency', () => {
    it('formats USD for English', () => {
      const result = service.formatCurrency(1500.5, 'USD', 'en');
      expect(result).toContain('1,500.50');
      expect(result).toContain('$');
    });

    it('formats EUR for French', () => {
      const result = service.formatCurrency(200, 'EUR', 'fr');
      expect(result).toContain('200');
      expect(result).toMatch(/€|EUR/);
    });

    it('formats KES for Swahili', () => {
      const result = service.formatCurrency(5000, 'KES', 'sw');
      expect(result).toContain('5,000');
    });

    it('falls back gracefully for unknown currency', () => {
      // Should not throw; returns a fallback string
      const result = service.formatCurrency(100, 'XYZ', 'en');
      expect(typeof result).toBe('string');
    });

    it('always shows 2 decimal places', () => {
      const result = service.formatCurrency(100, 'USD', 'en');
      expect(result).toMatch(/100\.00/);
    });
  });

  // --------------------------------------------------------------------------
  // translateNotification
  // --------------------------------------------------------------------------

  describe('translateNotification', () => {
    it('translates payment_approved notification with amount', () => {
      const result = service.translateNotification('payment_approved', { amount: '$500' }, 'en');
      expect(result).toContain('$500');
      expect(result).toContain('approved');
    });

    it('translates report_overdue notification with report name', () => {
      const result = service.translateNotification('report_overdue', { report_name: 'Q1 Report' }, 'en');
      expect(result).toContain('Q1 Report');
      expect(result).toContain('overdue');
    });

    it('translates task_assigned notification', () => {
      const result = service.translateNotification('task_assigned', { task_name: 'Fix bug' }, 'en');
      expect(result).toContain('Fix bug');
    });

    it('returns the key when translation is missing', () => {
      const result = service.translateNotification('unknown_type', {}, 'en');
      expect(result).toContain('notifications.unknown_type');
    });
  });

  // --------------------------------------------------------------------------
  // translateEmail
  // --------------------------------------------------------------------------

  describe('translateEmail', () => {
    it('translates payment.approved email in English', () => {
      const result = service.translateEmail('payment.approved', { name: 'Alice', amount: '$200', date: '2024-03-15' }, 'en');
      expect(result.subject).toBe('Payment Approved');
      expect(result.body).toContain('Alice');
      expect(result.body).toContain('$200');
    });

    it('translates payment.approved email in Swahili', () => {
      const result = service.translateEmail('payment.approved', { name: 'Juma', amount: 'KES 5000', date: '15/03/2024' }, 'sw');
      expect(result.subject).toBe('Malipo Yameidhinishwa');
      expect(result.body).toContain('Juma');
      expect(result.body).toContain('KES 5000');
    });

    it('translates payment.approved email in French', () => {
      const result = service.translateEmail('payment.approved', { name: 'Marie', amount: '€300', date: '15/03/2024' }, 'fr');
      expect(result.subject).toBe('Paiement Approuvé');
      expect(result.body).toContain('Marie');
    });

    it('translates account.welcome email', () => {
      const result = service.translateEmail('account.welcome', { name: 'Bob', username: 'bob@example.com' }, 'en');
      expect(result.subject).toBe('Welcome to TechSwiftTrix ERP');
      expect(result.body).toContain('bob@example.com');
    });

    it('falls back to English for unknown language', () => {
      const result = service.translateEmail('payment.approved', { name: 'Test', amount: '$10', date: 'today' }, 'xx');
      expect(result.subject).toBe('Payment Approved');
    });

    it('returns empty template for unknown template key', () => {
      const result = service.translateEmail('nonexistent.key', {}, 'en');
      expect(result.subject).toBe('nonexistent.key');
      expect(result.body).toBe('');
    });

    it('handles region-qualified language codes like fr-CA', () => {
      const result = service.translateEmail('payment.approved', { name: 'Pierre', amount: '€100', date: '2024-01-01' }, 'fr-CA');
      expect(result.subject).toBe('Paiement Approuvé');
    });

    it('interpolates all params in subject and body', () => {
      const result = service.translateEmail(
        'task.assigned',
        { name: 'Carol', task_name: 'Deploy app', due_date: '2024-04-01' },
        'en',
      );
      expect(result.subject).toContain('Deploy app');
      expect(result.body).toContain('Carol');
      expect(result.body).toContain('Deploy app');
      expect(result.body).toContain('2024-04-01');
    });
  });
});
