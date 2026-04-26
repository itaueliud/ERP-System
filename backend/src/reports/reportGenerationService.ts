import ExcelJS from 'exceljs';
import { db } from '../database/connection';
import logger from '../utils/logger';

// ============================================================================
// Types and Enums
// ============================================================================

export enum ReportType {
  CLIENT_LIST = 'CLIENT_LIST',
  LEAD_PIPELINE = 'LEAD_PIPELINE',
  PROJECT_STATUS = 'PROJECT_STATUS',
  PAYMENT_SUMMARY = 'PAYMENT_SUMMARY',
  AUDIT_SUMMARY = 'AUDIT_SUMMARY',
  ACHIEVEMENT_SUMMARY = 'ACHIEVEMENT_SUMMARY',
  DAILY_REPORT_COMPLIANCE = 'DAILY_REPORT_COMPLIANCE',
}

export type ReportFormat = 'pdf' | 'xlsx' | 'csv';

export interface ReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  country?: string;
  userId?: string;
  departmentId?: string;
  [key: string]: any;
}

export interface ReportMetadata {
  reportType: ReportType;
  generatedAt: Date;
  generatedBy: string;
  filtersApplied: ReportFilters;
  totalRecords: number;
}

export interface ColumnDefinition {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'currency';
}

export interface GeneratedReport {
  metadata: ReportMetadata;
  data: Record<string, any>[];
  columns: ColumnDefinition[];
}

// ============================================================================
// Column definitions per report type
// ============================================================================

const REPORT_COLUMNS: Record<ReportType, ColumnDefinition[]> = {
  [ReportType.CLIENT_LIST]: [
    { key: 'reference_number', header: 'Reference', width: 20 },
    { key: 'name', header: 'Name', width: 30 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'phone', header: 'Phone', width: 20 },
    { key: 'country', header: 'Country', width: 20 },
    { key: 'industry_category', header: 'Industry', width: 20 },
    { key: 'status', header: 'Status', width: 20 },
    { key: 'estimated_value', header: 'Estimated Value', width: 18, type: 'currency' },
    { key: 'created_at', header: 'Created At', width: 22, type: 'date' },
  ],
  [ReportType.LEAD_PIPELINE]: [
    { key: 'reference_number', header: 'Reference', width: 20 },
    { key: 'name', header: 'Client Name', width: 30 },
    { key: 'status', header: 'Pipeline Stage', width: 22 },
    { key: 'agent_name', header: 'Agent', width: 25 },
    { key: 'country', header: 'Country', width: 20 },
    { key: 'industry_category', header: 'Industry', width: 20 },
    { key: 'estimated_value', header: 'Estimated Value', width: 18, type: 'currency' },
    { key: 'created_at', header: 'Created At', width: 22, type: 'date' },
  ],
  [ReportType.PROJECT_STATUS]: [
    { key: 'reference_number', header: 'Reference', width: 22 },
    { key: 'client_name', header: 'Client', width: 30 },
    { key: 'status', header: 'Status', width: 20 },
    { key: 'service_amount', header: 'Service Amount', width: 18, type: 'currency' },
    { key: 'currency', header: 'Currency', width: 12 },
    { key: 'start_date', header: 'Start Date', width: 16, type: 'date' },
    { key: 'end_date', header: 'End Date', width: 16, type: 'date' },
    { key: 'created_at', header: 'Created At', width: 22, type: 'date' },
  ],
  [ReportType.PAYMENT_SUMMARY]: [
    { key: 'transaction_id', header: 'Transaction ID', width: 30 },
    { key: 'amount', header: 'Amount', width: 16, type: 'currency' },
    { key: 'currency', header: 'Currency', width: 12 },
    { key: 'payment_method', header: 'Method', width: 18 },
    { key: 'status', header: 'Status', width: 16 },
    { key: 'client_name', header: 'Client', width: 30 },
    { key: 'created_at', header: 'Date', width: 22, type: 'date' },
  ],
  [ReportType.AUDIT_SUMMARY]: [
    { key: 'user_name', header: 'User', width: 25 },
    { key: 'action', header: 'Action', width: 20 },
    { key: 'resource_type', header: 'Resource Type', width: 22 },
    { key: 'resource_id', header: 'Resource ID', width: 30 },
    { key: 'result', header: 'Result', width: 12 },
    { key: 'ip_address', header: 'IP Address', width: 18 },
    { key: 'created_at', header: 'Timestamp', width: 22, type: 'date' },
  ],
  [ReportType.ACHIEVEMENT_SUMMARY]: [
    { key: 'user_name', header: 'User', width: 25 },
    { key: 'department_name', header: 'Department', width: 25 },
    { key: 'country', header: 'Country', width: 20 },
    { key: 'title', header: 'Achievement', width: 40 },
    { key: 'description', header: 'Description', width: 50 },
    { key: 'achieved_at', header: 'Achieved At', width: 22, type: 'date' },
  ],
  [ReportType.DAILY_REPORT_COMPLIANCE]: [
    { key: 'user_name', header: 'User', width: 25 },
    { key: 'department_name', header: 'Department', width: 25 },
    { key: 'report_date', header: 'Date', width: 16, type: 'date' },
    { key: 'submitted', header: 'Submitted', width: 12 },
    { key: 'submitted_at', header: 'Submitted At', width: 22, type: 'date' },
    { key: 'hours_worked', header: 'Hours Worked', width: 14, type: 'number' },
  ],
};

// ============================================================================
// Data fetchers
// ============================================================================

async function fetchClientList(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`c.created_at >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`c.created_at <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.status) { conditions.push(`c.status = $${idx++}`); values.push(filters.status); }
  if (filters.country) { conditions.push(`c.country = $${idx++}`); values.push(filters.country); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT c.reference_number, c.name, c.email, c.phone, c.country,
            c.industry_category, c.status, c.estimated_value, c.created_at
     FROM clients c ${where}
     ORDER BY c.created_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

async function fetchLeadPipeline(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [`c.status IN ('LEAD', 'QUALIFIED_LEAD', 'PENDING_COMMITMENT')`];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`c.created_at >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`c.created_at <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.status) { conditions.push(`c.status = $${idx++}`); values.push(filters.status); }
  if (filters.country) { conditions.push(`c.country = $${idx++}`); values.push(filters.country); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const result = await db.query(
    `SELECT c.reference_number, c.name, c.status, c.country, c.industry_category,
            c.estimated_value, c.created_at,
            u.name AS agent_name
     FROM clients c
     LEFT JOIN users u ON u.id = c.agent_id
     ${where}
     ORDER BY c.created_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

async function fetchProjectStatus(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`p.created_at >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`p.created_at <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.status) { conditions.push(`p.status = $${idx++}`); values.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT p.reference_number, c.name AS client_name, p.status,
            p.service_amount, p.currency, p.start_date, p.end_date, p.created_at
     FROM projects p
     JOIN clients c ON c.id = p.client_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

async function fetchPaymentSummary(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`pay.created_at >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`pay.created_at <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.status) { conditions.push(`pay.status = $${idx++}`); values.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT pay.transaction_id, pay.amount, pay.currency, pay.payment_method,
            pay.status, c.name AS client_name, pay.created_at
     FROM payments pay
     LEFT JOIN clients c ON c.id = pay.client_id
     ${where}
     ORDER BY pay.created_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

async function fetchAuditSummary(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`al.created_at >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`al.created_at <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.userId) { conditions.push(`al.user_id = $${idx++}`); values.push(filters.userId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT u.name AS user_name, al.action, al.resource_type, al.resource_id,
            al.result, al.ip_address, al.created_at
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

async function fetchAchievementSummary(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`a.achieved_at >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`a.achieved_at <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.userId) { conditions.push(`a.user_id = $${idx++}`); values.push(filters.userId); }
  if (filters.departmentId) { conditions.push(`u.department_id = $${idx++}`); values.push(filters.departmentId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT u.name AS user_name, d.name AS department_name, u.country,
            a.title, a.description, a.achieved_at
     FROM achievements a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN departments d ON d.id = u.department_id
     ${where}
     ORDER BY a.achieved_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

async function fetchDailyReportCompliance(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`dates.report_date >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`dates.report_date <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.userId) { conditions.push(`u.id = $${idx++}`); values.push(filters.userId); }
  if (filters.departmentId) { conditions.push(`u.department_id = $${idx++}`); values.push(filters.departmentId); }

  // Generate a date series for the last 30 days if no date range specified
  const dateFrom = filters.dateFrom ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = filters.dateTo ?? new Date();

  const result = await db.query(
    `SELECT u.name AS user_name, d.name AS department_name,
            gs.report_date::date AS report_date,
            CASE WHEN dr.id IS NOT NULL THEN 'Yes' ELSE 'No' END AS submitted,
            dr.submitted_at,
            dr.hours_worked
     FROM users u
     CROSS JOIN generate_series($${idx++}::date, $${idx++}::date, '1 day'::interval) AS gs(report_date)
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN daily_reports dr ON dr.user_id = u.id AND dr.report_date = gs.report_date::date
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY gs.report_date DESC, u.name ASC
     LIMIT 10000`,
    [...values, dateFrom, dateTo]
  );
  return result.rows;
}

const DATA_FETCHERS: Record<ReportType, (filters: ReportFilters) => Promise<Record<string, any>[]>> = {
  [ReportType.CLIENT_LIST]: fetchClientList,
  [ReportType.LEAD_PIPELINE]: fetchLeadPipeline,
  [ReportType.PROJECT_STATUS]: fetchProjectStatus,
  [ReportType.PAYMENT_SUMMARY]: fetchPaymentSummary,
  [ReportType.AUDIT_SUMMARY]: fetchAuditSummary,
  [ReportType.ACHIEVEMENT_SUMMARY]: fetchAchievementSummary,
  [ReportType.DAILY_REPORT_COMPLIANCE]: fetchDailyReportCompliance,
};

// ============================================================================
// ReportGenerationService
// ============================================================================

/**
 * Report Generation Service
 * Generates reports in PDF, Excel (XLSX), and CSV formats with metadata.
 * Requirements: 40.1-40.5
 */
export class ReportGenerationService {
  /**
   * Generate report data with metadata.
   * Requirements: 40.2 (apply filters), 40.3 (include metadata)
   */
  async generateReport(
    type: ReportType,
    filters: ReportFilters,
    requestedBy: string
  ): Promise<GeneratedReport> {
    const fetcher = DATA_FETCHERS[type];
    if (!fetcher) {
      throw new Error(`Unknown report type: ${type}`);
    }

    const data = await fetcher(filters);
    const columns = REPORT_COLUMNS[type];

    const metadata: ReportMetadata = {
      reportType: type,
      generatedAt: new Date(),
      generatedBy: requestedBy,
      filtersApplied: filters,
      totalRecords: data.length,
    };

    logger.info('Report generated', { type, requestedBy, totalRecords: data.length });

    return { metadata, data, columns };
  }

  /**
   * Generate CSV string from report data.
   * Requirement 40.1: Support CSV format
   */
  generateCSV(report: GeneratedReport): string {
    const { data, columns, metadata } = report;

    // Metadata header lines
    const metaLines = [
      `# Report Type: ${metadata.reportType}`,
      `# Generated At: ${metadata.generatedAt.toISOString()}`,
      `# Generated By: ${metadata.generatedBy}`,
      `# Filters Applied: ${JSON.stringify(metadata.filtersApplied)}`,
      `# Total Records: ${metadata.totalRecords}`,
      '',
    ];

    const header = columns.map((c) => `"${c.header}"`).join(',');

    const rows = data.map((row) =>
      columns
        .map((col) => {
          const val = row[col.key];
          if (val === null || val === undefined) return '""';
          if (col.type === 'date' && val) {
            const d = val instanceof Date ? val : new Date(val);
            return `"${d.toISOString()}"`;
          }
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );

    return [...metaLines, header, ...rows].join('\n');
  }

  /**
   * Generate Excel (XLSX) buffer from report data.
   * Requirement 40.1: Support Excel format
   * Requirement 40.4: Format with headers, column widths, data types
   */
  async generateExcel(report: GeneratedReport): Promise<Buffer> {
    const { data, columns, metadata } = report;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TechSwiftTrix ERP';
    workbook.created = new Date();

    // Metadata sheet
    const metaSheet = workbook.addWorksheet('Metadata');
    metaSheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 60 },
    ];
    metaSheet.getRow(1).font = { bold: true };
    metaSheet.addRow({ field: 'Report Type', value: metadata.reportType });
    metaSheet.addRow({ field: 'Generated At', value: metadata.generatedAt.toISOString() });
    metaSheet.addRow({ field: 'Generated By', value: metadata.generatedBy });
    metaSheet.addRow({ field: 'Total Records', value: metadata.totalRecords });
    metaSheet.addRow({ field: 'Filters Applied', value: JSON.stringify(metadata.filtersApplied) });

    // Data sheet
    const dataSheet = workbook.addWorksheet('Report Data');

    // Define columns with widths
    dataSheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? 20,
    }));

    // Style header row
    const headerRow = dataSheet.getRow(1);
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows with proper types
    for (const row of data) {
      const rowData: Record<string, any> = {};
      for (const col of columns) {
        const val = row[col.key];
        if (val === null || val === undefined) {
          rowData[col.key] = '';
        } else if (col.type === 'date') {
          rowData[col.key] = val instanceof Date ? val : new Date(val);
        } else if (col.type === 'number' || col.type === 'currency') {
          rowData[col.key] = val !== '' ? Number(val) : 0;
        } else {
          rowData[col.key] = String(val);
        }
      }
      dataSheet.addRow(rowData);
    }

    // Apply number formats
    columns.forEach((col) => {
      if (col.type === 'date') {
        dataSheet.getColumn(col.key).numFmt = 'yyyy-mm-dd hh:mm:ss';
      }
      if (col.type === 'currency') {
        dataSheet.getColumn(col.key).numFmt = '#,##0.00';
      }
    });

    // Freeze header row
    dataSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate PDF buffer from report data using Puppeteer.
   * Requirement 40.1: Support PDF format
   * Requirement 40.5: Include company branding and page numbers
   */
  async generatePDF(report: GeneratedReport): Promise<Buffer> {
    // Lazy-load puppeteer to avoid hard dependency at module load time
    let puppeteer: any;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new Error('puppeteer is not installed. Run: npm install puppeteer');
    }

    const html = this.buildReportHTML(report);
    let browser: any;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size:9px;width:100%;display:flex;align-items:center;justify-content:space-between;padding:0 15mm;color:#666;">
            <span style="font-weight:900;background:linear-gradient(90deg,#1e90ff,#00d4ff,#84cc16);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">TechSwiftTrix ERP</span>
            <span>Confidential</span>
          </div>`,
        footerTemplate: `
          <div style="font-size:9px;width:100%;text-align:center;color:#666;padding:0 15mm;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>`,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Build HTML for a report (used by generatePDF).
   * Requirement 40.5: Company branding and page numbers
   */
  buildReportHTML(report: GeneratedReport): string {
    const { metadata, data, columns } = report;

    const filterStr =
      Object.entries(metadata.filtersApplied)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}: ${v instanceof Date ? v.toISOString() : v}`)
        .join(', ') || 'None';

    const headerCells = columns.map((c) => `<th>${c.header}</th>`).join('');

    const bodyRows = data
      .map((row) => {
        const cells = columns
          .map((col) => {
            const val = row[col.key];
            if (val === null || val === undefined) return '<td></td>';
            if (col.type === 'date' && val) {
              const d = val instanceof Date ? val : new Date(val);
              return `<td>${d.toISOString().replace('T', ' ').substring(0, 19)}</td>`;
            }
            return `<td>${String(val)}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 0; }
  .tst-header { background: linear-gradient(135deg, #0a1628 0%, #0d2040 100%); color: white; padding: 16px 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 14px; }
  .tst-emblem { width: 44px; height: 44px; border-radius: 8px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(30,144,255,0.4); flex-shrink: 0; }
  .tst-emblem span { font-family: Arial Black, Arial, sans-serif; font-weight: 900; font-size: 14px; background: linear-gradient(90deg, #1e90ff, #00d4ff, #84cc16); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .tst-brand-name { font-size: 15px; font-weight: 900; background: linear-gradient(90deg, #1e90ff, #00d4ff, #84cc16); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .tst-brand-sub { font-size: 9px; color: rgba(255,255,255,0.5); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
  .tst-report-title { margin-left: auto; text-align: right; }
  .tst-report-title h1 { margin: 0; font-size: 14px; color: white; }
  .tst-report-title p { margin: 3px 0 0; font-size: 10px; color: rgba(255,255,255,0.6); }
  .meta { margin-bottom: 12px; font-size: 10px; color: #555; padding: 8px 12px; background: #f8fafc; border-left: 3px solid #1e90ff; }
  .meta span { margin-right: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: linear-gradient(90deg, #0a1628, #1e3a5f); color: white; padding: 7px 8px; text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  .tst-footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #aaa; }
</style>
</head>
<body>
<div class="tst-header">
  <div class="tst-emblem"><span>TST</span></div>
  <div>
    <div class="tst-brand-name">TechSwiftTrix</div>
    <div class="tst-brand-sub">Web · Mobile · Solutions</div>
  </div>
  <div class="tst-report-title">
    <h1>${metadata.reportType.replace(/_/g, ' ')}</h1>
    <p>TechSwiftTrix ERP System</p>
  </div>
</div>
<div class="meta">
  <span>Generated: ${metadata.generatedAt.toISOString().replace('T', ' ').substring(0, 19)} UTC</span>
  <span>Generated By: ${metadata.generatedBy}</span>
  <span>Records: ${metadata.totalRecords}</span>
  <span>Filters: ${filterStr}</span>
</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="tst-footer">TechSwiftTrix ERP &nbsp;·&nbsp; Confidential &nbsp;·&nbsp; Page <span class="pageNumber"></span></div>
</body>
</html>`;
  }
}

export const reportGenerationService = new ReportGenerationService();
export default reportGenerationService;
