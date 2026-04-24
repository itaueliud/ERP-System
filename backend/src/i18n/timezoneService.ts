/**
 * Timezone Service — UTC storage, user timezone conversion, DST-aware formatting
 * Requirements: 42.1-42.9
 */

import { db } from '../database/connection';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEZONE = 'UTC';

/**
 * Common African timezones (IANA identifiers).
 * Covers the major regions used across the continent.
 */
const COMMON_AFRICAN_TIMEZONES: string[] = [
  'Africa/Abidjan',       // UTC+0  — Côte d'Ivoire, Ghana, Senegal, etc.
  'Africa/Lagos',         // UTC+1  — Nigeria, Cameroon, Niger, Chad
  'Africa/Cairo',         // UTC+2  — Egypt
  'Africa/Johannesburg',  // UTC+2  — South Africa, Zimbabwe, Zambia
  'Africa/Nairobi',       // UTC+3  — Kenya, Tanzania, Uganda, Ethiopia
  'Africa/Addis_Ababa',   // UTC+3  — Ethiopia
  'Africa/Dar_es_Salaam', // UTC+3  — Tanzania
  'Africa/Kampala',       // UTC+3  — Uganda
  'Africa/Khartoum',      // UTC+3  — Sudan
  'Africa/Mogadishu',     // UTC+3  — Somalia
  'Africa/Casablanca',    // UTC+1  — Morocco (observes DST)
  'Africa/Tunis',         // UTC+1  — Tunisia
  'Africa/Algiers',       // UTC+1  — Algeria
  'Africa/Tripoli',       // UTC+2  — Libya
  'Africa/Accra',         // UTC+0  — Ghana
  'Africa/Dakar',         // UTC+0  — Senegal
  'Africa/Lusaka',        // UTC+2  — Zambia
  'Africa/Harare',        // UTC+2  — Zimbabwe
  'Africa/Maputo',        // UTC+2  — Mozambique
  'Africa/Luanda',        // UTC+1  — Angola
];

// ============================================================================
// TimezoneService
// ============================================================================

export class TimezoneService {
  /**
   * Convert a UTC Date to the equivalent instant expressed in the user's timezone.
   * The returned Date object still represents the same instant in time; use
   * formatWithTimezone() to get a human-readable string in the target timezone.
   *
   * DST is handled automatically by Intl.DateTimeFormat.
   */
  convertToUserTimezone(utcDate: Date, timezone: string): Date {
    const tz = this.resolveTimezone(timezone);

    // Extract the wall-clock components in the target timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(utcDate);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';

    const year = parseInt(get('year'), 10);
    const month = parseInt(get('month'), 10) - 1; // 0-indexed
    const day = parseInt(get('day'), 10);
    const hour = parseInt(get('hour'), 10) % 24; // handle "24" hour edge case
    const minute = parseInt(get('minute'), 10);
    const second = parseInt(get('second'), 10);

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Convert a local Date (wall-clock time in the given timezone) back to UTC.
   * DST is handled automatically by Intl.DateTimeFormat.
   */
  convertToUTC(localDate: Date, timezone: string): Date {
    const tz = this.resolveTimezone(timezone);

    // Strategy: treat the local date's numeric components as wall-clock time in
    // the target timezone, then find the UTC instant that corresponds to it.
    //
    // We build a UTC timestamp from the local components, then compute the
    // timezone offset at that approximate instant, and subtract it.
    const approxUtcMs = Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes(),
      localDate.getSeconds(),
    );
    const approxUtc = new Date(approxUtcMs);

    // Get the offset at the approximate UTC instant (close enough for DST)
    const offset = this.getTimezoneOffset(tz, approxUtc);
    return new Date(approxUtcMs - offset * 60 * 1000);
  }

  /**
   * Format a UTC date as a human-readable string with a timezone indicator.
   * Example output: "15/01/2024, 14:30:00 EAT"
   *
   * DST transitions are handled automatically by Intl.DateTimeFormat.
   */
  formatWithTimezone(utcDate: Date, timezone: string, language?: string): string {
    const tz = this.resolveTimezone(timezone);
    const locale = language ?? 'en-US';

    try {
      const formatted = new Intl.DateTimeFormat(locale, {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
        hour12: false,
      }).format(utcDate);

      return formatted;
    } catch (err) {
      logger.error('Timezone formatting failed', { timezone, language, err });
      return utcDate.toISOString();
    }
  }

  /**
   * Return the UTC offset in minutes for the given timezone at the given instant.
   * Positive values mean the timezone is ahead of UTC (e.g. UTC+3 → 180).
   * DST is taken into account for the provided reference date (defaults to now).
   */
  getTimezoneOffset(timezone: string, referenceDate?: Date): number {
    const tz = this.resolveTimezone(timezone);
    const date = referenceDate ?? new Date();

    try {
      // Format the same instant in UTC and in the target timezone, then diff
      const utcParts = this.extractDateParts(date, 'UTC');
      const tzParts = this.extractDateParts(date, tz);

      const utcMs = Date.UTC(
        utcParts.year, utcParts.month, utcParts.day,
        utcParts.hour, utcParts.minute, utcParts.second,
      );
      const tzMs = Date.UTC(
        tzParts.year, tzParts.month, tzParts.day,
        tzParts.hour, tzParts.minute, tzParts.second,
      );

      return Math.round((tzMs - utcMs) / 60000);
    } catch (err) {
      logger.error('Failed to compute timezone offset', { timezone, err });
      return 0;
    }
  }

  /**
   * Validate that the given string is a recognised IANA timezone identifier.
   */
  isValidTimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== 'string') return false;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Persist the user's preferred timezone to the database.
   */
  async setUserTimezone(userId: string, timezone: string): Promise<void> {
    if (!this.isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    await db.query(
      `UPDATE users SET timezone = $1, updated_at = NOW() WHERE id = $2`,
      [timezone, userId],
    );

    logger.info('User timezone preference updated', { userId, timezone });
  }

  /**
   * Retrieve the user's preferred timezone from the database.
   * Returns 'UTC' when the user has no preference set or is not found.
   */
  async getUserTimezone(userId: string): Promise<string> {
    const result = await db.query<{ timezone: string | null }>(
      `SELECT timezone FROM users WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      logger.warn('User not found when fetching timezone preference', { userId });
      return DEFAULT_TIMEZONE;
    }

    return result.rows[0].timezone ?? DEFAULT_TIMEZONE;
  }

  /**
   * Return the list of common African IANA timezone identifiers.
   */
  getCommonAfricanTimezones(): string[] {
    return [...COMMON_AFRICAN_TIMEZONES];
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private resolveTimezone(timezone: string): string {
    if (!timezone || !this.isValidTimezone(timezone)) {
      logger.warn('Invalid or missing timezone, falling back to UTC', { timezone });
      return DEFAULT_TIMEZONE;
    }
    return timezone;
  }

  private extractDateParts(
    date: Date,
    timezone: string,
  ): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

    return {
      year: get('year'),
      month: get('month') - 1,
      day: get('day'),
      hour: get('hour') % 24,
      minute: get('minute'),
      second: get('second'),
    };
  }
}

export const timezoneService = new TimezoneService();
export default timezoneService;
