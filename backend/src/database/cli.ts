#!/usr/bin/env node

import { db } from './connection';
import { migrationManager } from './migrations';
import logger from '../utils/logger';

const commands = {
  init: async () => {
    logger.info('Initializing database...');
    await migrationManager.initializeDatabase();
    await migrationManager.createFuturePartitions(12);
    logger.info('Database initialized successfully');
  },

  migrate: async () => {
    logger.info('Running migrations...');
    await migrationManager.runMigrations();
    logger.info('Migrations completed');
  },

  status: async () => {
    logger.info('Checking migration status...');
    const status = await migrationManager.getStatus();
    
    console.log('\n=== Migration Status ===\n');
    console.log(`Executed migrations: ${status.executed.length}`);
    status.executed.forEach((m) => {
      console.log(`  ✓ ${m.name} (${m.executed_at})`);
    });
    
    console.log(`\nPending migrations: ${status.pending.length}`);
    status.pending.forEach((m) => {
      console.log(`  ○ ${m}`);
    });
    console.log('');
  },

  'create-partitions': async () => {
    const months = parseInt(process.argv[3] || '12', 10);
    logger.info(`Creating partitions for next ${months} months...`);
    await migrationManager.createFuturePartitions(months);
    logger.info('Partitions created successfully');
  },

  test: async () => {
    logger.info('Testing database connection...');
    const connected = await db.testConnection();
    if (connected) {
      logger.info('Database connection successful');
      const stats = db.getPoolStats();
      console.log('\n=== Pool Statistics ===');
      console.log(`Total connections: ${stats.totalCount}`);
      console.log(`Idle connections: ${stats.idleCount}`);
      console.log(`Waiting connections: ${stats.waitingCount}`);
      console.log('');
    } else {
      logger.error('Database connection failed');
      process.exit(1);
    }
  },

  help: () => {
    console.log(`
TechSwiftTrix ERP Database CLI

Usage: npm run db <command>

Commands:
  init              Initialize database with schema and seed data
  migrate           Run pending migrations
  status            Show migration status
  create-partitions Create monthly partitions (default: 12 months)
  test              Test database connection
  help              Show this help message

Examples:
  npm run db init
  npm run db migrate
  npm run db status
  npm run db create-partitions 24
  npm run db test
    `);
  },
};

async function main() {
  const command = process.argv[2];

  if (!command || !commands[command as keyof typeof commands]) {
    commands.help();
    process.exit(1);
  }

  try {
    await commands[command as keyof typeof commands]();
    await db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Command failed', { error });
    await db.close();
    process.exit(1);
  }
}

main();
