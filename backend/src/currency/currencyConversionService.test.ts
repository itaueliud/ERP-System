/**
 * Tests for CurrencyConversionService
 * Requirements: 41.5-41.10
 */

import { CurrencyConversionService } from './currencyConversionService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('./currencyService', () => ({
  currencyService: {
    getExchangeRate: jest.fn(),
  },
}));

jest.mock('../i18n/localizationService', () => ({
  localizationService: {
    formatCurrency: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { currencyService } from './currencyService';
import { localizationService } from '../i18n/localizationService';

const mockGetExchangeRate = currencyService.getExchangeRate as jest.Mock;
const mockFormatCurrency = localizationService.formatCurrency as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CurrencyConversionService', () => {
  let service: CurrencyConversionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CurrencyConversionService();
  });

  // -------------------------------------------------------------------------
  // convertAmount — Requirements 41.7, 41.9
  // -------------------------------------------------------------------------

  describe('convertAmount', () => {
    it('converts amount using the exchange rate from currencyService', async () => {
      mockGetExchangeRate.mockResolvedValue(130.5);

      const result = await service.convertAmount(100, 'USD', 'KES');

      expect(result.originalAmount).toBe(100);
      expect(result.originalCurrency).toBe('USD');
      expect(result.convertedAmount).toBeCloseTo(13050);
      expect(result.convertedCurrency).toBe('KES');
      expect(result.exchangeRate).toBe(130.5);
      expect(result.convertedAt).toBeInstanceOf(Date);
    });

    it('normalises currency codes to uppercase', async () => {
      mockGetExchangeRate.mockResolvedValue(130.5);

      const result = await service.convertAmount(50, 'usd', 'kes');

      expect(result.originalCurrency).toBe('USD');
      expect(result.convertedCurrency).toBe('KES');
      expect(mockGetExchangeRate).toHaveBeenCalledWith('USD', 'KES');
    });

    it('returns rate of 1 and same amount when currencies are equal', async () => {
      mockGetExchangeRate.mockResolvedValue(1);

      const result = await service.convertAmount(200, 'USD', 'USD');

      expect(result.convertedAmount).toBe(200);
      expect(result.exchangeRate).toBe(1);
    });

    it('propagates errors from currencyService', async () => {
      mockGetExchangeRate.mockRejectedValue(new Error('Exchange rate not found for USD → XYZ'));

      await expect(service.convertAmount(100, 'USD', 'XYZ')).rejects.toThrow(
        'Exchange rate not found for USD → XYZ',
      );
    });
  });

  // -------------------------------------------------------------------------
  // convertToUSD — Requirement 41.6
  // -------------------------------------------------------------------------

  describe('convertToUSD', () => {
    it('converts from a foreign currency to USD', async () => {
      mockGetExchangeRate.mockResolvedValue(1 / 130.5); // KES → USD

      const result = await service.convertToUSD(13050, 'KES');

      expect(result.convertedCurrency).toBe('USD');
      expect(result.originalCurrency).toBe('KES');
      expect(mockGetExchangeRate).toHaveBeenCalledWith('KES', 'USD');
    });

    it('returns same amount when already in USD', async () => {
      mockGetExchangeRate.mockResolvedValue(1);

      const result = await service.convertToUSD(500, 'USD');

      expect(result.convertedAmount).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // convertFromUSD — Requirement 41.7
  // -------------------------------------------------------------------------

  describe('convertFromUSD', () => {
    it('converts from USD to a target currency', async () => {
      mockGetExchangeRate.mockResolvedValue(1500);

      const result = await service.convertFromUSD(10, 'NGN');

      expect(result.originalCurrency).toBe('USD');
      expect(result.convertedCurrency).toBe('NGN');
      expect(result.convertedAmount).toBeCloseTo(15000);
      expect(mockGetExchangeRate).toHaveBeenCalledWith('USD', 'NGN');
    });
  });

  // -------------------------------------------------------------------------
  // formatConvertedAmount — Requirement 41.5
  // -------------------------------------------------------------------------

  describe('formatConvertedAmount', () => {
    it('delegates to localizationService.formatCurrency', () => {
      mockFormatCurrency.mockReturnValue('KSh 13,050.00');

      const formatted = service.formatConvertedAmount(13050, 'KES', 'sw');

      expect(formatted).toBe('KSh 13,050.00');
      expect(mockFormatCurrency).toHaveBeenCalledWith(13050, 'KES', 'sw');
    });

    it('formats USD amounts in English', () => {
      mockFormatCurrency.mockReturnValue('$100.00');

      const formatted = service.formatConvertedAmount(100, 'USD', 'en');

      expect(formatted).toBe('$100.00');
    });
  });

  // -------------------------------------------------------------------------
  // getConversionDisplay — Requirement 41.8
  // -------------------------------------------------------------------------

  describe('getConversionDisplay', () => {
    it('returns original and converted formatted strings with rate label', async () => {
      mockGetExchangeRate.mockResolvedValue(130.5);
      mockFormatCurrency
        .mockReturnValueOnce('$100.00')   // original
        .mockReturnValueOnce('KSh 13,050.00'); // converted

      const display = await service.getConversionDisplay(100, 'USD', 'KES', 'en');

      expect(display.original).toBe('$100.00');
      expect(display.converted).toBe('KSh 13,050.00');
      expect(display.exchangeRate).toBe(130.5);
      expect(display.rateLabel).toBe('1 USD = 130.5000 KES');
    });

    it('normalises currency codes in the rate label', async () => {
      mockGetExchangeRate.mockResolvedValue(0.92);
      mockFormatCurrency.mockReturnValueOnce('$50.00').mockReturnValueOnce('€46.00');

      const display = await service.getConversionDisplay(50, 'usd', 'eur', 'en');

      expect(display.rateLabel).toBe('1 USD = 0.9200 EUR');
    });

    it('shows same currency display when original equals display currency', async () => {
      mockGetExchangeRate.mockResolvedValue(1);
      mockFormatCurrency.mockReturnValue('$200.00');

      const display = await service.getConversionDisplay(200, 'USD', 'USD', 'en');

      expect(display.exchangeRate).toBe(1);
      expect(display.rateLabel).toBe('1 USD = 1.0000 USD');
    });
  });
});
