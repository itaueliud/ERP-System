import { monitorQuery, SLOW_QUERY_THRESHOLD_MS } from './queryMonitor';
import logger from './logger';

jest.mock('./logger', () => ({
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

describe('monitorQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the result from the executor', async () => {
    const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
    const result = await monitorQuery('SELECT 1', [], async () => mockResult);
    expect(result).toBe(mockResult);
  });

  it('logs debug for fast queries', async () => {
    await monitorQuery('SELECT 1', [], async () => ({ rows: [], rowCount: 0 }));
    expect(logger.debug).toHaveBeenCalledWith(
      'Query executed',
      expect.objectContaining({ query: 'SELECT 1' })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs warn for slow queries exceeding threshold', async () => {
    const slowExecutor = async () => {
      await new Promise((resolve) => setTimeout(resolve, SLOW_QUERY_THRESHOLD_MS + 50));
      return { rows: [], rowCount: 0 };
    };

    await monitorQuery('SELECT pg_sleep(1)', [], slowExecutor);

    expect(logger.warn).toHaveBeenCalledWith(
      'Slow query detected',
      expect.objectContaining({ query: 'SELECT pg_sleep(1)' })
    );
  }, 3000);

  it('logs error and rethrows on query failure', async () => {
    const error = new Error('DB connection lost');
    const failingExecutor = async () => {
      throw error;
    };

    await expect(monitorQuery('SELECT 1', [], failingExecutor)).rejects.toThrow('DB connection lost');
    expect(logger.error).toHaveBeenCalledWith(
      'Query execution failed',
      expect.objectContaining({ query: 'SELECT 1', error })
    );
  });

  it('includes params in slow query log', async () => {
    const slowExecutor = async () => {
      await new Promise((resolve) => setTimeout(resolve, SLOW_QUERY_THRESHOLD_MS + 50));
      return { rows: [], rowCount: 0 };
    };

    const params = ['user-123', 'LEAD'];
    await monitorQuery('SELECT * FROM clients WHERE agent_id = $1 AND status = $2', params, slowExecutor);

    expect(logger.warn).toHaveBeenCalledWith(
      'Slow query detected',
      expect.objectContaining({ params })
    );
  }, 3000);
});
