import { Router, Request, Response } from 'express';
import { communicationService, CreateCommunicationInput, CommunicationType } from './communicationService';
import logger from '../utils/logger';
import { clientAnalyticsService } from './clientAnalyticsService';
import { clientSearchService, ClientSearchFilters } from './clientSearchService';
import { bulkImportService } from '../bulk/bulkImportService';
import { bulkOperationsService } from '../bulk/bulkOperationsService';

const router = Router();

/**
 * Log a communication record
 * POST /api/clients/:clientId/communications
 * Requirements: 49.3
 */
router.post('/:clientId/communications', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { type, communicationDate, durationMinutes, summary, participants, outcome } = req.body;

    // Validate required fields
    if (!type || !communicationDate) {
      return res.status(400).json({
        error: 'Missing required fields: type, communicationDate',
      });
    }

    const input: CreateCommunicationInput = {
      clientId,
      type,
      communicationDate: new Date(communicationDate),
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
      summary,
      participants,
      outcome,
      attachmentIds: req.body.attachmentIds, // Requirement 49.8
    };

    const communication = await communicationService.logCommunication(input);

    return res.status(201).json(communication);
  } catch (error: any) {
    logger.error('Error logging communication', { error, body: req.body });
    return res.status(400).json({ error: error.message || 'Failed to log communication' });
  }
});

/**
 * Get communication history for a client
 * GET /api/clients/:clientId/communications
 * Requirements: 49.6, 49.7
 */
router.get('/:clientId/communications', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    const filters = {
      type: req.query.type as CommunicationType | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await communicationService.getCommunicationHistory(clientId, filters);

    return res.json(result);
  } catch (error: any) {
    logger.error('Error getting communication history', { error, clientId: req.params.clientId });
    return res.status(500).json({ error: 'Failed to get communication history' });
  }
});

/**
 * Get total communication time for a client
 * GET /api/clients/:clientId/communications/total-time
 * Requirements: 49.9
 */
router.get('/:clientId/communications/total-time', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    const totalMinutes = await communicationService.getTotalCommunicationTime(clientId);

    return res.json({ totalMinutes });
  } catch (error: any) {
    logger.error('Error getting total communication time', { error, clientId: req.params.clientId });
    return res.status(500).json({ error: 'Failed to get total communication time' });
  }
});

/**
 * Get last communication date for a client
 * GET /api/clients/:clientId/communications/last-date
 * Requirements: 49.10
 */
router.get('/:clientId/communications/last-date', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    const lastDate = await communicationService.getLastCommunicationDate(clientId);

    return res.json({ lastCommunicationDate: lastDate });
  } catch (error: any) {
    logger.error('Error getting last communication date', { error, clientId: req.params.clientId });
    return res.status(500).json({ error: 'Failed to get last communication date' });
  }
});

/**
 * Delete communication record
 * DELETE /api/clients/:clientId/communications/:communicationId
 */
router.delete('/:clientId/communications/:communicationId', async (req: Request, res: Response) => {
  try {
    const { communicationId } = req.params;

    await communicationService.deleteCommunication(communicationId);

    return res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting communication', { error, communicationId: req.params.communicationId });
    return res.status(400).json({ error: error.message || 'Failed to delete communication' });
  }
});

export default router;

// ============================================================================
// Analytics routes — GET /api/clients/analytics/*
// ============================================================================

/**
 * GET /api/clients/analytics/dashboard
 * Full analytics dashboard (funnel + revenue + activity)
 */
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const dashboard = await clientAnalyticsService.getDashboard(agentId);
    return res.json(dashboard);
  } catch (error: any) {
    logger.error('Error getting client analytics dashboard', { error });
    return res.status(500).json({ error: 'Failed to get analytics dashboard' });
  }
});

/**
 * GET /api/clients/analytics/funnel
 */
router.get('/analytics/funnel', async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const funnel = await clientAnalyticsService.getConversionFunnel(agentId);
    return res.json(funnel);
  } catch (error: any) {
    logger.error('Error getting conversion funnel', { error });
    return res.status(500).json({ error: 'Failed to get conversion funnel' });
  }
});

/**
 * GET /api/clients/analytics/revenue
 */
router.get('/analytics/revenue', async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const stats = await clientAnalyticsService.getRevenueStats(agentId);
    return res.json(stats);
  } catch (error: any) {
    logger.error('Error getting revenue stats', { error });
    return res.status(500).json({ error: 'Failed to get revenue stats' });
  }
});

// ============================================================================
// Advanced search — POST /api/clients/search
// ============================================================================

/**
 * POST /api/clients/search
 * Advanced search with multi-field filtering and sorting
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const filters: ClientSearchFilters = {
      ...req.body,
      // Agents can only search their own clients unless elevated role
      agentId: req.body.agentId ?? userId,
    };

    const result = await clientSearchService.search(filters);
    return res.json(result);
  } catch (error: any) {
    logger.error('Error searching clients', { error });
    return res.status(500).json({ error: 'Failed to search clients' });
  }
});

// ============================================================================
// Bulk import/export — /api/clients/bulk/*
// ============================================================================

/**
 * POST /api/clients/bulk/import
 * Initiate async CSV bulk import for clients
 */
router.post('/bulk/import', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { csvContent } = req.body;
    if (!csvContent) return res.status(400).json({ error: 'csvContent is required' });

    const job = await bulkImportService.startImport('clients', csvContent, userId);
    return res.status(202).json({ jobId: job.id, status: job.status });
  } catch (error: any) {
    logger.error('Error initiating client bulk import', { error });
    return res.status(400).json({ error: error.message || 'Failed to initiate import' });
  }
});

/**
 * GET /api/clients/bulk/import/:jobId
 * Get import job status
 */
router.get('/bulk/import/:jobId', async (req: Request, res: Response) => {
  try {
    const job = await bulkImportService.getImportJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Import job not found' });
    return res.json(job);
  } catch (error: any) {
    logger.error('Error getting import job', { error });
    return res.status(500).json({ error: 'Failed to get import job' });
  }
});

/**
 * GET /api/clients/bulk/export/csv
 * Export clients to CSV
 */
router.get('/bulk/export/csv', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const filters = {
      status: req.query.status as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const csv = await bulkOperationsService.bulkExportCSV('clients', filters, userId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    return res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting clients CSV', { error });
    return res.status(500).json({ error: 'Failed to export clients' });
  }
});

/**
 * GET /api/clients/bulk/export/excel
 * Export clients to Excel
 */
router.get('/bulk/export/excel', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const filters = {
      status: req.query.status as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const buffer = await bulkOperationsService.bulkExportExcel('clients', filters, userId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.xlsx"');
    return res.send(buffer);
  } catch (error: any) {
    logger.error('Error exporting clients Excel', { error });
    return res.status(500).json({ error: 'Failed to export clients' });
  }
});
