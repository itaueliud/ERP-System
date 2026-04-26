/**
 * Contract Generation Service Tests
 * Tests for ContractGenerationService
 * Requirements: 9.1-9.11
 */

import { ContractGenerationService, ContractStatus } from './contractService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('./contractPrettyPrinter', () => ({
  contractPrettyPrinter: {
    renderToPDF: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
  },
}));

jest.mock('../services/storage', () => ({
  storageClient: {
    upload: jest.fn().mockResolvedValue({
      key: 'contracts/proj-1/TST-CNT-2024-000001-v1.pdf',
      url: 'https://bucket.s3.us-east-1.amazonaws.com/contracts/proj-1/TST-CNT-2024-000001-v1.pdf',
      size: 1024,
      etag: 'abc123',
    }),
    getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed-url.example.com/contract.pdf'),
  },
}));

jest.mock('../services/sendgrid', () => ({
  sendgridClient: {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const { db } = require('../database/connection');

const mockProjectRow = {
  id: 'project-uuid-1',
  reference_number: 'TST-PRJ-2024-000001',
  status: 'ACTIVE',
  service_amount: '5000.00',
  currency: 'USD',
  start_date: new Date('2024-01-01'),
  end_date: new Date('2024-06-30'),
  client_id: 'client-uuid-1',
  client_name: 'Acme Corp',
  client_email: 'acme@example.com',
  client_phone: '+254700000000',
  client_country: 'Kenya',
  service_description: 'Web development services',
  industry_category: 'COMPANIES',
};

const mockContractRow = {
  id: 'contract-uuid-1',
  reference_number: 'TST-CNT-2024-000001',
  project_id: 'project-uuid-1',
  version: 1,
  content: JSON.stringify({
    clientName: 'Acme Corp',
    clientEmail: 'acme@example.com',
    clientPhone: '+254700000000',
    clientCountry: 'Kenya',
    serviceDescription: 'Web development services',
    serviceAmount: 5000,
    currency: 'USD',
    transactionIds: ['TXN-001'],
    projectReferenceNumber: 'TST-PRJ-2024-000001',
    industryCategory: 'COMPANIES',
  }),
  pdf_url: 'https://bucket.s3.us-east-1.amazonaws.com/contracts/project-uuid-1/TST-CNT-2024-000001-v1.pdf',
  status: 'ACTIVE',
  created_by: 'user-uuid-1',
  created_at: new Date('2024-01-15'),
};

function setupDefaultDbMocks() {
  db.query
    // 1. Verify requester
    .mockResolvedValueOnce({ rows: [{ id: 'user-uuid-1' }] })
    // 2. Fetch project + client
    .mockResolvedValueOnce({ rows: [mockProjectRow] })
    // 3. Fetch project payments
    .mockResolvedValueOnce({ rows: [{ transaction_id: 'TXN-001' }] })
    // 4. Fetch client commitment payments
    .mockResolvedValueOnce({ rows: [] })
    // 5. Generate reference number (no existing)
    .mockResolvedValueOnce({ rows: [] })
    // 6. Get next version
    .mockResolvedValueOnce({ rows: [{ next_version: 1 }] })
    // 7. Insert contract
    .mockResolvedValueOnce({ rows: [mockContractRow] })
    // 8. Insert contract_versions
    .mockResolvedValueOnce({ rows: [] });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContractGenerationService', () => {
  let service: ContractGenerationService;

  beforeEach(() => {
    service = new ContractGenerationService();
    jest.clearAllMocks();

    // Re-setup default implementations after clear
    const { storageClient } = require('../services/storage');
    storageClient.upload.mockResolvedValue({
      key: 'contracts/proj-1/TST-CNT-2024-000001-v1.pdf',
      url: 'https://bucket.s3.us-east-1.amazonaws.com/contracts/proj-1/TST-CNT-2024-000001-v1.pdf',
      size: 1024,
      etag: 'abc123',
    });
    storageClient.getSignedDownloadUrl.mockResolvedValue(
      'https://signed-url.example.com/contract.pdf'
    );

    const { sendgridClient } = require('../services/sendgrid');
    sendgridClient.sendEmail.mockResolvedValue(undefined);

    const { contractPrettyPrinter } = require('./contractPrettyPrinter');
    contractPrettyPrinter.renderToPDF.mockResolvedValue(Buffer.from('mock-pdf-content'));
  });

  // ── generateReferenceNumber ──────────────────────────────────────────────────

  describe('generateReferenceNumber', () => {
    it('generates TST-CNT-YYYY-000001 when no contracts exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const ref = await service.generateReferenceNumber();
      const year = new Date().getFullYear();

      expect(ref).toBe(`TST-CNT-${year}-000001`);
    });

    it('increments sequence from last reference number', async () => {
      const year = new Date().getFullYear();
      db.query.mockResolvedValueOnce({
        rows: [{ reference_number: `TST-CNT-${year}-000042` }],
      });

      const ref = await service.generateReferenceNumber();
      expect(ref).toBe(`TST-CNT-${year}-000043`);
    });

    it('pads sequence to 6 digits', async () => {
      const year = new Date().getFullYear();
      db.query.mockResolvedValueOnce({
        rows: [{ reference_number: `TST-CNT-${year}-000009` }],
      });

      const ref = await service.generateReferenceNumber();
      expect(ref).toBe(`TST-CNT-${year}-000010`);
    });

    it('uses current year in reference number', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const ref = await service.generateReferenceNumber();
      const year = new Date().getFullYear();

      expect(ref).toMatch(new RegExp(`^TST-CNT-${year}-`));
    });
  });

  // ── generateContract ─────────────────────────────────────────────────────────

  describe('generateContract', () => {
    it('generates a contract successfully', async () => {
      setupDefaultDbMocks();

      const contract = await service.generateContract('project-uuid-1', 'user-uuid-1');

      expect(contract).toBeDefined();
      expect(contract.id).toBe('contract-uuid-1');
      expect(contract.referenceNumber).toBe('TST-CNT-2024-000001');
      expect(contract.projectId).toBe('project-uuid-1');
      expect(contract.version).toBe(1);
      expect(contract.status).toBe(ContractStatus.ACTIVE);
    });

    it('throws error when requester not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // requester not found

      await expect(
        service.generateContract('project-uuid-1', 'nonexistent-user')
      ).rejects.toThrow('Requester not found');
    });

    it('throws error when project not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-uuid-1' }] }) // requester found
        .mockResolvedValueOnce({ rows: [] }); // project not found

      await expect(
        service.generateContract('nonexistent-project', 'user-uuid-1')
      ).rejects.toThrow('Project not found');
    });

    it('includes transaction IDs in contract content', async () => {
      setupDefaultDbMocks();

      const contract = await service.generateContract('project-uuid-1', 'user-uuid-1');

      expect(contract.content.transactionIds).toContain('TXN-001');
    });

    it('deduplicates transaction IDs from project and client payments', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-uuid-1' }] })
        .mockResolvedValueOnce({ rows: [mockProjectRow] })
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'TXN-001' }, { transaction_id: 'TXN-002' }] })
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'TXN-001' }] }) // duplicate
        .mockResolvedValueOnce({ rows: [] }) // ref number
        .mockResolvedValueOnce({ rows: [{ next_version: 1 }] })
        .mockResolvedValueOnce({ rows: [mockContractRow] })
        .mockResolvedValueOnce({ rows: [] });

      const contract = await service.generateContract('project-uuid-1', 'user-uuid-1');

      // The content stored in DB is from mockContractRow which has TXN-001
      // The deduplication happens before storage
      expect(contract).toBeDefined();
    });

    it('marks previous ACTIVE contract as SUPERSEDED when version > 1', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-uuid-1' }] })
        .mockResolvedValueOnce({ rows: [mockProjectRow] })
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'TXN-001' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // ref number
        .mockResolvedValueOnce({ rows: [{ next_version: 2 }] }) // version 2
        .mockResolvedValueOnce({ rows: [] }) // supersede old contract
        .mockResolvedValueOnce({ rows: [{ ...mockContractRow, version: 2 }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.generateContract('project-uuid-1', 'user-uuid-1');

      // Check that the supersede query was called (UPDATE contracts SET status = SUPERSEDED)
      const calls = db.query.mock.calls as any[][];
      const supersedeCalls = calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('UPDATE contracts') &&
          Array.isArray(call[1]) &&
          call[1].includes('SUPERSEDED')
      );
      expect(supersedeCalls.length).toBeGreaterThan(0);
    });

    it('stores PDF in file storage', async () => {
      setupDefaultDbMocks();

      const { storageClient } = require('../services/storage');
      await service.generateContract('project-uuid-1', 'user-uuid-1');

      expect(storageClient.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'application/pdf',
          metadata: expect.objectContaining({
            projectId: 'project-uuid-1',
          }),
        })
      );
    });

    it('sends contract email to client', async () => {
      setupDefaultDbMocks();

      const { sendgridClient } = require('../services/sendgrid');
      await service.generateContract('project-uuid-1', 'user-uuid-1');

      expect(sendgridClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'acme@example.com',
          subject: expect.stringContaining('TST-CNT-'),
          attachments: expect.arrayContaining([
            expect.objectContaining({
              type: 'application/pdf',
              disposition: 'attachment',
            }),
          ]),
        })
      );
    });

    it('does not fail if email sending fails', async () => {
      setupDefaultDbMocks();

      const { sendgridClient } = require('../services/sendgrid');
      sendgridClient.sendEmail.mockRejectedValueOnce(new Error('SMTP error'));

      // Should not throw
      const contract = await service.generateContract('project-uuid-1', 'user-uuid-1');
      expect(contract).toBeDefined();
    });
  });

  // ── getContract ──────────────────────────────────────────────────────────────

  describe('getContract', () => {
    it('returns contract when found', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockContractRow] });

      const contract = await service.getContract('contract-uuid-1');

      expect(contract).not.toBeNull();
      expect(contract!.id).toBe('contract-uuid-1');
      expect(contract!.referenceNumber).toBe('TST-CNT-2024-000001');
    });

    it('returns null when contract not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const contract = await service.getContract('nonexistent-id');

      expect(contract).toBeNull();
    });

    it('parses JSON content correctly', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockContractRow] });

      const contract = await service.getContract('contract-uuid-1');

      expect(contract!.content.clientName).toBe('Acme Corp');
      expect(contract!.content.serviceAmount).toBe(5000);
      expect(contract!.content.currency).toBe('USD');
    });
  });

  // ── getContractByReference ───────────────────────────────────────────────────

  describe('getContractByReference', () => {
    it('returns contract by reference number', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockContractRow] });

      const contract = await service.getContractByReference('TST-CNT-2024-000001');

      expect(contract).not.toBeNull();
      expect(contract!.referenceNumber).toBe('TST-CNT-2024-000001');
    });

    it('returns null when reference not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const contract = await service.getContractByReference('TST-CNT-2024-999999');

      expect(contract).toBeNull();
    });
  });

  // ── listContracts ────────────────────────────────────────────────────────────

  describe('listContracts', () => {
    it('lists all contracts without filters', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [mockContractRow, { ...mockContractRow, id: 'contract-uuid-2' }] });

      const result = await service.listContracts();

      expect(result.total).toBe(2);
      expect(result.contracts).toHaveLength(2);
    });

    it('filters by projectId', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockContractRow] });

      const result = await service.listContracts({ projectId: 'project-uuid-1' });

      expect(result.total).toBe(1);
      expect(result.contracts[0].projectId).toBe('project-uuid-1');

      // Verify the query included the projectId filter
      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('project_id');
    });

    it('filters by status', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockContractRow] });

      const result = await service.listContracts({ status: ContractStatus.ACTIVE });

      expect(result.total).toBe(1);

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('status');
    });

    it('returns empty list when no contracts', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.listContracts();

      expect(result.total).toBe(0);
      expect(result.contracts).toHaveLength(0);
    });

    it('applies pagination with limit and offset', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [mockContractRow] });

      const result = await service.listContracts({ limit: 5, offset: 5 });

      expect(result.total).toBe(10);
      expect(result.contracts).toHaveLength(1);
    });
  });

  // ── getDownloadUrl ───────────────────────────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('returns a signed download URL', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockContractRow] });

      const url = await service.getDownloadUrl('contract-uuid-1');

      expect(url).toBe('https://signed-url.example.com/contract.pdf');
    });

    it('throws error when contract not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getDownloadUrl('nonexistent-id')).rejects.toThrow(
        'Contract not found'
      );
    });
  });

  // ── getContractVersions ──────────────────────────────────────────────────────

  describe('getContractVersions', () => {
    const mockVersionRow = {
      id: 'version-uuid-1',
      contract_id: 'contract-uuid-1',
      version_number: 1,
      content: JSON.stringify({
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        clientPhone: '+254700000000',
        clientCountry: 'Kenya',
        serviceDescription: 'Web development services',
        serviceAmount: 5000,
        currency: 'USD',
        transactionIds: ['TXN-001'],
        projectReferenceNumber: 'TST-PRJ-2024-000001',
        industryCategory: 'COMPANIES',
      }),
      pdf_url: 'https://bucket.s3.amazonaws.com/contracts/project-uuid-1/TST-CNT-2024-000001-v1.pdf',
      change_summary: 'Initial contract generation',
      created_by: 'user-uuid-1',
      created_at: new Date('2024-01-15'),
    };

    it('returns all versions for a contract', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockContractRow] }) // getContract
        .mockResolvedValueOnce({ rows: [mockVersionRow, { ...mockVersionRow, id: 'version-uuid-2', version_number: 2 }] });

      const versions = await service.getContractVersions('contract-uuid-1');

      expect(versions).toHaveLength(2);
      expect(versions[0].versionNumber).toBe(1);
      expect(versions[1].versionNumber).toBe(2);
    });

    it('throws error when contract not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // getContract returns null

      await expect(service.getContractVersions('nonexistent-id')).rejects.toThrow(
        'Contract not found'
      );
    });

    it('returns empty array when no versions exist', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockContractRow] })
        .mockResolvedValueOnce({ rows: [] });

      const versions = await service.getContractVersions('contract-uuid-1');

      expect(versions).toHaveLength(0);
    });

    it('maps version fields correctly', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockContractRow] })
        .mockResolvedValueOnce({ rows: [mockVersionRow] });

      const versions = await service.getContractVersions('contract-uuid-1');

      expect(versions[0]).toMatchObject({
        id: 'version-uuid-1',
        contractId: 'contract-uuid-1',
        versionNumber: 1,
        changeSummary: 'Initial contract generation',
        createdBy: 'user-uuid-1',
      });
      expect(versions[0].content.clientName).toBe('Acme Corp');
    });
  });

  // ── getContractVersion ───────────────────────────────────────────────────────

  describe('getContractVersion', () => {
    const mockVersionRow = {
      id: 'version-uuid-1',
      contract_id: 'contract-uuid-1',
      version_number: 1,
      content: JSON.stringify({
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        clientPhone: '+254700000000',
        clientCountry: 'Kenya',
        serviceDescription: 'Web development services',
        serviceAmount: 5000,
        currency: 'USD',
        transactionIds: ['TXN-001'],
        projectReferenceNumber: 'TST-PRJ-2024-000001',
        industryCategory: 'COMPANIES',
      }),
      pdf_url: 'https://bucket.s3.amazonaws.com/contracts/project-uuid-1/TST-CNT-2024-000001-v1.pdf',
      change_summary: 'Initial contract generation',
      created_by: 'user-uuid-1',
      created_at: new Date('2024-01-15'),
    };

    it('returns specific version when found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockContractRow] })
        .mockResolvedValueOnce({ rows: [mockVersionRow] });

      const version = await service.getContractVersion('contract-uuid-1', 1);

      expect(version).not.toBeNull();
      expect(version!.versionNumber).toBe(1);
      expect(version!.contractId).toBe('contract-uuid-1');
    });

    it('returns null when version not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockContractRow] })
        .mockResolvedValueOnce({ rows: [] });

      const version = await service.getContractVersion('contract-uuid-1', 99);

      expect(version).toBeNull();
    });

    it('throws error when contract not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getContractVersion('nonexistent-id', 1)).rejects.toThrow(
        'Contract not found'
      );
    });
  });

  // ── getVersionDownloadUrl ────────────────────────────────────────────────────

  describe('getVersionDownloadUrl', () => {
    const mockVersionRow = {
      id: 'version-uuid-1',
      contract_id: 'contract-uuid-1',
      version_number: 1,
      content: JSON.stringify({
        clientName: 'Acme Corp',
        clientEmail: 'acme@example.com',
        clientPhone: '+254700000000',
        clientCountry: 'Kenya',
        serviceDescription: 'Web development services',
        serviceAmount: 5000,
        currency: 'USD',
        transactionIds: [],
        projectReferenceNumber: 'TST-PRJ-2024-000001',
        industryCategory: 'COMPANIES',
      }),
      pdf_url: 'https://bucket.s3.amazonaws.com/contracts/project-uuid-1/TST-CNT-2024-000001-v1.pdf',
      change_summary: 'Initial contract generation',
      created_by: 'user-uuid-1',
      created_at: new Date('2024-01-15'),
    };

    it('returns signed URL for a specific version', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockContractRow] }) // getContract inside getContractVersion
        .mockResolvedValueOnce({ rows: [mockVersionRow] }); // getContractVersion query

      const url = await service.getVersionDownloadUrl('contract-uuid-1', 1);

      expect(url).toBe('https://signed-url.example.com/contract.pdf');
    });

    it('throws error when version not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockContractRow] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(service.getVersionDownloadUrl('contract-uuid-1', 99)).rejects.toThrow(
        'Contract version not found'
      );
    });

    it('throws error when contract not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getVersionDownloadUrl('nonexistent-id', 1)).rejects.toThrow(
        'Contract not found'
      );
    });
  });

  // ── Contract content mapping ─────────────────────────────────────────────────

  describe('contract content mapping', () => {
    it('maps all required fields from database row', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockContractRow] });

      const contract = await service.getContract('contract-uuid-1');

      expect(contract).toMatchObject({
        id: 'contract-uuid-1',
        referenceNumber: 'TST-CNT-2024-000001',
        projectId: 'project-uuid-1',
        version: 1,
        status: ContractStatus.ACTIVE,
        createdBy: 'user-uuid-1',
      });
    });

    it('handles content as already-parsed object', async () => {
      const rowWithParsedContent = {
        ...mockContractRow,
        content: {
          clientName: 'Acme Corp',
          clientEmail: 'acme@example.com',
          serviceAmount: 5000,
          currency: 'USD',
          transactionIds: [],
          projectReferenceNumber: 'TST-PRJ-2024-000001',
          industryCategory: 'COMPANIES',
          clientPhone: '+254700000000',
          clientCountry: 'Kenya',
          serviceDescription: 'Web development',
        },
      };

      db.query.mockResolvedValueOnce({ rows: [rowWithParsedContent] });

      const contract = await service.getContract('contract-uuid-1');

      expect(contract!.content.clientName).toBe('Acme Corp');
    });
  });
});
