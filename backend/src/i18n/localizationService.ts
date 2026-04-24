/**
 * Localization Service — date/number/currency formatting and localized notifications/emails
 * Requirements: 28.6-28.10
 */

import logger from '../utils/logger';
import { i18nService } from './i18nService';

// ============================================================================
// Types
// ============================================================================

export interface NumberFormatOptions {
  style?: 'decimal' | 'percent';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

// ============================================================================
// Locale map
// ============================================================================

const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  sw: 'sw-KE',
  fr: 'fr-FR',
};

// ============================================================================
// Email translation dictionaries
// ============================================================================

const emailTranslations: Record<string, Record<string, { subject: string; body: string }>> = {
  en: {
    'payment.approved': {
      subject: 'Payment Approved',
      body: 'Dear {{name}},\n\nYour payment of {{amount}} has been approved on {{date}}.\n\nThank you.',
    },
    'payment.rejected': {
      subject: 'Payment Rejected',
      body: 'Dear {{name}},\n\nYour payment of {{amount}} has been rejected. Reason: {{reason}}.\n\nPlease contact support.',
    },
    'task.assigned': {
      subject: 'New Task Assigned: {{task_name}}',
      body: 'Dear {{name}},\n\nYou have been assigned a new task: {{task_name}}.\n\nDue date: {{due_date}}.',
    },
    'report.overdue': {
      subject: 'Report Overdue: {{report_name}}',
      body: 'Dear {{name}},\n\nThe report "{{report_name}}" is overdue. Please submit it as soon as possible.',
    },
    'account.welcome': {
      subject: 'Welcome to TechSwiftTrix ERP',
      body: 'Dear {{name}},\n\nWelcome to TechSwiftTrix ERP. Your account has been created successfully.\n\nUsername: {{username}}',
    },
  },
  sw: {
    'payment.approved': {
      subject: 'Malipo Yameidhinishwa',
      body: 'Mpendwa {{name}},\n\nMalipo yako ya {{amount}} yameidhinishwa tarehe {{date}}.\n\nAsante.',
    },
    'payment.rejected': {
      subject: 'Malipo Yamekataliwa',
      body: 'Mpendwa {{name}},\n\nMalipo yako ya {{amount}} yamekataliwa. Sababu: {{reason}}.\n\nTafadhali wasiliana na msaada.',
    },
    'task.assigned': {
      subject: 'Kazi Mpya Imepewa: {{task_name}}',
      body: 'Mpendwa {{name}},\n\nUmepewa kazi mpya: {{task_name}}.\n\nTarehe ya mwisho: {{due_date}}.',
    },
    'report.overdue': {
      subject: 'Ripoti Imechelewa: {{report_name}}',
      body: 'Mpendwa {{name}},\n\nRipoti "{{report_name}}" imechelewa. Tafadhali iwasilishe haraka iwezekanavyo.',
    },
    'account.welcome': {
      subject: 'Karibu TechSwiftTrix ERP',
      body: 'Mpendwa {{name}},\n\nKaribu TechSwiftTrix ERP. Akaunti yako imeundwa kwa mafanikio.\n\nJina la mtumiaji: {{username}}',
    },
  },
  fr: {
    'payment.approved': {
      subject: 'Paiement Approuvé',
      body: 'Cher(e) {{name}},\n\nVotre paiement de {{amount}} a été approuvé le {{date}}.\n\nMerci.',
    },
    'payment.rejected': {
      subject: 'Paiement Rejeté',
      body: 'Cher(e) {{name}},\n\nVotre paiement de {{amount}} a été rejeté. Raison : {{reason}}.\n\nVeuillez contacter le support.',
    },
    'task.assigned': {
      subject: 'Nouvelle Tâche Assignée : {{task_name}}',
      body: 'Cher(e) {{name}},\n\nUne nouvelle tâche vous a été assignée : {{task_name}}.\n\nDate limite : {{due_date}}.',
    },
    'report.overdue': {
      subject: 'Rapport en Retard : {{report_name}}',
      body: 'Cher(e) {{name}},\n\nLe rapport "{{report_name}}" est en retard. Veuillez le soumettre dès que possible.',
    },
    'account.welcome': {
      subject: 'Bienvenue sur TechSwiftTrix ERP',
      body: "Cher(e) {{name}},\n\nBienvenue sur TechSwiftTrix ERP. Votre compte a été créé avec succès.\n\nNom d'utilisateur : {{username}}",
    },
  },
};

// ============================================================================
// LocalizationService
// ============================================================================

export class LocalizationService {
  /**
   * Returns the BCP-47 locale string for a given language code.
   * e.g. 'en' → 'en-US', 'sw' → 'sw-KE', 'fr' → 'fr-FR'
   */
  getLocaleForLanguage(language: string): string {
    const lang = language.toLowerCase().split('-')[0];
    const locale = LANGUAGE_LOCALE_MAP[lang];
    if (!locale) {
      logger.warn('Unknown language, falling back to en-US', { language });
      return 'en-US';
    }
    return locale;
  }

  /**
   * Format a date according to the given language and format style.
   * Uses Intl.DateTimeFormat (built-in Node.js).
   */
  formatDate(date: Date, language: string, format: 'short' | 'long' | 'relative' = 'short'): string {
    const locale = this.getLocaleForLanguage(language);

    if (format === 'relative') {
      return this.formatRelativeDate(date, locale);
    }

    const options: Intl.DateTimeFormatOptions =
      format === 'long'
        ? { year: 'numeric', month: 'long', day: 'numeric' }
        : { year: 'numeric', month: '2-digit', day: '2-digit' };

    try {
      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (err) {
      logger.error('Date formatting failed', { language, format, err });
      return date.toISOString().split('T')[0];
    }
  }

  /**
   * Format a number according to the given language and options.
   * Uses Intl.NumberFormat (built-in Node.js).
   */
  formatNumber(value: number, language: string, options?: NumberFormatOptions): string {
    const locale = this.getLocaleForLanguage(language);

    const intlOptions: Intl.NumberFormatOptions = {
      style: options?.style ?? 'decimal',
      minimumFractionDigits: options?.minimumFractionDigits,
      maximumFractionDigits: options?.maximumFractionDigits,
    };

    try {
      return new Intl.NumberFormat(locale, intlOptions).format(value);
    } catch (err) {
      logger.error('Number formatting failed', { language, value, err });
      return String(value);
    }
  }

  /**
   * Format a monetary amount with currency symbol according to the given language.
   * Uses Intl.NumberFormat with style 'currency' (built-in Node.js).
   */
  formatCurrency(amount: number, currency: string, language: string): string {
    const locale = this.getLocaleForLanguage(language);

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (err) {
      logger.error('Currency formatting failed', { language, currency, amount, err });
      return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Translate a notification message to the recipient's language.
   * Delegates to i18nService for key lookup and interpolation.
   */
  translateNotification(type: string, params: Record<string, any>, language: string): string {
    const key = `notifications.${type}`;
    const translated = i18nService.t(key, language, params);
    logger.debug('Notification translated', { type, language });
    return translated;
  }

  /**
   * Translate an email template (subject + body) to the recipient's language.
   * Falls back to English when the template key is not found in the target language.
   */
  translateEmail(
    templateKey: string,
    params: Record<string, any>,
    language: string,
  ): { subject: string; body: string } {
    const lang = language.toLowerCase().split('-')[0];
    const langDict = emailTranslations[lang] ?? emailTranslations['en'];
    const template = langDict?.[templateKey] ?? emailTranslations['en']?.[templateKey];

    if (!template) {
      logger.warn('Email template key not found, returning empty template', { templateKey, language });
      return { subject: templateKey, body: '' };
    }

    const subject = this.interpolate(template.subject, params);
    const body = this.interpolate(template.body, params);

    logger.debug('Email translated', { templateKey, language });
    return { subject, body };
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private interpolate(text: string, params: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      params[key] !== undefined ? String(params[key]) : `{{${key}}}`,
    );
  }

  private formatRelativeDate(date: Date, locale: string): string {
    const now = Date.now();
    const diffMs = date.getTime() - now;
    const diffSeconds = Math.round(diffMs / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

      if (Math.abs(diffSeconds) < 60) return rtf.format(diffSeconds, 'second');
      if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
      if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
      return rtf.format(diffDays, 'day');
    } catch {
      // Fallback for environments without Intl.RelativeTimeFormat
      if (diffDays === 0) return 'today';
      if (diffDays === 1) return 'tomorrow';
      if (diffDays === -1) return 'yesterday';
      return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
    }
  }
}

export const localizationService = new LocalizationService();
export default localizationService;
