import Bull from 'bull';
import logger from '../utils/logger';

// ============================================================================
// Bull Queue: report-exports
// Requirements: 40.8
// ============================================================================

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const exportQueue = new Bull<{ jobId: string; userEmail: string }>('report-exports', redisUrl);

// Process jobs
exportQueue.process(async (job) => {
  const { jobId, userEmail } = job.data;
  logger.info('Processing export job', { jobId });

  // Lazy import to avoid circular dependency
  const { asyncExportService } = await import('./asyncExportService');
  await asyncExportService.processExportJob(jobId, userEmail);
});

exportQueue.on('completed', (job) => {
  logger.info('Export job completed', { jobId: job.data.jobId });
});

exportQueue.on('failed', (job, err) => {
  logger.error('Export job failed', { jobId: job.data.jobId, error: err.message });
});

export default exportQueue;
