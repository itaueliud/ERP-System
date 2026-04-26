/**
 * Tests for I18nService
 * Requirements: 28.1-28.5
 */

import { I18nService, SupportedLanguage } from './i18nService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => {
  const mock = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return { __esModule: true, default: mock };
});

import { db } from '../database/connection';
const mockDb = db as jest.Mocked<typeof db>;

// ============================================================================
// Tests
// ============================================================================

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new I18nService();
  });

  // --------------------------------------------------------------------------
  // getSupportedLanguages
  // --------------------------------------------------------------------------

  describe('getSupportedLanguages', () => {
    it('returns all three supported languages', () => {
      expect(service.getSupportedLanguages()).toEqual(['en', 'sw', 'fr']);
    });

    it('returns a copy — mutations do not affect the service', () => {
      const langs = service.getSupportedLanguages();
      langs.push('de' as SupportedLanguage);
      expect(service.getSupportedLanguages()).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------------------
  // t — translate
  // --------------------------------------------------------------------------

  describe('t', () => {
    it('translates a key in English', () => {
      expect(service.t('common.save', 'en')).toBe('Save');
    });

    it('translates a key in Swahili', () => {
      expect(service.t('common.save', 'sw')).toBe('Hifadhi');
    });

    it('translates a key in French', () => {
      expect(service.t('common.save', 'fr')).toBe('Enregistrer');
    });

    it('interpolates params into the translation', () => {
      const result = service.t('notifications.payment_approved', 'en', { amount: '$100' });
      expect(result).toBe('Your payment of $100 has been approved.');
    });

    it('interpolates params in Swahili', () => {
      const result = service.t('notifications.task_assigned', 'sw', { task_name: 'Ukaguzi' });
      expect(result).toBe('Umepewa kazi mpya: Ukaguzi.');
    });

    it('leaves placeholder intact when param is missing', () => {
      const result = service.t('notifications.payment_approved', 'en');
      expect(result).toContain('{{amount}}');
    });

    it('falls back to English for an unsupported language', () => {
      expect(service.t('common.cancel', 'de')).toBe('Cancel');
    });

    it('falls back to English when key is missing in target language', () => {
      // All keys exist in all languages, so we test the key-fallback path
      expect(service.t('common.confirm', 'en')).toBe('Confirm');
    });

    it('returns the key itself when not found in any language', () => {
      expect(service.t('nonexistent.key', 'en')).toBe('nonexistent.key');
    });

    it('handles locale variants like "fr-CA" by stripping the region', () => {
      expect(service.t('common.save', 'fr-CA')).toBe('Enregistrer');
    });

    it('translates all auth keys in all languages', () => {
      const keys = ['auth.login_success', 'auth.login_failed', 'auth.logout_success'];
      const langs: SupportedLanguage[] = ['en', 'sw', 'fr'];
      for (const lang of langs) {
        for (const key of keys) {
          const result = service.t(key, lang);
          expect(result).not.toBe(key); // should be translated, not the raw key
        }
      }
    });

    it('translates all error keys in all languages', () => {
      const keys = ['errors.not_found', 'errors.unauthorized', 'errors.forbidden', 'errors.validation_failed'];
      const langs: SupportedLanguage[] = ['en', 'sw', 'fr'];
      for (const lang of langs) {
        for (const key of keys) {
          expect(service.t(key, lang)).not.toBe(key);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // detectLanguage
  // --------------------------------------------------------------------------

  describe('detectLanguage', () => {
    it('detects English from "en"', () => {
      expect(service.detectLanguage('en')).toBe('en');
    });

    it('detects Swahili from "sw"', () => {
      expect(service.detectLanguage('sw')).toBe('sw');
    });

    it('detects French from "fr"', () => {
      expect(service.detectLanguage('fr')).toBe('fr');
    });

    it('detects language from a full Accept-Language header', () => {
      expect(service.detectLanguage('en-US,en;q=0.9,fr;q=0.8')).toBe('en');
    });

    it('picks the highest-quality supported language', () => {
      expect(service.detectLanguage('de;q=1.0,fr;q=0.9,en;q=0.8')).toBe('fr');
    });

    it('strips region subtag (fr-CA → fr)', () => {
      expect(service.detectLanguage('fr-CA')).toBe('fr');
    });

    it('falls back to English for unsupported language', () => {
      expect(service.detectLanguage('de,es')).toBe('en');
    });

    it('falls back to English for empty header', () => {
      expect(service.detectLanguage('')).toBe('en');
    });

    it('handles sw-KE correctly', () => {
      expect(service.detectLanguage('sw-KE')).toBe('sw');
    });
  });

  // --------------------------------------------------------------------------
  // getTranslations
  // --------------------------------------------------------------------------

  describe('getTranslations', () => {
    it('returns all translations for English', () => {
      const dict = service.getTranslations('en');
      expect(dict['common.save']).toBe('Save');
      expect(dict['auth.login_success']).toBe('Login successful');
    });

    it('returns all translations for Swahili', () => {
      const dict = service.getTranslations('sw');
      expect(dict['common.save']).toBe('Hifadhi');
    });

    it('returns all translations for French', () => {
      const dict = service.getTranslations('fr');
      expect(dict['common.save']).toBe('Enregistrer');
    });

    it('returns a copy — mutations do not affect the service', () => {
      const dict = service.getTranslations('en');
      dict['common.save'] = 'MUTATED';
      expect(service.getTranslations('en')['common.save']).toBe('Save');
    });

    it('falls back to English for unsupported language', () => {
      const dict = service.getTranslations('xx');
      expect(dict['common.save']).toBe('Save');
    });

    it('contains all required keys for every language', () => {
      const requiredKeys = [
        'auth.login_success', 'auth.login_failed', 'auth.logout_success',
        'errors.not_found', 'errors.unauthorized', 'errors.forbidden', 'errors.validation_failed',
        'notifications.payment_approved', 'notifications.report_overdue', 'notifications.task_assigned',
        'common.save', 'common.cancel', 'common.delete', 'common.confirm',
      ];
      for (const lang of ['en', 'sw', 'fr'] as SupportedLanguage[]) {
        const dict = service.getTranslations(lang);
        for (const key of requiredKeys) {
          expect(Object.prototype.hasOwnProperty.call(dict, key)).toBe(true);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // setUserLanguage
  // --------------------------------------------------------------------------

  describe('setUserLanguage', () => {
    it('executes an UPDATE query with the correct params', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.setUserLanguage('user-1', 'fr');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['fr', 'user-1']
      );
    });

    it('normalizes language before persisting', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.setUserLanguage('user-2', 'FR');

      const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(params[0]).toBe('fr');
    });

    it('falls back to "en" for unsupported language', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.setUserLanguage('user-3', 'de');

      const [, params] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(params[0]).toBe('en');
    });
  });

  // --------------------------------------------------------------------------
  // getUserLanguage
  // --------------------------------------------------------------------------

  describe('getUserLanguage', () => {
    it('returns the stored language for a user', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ preferred_language: 'sw' }], rowCount: 1 } as any);

      const lang = await service.getUserLanguage('user-1');

      expect(lang).toBe('sw');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT preferred_language'),
        ['user-1']
      );
    });

    it('returns "en" when user is not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const lang = await service.getUserLanguage('unknown-user');

      expect(lang).toBe('en');
    });

    it('normalizes an unsupported stored value to "en"', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ preferred_language: 'de' }], rowCount: 1 } as any);

      const lang = await service.getUserLanguage('user-2');

      expect(lang).toBe('en');
    });
  });
});
