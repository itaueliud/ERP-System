import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import logger from '../utils/logger';

class RedisCache {
  private client: RedisClientType;
  private static instance: RedisCache;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    // Handle connection events
    this.client.on('connect', () => {
      logger.info('Redis connection established');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready');
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error', { error: err });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.info('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
  }

  public static getInstance(): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache();
    }
    return RedisCache.instance;
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Get the Redis client
   */
  public getClient(): RedisClientType {
    return this.client;
  }

  /**
   * Test Redis connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      logger.info('Redis connection successful', { response: pong });
      return pong === 'PONG';
    } catch (error) {
      logger.error('Redis connection failed', { error });
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      logger.info('Redis connection closed');
    }
  }

  /**
   * Check if Redis is connected
   */
  public isReady(): boolean {
    return this.isConnected;
  }
}

export const redis = RedisCache.getInstance();
export default redis;
