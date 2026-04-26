/**
 * Lightweight in-process metrics collection
 * Tracks counters, gauges, and histograms for service monitoring
 */

import logger from './logger';

interface MetricEntry {
  count: number;
  total: number;
  min: number;
  max: number;
  lastUpdated: Date;
}

class MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, MetricEntry>();

  /** Increment a counter */
  increment(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value);
  }

  /** Record a duration/value in a histogram */
  record(name: string, value: number): void {
    const existing = this.histograms.get(name);
    if (existing) {
      existing.count++;
      existing.total += value;
      existing.min = Math.min(existing.min, value);
      existing.max = Math.max(existing.max, value);
      existing.lastUpdated = new Date();
    } else {
      this.histograms.set(name, {
        count: 1,
        total: value,
        min: value,
        max: value,
        lastUpdated: new Date(),
      });
    }
  }

  /** Time an async operation and record its duration */
  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.record(`${name}.duration_ms`, Date.now() - start);
      this.increment(`${name}.success`);
      return result;
    } catch (err) {
      this.record(`${name}.duration_ms`, Date.now() - start);
      this.increment(`${name}.error`);
      throw err;
    }
  }

  /** Get a snapshot of all metrics */
  snapshot(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, value] of this.counters) {
      result[name] = value;
    }

    for (const [name, entry] of this.histograms) {
      result[name] = {
        count: entry.count,
        avg: entry.count > 0 ? Math.round(entry.total / entry.count) : 0,
        min: entry.min,
        max: entry.max,
        lastUpdated: entry.lastUpdated,
      };
    }

    return result;
  }

  /** Log current metrics snapshot */
  logSnapshot(): void {
    logger.info('Metrics snapshot', { metrics: this.snapshot() });
  }

  /** Reset all metrics */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

export const metrics = new MetricsCollector();
export default metrics;
