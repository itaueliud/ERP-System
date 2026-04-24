/**
 * CurrencyConversionService — convert, format, and display amounts across currencies
 * Requirements: 41.5-41.10
 */

import logger from '../utils/logger';
import { currencyService } from './currencyService';
import { localizationService } from '../i18n/localizationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  exchangeRate: number;
  convertedAt: Date;
}

export interface ConversionDisplay {
  original: string;
  converted: string;
  exchangeRate: number;
  rateLabel: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CurrencyConversionService {
  /**
   * Convert an amount from one currency to another (41.7, 41.9)
   */
  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<ConversionResult> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    const exchangeRate = await currencyService.getExchangeRate(from, to);
    const convertedAmount = amount * exchangeRate;

    logger.debug('Currency converted', { amount, from, to, exchangeRate, convertedAmount });

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount,
      convertedCurrency: to,
      exchangeRate,
      convertedAt: new Date(),
    };
  }

  /**
   * Convert an amount from any currency to USD base currency (41.6)
   */
  async convertToUSD(amount: number, fromCurrency: string): Promise<ConversionResult> {
    return this.convertAmount(amount, fromCurrency, 'USD');
  }

  /**
   * Convert a USD base amount to a target display currency (41.7)
   */
  async convertFromUSD(amountUSD: number, toCurrency: string): Promise<ConversionResult> {
    return this.convertAmount(amountUSD, 'USD', toCurrency);
  }

  /**
   * Format a monetary amount with locale-aware currency formatting (41.5)
   */
  formatConvertedAmount(amount: number, currency: string, language: string): string {
    return localizationService.formatCurrency(amount, currency, language);
  }

  /**
   * Build a ConversionDisplay showing both original and converted amounts (41.8)
   */
  async getConversionDisplay(
    originalAmount: number,
    originalCurrency: string,
    displayCurrency: string,
    language: string,
  ): Promise<ConversionDisplay> {
    const from = originalCurrency.toUpperCase();
    const to = displayCurrency.toUpperCase();

    const result = await this.convertAmount(originalAmount, from, to);

    const original = this.formatConvertedAmount(originalAmount, from, language);
    const converted = this.formatConvertedAmount(result.convertedAmount, to, language);
    const rateLabel = `1 ${from} = ${result.exchangeRate.toFixed(4)} ${to}`;

    logger.debug('Conversion display built', { from, to, exchangeRate: result.exchangeRate });

    return {
      original,
      converted,
      exchangeRate: result.exchangeRate,
      rateLabel,
    };
  }
}

export const currencyConversionService = new CurrencyConversionService();
export default currencyConversionService;
