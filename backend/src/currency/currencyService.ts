/**
 * CurrencyService — country and currency support for African markets
 * Requirements: 41.1-41.4
 */

import axios from 'axios';
import { db } from '../database/connection';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  region: string;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar',          symbol: '$'  },
  { code: 'EUR', name: 'Euro',               symbol: '€'  },
  { code: 'KES', name: 'Kenyan Shilling',    symbol: 'KSh' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'UGX', name: 'Ugandan Shilling',   symbol: 'USh' },
  { code: 'NGN', name: 'Nigerian Naira',     symbol: '₦'  },
  { code: 'GHS', name: 'Ghanaian Cedi',      symbol: '₵'  },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R'  },
  { code: 'EGP', name: 'Egyptian Pound',     symbol: 'E£' },
  { code: 'MAD', name: 'Moroccan Dirham',    symbol: 'MAD' },
];

export const AFRICAN_COUNTRIES: Country[] = [
  // North Africa
  { code: 'DZ', name: 'Algeria',                  currency: 'DZD', region: 'North Africa'    },
  { code: 'EG', name: 'Egypt',                    currency: 'EGP', region: 'North Africa'    },
  { code: 'LY', name: 'Libya',                    currency: 'LYD', region: 'North Africa'    },
  { code: 'MA', name: 'Morocco',                  currency: 'MAD', region: 'North Africa'    },
  { code: 'SD', name: 'Sudan',                    currency: 'SDG', region: 'North Africa'    },
  { code: 'TN', name: 'Tunisia',                  currency: 'TND', region: 'North Africa'    },
  // West Africa
  { code: 'BJ', name: 'Benin',                    currency: 'XOF', region: 'West Africa'     },
  { code: 'BF', name: 'Burkina Faso',             currency: 'XOF', region: 'West Africa'     },
  { code: 'CI', name: "Côte d'Ivoire",            currency: 'XOF', region: 'West Africa'     },
  { code: 'GM', name: 'Gambia',                   currency: 'GMD', region: 'West Africa'     },
  { code: 'GH', name: 'Ghana',                    currency: 'GHS', region: 'West Africa'     },
  { code: 'GN', name: 'Guinea',                   currency: 'GNF', region: 'West Africa'     },
  { code: 'GW', name: 'Guinea-Bissau',            currency: 'XOF', region: 'West Africa'     },
  { code: 'LR', name: 'Liberia',                  currency: 'LRD', region: 'West Africa'     },
  { code: 'ML', name: 'Mali',                     currency: 'XOF', region: 'West Africa'     },
  { code: 'MR', name: 'Mauritania',               currency: 'MRU', region: 'West Africa'     },
  { code: 'NE', name: 'Niger',                    currency: 'XOF', region: 'West Africa'     },
  { code: 'NG', name: 'Nigeria',                  currency: 'NGN', region: 'West Africa'     },
  { code: 'SN', name: 'Senegal',                  currency: 'XOF', region: 'West Africa'     },
  { code: 'SL', name: 'Sierra Leone',             currency: 'SLL', region: 'West Africa'     },
  { code: 'TG', name: 'Togo',                     currency: 'XOF', region: 'West Africa'     },
  // East Africa
  { code: 'BI', name: 'Burundi',                  currency: 'BIF', region: 'East Africa'     },
  { code: 'DJ', name: 'Djibouti',                 currency: 'DJF', region: 'East Africa'     },
  { code: 'ER', name: 'Eritrea',                  currency: 'ERN', region: 'East Africa'     },
  { code: 'ET', name: 'Ethiopia',                 currency: 'ETB', region: 'East Africa'     },
  { code: 'KE', name: 'Kenya',                    currency: 'KES', region: 'East Africa'     },
  { code: 'MG', name: 'Madagascar',               currency: 'MGA', region: 'East Africa'     },
  { code: 'MW', name: 'Malawi',                   currency: 'MWK', region: 'East Africa'     },
  { code: 'MU', name: 'Mauritius',                currency: 'MUR', region: 'East Africa'     },
  { code: 'MZ', name: 'Mozambique',               currency: 'MZN', region: 'East Africa'     },
  { code: 'RW', name: 'Rwanda',                   currency: 'RWF', region: 'East Africa'     },
  { code: 'SC', name: 'Seychelles',               currency: 'SCR', region: 'East Africa'     },
  { code: 'SO', name: 'Somalia',                  currency: 'SOS', region: 'East Africa'     },
  { code: 'SS', name: 'South Sudan',              currency: 'SSP', region: 'East Africa'     },
  { code: 'TZ', name: 'Tanzania',                 currency: 'TZS', region: 'East Africa'     },
  { code: 'UG', name: 'Uganda',                   currency: 'UGX', region: 'East Africa'     },
  { code: 'ZM', name: 'Zambia',                   currency: 'ZMW', region: 'East Africa'     },
  { code: 'ZW', name: 'Zimbabwe',                 currency: 'ZWL', region: 'East Africa'     },
  // Central Africa
  { code: 'AO', name: 'Angola',                   currency: 'AOA', region: 'Central Africa'  },
  { code: 'CM', name: 'Cameroon',                 currency: 'XAF', region: 'Central Africa'  },
  { code: 'CF', name: 'Central African Republic', currency: 'XAF', region: 'Central Africa'  },
  { code: 'TD', name: 'Chad',                     currency: 'XAF', region: 'Central Africa'  },
  { code: 'CG', name: 'Republic of the Congo',    currency: 'XAF', region: 'Central Africa'  },
  { code: 'CD', name: 'DR Congo',                 currency: 'CDF', region: 'Central Africa'  },
  { code: 'GQ', name: 'Equatorial Guinea',        currency: 'XAF', region: 'Central Africa'  },
  { code: 'GA', name: 'Gabon',                    currency: 'XAF', region: 'Central Africa'  },
  // Southern Africa
  { code: 'BW', name: 'Botswana',                 currency: 'BWP', region: 'Southern Africa' },
  { code: 'LS', name: 'Lesotho',                  currency: 'LSL', region: 'Southern Africa' },
  { code: 'NA', name: 'Namibia',                  currency: 'NAD', region: 'Southern Africa' },
  { code: 'ZA', name: 'South Africa',             currency: 'ZAR', region: 'Southern Africa' },
  { code: 'SZ', name: 'Eswatini',                 currency: 'SZL', region: 'Southern Africa' },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CurrencyService {
  /**
   * Returns the list of supported currencies (41.1)
   */
  getSupportedCurrencies(): Currency[] {
    return SUPPORTED_CURRENCIES;
  }

  /**
   * Returns all 51 African countries with their currencies (41.2)
   */
  getAfricanCountries(): Country[] {
    return AFRICAN_COUNTRIES;
  }

  /**
   * Returns countries that use the given currency code (41.2)
   */
  getCountryByCurrency(currency: string): Country[] {
    return AFRICAN_COUNTRIES.filter(
      (c) => c.currency.toUpperCase() === currency.toUpperCase()
    );
  }

  /**
   * Retrieves an exchange rate from the database (41.3)
   */
  async getExchangeRate(from: string, to: string): Promise<number> {
    if (from.toUpperCase() === to.toUpperCase()) return 1;

    const result = await db.query<{ rate: string }>(
      `SELECT rate FROM exchange_rates
       WHERE from_currency = $1 AND to_currency = $2`,
      [from.toUpperCase(), to.toUpperCase()]
    );

    if (result.rows.length === 0) {
      throw new Error(`Exchange rate not found for ${from} → ${to}`);
    }

    return parseFloat(result.rows[0].rate);
  }

  /**
   * Allows administrators to set / update an exchange rate (41.3)
   */
  async setExchangeRate(
    from: string,
    to: string,
    rate: number,
    updatedBy: string
  ): Promise<void> {
    if (rate <= 0) throw new Error('Exchange rate must be a positive number');

    await db.query(
      `INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (from_currency, to_currency)
       DO UPDATE SET rate = EXCLUDED.rate,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()`,
      [from.toUpperCase(), to.toUpperCase(), rate, updatedBy]
    );

    logger.info('Exchange rate updated', { from, to, rate, updatedBy });
  }

  /**
   * Fetches latest exchange rates from an external API and persists them (41.4)
   * Uses exchangerate-api.com free tier (base USD).
   */
  async updateExchangeRatesFromAPI(): Promise<void> {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const baseUrl = process.env.EXCHANGE_RATE_API_URL ?? 'https://v6.exchangerate-api.com/v6';

    if (!apiKey) {
      logger.warn('EXCHANGE_RATE_API_KEY not set — skipping automatic rate update');
      return;
    }

    const supportedCodes = SUPPORTED_CURRENCIES.map((c) => c.code);

    try {
      const url = `${baseUrl}/${apiKey}/latest/USD`;
      const response = await axios.get<{ conversion_rates: Record<string, number> }>(url, {
        timeout: 10_000,
      });

      const rates = response.data.conversion_rates;
      const updatedBy = 'system:api';

      for (const toCurrency of supportedCodes) {
        if (toCurrency === 'USD') continue;
        const rate = rates[toCurrency];
        if (rate == null) {
          logger.warn('Rate not found in API response', { toCurrency });
          continue;
        }
        await this.setExchangeRate('USD', toCurrency, rate, updatedBy);
      }

      // Derive cross-rates between non-USD pairs using USD as pivot
      for (const fromCurrency of supportedCodes) {
        if (fromCurrency === 'USD') continue;
        const fromRate = rates[fromCurrency];
        if (fromRate == null) continue;

        for (const toCurrency of supportedCodes) {
          if (toCurrency === fromCurrency) continue;
          const toRate = rates[toCurrency];
          if (toRate == null) continue;
          const crossRate = toRate / fromRate;
          await this.setExchangeRate(fromCurrency, toCurrency, crossRate, updatedBy);
        }
      }

      logger.info('Exchange rates updated from API', { currencies: supportedCodes.length });
    } catch (error) {
      logger.error('Failed to update exchange rates from API', { error });
      throw error;
    }
  }
}

export const currencyService = new CurrencyService();
export default currencyService;
