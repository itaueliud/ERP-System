import { ComplianceService, ComplianceReport } from './complianceService';

describe('ComplianceService', () => {
  let service: ComplianceService;

  beforeEach(() => {
    service = new ComplianceService();
  });

  // Helper to create a base report
  function makeReport(overrides: Partial<ComplianceReport> = {}): ComplianceReport {
    return {
      id: 'report-001',
      type: 'Tax_Reports',
      country: 'US',
      period: '2024-Q2',
      frequency: 'quarterly',
      status: 'pending',
      dueDate: new Date('2024-07-01T00:00:00Z'),
      ...overrides,
    };
  }

  // 1. createReport
  describe('createReport', () => {
    it('creates a report with pending status', () => {
      const dueDate = new Date('2024-07-01T00:00:00Z');
      const report = service.createReport('Tax_Reports', 'US', '2024-Q2', 'quarterly', dueDate);
      expect(report.status).toBe('pending');
    });

    it('sets correct fields on the created report', () => {
      const dueDate = new Date('2024-07-01T00:00:00Z');
      const report = service.createReport('Financial_Statements', 'DE', '2024-06', 'monthly', dueDate);
      expect(report.type).toBe('Financial_Statements');
      expect(report.country).toBe('DE');
      expect(report.period).toBe('2024-06');
      expect(report.frequency).toBe('monthly');
      expect(report.dueDate).toEqual(dueDate);
    });

    it('generates a unique id', () => {
      const dueDate = new Date('2024-07-01T00:00:00Z');
      const r1 = service.createReport('Tax_Reports', 'US', '2024-Q2', 'quarterly', dueDate);
      const r2 = service.createReport('Tax_Reports', 'US', '2024-Q2', 'quarterly', dueDate);
      expect(r1.id).not.toBe(r2.id);
    });

    it('does not set optional fields', () => {
      const dueDate = new Date('2024-07-01T00:00:00Z');
      const report = service.createReport('Tax_Reports', 'US', '2024-Q2', 'quarterly', dueDate);
      expect(report.generatedAt).toBeUndefined();
      expect(report.encryptedFilePath).toBeUndefined();
      expect(report.checksum).toBeUndefined();
      expect(report.submittedAt).toBeUndefined();
    });
  });

  // 2. markGenerating
  describe('markGenerating', () => {
    it('sets status to generating', () => {
      const report = makeReport({ status: 'pending' });
      const updated = service.markGenerating(report);
      expect(updated.status).toBe('generating');
    });

    it('does not mutate the original report', () => {
      const report = makeReport({ status: 'pending' });
      service.markGenerating(report);
      expect(report.status).toBe('pending');
    });
  });

  // 3. completeReport
  describe('completeReport', () => {
    it('sets status to completed', () => {
      const report = makeReport({ status: 'generating' });
      const updated = service.completeReport(report, 'encrypted://report-001/file.pdf', 'abc123');
      expect(updated.status).toBe('completed');
    });

    it('sets encryptedFilePath and checksum', () => {
      const report = makeReport({ status: 'generating' });
      const updated = service.completeReport(report, 'encrypted://report-001/file.pdf', 'abc123');
      expect(updated.encryptedFilePath).toBe('encrypted://report-001/file.pdf');
      expect(updated.checksum).toBe('abc123');
    });

    it('sets generatedAt to a Date', () => {
      const report = makeReport({ status: 'generating' });
      const updated = service.completeReport(report, 'encrypted://report-001/file.pdf', 'abc123');
      expect(updated.generatedAt).toBeInstanceOf(Date);
    });
  });

  // 4. submitReport
  describe('submitReport', () => {
    it('sets status to submitted', () => {
      const report = makeReport({ status: 'completed' });
      const updated = service.submitReport(report);
      expect(updated.status).toBe('submitted');
    });

    it('sets submittedAt to a Date', () => {
      const report = makeReport({ status: 'completed' });
      const updated = service.submitReport(report);
      expect(updated.submittedAt).toBeInstanceOf(Date);
    });
  });

  // 5. failReport
  describe('failReport', () => {
    it('sets status to failed', () => {
      const report = makeReport({ status: 'generating' });
      const updated = service.failReport(report, 'Generation error');
      expect(updated.status).toBe('failed');
    });

    it('does not mutate the original report', () => {
      const report = makeReport({ status: 'generating' });
      service.failReport(report, 'error');
      expect(report.status).toBe('generating');
    });
  });

  // 6. getNextDueDate
  describe('getNextDueDate', () => {
    it('adds 1 month for monthly frequency', () => {
      const from = new Date('2024-01-15T00:00:00Z');
      const next = service.getNextDueDate('monthly', from);
      expect(next.getMonth()).toBe(1); // February
      expect(next.getFullYear()).toBe(2024);
    });

    it('adds 3 months for quarterly frequency', () => {
      const from = new Date('2024-01-15T00:00:00Z');
      const next = service.getNextDueDate('quarterly', from);
      expect(next.getMonth()).toBe(3); // April
      expect(next.getFullYear()).toBe(2024);
    });

    it('adds 1 year for annually frequency', () => {
      const from = new Date('2024-06-15T00:00:00Z');
      const next = service.getNextDueDate('annually', from);
      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(5); // June
    });

    it('does not mutate the input date', () => {
      const from = new Date('2024-01-15T00:00:00Z');
      const original = from.getTime();
      service.getNextDueDate('monthly', from);
      expect(from.getTime()).toBe(original);
    });
  });

  // 7. isOverdue
  describe('isOverdue', () => {
    it('returns true when past due and not submitted', () => {
      const report = makeReport({
        status: 'pending',
        dueDate: new Date('2024-06-01T00:00:00Z'),
      });
      const now = new Date('2024-06-15T00:00:00Z');
      expect(service.isOverdue(report, now)).toBe(true);
    });

    it('returns false when submitted even if past due', () => {
      const report = makeReport({
        status: 'submitted',
        dueDate: new Date('2024-06-01T00:00:00Z'),
      });
      const now = new Date('2024-06-15T00:00:00Z');
      expect(service.isOverdue(report, now)).toBe(false);
    });

    it('returns false when due date is in the future', () => {
      const report = makeReport({
        status: 'pending',
        dueDate: new Date('2024-07-01T00:00:00Z'),
      });
      const now = new Date('2024-06-15T00:00:00Z');
      expect(service.isOverdue(report, now)).toBe(false);
    });
  });

  // 8. encryptReportPath
  describe('encryptReportPath', () => {
    it('returns encrypted:// format with reportId and filePath', () => {
      const result = service.encryptReportPath('reports/tax-2024.pdf', 'report-001');
      expect(result).toBe('encrypted://report-001/reports/tax-2024.pdf');
    });

    it('includes the reportId in the path', () => {
      const result = service.encryptReportPath('file.pdf', 'my-report-id');
      expect(result).toContain('my-report-id');
    });

    it('starts with encrypted://', () => {
      const result = service.encryptReportPath('file.pdf', 'report-001');
      expect(result.startsWith('encrypted://')).toBe(true);
    });
  });

  // 9. logAuditEntry
  describe('logAuditEntry', () => {
    it('creates audit entry with correct reportId', () => {
      const entry = service.logAuditEntry('report-001', 'created', 'Report created');
      expect(entry.reportId).toBe('report-001');
    });

    it('creates audit entry with correct action', () => {
      const entry = service.logAuditEntry('report-001', 'submitted', 'Submitted to authority');
      expect(entry.action).toBe('submitted');
    });

    it('creates audit entry with correct details', () => {
      const entry = service.logAuditEntry('report-001', 'failed', 'Generation failed');
      expect(entry.details).toBe('Generation failed');
    });

    it('sets timestamp to a Date', () => {
      const entry = service.logAuditEntry('report-001', 'completed', 'Done');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('generates a unique id', () => {
      const e1 = service.logAuditEntry('report-001', 'created', 'a');
      const e2 = service.logAuditEntry('report-001', 'created', 'a');
      expect(e1.id).not.toBe(e2.id);
    });
  });

  // 10. getUpcomingDeadlines
  describe('getUpcomingDeadlines', () => {
    it('returns reports due within 7 days', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const reports: ComplianceReport[] = [
        makeReport({ id: 'r1', dueDate: new Date('2024-06-20T00:00:00Z'), status: 'pending' }),
        makeReport({ id: 'r2', dueDate: new Date('2024-06-25T00:00:00Z'), status: 'pending' }),
        makeReport({ id: 'r3', dueDate: new Date('2024-07-01T00:00:00Z'), status: 'pending' }),
      ];
      const upcoming = service.getUpcomingDeadlines(reports, now, 7);
      expect(upcoming.map((r) => r.id)).toContain('r1');
      expect(upcoming.map((r) => r.id)).not.toContain('r3');
    });

    it('excludes submitted reports', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const reports: ComplianceReport[] = [
        makeReport({ id: 'r1', dueDate: new Date('2024-06-20T00:00:00Z'), status: 'submitted' }),
        makeReport({ id: 'r2', dueDate: new Date('2024-06-20T00:00:00Z'), status: 'pending' }),
      ];
      const upcoming = service.getUpcomingDeadlines(reports, now, 7);
      expect(upcoming.map((r) => r.id)).not.toContain('r1');
      expect(upcoming.map((r) => r.id)).toContain('r2');
    });

    it('returns empty array when no reports are due soon', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const reports: ComplianceReport[] = [
        makeReport({ id: 'r1', dueDate: new Date('2024-07-01T00:00:00Z'), status: 'pending' }),
      ];
      const upcoming = service.getUpcomingDeadlines(reports, now, 7);
      expect(upcoming).toHaveLength(0);
    });
  });

  // 11. isAlertDue
  describe('isAlertDue', () => {
    it('returns true when within alert window', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const report = makeReport({
        status: 'pending',
        dueDate: new Date('2024-06-20T00:00:00Z'),
      });
      expect(service.isAlertDue(report, now, 7)).toBe(true);
    });

    it('returns false when submitted', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const report = makeReport({
        status: 'submitted',
        dueDate: new Date('2024-06-20T00:00:00Z'),
      });
      expect(service.isAlertDue(report, now, 7)).toBe(false);
    });

    it('returns false when due date is outside alert window', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const report = makeReport({
        status: 'pending',
        dueDate: new Date('2024-07-01T00:00:00Z'),
      });
      expect(service.isAlertDue(report, now, 7)).toBe(false);
    });
  });

  // 12. getOverdueReports
  describe('getOverdueReports', () => {
    it('returns only overdue unsubmitted reports', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const reports: ComplianceReport[] = [
        makeReport({ id: 'r1', dueDate: new Date('2024-06-01T00:00:00Z'), status: 'pending' }),
        makeReport({ id: 'r2', dueDate: new Date('2024-06-01T00:00:00Z'), status: 'submitted' }),
        makeReport({ id: 'r3', dueDate: new Date('2024-07-01T00:00:00Z'), status: 'pending' }),
      ];
      const overdue = service.getOverdueReports(reports, now);
      expect(overdue).toHaveLength(1);
      expect(overdue[0].id).toBe('r1');
    });

    it('returns empty array when no reports are overdue', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const reports: ComplianceReport[] = [
        makeReport({ id: 'r1', dueDate: new Date('2024-07-01T00:00:00Z'), status: 'pending' }),
      ];
      const overdue = service.getOverdueReports(reports, now);
      expect(overdue).toHaveLength(0);
    });

    it('returns multiple overdue reports', () => {
      const now = new Date('2024-06-15T00:00:00Z');
      const reports: ComplianceReport[] = [
        makeReport({ id: 'r1', dueDate: new Date('2024-05-01T00:00:00Z'), status: 'pending' }),
        makeReport({ id: 'r2', dueDate: new Date('2024-06-01T00:00:00Z'), status: 'failed' }),
        makeReport({ id: 'r3', dueDate: new Date('2024-07-01T00:00:00Z'), status: 'pending' }),
      ];
      const overdue = service.getOverdueReports(reports, now);
      expect(overdue).toHaveLength(2);
      expect(overdue.map((r) => r.id)).toContain('r1');
      expect(overdue.map((r) => r.id)).toContain('r2');
    });
  });
});
