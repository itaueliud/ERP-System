import { redis } from './connection';
import { cacheService, CacheTTL } from './cacheService';

describe('CacheService', () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.close();
  });

  beforeEach(async () => {
    await cacheService.flush();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', async () => {
      const key = 'test:key';
      const value = { name: 'Test', count: 42 };

      await cacheService.set(key, value);
      const result = await cacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should store value with TTL', async () => {
      const key = 'test:ttl';
      const value = 'test-value';
      const ttl = 10;

      await cacheService.set(key, value, ttl);
      const storedTTL = await cacheService.ttl(key);

      expect(storedTTL).toBeGreaterThan(0);
      expect(storedTTL).toBeLessThanOrEqual(ttl);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('non:existent');
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      const key = 'test:delete';
      await cacheService.set(key, 'value');

      await cacheService.delete(key);
      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      const key = 'test:exists';
      await cacheService.set(key, 'value');

      const exists = await cacheService.exists(key);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await cacheService.exists('non:existent');
      expect(exists).toBe(false);
    });
  });

  describe('mset and mget', () => {
    it('should set and get multiple values', async () => {
      const entries = {
        'test:key1': { value: 1 },
        'test:key2': { value: 2 },
        'test:key3': { value: 3 },
      };

      await cacheService.mset(entries);
      const results = await cacheService.mget(Object.keys(entries));

      expect(results).toEqual(Object.values(entries));
    });
  });

  describe('increment and decrement', () => {
    it('should increment a counter', async () => {
      const key = 'test:counter';
      
      const result1 = await cacheService.increment(key);
      expect(result1).toBe(1);

      const result2 = await cacheService.increment(key, 5);
      expect(result2).toBe(6);
    });

    it('should decrement a counter', async () => {
      const key = 'test:counter';
      await cacheService.increment(key, 10);

      const result1 = await cacheService.decrement(key);
      expect(result1).toBe(9);

      const result2 = await cacheService.decrement(key, 3);
      expect(result2).toBe(6);
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', async () => {
      await cacheService.set('test:pattern:1', 'value1');
      await cacheService.set('test:pattern:2', 'value2');
      await cacheService.set('test:other', 'value3');

      await cacheService.deletePattern('test:pattern:*');

      const result1 = await cacheService.get('test:pattern:1');
      const result2 = await cacheService.get('test:pattern:2');
      const result3 = await cacheService.get('test:other');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBe('value3');
    });
  });

  describe('TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(CacheTTL.SESSION).toBe(8 * 60 * 60); // 8 hours
      expect(CacheTTL.DASHBOARD_METRICS).toBe(5 * 60); // 5 minutes
      expect(CacheTTL.PERMISSIONS).toBe(1 * 60 * 60); // 1 hour
    });
  });
});
