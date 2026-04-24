import { communicationService, CommunicationType, CreateCommunicationInput } from './communicationService';
import { db } from '../database/connection';

// Mock the database connection
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('CommunicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logCommunication', () => {
    it('should log a communication record successfully', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockCommunicationId = '223e4567-e89b-12d3-a456-426614174000';
      const mockDate = new Date('2024-01-15T10:00:00Z');

      // Mock client exists check
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockClientId }],
      });

      // Mock communication insert
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockCommunicationId,
            client_id: mockClientId,
            type: 'EMAIL',
            communication_date: mockDate,
            duration_minutes: 30,
            summary: 'Discussed project requirements',
            participants: JSON.stringify(['john@example.com', 'jane@example.com']),
            outcome: 'Agreement reached',
            created_at: new Date(),
          },
        ],
      });

      const input: CreateCommunicationInput = {
        clientId: mockClientId,
        type: CommunicationType.EMAIL,
        communicationDate: mockDate,
        durationMinutes: 30,
        summary: 'Discussed project requirements',
        participants: ['john@example.com', 'jane@example.com'],
        outcome: 'Agreement reached',
      };

      const result = await communicationService.logCommunication(input);

      expect(result.id).toBe(mockCommunicationId);
      expect(result.clientId).toBe(mockClientId);
      expect(result.type).toBe(CommunicationType.EMAIL);
      expect(result.durationMinutes).toBe(30);
      expect(result.summary).toBe('Discussed project requirements');
      expect(result.participants).toEqual(['john@example.com', 'jane@example.com']);
      expect(result.outcome).toBe('Agreement reached');
    });

    it('should throw error if client does not exist', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      // Mock client does not exist
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const input: CreateCommunicationInput = {
        clientId: mockClientId,
        type: CommunicationType.EMAIL,
        communicationDate: new Date(),
        summary: 'Test',
      };

      await expect(communicationService.logCommunication(input)).rejects.toThrow('Client not found');
    });

    it('should throw error for invalid communication type', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      // Mock client exists
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockClientId }],
      });

      const input: CreateCommunicationInput = {
        clientId: mockClientId,
        type: 'INVALID_TYPE' as CommunicationType,
        communicationDate: new Date(),
      };

      await expect(communicationService.logCommunication(input)).rejects.toThrow(
        'Invalid communication type'
      );
    });
  });

  describe('autoLogEmail', () => {
    it('should auto-log system-generated email', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockCommunicationId = '223e4567-e89b-12d3-a456-426614174000';

      // Mock client exists
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockClientId }],
      });

      // Mock communication insert
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockCommunicationId,
            client_id: mockClientId,
            type: 'EMAIL',
            communication_date: new Date(),
            duration_minutes: null,
            summary: 'Contract sent',
            participants: JSON.stringify(['client@example.com']),
            outcome: 'Email delivered',
            created_at: new Date(),
          },
        ],
      });

      const result = await communicationService.autoLogEmail(
        mockClientId,
        'Contract sent',
        ['client@example.com'],
        'Email delivered'
      );

      expect(result.type).toBe(CommunicationType.EMAIL);
      expect(result.summary).toBe('Contract sent');
      expect(result.participants).toEqual(['client@example.com']);
      expect(result.outcome).toBe('Email delivered');
    });
  });

  describe('autoLogChat', () => {
    it('should auto-log chat message', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockCommunicationId = '223e4567-e89b-12d3-a456-426614174000';

      // Mock client exists
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockClientId }],
      });

      // Mock communication insert
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockCommunicationId,
            client_id: mockClientId,
            type: 'CHAT',
            communication_date: new Date(),
            duration_minutes: 15,
            summary: 'Quick question about pricing',
            participants: JSON.stringify(['agent@example.com', 'client@example.com']),
            outcome: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await communicationService.autoLogChat(
        mockClientId,
        'Quick question about pricing',
        ['agent@example.com', 'client@example.com'],
        15
      );

      expect(result.type).toBe(CommunicationType.CHAT);
      expect(result.summary).toBe('Quick question about pricing');
      expect(result.durationMinutes).toBe(15);
    });
  });

  describe('getCommunicationHistory', () => {
    it('should retrieve communication history in chronological order', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });

      // Mock communications query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            client_id: mockClientId,
            type: 'EMAIL',
            communication_date: new Date('2024-01-15'),
            duration_minutes: null,
            summary: 'Email 1',
            participants: null,
            outcome: null,
            created_at: new Date(),
          },
          {
            id: '2',
            client_id: mockClientId,
            type: 'PHONE',
            communication_date: new Date('2024-01-14'),
            duration_minutes: 20,
            summary: 'Phone call',
            participants: null,
            outcome: null,
            created_at: new Date(),
          },
          {
            id: '3',
            client_id: mockClientId,
            type: 'MEETING',
            communication_date: new Date('2024-01-13'),
            duration_minutes: 60,
            summary: 'Initial meeting',
            participants: null,
            outcome: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await communicationService.getCommunicationHistory(mockClientId);

      expect(result.total).toBe(3);
      expect(result.communications).toHaveLength(3);
      expect(result.communications[0].type).toBe(CommunicationType.EMAIL);
      expect(result.communications[1].type).toBe(CommunicationType.PHONE);
      expect(result.communications[2].type).toBe(CommunicationType.MEETING);
    });

    it('should filter communication history by type', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      // Mock communications query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            client_id: mockClientId,
            type: 'EMAIL',
            communication_date: new Date('2024-01-15'),
            duration_minutes: null,
            summary: 'Email 1',
            participants: null,
            outcome: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await communicationService.getCommunicationHistory(mockClientId, {
        type: CommunicationType.EMAIL,
      });

      expect(result.total).toBe(1);
      expect(result.communications).toHaveLength(1);
      expect(result.communications[0].type).toBe(CommunicationType.EMAIL);
    });

    it('should filter communication history by date range', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });

      // Mock communications query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            client_id: mockClientId,
            type: 'EMAIL',
            communication_date: new Date('2024-01-15'),
            duration_minutes: null,
            summary: 'Email 1',
            participants: null,
            outcome: null,
            created_at: new Date(),
          },
          {
            id: '2',
            client_id: mockClientId,
            type: 'PHONE',
            communication_date: new Date('2024-01-10'),
            duration_minutes: 20,
            summary: 'Phone call',
            participants: null,
            outcome: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await communicationService.getCommunicationHistory(mockClientId, {
        startDate,
        endDate,
      });

      expect(result.total).toBe(2);
      expect(result.communications).toHaveLength(2);
    });
  });

  describe('getTotalCommunicationTime', () => {
    it('should calculate total communication time', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total_minutes: '150' }],
      });

      const result = await communicationService.getTotalCommunicationTime(mockClientId);

      expect(result).toBe(150);
    });

    it('should return 0 if no communications with duration', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ total_minutes: '0' }],
      });

      const result = await communicationService.getTotalCommunicationTime(mockClientId);

      expect(result).toBe(0);
    });
  });

  describe('getLastCommunicationDate', () => {
    it('should return last communication date', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';
      const mockDate = new Date('2024-01-15');

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ communication_date: mockDate }],
      });

      const result = await communicationService.getLastCommunicationDate(mockClientId);

      expect(result).toEqual(mockDate);
    });

    it('should return null if no communications', async () => {
      const mockClientId = '123e4567-e89b-12d3-a456-426614174000';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await communicationService.getLastCommunicationDate(mockClientId);

      expect(result).toBeNull();
    });
  });

  describe('getLastCommunicationDates', () => {
    it('should return last communication dates for multiple clients', async () => {
      const mockClientIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        '223e4567-e89b-12d3-a456-426614174000',
      ];

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            client_id: mockClientIds[0],
            communication_date: new Date('2024-01-15'),
          },
          {
            client_id: mockClientIds[1],
            communication_date: new Date('2024-01-14'),
          },
        ],
      });

      const result = await communicationService.getLastCommunicationDates(mockClientIds);

      expect(result.size).toBe(2);
      expect(result.get(mockClientIds[0])).toEqual(new Date('2024-01-15'));
      expect(result.get(mockClientIds[1])).toEqual(new Date('2024-01-14'));
    });

    it('should return empty map for empty client list', async () => {
      const result = await communicationService.getLastCommunicationDates([]);

      expect(result.size).toBe(0);
    });
  });

  describe('deleteCommunication', () => {
    it('should delete communication record successfully', async () => {
      const mockCommunicationId = '123e4567-e89b-12d3-a456-426614174000';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockCommunicationId }],
      });

      await communicationService.deleteCommunication(mockCommunicationId);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM communications WHERE id = $1 RETURNING id',
        [mockCommunicationId]
      );
    });

    it('should throw error if communication not found', async () => {
      const mockCommunicationId = '123e4567-e89b-12d3-a456-426614174000';

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await expect(communicationService.deleteCommunication(mockCommunicationId)).rejects.toThrow(
        'Communication not found'
      );
    });
  });
});
