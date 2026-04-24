/**
 * Tests for CurrencyService
 * Requirements: 41.1-41.4
 */

import { CurrencyService, SUPPORTED_CURRENCIES, AFRICAN_COUNTRIES } from './currencyService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('axios');

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

import { db } from '../database/connection';
import axios from 'axios';

const mockDb = db as jest.Mocked<typeof db>;
const mockAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CurrencyService();
  });

  // -------------------------------------------------------------------------
  // getSupportedCurrencies — Requirement 41.1
  // -------------------------------------------------------------------------

  describe('getSupportedCurrencies', () => {
    it('returns exactly 10 supported currencies', () => {
      const currencies = service.getSupportedCurrencies();
      expect(currencies).toHaveLength(10);
    });

    it('includes all required currency codes', () => {
      const codes = service.getSupportedCurrencies().map((c) => c.code);
      expect(codes).toEqual(
        expect.arrayContaining(['USD', 'EUR', 'KES', 'TZS', 'UGX', 'NGN', 'GHS', 'ZAR', 'EGP', 'MAD'])
      );
    });

    it('each currency has code, name, and symbol', () => {
      service.getSupportedCurrencies().forEach((c) => {
        expect(c.code).toBeTruthy();
        expect(c.name).toBeTruthy();
        expect(c.symbol).toBeTruthy();
      });
    });
  });

  // -------------------------------------------------------------------------
  // getAfricanCountries — Requirement 41.2
  // -------------------------------------------------------------------------

  describe('getAfricanCountries', () => {
    it('returns exactly 51 African countries', () => {
      const countries = service.getAfricanCountries();
      expect(countries).toHaveLength(51);
    });

    it('each country has code, name, currency, and region', () => {
      service.getAfricanCountries().forEach((c) => {
        expect(c.code).toBeTruthy();
        expect(c.name).toBeTruthy();
        expect(c.currency).toBeTruthy();
        expect(c.region).toBeTruthy();
      });
    });

    it('covers all five African regions', () => {
      const regions = new Set(service.getAfricanCountries().map((c) => c.region));
      expect(regions).toContain('North Africa');
      expect(regions).toContain('West Africa');
      expect(regions).toContain('East Africa');
      expect(regions).toContain('Central Africa');
      expect(regions).toContain('Southern Africa');
    });

    it('includes key countries', () => {
      const names = service.getAfricanCountries().map((c) => c.name);
      expect(names).toContain('Kenya');
      expect(names).toContain('Nigeria');
      expect(names).toContain('South Africa');
      expect(names).toContain('Egypt');
      expect(names).toContain('Ghana');
    });
  });

  // -------------------------------------------------------------------------
  // getCountryByCurrency — Requirement 41.2
  // -------------------------------------------------------------------------

  describe('getCountryByCurrency', () => {
    it('returns Kenya for KES', () => {
      const countries = service.getCountryByCurrency('KES');
      expect(countries.map((c) => c.name)).toContain('Kenya');
    });

    it('returns Nigeria for NGN', () => {
      const countries = service.getCountryByCurrency('NGN');
      expect(countries.map((c) => c.name)).toContain('Nigeria');
    });

    it('returns multiple countries for XOF (shared West African currency)', () => {
      const countries = service.getCountryByCurrency('XOF');
      expect(countries.length).toBeGreaterThan(1);
    });

    it('is case-insensitive', () => {
      const upper = service.getCountryByCurrency('KES');
      const lower = service.getCountryByCurrency('kes');
      expect(upper).toEqual(lower);
    });

    it('returns empty array for unknown currency', () => {
      const countries = service.getCountryByCurrency('XYZ');
      expect(countries).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getExchangeRate — Requirement 41.3
  // -------------------------------------------------------------------------

  describe('getExchangeRate', () => {
    it('returns 1 when from and to are the same currency', async () => {
      const rate = await service.getExchangeRate('USD', 'USD');
      expect(rate).toBe(1);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns the rate from the database', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ rate: '130.5' }], rowCount: 1 } as any);

      const rate = await service.getExchangeRate('USD', 'KES');
      expect(rate).toBe(130.5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('exchange_rates'),
        ['USD', 'KES']
      );
    });

    it('throws when no rate is found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await expect(service.getExchangeRate('USD', 'KES')).rejects.toThrow(
        'Exchange rate not found for USD → KES'
      );
    });

    it('normalises currency codes to uppercase', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ rate: '130.5' }], rowCount: 1 } as any);

      await service.getExchangeRate('usd', 'kes');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['USD', 'KES']
      );
    });
  });

  // -------------------------------------------------------------------------
  // setExchangeRate — Requirement 41.3
  // -------------------------------------------------------------------------

  describe('setExchangeRate', () => {
    it('inserts or updates the rate in the database', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.setExchangeRate('USD', 'KES', 130.5, 'admin-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO exchange_rates'),
        ['USD', 'KES', 130.5, 'admin-1']
      );
    });

    it('throws when rate is zero or negative', async () => {
      await expect(service.setExchangeRate('USD', 'KES', 0, 'admin')).rejects.toThrow(
        'Exchange rate must be a positive number'
      );
      await expect(service.setExchangeRate('USD', 'KES', -5, 'admin')).rejects.toThrow(
        'Exchange rate must be a positive number'
      );
    });

    it('normalises currency codes to uppercase', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.setExchangeRate('usd', 'kes', 130.5, 'admin');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['USD', 'KES', 130.5, 'admin']
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateExchangeRatesFromAPI — Requirement 41.4
  // -------------------------------------------------------------------------

  describe('updateExchangeRatesFromAPI', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, EXCHANGE_RATE_API_KEY: 'test-key' };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('skips update when API key is not set', async () => {
      delete process.env.EXCHANGE_RATE_API_KEY;

      await service.updateExchangeRatesFromAPI();

      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('fetches rates from the external API and persists them', async () => {
      const conversionRates: Record<string, number> = {
        USD: 1, EUR: 0.92, KES: 130.5, TZS: 2500, UGX: 3700,
        NGN: 1500, GHS: 12.5, ZAR: 18.5, EGP: 30.9, MAD: 10.1,
      };

      (mockAxios.get as jest.Mock).mockResolvedValue({
        data: { conversion_rates: conversionRates },
      });
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await service.updateExchangeRatesFromAPI();

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('test-key'),
        expect.objectContaining({ timeout: 10_000 })
      );
      // Should have called db.query for each rate pair
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('throws and logs when the API call fails', async () => {
      (mockAxios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.updateExchangeRatesFromAPI()).rejects.toThrow('Network error');
    });
  });

  // -------------------------------------------------------------------------
  // Static data integrity
  // -------------------------------------------------------------------------

  describe('static data integrity', () => {
    it('AFRICAN_COUNTRIES has 51 entries', () => {
      expect(AFRICAN_COUNTRIES).toHaveLength(51);
    });

    it('SUPPORTED_CURRENCIES has 10 entries', () => {
      expect(SUPPORTED_CURRENCIES).toHaveLength(10);
    });

    it('all country codes are unique', () => {
      const codes = AFRICAN_COUNTRIES.map((c) => c.code);
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });

    it('all currency codes are unique', () => {
      const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });
  });
});
