import { redis } from './connection';

describe('Redis Connection', () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.close();
  });

  describe('testConnection', () => {
    it('should successfully connect to Redis', async () => {
      const result = await redis.testConnection();
      expect(result).toBe(true);
    });

    it('should return PONG on ping', async () => {
      const client = redis.getClient();
      const response = await client.ping();
      expect(response).toBe('PONG');
    });
  });

  describe('isReady', () => {
    it('should return true when connected', () => {
      expect(redis.isReady()).toBe(true);
    });
  });

  describe('getClient', () => {
    it('should return a Redis client instance', () => {
      const client = redis.getClient();
      expect(client).toBeDefined();
      expect(typeof client.get).toBe('function');
      expect(typeof client.set).toBe('function');
    });
  });
});
