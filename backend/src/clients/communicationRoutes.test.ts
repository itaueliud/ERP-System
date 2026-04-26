import request from 'supertest';
import express from 'express';
import communicationRoutes from './communicationRoutes';
import { communicationService, CommunicationType } from './communicationService';

// Mock the communication service
jest.mock('./communicationService', () => ({
  communicationService: {
    logCommunication: jest.fn(),
    getCommunicationHistory: jest.fn(),
    getTotalCommunicationTime: jest.fn(),
    getLastCommunicationDate: jest.fn(),
    deleteCommunication: jest.fn(),
  },
  CommunicationType: {
    EMAIL: 'EMAIL',
    PHONE: 'PHONE',
    MEETING: 'MEETING',
    CHAT: 'CHAT',
    SMS: 'SMS',
  },
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Communication Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/clients', communicationRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/clients/:clientId/communications', () => {
    it('should log a communication record successfully', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockCommunication = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        clientId: mockClientId,
        type: CommunicationType.EMAIL,
        communicationDate: new Date('2024-01-15T10:00:00Z'),
        durationMinutes: 30,
        summary: 'Discussed project requirements',
        participants: ['john@example.com', 'jane@example.com'],
        outcome: 'Agreement reached',
        createdAt: new Date(),
      };

      (communicationService.logCommunication as jest.Mock).mockResolvedValue(mockCommunication);

      const response = await request(app)
        .post(`/api/clients/${mockClientId}/communications`)
        .send({
          type: 'EMAIL',
          communicationDate: '2024-01-15T10:00:00Z',
          durationMinutes: 30,
          summary: 'Discussed project requirements',
          participants: ['john@example.com', 'jane@example.com'],
          outcome: 'Agreement reached',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe(mockCommunication.id);
      expect(response.body.type).toBe('EMAIL');
      expect(communicationService.logCommunication).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: mockClientId,
          type: 'EMAIL',
          durationMinutes: 30,
          summary: 'Discussed project requirements',
        })
      );
    });

    it('should return 400 if required fields are missing', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .post(`/api/clients/${mockClientId}/communications`)
        .send({
          summary: 'Missing type and date',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 if service throws error', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      (communicationService.logCommunication as jest.Mock).mockRejectedValue(
        new Error('Client not found')
      );

      const response = await request(app)
        .post(`/api/clients/${mockClientId}/communications`)
        .send({
          type: 'EMAIL',
          communicationDate: '2024-01-15T10:00:00Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Client not found');
    });
  });

  describe('GET /api/clients/:clientId/communications', () => {
    it('should retrieve communication history', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockHistory = {
        communications: [
          {
            id: '1',
            clientId: mockClientId,
            type: CommunicationType.EMAIL,
            communicationDate: new Date('2024-01-15'),
            summary: 'Email 1',
            createdAt: new Date(),
          },
          {
            id: '2',
            clientId: mockClientId,
            type: CommunicationType.PHONE,
            communicationDate: new Date('2024-01-14'),
            durationMinutes: 20,
            summary: 'Phone call',
            createdAt: new Date(),
          },
        ],
        total: 2,
      };

      (communicationService.getCommunicationHistory as jest.Mock).mockResolvedValue(mockHistory);

      const response = await request(app).get(`/api/clients/${mockClientId}/communications`);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      expect(response.body.communications).toHaveLength(2);
    });

    it('should filter communication history by type', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockHistory = {
        communications: [
          {
            id: '1',
            clientId: mockClientId,
            type: CommunicationType.EMAIL,
            communicationDate: new Date('2024-01-15'),
            summary: 'Email 1',
            createdAt: new Date(),
          },
        ],
        total: 1,
      };

      (communicationService.getCommunicationHistory as jest.Mock).mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/clients/${mockClientId}/communications`)
        .query({ type: 'EMAIL' });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(communicationService.getCommunicationHistory).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          type: 'EMAIL',
        })
      );
    });

    it('should filter communication history by date range', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockHistory = {
        communications: [],
        total: 0,
      };

      (communicationService.getCommunicationHistory as jest.Mock).mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/clients/${mockClientId}/communications`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(communicationService.getCommunicationHistory).toHaveBeenCalledWith(
        mockClientId,
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });
  });

  describe('GET /api/clients/:clientId/communications/total-time', () => {
    it('should return total communication time', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      (communicationService.getTotalCommunicationTime as jest.Mock).mockResolvedValue(150);

      const response = await request(app).get(
        `/api/clients/${mockClientId}/communications/total-time`
      );

      expect(response.status).toBe(200);
      expect(response.body.totalMinutes).toBe(150);
    });
  });

  describe('GET /api/clients/:clientId/communications/last-date', () => {
    it('should return last communication date', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockDate = new Date('2024-01-15');

      (communicationService.getLastCommunicationDate as jest.Mock).mockResolvedValue(mockDate);

      const response = await request(app).get(
        `/api/clients/${mockClientId}/communications/last-date`
      );

      expect(response.status).toBe(200);
      expect(response.body.lastCommunicationDate).toBe(mockDate.toISOString());
    });

    it('should return null if no communications', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      (communicationService.getLastCommunicationDate as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get(
        `/api/clients/${mockClientId}/communications/last-date`
      );

      expect(response.status).toBe(200);
      expect(response.body.lastCommunicationDate).toBeNull();
    });
  });

  describe('DELETE /api/clients/:clientId/communications/:communicationId', () => {
    it('should delete communication record successfully', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockCommunicationId = '223e4567-e89b-12d3-a456-426614174000';

      (communicationService.deleteCommunication as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).delete(
        `/api/clients/${mockClientId}/communications/${mockCommunicationId}`
      );

      expect(response.status).toBe(204);
      expect(communicationService.deleteCommunication).toHaveBeenCalledWith(mockCommunicationId);
    });

    it('should return 400 if communication not found', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockCommunicationId = '223e4567-e89b-12d3-a456-426614174000';

      (communicationService.deleteCommunication as jest.Mock).mockRejectedValue(
        new Error('Communication not found')
      );

      const response = await request(app).delete(
        `/api/clients/${mockClientId}/communications/${mockCommunicationId}`
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Communication not found');
    });
  });
});
