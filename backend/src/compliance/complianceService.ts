export type ComplianceReportType =
  | 'Tax_Reports'
  | 'Financial_Statements'
  | 'Employee_Records'
  | 'Transaction_Logs';

export type ComplianceFrequency = 'monthly' | 'quarterly' | 'annually';

export type ComplianceStatus =
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'submitted';

export interface ComplianceReport {
  id: string;
  type: ComplianceReportType;
  country: string;
  period: string;
  frequency: ComplianceFrequency;
  status: ComplianceStatus;
  generatedAt?: Date;
  encryptedFilePath?: string;
  checksum?: string;
  submittedAt?: Date;
  dueDate: Date;
}

export interface ComplianceAuditEntry {
  id: string;
  reportId: string;
  action: 'created' | 'generating' | 'completed' | 'submitted' | 'failed';
  timestamp: Date;
  details: string;
}

export interface ComplianceTemplate {
  id: string;
  type: ComplianceReportType;
  country: string;
  fields: string[];
  frequency: ComplianceFrequency;
  lastUpdated: Date;
}

export class ComplianceService {
  createReport(
    type: ComplianceReportType,
    country: string,
    period: string,
    frequency: ComplianceFrequency,
    dueDate: Date,
  ): ComplianceReport {
    return {
      id: `compliance-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      country,
      period,
      frequency,
      status: 'pending',
      dueDate,
    };
  }

  markGenerating(report: ComplianceReport): ComplianceReport {
    return { ...report, status: 'generating' };
  }

  completeReport(
    report: ComplianceReport,
    encryptedFilePath: string,
    checksum: string,
  ): ComplianceReport {
    return {
      ...report,
      status: 'completed',
      generatedAt: new Date(),
      encryptedFilePath,
      checksum,
    };
  }

  submitReport(report: ComplianceReport): ComplianceReport {
    return { ...report, status: 'submitted', submittedAt: new Date() };
  }

  failReport(report: ComplianceReport, _reason: string): ComplianceReport {
    return { ...report, status: 'failed' };
  }

  getNextDueDate(frequency: ComplianceFrequency, fromDate: Date): Date {
    const next = new Date(fromDate);
    if (frequency === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else if (frequency === 'quarterly') {
      next.setMonth(next.getMonth() + 3);
    } else {
      next.setFullYear(next.getFullYear() + 1);
    }
    return next;
  }

  isOverdue(report: ComplianceReport, now: Date): boolean {
    return report.status !== 'submitted' && report.dueDate < now;
  }

  encryptReportPath(filePath: string, reportId: string): string {
    return `encrypted://${reportId}/${filePath}`;
  }

  logAuditEntry(
    reportId: string,
    action: ComplianceAuditEntry['action'],
    details: string,
  ): ComplianceAuditEntry {
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      reportId,
      action,
      timestamp: new Date(),
      details,
    };
  }

  getUpcomingDeadlines(
    reports: ComplianceReport[],
    now: Date,
    alertDaysAhead: number,
  ): ComplianceReport[] {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + alertDaysAhead);
    return reports.filter(
      (r) => r.status !== 'submitted' && r.dueDate >= now && r.dueDate <= cutoff,
    );
  }

  isAlertDue(report: ComplianceReport, now: Date, alertDaysAhead: number): boolean {
    if (report.status === 'submitted') return false;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + alertDaysAhead);
    return report.dueDate >= now && report.dueDate <= cutoff;
  }

  getOverdueReports(reports: ComplianceReport[], now: Date): ComplianceReport[] {
    return reports.filter((r) => this.isOverdue(r, now));
  }
}
