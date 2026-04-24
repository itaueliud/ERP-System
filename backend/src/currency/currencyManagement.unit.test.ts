/**
 * Unit tests for Currency Management
 * Task: 31.4
 * Requirements: 41.1-41.10
 *
 * Covers:
 *  1. Exchange rate updates  — fetch from external API, store in DB, daily schedule (41.3, 41.4)
 *  2. Currency conversion    — convert amounts between currencies using stored rates (41.6, 41.7, 41.9)
 *  3. Currency formatting    — format amounts with currency symbols per locale (41.5)
 *  4. Exchange rate tracking — track which rate was used for each transaction (41.9)
 *  5. Base currency          — all amounts stored in USD, converted for display (41.6, 41.7, 41.8)
 */

import { CurrencyService } from './currencyService';
import { CurrencyConversionService } from './currencyConversionService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../database/connection', () => ({
  db: { query: jest.fn() },
}));

jest.mock('axios');

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('./currencyService', () => {
  const actual = jest.requireActual('./currencyService');
  return {
    ...actual,
    currencyService: { getExchangeRate: jest.fn() },
  };
});

jest.mock('../i18n/localizationService', () => ({
  localizationService: { formatCurrency: jest.fn() },
}));

import { db } from '../database/connection';
import axios from 'axios';
import { currencyService as mockCurrencyServiceSingleton } from './currencyService';
import { localizationService } from '../i18n/localizationService';

const mockDb = db as jest.Mocked<typeof db>;
const mockAxios = axios as jest.Mocked<typeof axios>;
const mockGetExchangeRate = mockCurrencyServiceSingleton.getExchangeRate as jest.Mock;
const mockFormatCurrency = localizationService.formatCurrency as jest.Mock;

// ─── 1. Exchange Rate Updates ─────────────────────────────────────────────────
// Requirements: 41.3, 41.4

describe('Exchange Rate Updates (Req 41.3, 41.4)', () => {
  let service: CurrencyService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CurrencyService();
    process.env = { ...originalEnv, EXCHANGE_RATE_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── setExchangeRate (Req 41.3) ──────────────────────────────────────────────

  it('stores a new exchange rate in the database (Req 41.3)', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    await service.setExchangeRate('USD', 'KES', 130.5, 'admin-1');

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO exchange_rates'),
      ['USD', 'KES', 130.5, 'admin-1'],
    );
  });

  it('upserts an existing exchange rate (ON CONFLICT update) (Req 41.3)', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    await service.setExchangeRate('USD', 'NGN', 1500, 'admin-1');
    await service.setExchangeRate('USD', 'NGN', 1550, 'admin-1');

    expect(mockDb.query).toHaveBeenCalledTimes(2);
    const [sql] = mockDb.query.mock.calls[1];
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE SET');
  });

  it('normalises currency codes to uppercase before storing (Req 41.3)', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    await service.setExchangeRate('usd', 'kes', 130.5, 'admin');

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.any(String),
      ['USD', 'KES', 130.5, 'admin'],
    );
  });

  it('rejects a zero exchange rate (Req 41.3)', async () => {
    await expect(service.setExchangeRate('USD', 'KES', 0, 'admin')).rejects.toThrow(
      'Exchange rate must be a positive number',
    );
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('rejects a negative exchange rate (Req 41.3)', async () => {
    await expect(service.setExchangeRate('USD', 'KES', -10, 'admin')).rejects.toThrow(
      'Exchange rate must be a positive number',
    );
  });

  // ── updateExchangeRatesFromAPI (Req 41.4) ───────────────────────────────────

  it('fetches rates from external API and persists them (Req 41.4)', async () => {
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
      expect.stringContaining('test-api-key'),
      expect.objectContaining({ timeout: 10_000 }),
    );
    expect(mockDb.query).toHaveBeenCalled();
  });

  it('stores USD→X rates for all supported currencies (Req 41.4)', async () => {
    const conversionRates: Record<string, number> = {
      USD: 1, EUR: 0.92, KES: 130.5, TZS: 2500, UGX: 3700,
      NGN: 1500, GHS: 12.5, ZAR: 18.5, EGP: 30.9, MAD: 10.1,
    };

    (mockAxios.get as jest.Mock).mockResolvedValue({
      data: { conversion_rates: conversionRates },
    });
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    await service.updateExchangeRatesFromAPI();

    // Should have stored at least one USD→KES rate
    const calls = mockDb.query.mock.calls;
    const kesParams = calls
      .map(([, p]) => p as unknown[])
      .find((p) => Array.isArray(p) && p[0] === 'USD' && p[1] === 'KES');
    expect(kesParams).toBeDefined();
    expect(kesParams?.[2]).toBe(130.5);
  });

  it('derives cross-rates between non-USD pairs (Req 41.4)', async () => {
    const conversionRates: Record<string, number> = {
      USD: 1, EUR: 0.92, KES: 130.5, TZS: 2500, UGX: 3700,
      NGN: 1500, GHS: 12.5, ZAR: 18.5, EGP: 30.9, MAD: 10.1,
    };

    (mockAxios.get as jest.Mock).mockResolvedValue({
      data: { conversion_rates: conversionRates },
    });
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    await service.updateExchangeRatesFromAPI();

    // EUR→KES cross-rate should be stored (KES/EUR = 130.5/0.92)
    const calls = mockDb.query.mock.calls;
    const eurKesParams = calls
      .map(([, p]) => p as unknown[])
      .find((p) => Array.isArray(p) && p[0] === 'EUR' && p[1] === 'KES');
    expect(eurKesParams).toBeDefined();
    const expectedCrossRate = 130.5 / 0.92;
    if (eurKesParams) {
      expect(eurKesParams[2]).toBeCloseTo(expectedCrossRate, 4);
    }
  });

  it('skips update when API key is not configured (Req 41.4)', async () => {
    delete process.env.EXCHANGE_RATE_API_KEY;

    await service.updateExchangeRatesFromAPI();

    expect(mockAxios.get).not.toHaveBeenCalled();
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('throws and propagates error when API call fails (Req 41.4)', async () => {
    (mockAxios.get as jest.Mock).mockRejectedValue(new Error('Network timeout'));

    await expect(service.updateExchangeRatesFromAPI()).rejects.toThrow('Network timeout');
  });

  it('marks system as updater when fetching from API (Req 41.4)', async () => {
    const conversionRates = { USD: 1, EUR: 0.92, KES: 130.5, TZS: 2500, UGX: 3700,
      NGN: 1500, GHS: 12.5, ZAR: 18.5, EGP: 30.9, MAD: 10.1 };

    (mockAxios.get as jest.Mock).mockResolvedValue({ data: { conversion_rates: conversionRates } });
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    await service.updateExchangeRatesFromAPI();

    const calls = mockDb.query.mock.calls;
    const systemParams = calls
      .map(([, p]) => p as unknown[])
      .find((p) => Array.isArray(p) && p[3] === 'system:api');
    expect(systemParams).toBeDefined();
  });
});

// ─── 2. Currency Conversion ───────────────────────────────────────────────────
// Requirements: 41.6, 41.7, 41.9

describe('Currency Conversion (Req 41.6, 41.7, 41.9)', () => {
  let service: CurrencyConversionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CurrencyConversionService();
  });

  it('converts amount between two currencies using stored exchange rate (Req 41.7)', async () => {
    mockGetExchangeRate.mockResolvedValue(130.5);

    const result = await service.convertAmount(100, 'USD', 'KES');

    expect(result.originalAmount).toBe(100);
    expect(result.originalCurrency).toBe('USD');
    expect(result.convertedAmount).toBeCloseTo(13050);
    expect(result.convertedCurrency).toBe('KES');
    expect(result.exchangeRate).toBe(130.5);
  });

  it('records the timestamp of conversion (Req 41.9)', async () => {
    mockGetExchangeRate.mockResolvedValue(130.5);

    const before = new Date();
    const result = await service.convertAmount(100, 'USD', 'KES');
    const after = new Date();

    expect(result.convertedAt).toBeInstanceOf(Date);
    expect(result.convertedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.convertedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('stores the exact exchange rate used in the result (Req 41.9)', async () => {
    const rate = 1547.83;
    mockGetExchangeRate.mockResolvedValue(rate);

    const result = await service.convertAmount(50, 'USD', 'NGN');

    expect(result.exchangeRate).toBe(rate);
  });

  it('converts amount to USD base currency (Req 41.6)', async () => {
    mockGetExchangeRate.mockResolvedValue(1 / 130.5);

    const result = await service.convertToUSD(13050, 'KES');

    expect(result.convertedCurrency).toBe('USD');
    expect(result.originalCurrency).toBe('KES');
    expect(mockGetExchangeRate).toHaveBeenCalledWith('KES', 'USD');
  });

  it('converts from USD base currency to display currency (Req 41.7)', async () => {
    mockGetExchangeRate.mockResolvedValue(1500);

    const result = await service.convertFromUSD(10, 'NGN');

    expect(result.originalCurrency).toBe('USD');
    expect(result.convertedCurrency).toBe('NGN');
    expect(result.convertedAmount).toBeCloseTo(15000);
    expect(mockGetExchangeRate).toHaveBeenCalledWith('USD', 'NGN');
  });

  it('returns rate of 1 and same amount for same-currency conversion (Req 41.7)', async () => {
    mockGetExchangeRate.mockResolvedValue(1);

    const result = await service.convertAmount(200, 'USD', 'USD');

    expect(result.convertedAmount).toBe(200);
    expect(result.exchangeRate).toBe(1);
  });

  it('normalises currency codes to uppercase (Req 41.7)', async () => {
    mockGetExchangeRate.mockResolvedValue(130.5);

    const result = await service.convertAmount(50, 'usd', 'kes');

    expect(result.originalCurrency).toBe('USD');
    expect(result.convertedCurrency).toBe('KES');
    expect(mockGetExchangeRate).toHaveBeenCalledWith('USD', 'KES');
  });

  it('propagates error when exchange rate is not found (Req 41.7)', async () => {
    mockGetExchangeRate.mockRejectedValue(new Error('Exchange rate not found for USD → XYZ'));

    await expect(service.convertAmount(100, 'USD', 'XYZ')).rejects.toThrow(
      'Exchange rate not found for USD → XYZ',
    );
  });

  it('handles small fractional amounts correctly (Req 41.7)', async () => {
    mockGetExchangeRate.mockResolvedValue(0.92);

    const result = await service.convertAmount(0.01, 'USD', 'EUR');

    expect(result.convertedAmount).toBeCloseTo(0.0092, 6);
  });

  it('handles large amounts correctly (Req 41.7)', async () => {
    mockGetExchangeRate.mockResolvedValue(18.5);

    const result = await service.convertAmount(1_000_000, 'USD', 'ZAR');

    expect(result.convertedAmount).toBeCloseTo(18_500_000);
  });
});

// ─── 3. Currency Formatting ───────────────────────────────────────────────────
// Requirements: 41.5

describe('Currency Formatting (Req 41.5)', () => {
  let service: CurrencyConversionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CurrencyConversionService();
  });

  it('formats amount with currency symbol for English locale (Req 41.5)', () => {
    mockFormatCurrency.mockReturnValue('$100.00');

    const result = service.formatConvertedAmount(100, 'USD', 'en');

    expect(result).toBe('$100.00');
    expect(mockFormatCurrency).toHaveBeenCalledWith(100, 'USD', 'en');
  });

  it('formats KES amount with Swahili locale (Req 41.5)', () => {
    mockFormatCurrency.mockReturnValue('KSh 13,050.00');

    const result = service.formatConvertedAmount(13050, 'KES', 'sw');

    expect(result).toBe('KSh 13,050.00');
    expect(mockFormatCurrency).toHaveBeenCalledWith(13050, 'KES', 'sw');
  });

  it('formats NGN amount with Nigerian locale (Req 41.5)', () => {
    mockFormatCurrency.mockReturnValue('₦1,500.00');

    const result = service.formatConvertedAmount(1500, 'NGN', 'en-NG');

    expect(result).toBe('₦1,500.00');
    expect(mockFormatCurrency).toHaveBeenCalledWith(1500, 'NGN', 'en-NG');
  });

  it('formats ZAR amount with South African locale (Req 41.5)', () => {
    mockFormatCurrency.mockReturnValue('R 18.50');

    const result = service.formatConvertedAmount(18.5, 'ZAR', 'en-ZA');

    expect(result).toBe('R 18.50');
  });

  it('formats EUR amount with French locale (Req 41.5)', () => {
    mockFormatCurrency.mockReturnValue('92,00 €');

    const result = service.formatConvertedAmount(92, 'EUR', 'fr');

    expect(result).toBe('92,00 €');
  });

  it('delegates formatting to localizationService (Req 41.5)', () => {
    mockFormatCurrency.mockReturnValue('MAD 10.10');

    service.formatConvertedAmount(10.1, 'MAD', 'ar-MA');

    expect(mockFormatCurrency).toHaveBeenCalledTimes(1);
    expect(mockFormatCurrency).toHaveBeenCalledWith(10.1, 'MAD', 'ar-MA');
  });
});

// ─── 4. Exchange Rate Tracking ────────────────────────────────────────────────
// Requirements: 41.9

describe('Exchange Rate Tracking (Req 41.9)', () => {
  let service: CurrencyConversionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CurrencyConversionService();
  });

  it('records the exchange rate used in each conversion result (Req 41.9)', async () => {
    const rate = 130.5;
    mockGetExchangeRate.mockResolvedValue(rate);

    const result = await service.convertAmount(100, 'USD', 'KES');

    expect(result.exchangeRate).toBe(rate);
  });

  it('records different rates for different currency pairs (Req 41.9)', async () => {
    mockGetExchangeRate
      .mockResolvedValueOnce(130.5)   // USD→KES
      .mockResolvedValueOnce(1500);   // USD→NGN

    const kesResult = await service.convertAmount(100, 'USD', 'KES');
    const ngnResult = await service.convertAmount(100, 'USD', 'NGN');

    expect(kesResult.exchangeRate).toBe(130.5);
    expect(ngnResult.exchangeRate).toBe(1500);
  });

  it('includes rate in conversion display for transaction details (Req 41.9)', async () => {
    mockGetExchangeRate.mockResolvedValue(130.5);
    mockFormatCurrency
      .mockReturnValueOnce('$100.00')
      .mockReturnValueOnce('KSh 13,050.00');

    const display = await service.getConversionDisplay(100, 'USD', 'KES', 'en');

    expect(display.exchangeRate).toBe(130.5);
    expect(display.rateLabel).toBe('1 USD = 130.5000 KES');
  });

  it('rate label shows 4 decimal places for precision (Req 41.9)', async () => {
    mockGetExchangeRate.mockResolvedValue(0.9200);
    mockFormatCurrency.mockReturnValue('');

    const display = await service.getConversionDisplay(100, 'USD', 'EUR', 'en');

    expect(display.rateLabel).toBe('1 USD = 0.9200 EUR');
  });

  it('getExchangeRate retrieves stored rate from database (Req 41.9)', async () => {
    const currencyServiceInstance = new CurrencyService();
    mockDb.query.mockResolvedValue({ rows: [{ rate: '130.5' }], rowCount: 1 } as any);

    const rate = await currencyServiceInstance.getExchangeRate('USD', 'KES');

    expect(rate).toBe(130.5);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('exchange_rates'),
      ['USD', 'KES'],
    );
  });

  it('throws when no stored rate exists for a currency pair (Req 41.9)', async () => {
    const currencyServiceInstance = new CurrencyService();
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

    await expect(currencyServiceInstance.getExchangeRate('USD', 'XYZ')).rejects.toThrow(
      'Exchange rate not found for USD → XYZ',
    );
  });
});

// ─── 5. Base Currency (USD) Storage and Display Conversion ───────────────────
// Requirements: 41.6, 41.7, 41.8

describe('Base Currency — USD Storage and Display Conversion (Req 41.6, 41.7, 41.8)', () => {
  let service: CurrencyConversionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CurrencyConversionService();
  });

  it('converts any currency to USD base for storage (Req 41.6)', async () => {
    mockGetExchangeRate.mockResolvedValue(1 / 130.5);

    const result = await service.convertToUSD(13050, 'KES');

    expect(result.convertedCurrency).toBe('USD');
    expect(result.convertedAmount).toBeCloseTo(100, 1);
  });

  it('converts USD base to user preferred currency for display (Req 41.7)', async () => {
    mockGetExchangeRate.mockResolvedValue(18.5);

    const result = await service.convertFromUSD(100, 'ZAR');

    expect(result.originalCurrency).toBe('USD');
    expect(result.convertedCurrency).toBe('ZAR');
    expect(result.convertedAmount).toBeCloseTo(1850);
  });

  it('displays both original and converted amounts in transaction details (Req 41.8)', async () => {
    mockGetExchangeRate.mockResolvedValue(130.5);
    mockFormatCurrency
      .mockReturnValueOnce('$100.00')
      .mockReturnValueOnce('KSh 13,050.00');

    const display = await service.getConversionDisplay(100, 'USD', 'KES', 'en');

    expect(display.original).toBe('$100.00');
    expect(display.converted).toBe('KSh 13,050.00');
  });

  it('shows same-currency display when original equals display currency (Req 41.8)', async () => {
    mockGetExchangeRate.mockResolvedValue(1);
    mockFormatCurrency.mockReturnValue('$200.00');

    const display = await service.getConversionDisplay(200, 'USD', 'USD', 'en');

    expect(display.original).toBe('$200.00');
    expect(display.converted).toBe('$200.00');
    expect(display.exchangeRate).toBe(1);
  });

  it('USD to USD conversion returns same amount (Req 41.6)', async () => {
    mockGetExchangeRate.mockResolvedValue(1);

    const result = await service.convertToUSD(500, 'USD');

    expect(result.convertedAmount).toBe(500);
    expect(result.convertedCurrency).toBe('USD');
  });

  it('normalises currency codes in conversion display (Req 41.8)', async () => {
    mockGetExchangeRate.mockResolvedValue(0.92);
    mockFormatCurrency.mockReturnValueOnce('$50.00').mockReturnValueOnce('€46.00');

    const display = await service.getConversionDisplay(50, 'usd', 'eur', 'en');

    expect(display.rateLabel).toBe('1 USD = 0.9200 EUR');
  });
});
