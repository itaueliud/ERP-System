import fs from 'fs/promises';
import path from 'path';
import { db } from './connection';
import logger from '../utils/logger';

interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

class MigrationManager {
  private migrationsTable = 'schema_migrations';

  /**
   * Ensure migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<string[]> {
    const result = await db.query<Migration>(
      `SELECT name FROM ${this.migrationsTable} ORDER BY id`
    );
    return result.rows.map((row) => row.name);
  }

  /**
   * Record migration execution
   */
  private async recordMigration(name: string): Promise<void> {
    await db.query(
      `INSERT INTO ${this.migrationsTable} (name) VALUES ($1)`,
      [name]
    );
  }

  /**
   * Initialize database with schema
   */
  public async initializeDatabase(): Promise<void> {
    try {
      logger.info('Initializing database...');

      // Read and execute schema.sql
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf-8');

      await db.query(schema);
      logger.info('Database schema created successfully');

      // Read and execute seeds.sql
      const seedsPath = path.join(__dirname, 'seeds.sql');
      const seeds = await fs.readFile(seedsPath, 'utf-8');

      await db.query(seeds);
      logger.info('Database seeded successfully');

      // Create migrations table
      await this.ensureMigrationsTable();
      await this.recordMigration('initial_schema');

      logger.info('Database initialization complete');
    } catch (error) {
      logger.error('Database initialization failed', { error });
      throw error;
    }
  }

  /**
   * Run pending migrations
   */
  public async runMigrations(): Promise<void> {
    try {
      await this.ensureMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();
      const migrationsDir = path.join(__dirname, 'migrations');

      // Check if migrations directory exists
      try {
        await fs.access(migrationsDir);
      } catch {
        logger.info('No migrations directory found, skipping migrations');
        return;
      }

      // Get all migration files
      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files
        .filter((f) => f.endsWith('.sql'))
        .sort();

      // Filter out already executed migrations
      const pendingMigrations = migrationFiles.filter(
        (f) => !executedMigrations.includes(f)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Running ${pendingMigrations.length} pending migrations`);

      for (const migrationFile of pendingMigrations) {
        logger.info(`Executing migration: ${migrationFile}`);

        const migrationPath = path.join(migrationsDir, migrationFile);
        const migrationSql = await fs.readFile(migrationPath, 'utf-8');

        await db.transaction(async (client) => {
          await client.query(migrationSql);
          await client.query(
            `INSERT INTO ${this.migrationsTable} (name) VALUES ($1)`,
            [migrationFile]
          );
        });

        logger.info(`Migration completed: ${migrationFile}`);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error });
      throw error;
    }
  }

  /**
   * Create partition for a specific month
   */
  public async createMonthlyPartition(
    tableName: string,
    year: number,
    month: number
  ): Promise<void> {
    const monthStr = month.toString().padStart(2, '0');
    const partitionName = `${tableName}_${year}_${monthStr}`;

    const startDate = `${year}-${monthStr}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF ${tableName}
        FOR VALUES FROM ('${startDate}') TO ('${endDate}')
      `);

      logger.info(`Created partition: ${partitionName}`);
    } catch (error) {
      logger.error(`Failed to create partition: ${partitionName}`, { error });
      throw error;
    }
  }

  /**
   * Create partitions for the next N months
   */
  public async createFuturePartitions(months: number = 12): Promise<void> {
    const partitionedTables = ['audit_logs', 'chat_messages', 'notifications'];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      for (const table of partitionedTables) {
        try {
          await this.createMonthlyPartition(table, year, month);
        } catch (error) {
          // Partition might already exist, continue
          logger.debug(`Partition might already exist for ${table} ${year}-${month}`);
        }
      }
    }

    logger.info(`Created partitions for next ${months} months`);
  }

  /**
   * Get migration status
   */
  public async getStatus(): Promise<{
    executed: Migration[];
    pending: string[];
  }> {
    await this.ensureMigrationsTable();

    const executedResult = await db.query<Migration>(
      `SELECT * FROM ${this.migrationsTable} ORDER BY id`
    );

    const migrationsDir = path.join(__dirname, 'migrations');
    let allMigrations: string[] = [];

    try {
      const files = await fs.readdir(migrationsDir);
      allMigrations = files.filter((f) => f.endsWith('.sql')).sort();
    } catch {
      // No migrations directory
    }

    const executedNames = executedResult.rows.map((r) => r.name);
    const pending = allMigrations.filter((m) => !executedNames.includes(m));

    return {
      executed: executedResult.rows,
      pending,
    };
  }
}

export const migrationManager = new MigrationManager();
export default migrationManager;
