import { withRetry } from './retryHandler';

// Mock logger to avoid file system writes during tests
jest.mock('./logger', () => {
  const mockLogger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
  return { __esModule: true, default: mockLogger };
});

function makeError(overrides: Record<string, any> = {}): Error & Record<string, any> {
  return Object.assign(new Error('test error'), overrides);
}

// Use very short delays so tests run fast without fake timers
const FAST_OPTS = { baseDelayMs: 1, maxDelayMs: 5 };

describe('withRetry', () => {
  it('returns result immediately on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on ECONNREFUSED and eventually succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ code: 'ECONNREFUSED' }))
      .mockResolvedValue('success');

    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on ETIMEDOUT', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ code: 'ETIMEDOUT' }))
      .mockResolvedValue('done');

    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on ENOTFOUND', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ code: 'ENOTFOUND' }))
      .mockResolvedValue('done');

    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 500 status', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ response: { status: 500 } }))
      .mockResolvedValue('ok');

    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 503 status', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ response: { status: 503 } }))
      .mockResolvedValue('ok');

    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on HTTP 4xx errors', async () => {
    const err = makeError({ response: { status: 404 } });
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, FAST_OPTS)).rejects.toMatchObject({ response: { status: 404 } });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on generic errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('validation failed'));

    await expect(withRetry(fn, FAST_OPTS)).rejects.toThrow('validation failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts maxAttempts and throws last error', async () => {
    const err = makeError({ code: 'ECONNREFUSED' });
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { ...FAST_OPTS, maxAttempts: 3 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects custom maxAttempts', async () => {
    const err = makeError({ code: 'ETIMEDOUT' });
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { ...FAST_OPTS, maxAttempts: 5 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('uses custom shouldRetry predicate', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('custom retryable'))
      .mockResolvedValue('result');

    const shouldRetry = (err: any) => err.message === 'custom retryable';
    await expect(withRetry(fn, { ...FAST_OPTS, shouldRetry })).resolves.toBe('result');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('caps delay at maxDelayMs', async () => {
    jest.useFakeTimers();
    try {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(makeError({ code: 'ECONNREFUSED' }))
        .mockRejectedValueOnce(makeError({ code: 'ECONNREFUSED' }))
        .mockResolvedValue('ok');

      const promise = withRetry(fn, { baseDelayMs: 100000, maxDelayMs: 500, maxAttempts: 3 });
      await jest.runAllTimersAsync();
      await expect(promise).resolves.toBe('ok');

      const timerCalls = setTimeoutSpy.mock.calls.filter(
        (call) => typeof call[1] === 'number' && (call[1] as number) > 0
      );
      timerCalls.forEach((call) => {
        // maxDelayMs=500, jitter can add up to baseDelayMs=100000 but is capped
        expect(call[1] as number).toBeLessThanOrEqual(500);
      });

      setTimeoutSpy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });
});
