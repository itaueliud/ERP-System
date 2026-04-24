// Mock pg before importing connection
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockEnd = jest.fn();
const mockRelease = jest.fn();
const mockClientQuery = jest.fn();
const mockOn = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
    on: mockOn,
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
  })),
}));

jest.mock('../utils/logger');

// Import after mocking
import { db } from './connection';

describe('Database Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to database', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ now: new Date() }], rowCount: 1 });
    const connected = await db.testConnection();
    expect(connected).toBe(true);
  });

  it('should execute simple query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ sum: 2 }], rowCount: 1 });
    const result = await db.query('SELECT 1 + 1 as sum');
    expect(result.rows[0].sum).toBe(2);
  });

  it('should handle parameterized queries', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ value: 'test' }], rowCount: 1 });
    const result = await db.query('SELECT $1::text as value', ['test']);
    expect(result.rows[0].value).toBe('test');
  });

  it('should execute transactions', async () => {
    const mockClient = {
      query: mockClientQuery,
      release: mockRelease,
    };
    mockConnect.mockResolvedValueOnce(mockClient);
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ num: 1 }] }) // SELECT 1
      .mockResolvedValueOnce({ rows: [{ num: 2 }] }) // SELECT 2
      .mockResolvedValueOnce({}); // COMMIT

    const result = await db.transaction(async (client) => {
      const res1 = await client.query('SELECT 1 as num');
      const res2 = await client.query('SELECT 2 as num');
      return res1.rows[0].num + res2.rows[0].num;
    });
    expect(result).toBe(3);
  });

  it('should rollback failed transactions', async () => {
    const mockClient = {
      query: mockClientQuery,
      release: mockRelease,
    };
    mockConnect.mockResolvedValueOnce(mockClient);
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ num: 1 }] }) // SELECT 1
      .mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      db.transaction(async (client) => {
        await client.query('SELECT 1');
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });

  it('should return pool statistics', () => {
    const stats = db.getPoolStats();
    expect(stats).toHaveProperty('totalCount');
    expect(stats).toHaveProperty('idleCount');
    expect(stats).toHaveProperty('waitingCount');
  });
});
