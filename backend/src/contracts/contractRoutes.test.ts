/**
 * Contract Routes Tests
 * Tests for contract REST API endpoints
 * Requirements: 9.1-9.11
 */

import request from 'supertest';
import express from 'express';
import contractRoutes from './contractRoutes';
import { contractService } from './contractService';
import { ContractStatus } from './contractService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('./contractService', () => ({
  contractService: {
    generateContract: jest.fn(),
    getContract: jest.fn(),
    listContracts: jest.fn(),
    getDownloadUrl: jest.fn(),
    getContractVersions: jest.fn(),
    getContractVersion: jest.fn(),
    getVersionDownloadUrl: jest.fn(),
  },
  ContractStatus: {
    DRAFT: 'DRAFT',
    ACTIVE: 'ACTIVE',
    SUPERSEDED: 'SUPERSEDED',
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// ─── Test App Setup ───────────────────────────────────────────────────────────

function createApp(userId?: string) {
  const app = express();
  app.use(express.json());

  // Inject mock user
  app.use((req: any, _res, next) => {
    if (userId) {
      req.user = { id: userId, role: 'CEO' };
    }
    next();
  });

  app.use('/api/contracts', contractRoutes);
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockContract = {
  id: 'contract-uuid-1',
  referenceNumber: 'TST-CNT-2024-000001',
  projectId: 'project-uuid-1',
  version: 1,
  content: {
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
  },
  pdfUrl: 'https://bucket.s3.amazonaws.com/contracts/project-uuid-1/TST-CNT-2024-000001-v1.pdf',
  status: ContractStatus.ACTIVE,
  createdBy: 'user-uuid-1',
  createdAt: new Date('2024-01-15'),
};

const mockVersion = {
  id: 'version-uuid-1',
  contractId: 'contract-uuid-1',
  versionNumber: 1,
  content: {
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
  },
  pdfUrl: 'https://bucket.s3.amazonaws.com/contracts/project-uuid-1/TST-CNT-2024-000001-v1.pdf',
  changeSummary: 'Initial contract generation',
  createdBy: 'user-uuid-1',
  createdAt: new Date('2024-01-15'),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Contract Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/contracts/generate ─────────────────────────────────────────────

  describe('POST /api/contracts/generate', () => {
    it('generates a contract and returns 201', async () => {
      (contractService.generateContract as jest.Mock).mockResolvedValueOnce(mockContract);

      const app = createApp('user-uuid-1');
      const res = await request(app)
        .post('/api/contracts/generate')
        .send({ projectId: 'project-uuid-1' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('contract-uuid-1');
      expect(res.body.referenceNumber).toBe('TST-CNT-2024-000001');
    });

    it('returns 401 when not authenticated', async () => {
      const app = createApp(); // no user
      const res = await request(app)
        .post('/api/contracts/generate')
        .send({ projectId: 'project-uuid-1' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when projectId is missing', async () => {
      const app = createApp('user-uuid-1');
      const res = await request(app)
        .post('/api/contracts/generate')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('projectId');
    });

    it('returns 404 when project not found', async () => {
      (contractService.generateContract as jest.Mock).mockRejectedValueOnce(
        new Error('Project not found: nonexistent')
      );

      const app = createApp('user-uuid-1');
      const res = await request(app)
        .post('/api/contracts/generate')
        .send({ projectId: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    it('returns 500 on unexpected error', async () => {
      (contractService.generateContract as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const app = createApp('user-uuid-1');
      const res = await request(app)
        .post('/api/contracts/generate')
        .send({ projectId: 'project-uuid-1' });

      expect(res.status).toBe(500);
    });

    it('passes requesterId from authenticated user', async () => {
      (contractService.generateContract as jest.Mock).mockResolvedValueOnce(mockContract);

      const app = createApp('user-uuid-1');
      await request(app)
        .post('/api/contracts/generate')
        .send({ projectId: 'project-uuid-1' });

      expect(contractService.generateContract).toHaveBeenCalledWith(
        'project-uuid-1',
        'user-uuid-1'
      );
    });
  });

  // ── GET /api/contracts ────────────────────────────────────────────────────────

  describe('GET /api/contracts', () => {
    it('returns list of contracts', async () => {
      (contractService.listContracts as jest.Mock).mockResolvedValueOnce({
        contracts: [mockContract],
        total: 1,
      });

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.contracts).toHaveLength(1);
    });

    it('returns 401 when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).get('/api/contracts');

      expect(res.status).toBe(401);
    });

    it('passes projectId filter from query string', async () => {
      (contractService.listContracts as jest.Mock).mockResolvedValueOnce({
        contracts: [],
        total: 0,
      });

      const app = createApp('user-uuid-1');
      await request(app).get('/api/contracts?projectId=project-uuid-1');

      expect(contractService.listContracts).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'project-uuid-1' })
      );
    });

    it('passes status filter from query string', async () => {
      (contractService.listContracts as jest.Mock).mockResolvedValueOnce({
        contracts: [],
        total: 0,
      });

      const app = createApp('user-uuid-1');
      await request(app).get('/api/contracts?status=ACTIVE');

      expect(contractService.listContracts).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' })
      );
    });

    it('passes pagination params', async () => {
      (contractService.listContracts as jest.Mock).mockResolvedValueOnce({
        contracts: [],
        total: 0,
      });

      const app = createApp('user-uuid-1');
      await request(app).get('/api/contracts?limit=10&offset=20');

      expect(contractService.listContracts).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });
  });

  // ── GET /api/contracts/:id ────────────────────────────────────────────────────

  describe('GET /api/contracts/:id', () => {
    it('returns contract by ID', async () => {
      (contractService.getContract as jest.Mock).mockResolvedValueOnce(mockContract);

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('contract-uuid-1');
    });

    it('returns 401 when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).get('/api/contracts/contract-uuid-1');

      expect(res.status).toBe(401);
    });

    it('returns 404 when contract not found', async () => {
      (contractService.getContract as jest.Mock).mockResolvedValueOnce(null);

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('returns 500 on unexpected error', async () => {
      (contractService.getContract as jest.Mock).mockRejectedValueOnce(
        new Error('DB error')
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1');

      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/contracts/:id/download ──────────────────────────────────────────

  describe('GET /api/contracts/:id/download', () => {
    it('returns a signed download URL', async () => {
      (contractService.getDownloadUrl as jest.Mock).mockResolvedValueOnce(
        'https://signed-url.example.com/contract.pdf'
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/download');

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBe('https://signed-url.example.com/contract.pdf');
      expect(res.body.expiresIn).toBe(3600);
    });

    it('returns 401 when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).get('/api/contracts/contract-uuid-1/download');

      expect(res.status).toBe(401);
    });

    it('returns 404 when contract not found', async () => {
      (contractService.getDownloadUrl as jest.Mock).mockRejectedValueOnce(
        new Error('Contract not found')
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/nonexistent/download');

      expect(res.status).toBe(404);
    });

    it('accepts custom expiresIn query param', async () => {
      (contractService.getDownloadUrl as jest.Mock).mockResolvedValueOnce(
        'https://signed-url.example.com/contract.pdf'
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/download?expiresIn=7200');

      expect(res.status).toBe(200);
      expect(res.body.expiresIn).toBe(7200);
      expect(contractService.getDownloadUrl).toHaveBeenCalledWith('contract-uuid-1', 7200);
    });
  });

  // ── GET /api/contracts/:id/versions ──────────────────────────────────────────

  describe('GET /api/contracts/:id/versions', () => {
    it('returns version list for a contract', async () => {
      (contractService.getContractVersions as jest.Mock).mockResolvedValueOnce([mockVersion]);

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.versions).toHaveLength(1);
      expect(res.body.versions[0].versionNumber).toBe(1);
    });

    it('returns 401 when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions');

      expect(res.status).toBe(401);
    });

    it('returns 404 when contract not found', async () => {
      (contractService.getContractVersions as jest.Mock).mockRejectedValueOnce(
        new Error('Contract not found')
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/nonexistent/versions');

      expect(res.status).toBe(404);
    });

    it('returns 500 on unexpected error', async () => {
      (contractService.getContractVersions as jest.Mock).mockRejectedValueOnce(
        new Error('DB error')
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions');

      expect(res.status).toBe(500);
    });

    it('returns empty versions array when no versions exist', async () => {
      (contractService.getContractVersions as jest.Mock).mockResolvedValueOnce([]);

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.versions).toHaveLength(0);
    });
  });

  // ── GET /api/contracts/:id/versions/:version ──────────────────────────────────

  describe('GET /api/contracts/:id/versions/:version', () => {
    it('returns a specific version', async () => {
      (contractService.getContractVersion as jest.Mock).mockResolvedValueOnce(mockVersion);

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions/1');

      expect(res.status).toBe(200);
      expect(res.body.versionNumber).toBe(1);
      expect(res.body.contractId).toBe('contract-uuid-1');
    });

    it('returns 401 when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions/1');

      expect(res.status).toBe(401);
    });

    it('returns 404 when version not found', async () => {
      (contractService.getContractVersion as jest.Mock).mockResolvedValueOnce(null);

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions/99');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('returns 400 for invalid version number', async () => {
      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions/abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid version number');
    });

    it('returns 404 when contract not found', async () => {
      (contractService.getContractVersion as jest.Mock).mockRejectedValueOnce(
        new Error('Contract not found')
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/nonexistent/versions/1');

      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/contracts/:id/versions/:version/download ────────────────────────

  describe('GET /api/contracts/:id/versions/:version/download', () => {
    it('returns a signed download URL for a specific version', async () => {
      (contractService.getVersionDownloadUrl as jest.Mock).mockResolvedValueOnce(
        'https://signed-url.example.com/v1.pdf'
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions/1/download');

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBe('https://signed-url.example.com/v1.pdf');
      expect(res.body.versionNumber).toBe(1);
      expect(res.body.expiresIn).toBe(3600);
    });

    it('returns 401 when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions/1/download');

      expect(res.status).toBe(401);
    });

    it('returns 404 when version not found', async () => {
      (contractService.getVersionDownloadUrl as jest.Mock).mockRejectedValueOnce(
        new Error('Contract version not found')
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions/99/download');

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid version number', async () => {
      const app = createApp('user-uuid-1');
      const res = await request(app).get('/api/contracts/contract-uuid-1/versions/abc/download');

      expect(res.status).toBe(400);
    });

    it('accepts custom expiresIn query param', async () => {
      (contractService.getVersionDownloadUrl as jest.Mock).mockResolvedValueOnce(
        'https://signed-url.example.com/v1.pdf'
      );

      const app = createApp('user-uuid-1');
      const res = await request(app).get(
        '/api/contracts/contract-uuid-1/versions/1/download?expiresIn=7200'
      );

      expect(res.status).toBe(200);
      expect(res.body.expiresIn).toBe(7200);
      expect(contractService.getVersionDownloadUrl).toHaveBeenCalledWith(
        'contract-uuid-1',
        1,
        7200
      );
    });
  });

  // ── DELETE /api/contracts/:id ─────────────────────────────────────────────────

  describe('DELETE /api/contracts/:id', () => {
    it('returns 405 Method Not Allowed', async () => {
      const app = createApp('user-uuid-1');
      const res = await request(app).delete('/api/contracts/contract-uuid-1');

      expect(res.status).toBe(405);
      expect(res.body.error).toContain('Method Not Allowed');
    });

    it('returns 405 even when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/contracts/contract-uuid-1');

      expect(res.status).toBe(405);
    });
  });

  // ── DELETE /api/contracts/:id/versions/:version ───────────────────────────────

  describe('DELETE /api/contracts/:id/versions/:version', () => {
    it('returns 405 Method Not Allowed', async () => {
      const app = createApp('user-uuid-1');
      const res = await request(app).delete('/api/contracts/contract-uuid-1/versions/1');

      expect(res.status).toBe(405);
      expect(res.body.error).toContain('Method Not Allowed');
    });

    it('returns 405 even when not authenticated', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/contracts/contract-uuid-1/versions/1');

      expect(res.status).toBe(405);
    });
  });
});
