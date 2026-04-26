import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import { db } from '../database/connection';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportType =
  | 'CLIENTS'
  | 'PROJECTS'
  | 'PAYMENTS'
  | 'CONTRACTS'
  | 'DAILY_REPORTS'
  | 'PROPERTY_LISTINGS';

export interface ColumnDefinition {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'currency';
}

export interface ReportTypeDefinition {
  type: ReportType;
  title: string;
  description: string;
  columns: ColumnDefinition[];
}

export interface ReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  country?: string;
  userId?: string;
  [key: string]: any;
}

export interface ReportMetadata {
  reportType: ReportType;
  generatedAt: Date;
  generatedBy: string;
  filters: ReportFilters;
  totalRecords: number;
}

export interface GeneratedReport {
  metadata: ReportMetadata;
  data: Record<string, any>[];
}

// ─── Report type definitions ──────────────────────────────────────────────────

const REPORT_TYPES: ReportTypeDefinition[] = [
  {
    type: 'CLIENTS',
    title: 'Clients Report',
    description: 'List of all clients with their status and details',
    columns: [
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
  },
  {
    type: 'PROJECTS',
    title: 'Projects Report',
    description: 'List of all projects with their status and financial details',
    columns: [
      { key: 'reference_number', header: 'Reference', width: 22 },
      { key: 'client_name', header: 'Client', width: 30 },
      { key: 'status', header: 'Status', width: 20 },
      { key: 'service_amount', header: 'Service Amount', width: 18, type: 'currency' },
      { key: 'currency', header: 'Currency', width: 12 },
      { key: 'start_date', header: 'Start Date', width: 16, type: 'date' },
      { key: 'end_date', header: 'End Date', width: 16, type: 'date' },
      { key: 'created_at', header: 'Created At', width: 22, type: 'date' },
    ],
  },
  {
    type: 'PAYMENTS',
    title: 'Payments Report',
    description: 'List of all payment transactions',
    columns: [
      { key: 'transaction_id', header: 'Transaction ID', width: 30 },
      { key: 'amount', header: 'Amount', width: 16, type: 'currency' },
      { key: 'currency', header: 'Currency', width: 12 },
      { key: 'payment_method', header: 'Method', width: 18 },
      { key: 'status', header: 'Status', width: 16 },
      { key: 'client_name', header: 'Client', width: 30 },
      { key: 'created_at', header: 'Date', width: 22, type: 'date' },
    ],
  },
  {
    type: 'CONTRACTS',
    title: 'Contracts Report',
    description: 'List of all contracts with their versions and status',
    columns: [
      { key: 'reference_number', header: 'Reference', width: 22 },
      { key: 'project_reference', header: 'Project', width: 22 },
      { key: 'client_name', header: 'Client', width: 30 },
      { key: 'version', header: 'Version', width: 10, type: 'number' },
      { key: 'status', header: 'Status', width: 16 },
      { key: 'created_by_name', header: 'Created By', width: 25 },
      { key: 'created_at', header: 'Created At', width: 22, type: 'date' },
    ],
  },
  {
    type: 'DAILY_REPORTS',
    title: 'Daily Reports',
    description: 'Daily activity reports submitted by users',
    columns: [
      { key: 'user_name', header: 'User', width: 25 },
      { key: 'report_date', header: 'Date', width: 16, type: 'date' },
      { key: 'accomplishments', header: 'Accomplishments', width: 50 },
      { key: 'challenges', header: 'Challenges', width: 40 },
      { key: 'tomorrow_plan', header: 'Tomorrow Plan', width: 40 },
      { key: 'hours_worked', header: 'Hours Worked', width: 14, type: 'number' },
      { key: 'submitted_at', header: 'Submitted At', width: 22, type: 'date' },
    ],
  },
  {
    type: 'PROPERTY_LISTINGS',
    title: 'Property Listings Report',
    description: 'List of all property listings with their details',
    columns: [
      { key: 'reference_number', header: 'Reference', width: 22 },
      { key: 'title', header: 'Title', width: 35 },
      { key: 'location', header: 'Location', width: 30 },
      { key: 'country', header: 'Country', width: 20 },
      { key: 'property_type', header: 'Type', width: 18 },
      { key: 'price', header: 'Price', width: 16, type: 'currency' },
      { key: 'currency', header: 'Currency', width: 12 },
      { key: 'status', header: 'Status', width: 16 },
      { key: 'view_count', header: 'Views', width: 10, type: 'number' },
      { key: 'created_at', header: 'Created At', width: 22, type: 'date' },
    ],
  },
];

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchClients(filters: ReportFilters): Promise<Record<string, any>[]> {
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

async function fetchProjects(filters: ReportFilters): Promise<Record<string, any>[]> {
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

async function fetchPayments(filters: ReportFilters): Promise<Record<string, any>[]> {
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

async function fetchContracts(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`con.created_at >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`con.created_at <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.status) { conditions.push(`con.status = $${idx++}`); values.push(filters.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT con.reference_number, p.reference_number AS project_reference,
            c.name AS client_name, con.version, con.status,
            u.full_name AS created_by_name, con.created_at
     FROM contracts con
     JOIN projects p ON p.id = con.project_id
     JOIN clients c ON c.id = p.client_id
     JOIN users u ON u.id = con.created_by
     ${where}
     ORDER BY con.created_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

async function fetchDailyReports(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`dr.report_date >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`dr.report_date <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.userId) { conditions.push(`dr.user_id = $${idx++}`); values.push(filters.userId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT u.full_name AS user_name, dr.report_date, dr.accomplishments,
            dr.challenges, dr.tomorrow_plan, dr.hours_worked, dr.submitted_at
     FROM daily_reports dr
     JOIN users u ON u.id = dr.user_id
     ${where}
     ORDER BY dr.report_date DESC, dr.submitted_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

async function fetchPropertyListings(filters: ReportFilters): Promise<Record<string, any>[]> {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (filters.dateFrom) { conditions.push(`pl.created_at >= $${idx++}`); values.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push(`pl.created_at <= $${idx++}`); values.push(filters.dateTo); }
  if (filters.status) { conditions.push(`pl.status = $${idx++}`); values.push(filters.status); }
  if (filters.country) { conditions.push(`pl.country = $${idx++}`); values.push(filters.country); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT pl.reference_number, pl.title, pl.location, pl.country,
            pl.property_type, pl.price, pl.currency, pl.status, pl.view_count, pl.created_at
     FROM property_listings pl
     ${where}
     ORDER BY pl.created_at DESC
     LIMIT 10000`,
    values
  );
  return result.rows;
}

const DATA_FETCHERS: Record<ReportType, (filters: ReportFilters) => Promise<Record<string, any>[]>> = {
  CLIENTS: fetchClients,
  PROJECTS: fetchProjects,
  PAYMENTS: fetchPayments,
  CONTRACTS: fetchContracts,
  DAILY_REPORTS: fetchDailyReports,
  PROPERTY_LISTINGS: fetchPropertyListings,
};

// ─── ReportingService ─────────────────────────────────────────────────────────

/**
 * Reporting Service
 * Generates reports in PDF, Excel (XLSX), and CSV formats
 * Requirements: 40.1-40.5
 */
export class ReportingService {
  /**
   * List all available report types
   * Requirement 40.1
   */
  getReportTypes(): ReportTypeDefinition[] {
    return REPORT_TYPES;
  }

  /**
   * Generate a report with data and metadata
   * Requirement 40.2: Apply current filters
   * Requirement 40.3: Include metadata
   */
  async generateReport(
    type: ReportType,
    filters: ReportFilters,
    userId: string
  ): Promise<GeneratedReport> {
    const fetcher = DATA_FETCHERS[type];
    if (!fetcher) {
      throw new Error(`Unknown report type: ${type}`);
    }

    const data = await fetcher(filters);

    const metadata: ReportMetadata = {
      reportType: type,
      generatedAt: new Date(),
      generatedBy: userId,
      filters,
      totalRecords: data.length,
    };

    logger.info('Report generated', { type, userId, totalRecords: data.length });

    return { metadata, data };
  }

  /**
   * Generate CSV string from data
   * Requirement 40.1: Support CSV format
   */
  generateCSV(data: Record<string, any>[], columns: ColumnDefinition[]): string {
    const header = columns.map((c) => `"${c.header}"`).join(',');

    const rows = data.map((row) => {
      return columns
        .map((col) => {
          const val = row[col.key];
          if (val === null || val === undefined) return '""';
          if (col.type === 'date' && val instanceof Date) {
            return `"${val.toISOString()}"`;
          }
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Generate Excel (XLSX) buffer from data
   * Requirement 40.1: Support Excel format
   * Requirement 40.4: Format with headers, column widths, data types
   */
  async generateExcel(
    data: Record<string, any>[],
    columns: ColumnDefinition[],
    metadata: ReportMetadata,
    sheetName = 'Report'
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TechSwiftTrix ERP';
    workbook.created = new Date();

    // Metadata sheet
    const metaSheet = workbook.addWorksheet('Metadata');
    metaSheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 50 },
    ];
    metaSheet.addRow({ field: 'Report Type', value: metadata.reportType });
    metaSheet.addRow({ field: 'Generated At', value: metadata.generatedAt.toISOString() });
    metaSheet.addRow({ field: 'Generated By', value: metadata.generatedBy });
    metaSheet.addRow({ field: 'Total Records', value: metadata.totalRecords });
    metaSheet.addRow({ field: 'Filters Applied', value: JSON.stringify(metadata.filters) });

    // Style metadata header row
    metaSheet.getRow(1).font = { bold: true };

    // Data sheet
    const dataSheet = workbook.addWorksheet(sheetName);

    // Define columns with widths
    dataSheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? 20,
    }));

    // Style header row
    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true };
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

    // Format date columns
    columns.forEach((col) => {
      if (col.type === 'date') {
        const colObj = dataSheet.getColumn(col.key);
        colObj.numFmt = 'yyyy-mm-dd hh:mm:ss';
      }
      if (col.type === 'currency') {
        const colObj = dataSheet.getColumn(col.key);
        colObj.numFmt = '#,##0.00';
      }
    });

    // Freeze header row
    dataSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate PDF buffer from HTML
   * Requirement 40.1: Support PDF format
   * Requirement 40.5: Include company branding and page numbers
   */
  async generatePDF(html: string): Promise<Buffer> {
    let browser;
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
          <div style="font-size:9px;width:100%;text-align:center;color:#666;padding:0 15mm;">
            TechSwiftTrix ERP System
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
   * Build HTML for a report (used by generatePDF)
   */
  buildReportHTML(report: GeneratedReport, columns: ColumnDefinition[]): string {
    const { metadata, data } = report;
    const typeDef = REPORT_TYPES.find((t) => t.type === metadata.reportType);
    const title = typeDef?.title ?? metadata.reportType;

    const filterStr = Object.entries(metadata.filters)
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
  body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
  .header { background: #1F4E79; color: white; padding: 16px 20px; margin-bottom: 16px; }
  .header h1 { margin: 0; font-size: 18px; }
  .meta { margin-bottom: 16px; font-size: 10px; color: #555; }
  .meta span { margin-right: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #1F4E79; color: white; padding: 6px 8px; text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
  tr:nth-child(even) { background: #f5f5f5; }
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
</div>
<div class="meta">
  <span>Generated: ${metadata.generatedAt.toISOString().replace('T', ' ').substring(0, 19)} UTC</span>
  <span>Records: ${metadata.totalRecords}</span>
  <span>Filters: ${filterStr}</span>
</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;
  }
}

export const reportingService = new ReportingService();
export default reportingService;
