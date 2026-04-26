import request from 'supertest';
import express from 'express';
import clientRoutes from './clientRoutes';
import { clientService, ClientStatus, Priority } from './clientService';

// Mock dependencies
jest.mock('./clientService');
jest.mock('../utils/logger');
jest.mock('../database/connection');
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: {
      level: 'info',
      filePath: '/tmp/test.log',
    },
    database: {
      host: 'localhost',
      port: 5432,
      name: 'test',
      user: 'test',
      password: 'test',
    },
  },
}));

describe('Client Routes - Status Workflow', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req, _res, next) => {
      (req as any).user = { id: 'test-agent-id' };
      next();
    });

    app.use('/api/clients', clientRoutes);

    jest.clearAllMocks();
  });

  describe('POST /api/clients/:id/convert-to-lead', () => {
    it('should convert client to LEAD status', async () => {
      const mockClient = {
        id: 'client-123',
        referenceNumber: 'TST-2024-000001',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '+254712345678',
        country: 'Kenya',
        industryCategory: 'SCHOOLS',
        serviceDescription: 'Need a school management system',
        status: ClientStatus.LEAD,
        agentId: 'test-agent-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (clientService.convertToLead as jest.Mock).mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/clients/client-123/convert-to-lead')
        .send({ transactionId: 'TXN-123456789' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(ClientStatus.LEAD);
      expect(clientService.convertToLead).toHaveBeenCalledWith('client-123', 'TXN-123456789');
    });

    it('should return 400 if transactionId is missing', async () => {
      const response = await request(app)
        .post('/api/clients/client-123/convert-to-lead')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('transactionId');
    });

    it('should return 400 if conversion fails', async () => {
      (clientService.convertToLead as jest.Mock).mockRejectedValue(
        new Error('Client must have PENDING_COMMITMENT status')
      );

      const response = await request(app)
        .post('/api/clients/client-123/convert-to-lead')
        .send({ transactionId: 'TXN-123456789' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('PENDING_COMMITMENT');
    });
  });

  describe('POST /api/clients/:id/qualify', () => {
    it('should qualify lead with valid data', async () => {
      const mockClient = {
        id: 'client-123',
        referenceNumber: 'TST-2024-000001',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '+254712345678',
        country: 'Kenya',
        industryCategory: 'SCHOOLS',
        serviceDescription: 'Need a school management system',
        status: ClientStatus.QUALIFIED_LEAD,
        agentId: 'test-agent-id',
        estimatedValue: 50000,
        priority: Priority.HIGH,
        expectedStartDate: new Date('2024-06-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (clientService.qualifyLead as jest.Mock).mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/clients/client-123/qualify')
        .send({
          estimatedValue: 50000,
          priority: 'HIGH',
          expectedStartDate: '2024-06-01',
          notes: 'High priority client',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(ClientStatus.QUALIFIED_LEAD);
      expect(response.body.estimatedValue).toBe(50000);
      expect(clientService.qualifyLead).toHaveBeenCalledWith('client-123', {
        estimatedValue: 50000,
        priority: 'HIGH',
        expectedStartDate: expect.any(Date),
        notes: 'High priority client',
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/clients/client-123/qualify')
        .send({ estimatedValue: 50000 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required fields');
    });

    it('should return 400 if qualification fails', async () => {
      (clientService.qualifyLead as jest.Mock).mockRejectedValue(
        new Error('Client must have LEAD status')
      );

      const response = await request(app)
        .post('/api/clients/client-123/qualify')
        .send({
          estimatedValue: 50000,
          priority: 'HIGH',
          expectedStartDate: '2024-06-01',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('LEAD status');
    });
  });

  describe('POST /api/clients/:id/convert-to-project', () => {
    it('should convert qualified lead to project', async () => {
      const mockResult = {
        client: {
          id: 'client-123',
          referenceNumber: 'TST-2024-000001',
          name: 'Test Client',
          email: 'client@example.com',
          phone: '+254712345678',
          country: 'Kenya',
          industryCategory: 'SCHOOLS',
          serviceDescription: 'Need a school management system',
          status: ClientStatus.PROJECT,
          agentId: 'test-agent-id',
          estimatedValue: 50000,
          priority: Priority.HIGH,
          expectedStartDate: new Date('2024-06-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        project: {
          id: 'project-456',
          referenceNumber: 'TST-PRJ-2024-000001',
          clientId: 'client-123',
          status: 'PENDING_APPROVAL',
          serviceAmount: 100000,
          currency: 'USD',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-12-31'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      (clientService.convertToProject as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/clients/client-123/convert-to-project')
        .send({
          serviceAmount: 100000,
          currency: 'USD',
          startDate: '2024-06-01',
          endDate: '2024-12-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.client.status).toBe(ClientStatus.PROJECT);
      expect(response.body.project.referenceNumber).toBe('TST-PRJ-2024-000001');
      expect(clientService.convertToProject).toHaveBeenCalledWith('client-123', {
        serviceAmount: 100000,
        currency: 'USD',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
    });

    it('should return 400 if serviceAmount is missing', async () => {
      const response = await request(app)
        .post('/api/clients/client-123/convert-to-project')
        .send({ currency: 'USD' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('serviceAmount');
    });

    it('should return 400 if conversion fails', async () => {
      (clientService.convertToProject as jest.Mock).mockRejectedValue(
        new Error('Client must have QUALIFIED_LEAD status')
      );

      const response = await request(app)
        .post('/api/clients/client-123/convert-to-project')
        .send({ serviceAmount: 100000 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('QUALIFIED_LEAD');
    });

    it('should handle optional date fields', async () => {
      const mockResult = {
        client: {
          id: 'client-123',
          referenceNumber: 'TST-2024-000001',
          name: 'Test Client',
          email: 'client@example.com',
          phone: '+254712345678',
          country: 'Kenya',
          industryCategory: 'SCHOOLS',
          serviceDescription: 'Need a school management system',
          status: ClientStatus.PROJECT,
          agentId: 'test-agent-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        project: {
          id: 'project-456',
          referenceNumber: 'TST-PRJ-2024-000001',
          clientId: 'client-123',
          status: 'PENDING_APPROVAL',
          serviceAmount: 100000,
          currency: 'USD',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      (clientService.convertToProject as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/clients/client-123/convert-to-project')
        .send({ serviceAmount: 100000 });

      expect(response.status).toBe(200);
      expect(clientService.convertToProject).toHaveBeenCalledWith('client-123', {
        serviceAmount: 100000,
        currency: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });
  });

  describe('POST /api/clients/:id/initiate-commitment-payment', () => {
    beforeEach(() => {
      // Mock payment service
      jest.mock('../payments/paymentService', () => ({
        paymentService: {
          initiateCommitmentPayment: jest.fn(),
        },
      }));
    });

    it('should initiate commitment payment for client', async () => {
      const mockClient = {
        id: 'client-123',
        referenceNumber: 'TST-2024-000001',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '+254712345678',
        country: 'Kenya',
        industryCategory: 'SCHOOLS',
        serviceDescription: 'Need a school management system',
        status: ClientStatus.PENDING_COMMITMENT,
        agentId: 'test-agent-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (clientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/clients/client-123/initiate-commitment-payment')
        .send({
          phoneNumber: '+254712345678',
          amount: 5000,
          currency: 'KES',
        });

      expect(response.status).toBe(201);
      expect(clientService.getClient).toHaveBeenCalledWith('client-123');
    });

    it('should return 400 if phoneNumber is missing', async () => {
      const response = await request(app)
        .post('/api/clients/client-123/initiate-commitment-payment')
        .send({ amount: 5000 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('phoneNumber');
    });

    it('should return 400 if amount is missing', async () => {
      const response = await request(app)
        .post('/api/clients/client-123/initiate-commitment-payment')
        .send({ phoneNumber: '+254712345678' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('amount');
    });

    it('should return 404 if client not found', async () => {
      (clientService.getClient as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/clients/client-123/initiate-commitment-payment')
        .send({
          phoneNumber: '+254712345678',
          amount: 5000,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Client not found');
    });

    it('should return 403 if client does not belong to agent', async () => {
      const mockClient = {
        id: 'client-123',
        referenceNumber: 'TST-2024-000001',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '+254712345678',
        country: 'Kenya',
        industryCategory: 'SCHOOLS',
        serviceDescription: 'Need a school management system',
        status: ClientStatus.PENDING_COMMITMENT,
        agentId: 'different-agent-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (clientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/clients/client-123/initiate-commitment-payment')
        .send({
          phoneNumber: '+254712345678',
          amount: 5000,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });

    it('should return 400 if client status is not PENDING_COMMITMENT', async () => {
      const mockClient = {
        id: 'client-123',
        referenceNumber: 'TST-2024-000001',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '+254712345678',
        country: 'Kenya',
        industryCategory: 'SCHOOLS',
        serviceDescription: 'Need a school management system',
        status: ClientStatus.LEAD,
        agentId: 'test-agent-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (clientService.getClient as jest.Mock).mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/clients/client-123/initiate-commitment-payment')
        .send({
          phoneNumber: '+254712345678',
          amount: 5000,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('PENDING_COMMITMENT');
    });
  });
});
