import { Router, Request, Response } from 'express';
import { reportingService, ReportType, ReportFilters } from './reportingService';
import logger from '../utils/logger';

const router = Router();

/**
 * List available report types
 * GET /api/reports/types
 * Requirement 40.1
 */
router.get('/types', (_req: Request, res: Response) => {
  const types = reportingService.getReportTypes();
  return res.json({ reportTypes: types });
});

/**
 * Generate a report and return it in the requested format
 * POST /api/reports/generate
 * Requirements: 40.1-40.5
 *
 * Body:
 *   type: ReportType
 *   format: 'pdf' | 'xlsx' | 'csv'
 *   filters?: ReportFilters
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type, format, filters = {} } = req.body as {
      type: ReportType;
      format: 'pdf' | 'xlsx' | 'csv';
      filters?: ReportFilters;
    };

    if (!type) {
      return res.status(400).json({ error: 'Missing required field: type' });
    }

    const validTypes: ReportType[] = [
      'CLIENTS', 'PROJECTS', 'PAYMENTS', 'CONTRACTS', 'DAILY_REPORTS', 'PROPERTY_LISTINGS',
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid report type. Must be one of: ${validTypes.join(', ')}` });
    }

    const validFormats = ['pdf', 'xlsx', 'csv'];
    const fmt = (format || 'csv').toLowerCase();
    if (!validFormats.includes(fmt)) {
      return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
    }

    // Parse date filters
    const parsedFilters: ReportFilters = { ...filters };
    if (parsedFilters.dateFrom) parsedFilters.dateFrom = new Date(parsedFilters.dateFrom as any);
    if (parsedFilters.dateTo) parsedFilters.dateTo = new Date(parsedFilters.dateTo as any);

    const report = await reportingService.generateReport(type, parsedFilters, userId);

    // Requirement 40.6: Limit to 10,000 records
    if (report.data.length >= 10000) {
      return res.status(400).json({
        error: 'Export exceeds 10,000 records. Please refine your filters.',
        totalRecords: report.data.length,
      });
    }

    const typeDef = reportingService.getReportTypes().find((t) => t.type === type);
    const columns = typeDef?.columns ?? [];
    const filename = `${type.toLowerCase()}_report_${Date.now()}`;

    if (fmt === 'csv') {
      const csv = reportingService.generateCSV(report.data, columns);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    if (fmt === 'xlsx') {
      const buffer = await reportingService.generateExcel(
        report.data,
        columns,
        report.metadata,
        typeDef?.title ?? type
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(buffer);
    }

    if (fmt === 'pdf') {
      const html = reportingService.buildReportHTML(report, columns);
      const buffer = await reportingService.generatePDF(html);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(buffer);
    }

    return res.status(400).json({ error: 'Unsupported format' });
  } catch (error: any) {
    logger.error('Error generating report', { error, body: req.body });
    return res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

/**
 * Get report metadata (preview without downloading)
 * GET /api/reports/:reportId
 * Requirement 40.3
 *
 * Note: This endpoint returns a preview of the report metadata and first 100 rows.
 * For full downloads use POST /generate.
 */
router.get('/:reportType', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const type = req.params.reportType.toUpperCase() as ReportType;
    const validTypes: ReportType[] = [
      'CLIENTS', 'PROJECTS', 'PAYMENTS', 'CONTRACTS', 'DAILY_REPORTS', 'PROPERTY_LISTINGS',
    ];

    if (!validTypes.includes(type)) {
      return res.status(404).json({ error: 'Report type not found' });
    }

    const filters: ReportFilters = {};
    if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom as string);
    if (req.query.dateTo) filters.dateTo = new Date(req.query.dateTo as string);
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.country) filters.country = req.query.country as string;
    if (req.query.userId) filters.userId = req.query.userId as string;

    const report = await reportingService.generateReport(type, filters, userId);
    const typeDef = reportingService.getReportTypes().find((t) => t.type === type);

    return res.json({
      metadata: report.metadata,
      columns: typeDef?.columns ?? [],
      preview: report.data.slice(0, 100),
    });
  } catch (error: any) {
    logger.error('Error getting report preview', { error, reportType: req.params.reportType });
    return res.status(500).json({ error: error.message || 'Failed to get report' });
  }
});

export default router;
