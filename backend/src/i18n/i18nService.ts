/**
 * I18n Service — multi-language support
 * Requirements: 28.1-28.5
 */

import { db } from '../database/connection';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type SupportedLanguage = 'en' | 'sw' | 'fr';

// ============================================================================
// Translation dictionaries
// ============================================================================

const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    'auth.login_success': 'Login successful',
    'auth.login_failed': 'Login failed. Please check your credentials.',
    'auth.logout_success': 'You have been logged out successfully.',

    'errors.not_found': 'The requested resource was not found.',
    'errors.unauthorized': 'You are not authorized to perform this action.',
    'errors.forbidden': 'Access to this resource is forbidden.',
    'errors.validation_failed': 'Validation failed. Please check your input.',

    'notifications.payment_approved': 'Your payment of {{amount}} has been approved.',
    'notifications.report_overdue': 'Report "{{report_name}}" is overdue.',
    'notifications.task_assigned': 'You have been assigned a new task: {{task_name}}.',

    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
  },

  sw: {
    'auth.login_success': 'Umeingia kwa mafanikio',
    'auth.login_failed': 'Kuingia kumeshindwa. Tafadhali angalia neno lako la siri.',
    'auth.logout_success': 'Umetoka kwa mafanikio.',

    'errors.not_found': 'Rasilimali uliyoitaka haikupatikana.',
    'errors.unauthorized': 'Huna ruhusa ya kufanya kitendo hiki.',
    'errors.forbidden': 'Ufikiaji wa rasilimali hii umezuiwa.',
    'errors.validation_failed': 'Uthibitishaji umeshindwa. Tafadhali angalia maingizo yako.',

    'notifications.payment_approved': 'Malipo yako ya {{amount}} yameidhinishwa.',
    'notifications.report_overdue': 'Ripoti "{{report_name}}" imechelewa.',
    'notifications.task_assigned': 'Umepewa kazi mpya: {{task_name}}.',

    'common.save': 'Hifadhi',
    'common.cancel': 'Ghairi',
    'common.delete': 'Futa',
    'common.confirm': 'Thibitisha',
  },

  fr: {
    'auth.login_success': 'Connexion réussie',
    'auth.login_failed': 'Échec de la connexion. Veuillez vérifier vos identifiants.',
    'auth.logout_success': 'Vous avez été déconnecté avec succès.',

    'errors.not_found': 'La ressource demandée est introuvable.',
    'errors.unauthorized': "Vous n'êtes pas autorisé à effectuer cette action.",
    'errors.forbidden': "L'accès à cette ressource est interdit.",
    'errors.validation_failed': 'La validation a échoué. Veuillez vérifier votre saisie.',

    'notifications.payment_approved': 'Votre paiement de {{amount}} a été approuvé.',
    'notifications.report_overdue': 'Le rapport "{{report_name}}" est en retard.',
    'notifications.task_assigned': 'Une nouvelle tâche vous a été assignée : {{task_name}}.',

    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.confirm': 'Confirmer',
  },
};

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'sw', 'fr'];
const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

// ============================================================================
// I18nService
// ============================================================================

export class I18nService {
  /**
   * Translate a key into the given language, interpolating optional params.
   * Falls back to English, then to the key itself if not found.
   */
  t(key: string, language: string, params?: Record<string, any>): string {
    const lang = this.normalizeLanguage(language);
    const dict = translations[lang];
    let text = dict[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;

    if (params) {
      text = this.interpolate(text, params);
    }

    return text;
  }

  /**
   * Detect the best supported language from an Accept-Language header value.
   * Falls back to 'en' when no match is found.
   */
  detectLanguage(acceptLanguageHeader: string): SupportedLanguage {
    if (!acceptLanguageHeader) return DEFAULT_LANGUAGE;

    // Parse "en-US,en;q=0.9,fr;q=0.8" style headers
    const entries = acceptLanguageHeader
      .split(',')
      .map((entry) => {
        const [tag, q] = entry.trim().split(';q=');
        return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q) : 1.0 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { tag } of entries) {
      // Exact match first (e.g. "sw")
      if (SUPPORTED_LANGUAGES.includes(tag as SupportedLanguage)) {
        return tag as SupportedLanguage;
      }
      // Prefix match (e.g. "fr-CA" → "fr")
      const prefix = tag.split('-')[0] as SupportedLanguage;
      if (SUPPORTED_LANGUAGES.includes(prefix)) {
        return prefix;
      }
    }

    return DEFAULT_LANGUAGE;
  }

  /** Returns the list of supported language codes. */
  getSupportedLanguages(): SupportedLanguage[] {
    return [...SUPPORTED_LANGUAGES];
  }

  /** Returns a copy of the full translation dictionary for a language. */
  getTranslations(language: string): Record<string, string> {
    const lang = this.normalizeLanguage(language);
    return { ...translations[lang] };
  }

  /** Persist the user's preferred language to the database. */
  async setUserLanguage(userId: string, language: string): Promise<void> {
    const lang = this.normalizeLanguage(language);
    await db.query(
      `UPDATE users SET preferred_language = $1, updated_at = NOW() WHERE id = $2`,
      [lang, userId]
    );
    logger.info('User language preference updated', { userId, language: lang });
  }

  /** Retrieve the user's preferred language from the database. */
  async getUserLanguage(userId: string): Promise<SupportedLanguage> {
    const result = await db.query<{ preferred_language: string }>(
      `SELECT preferred_language FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      logger.warn('User not found when fetching language preference', { userId });
      return DEFAULT_LANGUAGE;
    }

    const lang = result.rows[0].preferred_language;
    return this.normalizeLanguage(lang);
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private normalizeLanguage(language: string): SupportedLanguage {
    const lower = (language ?? '').toLowerCase().split('-')[0] as SupportedLanguage;
    return SUPPORTED_LANGUAGES.includes(lower) ? lower : DEFAULT_LANGUAGE;
  }

  private interpolate(text: string, params: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      params[key] !== undefined ? String(params[key]) : `{{${key}}}`
    );
  }
}

export const i18nService = new I18nService();
export default i18nService;
