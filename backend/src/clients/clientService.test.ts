import { ClientService, IndustryCategory, ClientStatus } from './clientService';
import { db } from '../database/connection';

// Mock dependencies
jest.mock('../database/connection');
jest.mock('../utils/logger');
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

describe('ClientService', () => {
  let service: ClientService;

  beforeEach(() => {
    service = new ClientService();
    jest.clearAllMocks();
  });

  describe('createClient', () => {
    const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';
    const validClientInput = {
      name: 'Test Client',
      email: 'client@example.com',
      phone: '+254712345678',
      country: 'Kenya',
      industryCategory: IndustryCategory.SCHOOLS,
      serviceDescription: 'Need a school management system',
      agentId: mockAgentId,
    };

    it('should create a client with valid data', async () => {
      // Mock country validation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      // Mock agent verification
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockAgentId }],
      });

      // Mock reference number generation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      // Mock client creation
      const mockClient = {
        id: '456e4567-e89b-12d3-a456-426614174001',
        reference_number: 'TST-2024-000001',
        name: validClientInput.name,
        email: validClientInput.email,
        phone: validClientInput.phone,
        country: validClientInput.country,
        industry_category: validClientInput.industryCategory,
        service_description: validClientInput.serviceDescription,
        status: ClientStatus.PENDING_COMMITMENT,
        agent_id: mockAgentId,
        estimated_value: null,
        priority: null,
        expected_start_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockClient],
      });

      const result = await service.createClient(validClientInput);

      expect(result).toMatchObject({
        id: mockClient.id,
        referenceNumber: 'TST-2024-000001',
        name: validClientInput.name,
        email: validClientInput.email,
        status: ClientStatus.PENDING_COMMITMENT,
        agentId: mockAgentId,
      });
    });

    it('should reject invalid country', async () => {
      // Mock country validation failure
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '0' }],
      });

      const invalidInput = {
        ...validClientInput,
        country: 'Invalid Country',
      };

      await expect(service.createClient(invalidInput)).rejects.toThrow(
        'Invalid country. Must be one of 51 African countries.'
      );
    });

    it('should reject invalid industry category', async () => {
      // Mock country validation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      const invalidInput = {
        ...validClientInput,
        industryCategory: 'INVALID_CATEGORY' as IndustryCategory,
      };

      await expect(service.createClient(invalidInput)).rejects.toThrow(
        'Invalid industry category'
      );
    });

    it('should reject non-existent agent', async () => {
      // Mock country validation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      // Mock agent verification failure
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await expect(service.createClient(validClientInput)).rejects.toThrow('Agent not found');
    });

    it('should generate sequential reference numbers', async () => {
      const year = new Date().getFullYear();

      // Mock country validation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      // Mock agent verification
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockAgentId }],
      });

      // Mock reference number generation with existing reference
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ reference_number: `TST-${year}-000005` }],
      });

      // Mock client creation
      const mockClient = {
        id: '456e4567-e89b-12d3-a456-426614174001',
        reference_number: `TST-${year}-000006`,
        name: validClientInput.name,
        email: validClientInput.email,
        phone: validClientInput.phone,
        country: validClientInput.country,
        industry_category: validClientInput.industryCategory,
        service_description: validClientInput.serviceDescription,
        status: ClientStatus.PENDING_COMMITMENT,
        agent_id: mockAgentId,
        estimated_value: null,
        priority: null,
        expected_start_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockClient],
      });

      const result = await service.createClient(validClientInput);

      expect(result.referenceNumber).toBe(`TST-${year}-000006`);
    });
  });

  describe('updateClient', () => {
    const mockClientId = '456e4567-e89b-12d3-a456-426614174001';
    const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';

    it('should update client with valid data', async () => {
      // Mock getClient
      const mockClient = {
        id: mockClientId,
        referenceNumber: 'TST-2024-000001',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '+254712345678',
        country: 'Kenya',
        industryCategory: IndustryCategory.SCHOOLS,
        serviceDescription: 'Need a school management system',
        status: ClientStatus.PENDING_COMMITMENT,
        agentId: mockAgentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClient.id,
            reference_number: mockClient.referenceNumber,
            name: mockClient.name,
            email: mockClient.email,
            phone: mockClient.phone,
            country: mockClient.country,
            industry_category: mockClient.industryCategory,
            service_description: mockClient.serviceDescription,
            status: mockClient.status,
            agent_id: mockClient.agentId,
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: mockClient.createdAt,
            updated_at: mockClient.updatedAt,
          },
        ],
      });

      // Mock update query
      const updatedClient = {
        ...mockClient,
        name: 'Updated Client Name',
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: updatedClient.id,
            reference_number: updatedClient.referenceNumber,
            name: updatedClient.name,
            email: updatedClient.email,
            phone: updatedClient.phone,
            country: updatedClient.country,
            industry_category: updatedClient.industryCategory,
            service_description: updatedClient.serviceDescription,
            status: updatedClient.status,
            agent_id: updatedClient.agentId,
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: updatedClient.createdAt,
            updated_at: updatedClient.updated_at,
          },
        ],
      });

      const result = await service.updateClient(mockClientId, mockAgentId, {
        name: 'Updated Client Name',
      });

      expect(result.name).toBe('Updated Client Name');
    });

    it('should reject update by non-owner agent', async () => {
      const differentAgentId = '789e4567-e89b-12d3-a456-426614174002';

      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClientId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.PENDING_COMMITMENT,
            agent_id: mockAgentId,
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(
        service.updateClient(mockClientId, differentAgentId, { name: 'Updated Name' })
      ).rejects.toThrow('Unauthorized: You can only update your own clients');
    });

    it('should reject update when status is not PENDING_COMMITMENT', async () => {
      // Mock getClient with LEAD status
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClientId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.LEAD,
            agent_id: mockAgentId,
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(
        service.updateClient(mockClientId, mockAgentId, { name: 'Updated Name' })
      ).rejects.toThrow('Client can only be updated while status is PENDING_COMMITMENT');
    });
  });

  describe('getClient', () => {
    it('should return client by ID', async () => {
      const mockClientId = '456e4567-e89b-12d3-a456-426614174001';
      const mockClient = {
        id: mockClientId,
        reference_number: 'TST-2024-000001',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '+254712345678',
        country: 'Kenya',
        industry_category: IndustryCategory.SCHOOLS,
        service_description: 'Need a school management system',
        status: ClientStatus.PENDING_COMMITMENT,
        agent_id: '123e4567-e89b-12d3-a456-426614174000',
        estimated_value: null,
        priority: null,
        expected_start_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockClient],
      });

      const result = await service.getClient(mockClientId);

      expect(result).toMatchObject({
        id: mockClientId,
        referenceNumber: 'TST-2024-000001',
        name: 'Test Client',
      });
    });

    it('should return null for non-existent client', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.getClient('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('listClientsForAgent', () => {
    const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';

    it('should list clients for agent', async () => {
      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '2' }],
      });

      // Mock clients query
      const mockClients = [
        {
          id: '456e4567-e89b-12d3-a456-426614174001',
          reference_number: 'TST-2024-000001',
          name: 'Client 1',
          email: 'client1@example.com',
          phone: '+254712345678',
          country: 'Kenya',
          industry_category: IndustryCategory.SCHOOLS,
          service_description: 'Description 1',
          status: ClientStatus.PENDING_COMMITMENT,
          agent_id: mockAgentId,
          estimated_value: null,
          priority: null,
          expected_start_date: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '456e4567-e89b-12d3-a456-426614174002',
          reference_number: 'TST-2024-000002',
          name: 'Client 2',
          email: 'client2@example.com',
          phone: '+254712345679',
          country: 'Kenya',
          industry_category: IndustryCategory.HOTELS,
          service_description: 'Description 2',
          status: ClientStatus.LEAD,
          agent_id: mockAgentId,
          estimated_value: null,
          priority: null,
          expected_start_date: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: mockClients,
      });

      const result = await service.listClientsForAgent(mockAgentId, {});

      expect(result.total).toBe(2);
      expect(result.clients).toHaveLength(2);
      expect(result.clients[0].name).toBe('Client 1');
      expect(result.clients[1].name).toBe('Client 2');
    });

    it('should filter clients by status', async () => {
      // Mock count query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      // Mock clients query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: '456e4567-e89b-12d3-a456-426614174001',
            reference_number: 'TST-2024-000001',
            name: 'Client 1',
            email: 'client1@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Description 1',
            status: ClientStatus.LEAD,
            agent_id: mockAgentId,
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await service.listClientsForAgent(mockAgentId, {
        status: ClientStatus.LEAD,
      });

      expect(result.total).toBe(1);
      expect(result.clients[0].status).toBe(ClientStatus.LEAD);
    });
  });

  describe('deleteClient', () => {
    const mockClientId = '456e4567-e89b-12d3-a456-426614174001';
    const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';

    it('should delete client with PENDING_COMMITMENT status', async () => {
      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClientId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.PENDING_COMMITMENT,
            agent_id: mockAgentId,
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock delete query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: mockClientId }],
      });

      await expect(service.deleteClient(mockClientId, mockAgentId)).resolves.not.toThrow();
    });

    it('should reject deletion by non-owner agent', async () => {
      const differentAgentId = '789e4567-e89b-12d3-a456-426614174002';

      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClientId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.PENDING_COMMITMENT,
            agent_id: mockAgentId,
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(service.deleteClient(mockClientId, differentAgentId)).rejects.toThrow(
        'Unauthorized: You can only delete your own clients'
      );
    });

    it('should reject deletion when status is not PENDING_COMMITMENT', async () => {
      // Mock getClient with LEAD status
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClientId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.LEAD,
            agent_id: mockAgentId,
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(service.deleteClient(mockClientId, mockAgentId)).rejects.toThrow(
        'Client can only be deleted while status is PENDING_COMMITMENT'
      );
    });
  });

  describe('convertToLead', () => {
    const mockClientId = '456e4567-e89b-12d3-a456-426614174001';
    const mockTransactionId = 'TXN-123456789';

    it('should convert PENDING_COMMITMENT client to LEAD', async () => {
      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClientId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.PENDING_COMMITMENT,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock update query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClientId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await service.convertToLead(mockClientId, mockTransactionId);

      expect(result.status).toBe(ClientStatus.LEAD);
      expect(result.id).toBe(mockClientId);
    });

    it('should reject conversion if status is not PENDING_COMMITMENT', async () => {
      // Mock getClient with LEAD status
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockClientId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(service.convertToLead(mockClientId, mockTransactionId)).rejects.toThrow(
        'Client must have PENDING_COMMITMENT status to convert to LEAD'
      );
    });

    it('should reject conversion if client not found', async () => {
      // Mock getClient returning null
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await expect(service.convertToLead('non-existent-id', mockTransactionId)).rejects.toThrow(
        'Client not found'
      );
    });
  });

  describe('qualifyLead', () => {
    const mockLeadId = '456e4567-e89b-12d3-a456-426614174001';
    const qualificationData = {
      estimatedValue: 50000,
      priority: 'HIGH' as any,
      expectedStartDate: new Date('2024-06-01'),
      notes: 'High priority client',
    };

    it('should qualify LEAD with valid data', async () => {
      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock update query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.QUALIFIED_LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: '50000.00',
            priority: 'HIGH',
            expected_start_date: new Date('2024-06-01'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await service.qualifyLead(mockLeadId, qualificationData);

      expect(result.status).toBe(ClientStatus.QUALIFIED_LEAD);
      expect(result.estimatedValue).toBe(50000);
      expect(result.priority).toBe('HIGH');
    });

    it('should reject qualification if status is not LEAD', async () => {
      // Mock getClient with PENDING_COMMITMENT status
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.PENDING_COMMITMENT,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(service.qualifyLead(mockLeadId, qualificationData)).rejects.toThrow(
        'Client must have LEAD status to be qualified'
      );
    });

    it('should reject qualification with invalid estimated value', async () => {
      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(
        service.qualifyLead(mockLeadId, { ...qualificationData, estimatedValue: -100 })
      ).rejects.toThrow('Estimated value must be greater than 0');
    });

    it('should reject qualification if client not found', async () => {
      // Mock getClient returning null
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      await expect(service.qualifyLead('non-existent-id', qualificationData)).rejects.toThrow(
        'Client not found'
      );
    });
  });

  describe('convertToProject', () => {
    const mockLeadId = '456e4567-e89b-12d3-a456-426614174001';
    const projectData = {
      serviceAmount: 100000,
      currency: 'USD',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-12-31'),
    };

    it('should convert QUALIFIED_LEAD to PROJECT', async () => {
      const year = new Date().getFullYear();

      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.QUALIFIED_LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: '50000.00',
            priority: 'HIGH',
            expected_start_date: new Date('2024-06-01'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock project reference number generation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      // Mock BEGIN transaction
      (db.query as jest.Mock).mockResolvedValueOnce({});

      // Mock client update
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.PROJECT,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: '50000.00',
            priority: 'HIGH',
            expected_start_date: new Date('2024-06-01'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock project creation
      const mockProjectId = '789e4567-e89b-12d3-a456-426614174003';
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockProjectId,
            reference_number: `TST-PRJ-${year}-000001`,
            client_id: mockLeadId,
            status: 'PENDING_APPROVAL',
            service_amount: '100000.00',
            currency: 'USD',
            start_date: new Date('2024-06-01'),
            end_date: new Date('2024-12-31'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock COMMIT transaction
      (db.query as jest.Mock).mockResolvedValueOnce({});

      const result = await service.convertToProject(mockLeadId, projectData);

      expect(result.client.status).toBe(ClientStatus.PROJECT);
      expect(result.project.referenceNumber).toBe(`TST-PRJ-${year}-000001`);
      expect(result.project.serviceAmount).toBe(100000);
      expect(result.project.status).toBe('PENDING_APPROVAL');
    });

    it('should reject conversion if status is not QUALIFIED_LEAD', async () => {
      // Mock getClient with LEAD status
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: null,
            priority: null,
            expected_start_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(service.convertToProject(mockLeadId, projectData)).rejects.toThrow(
        'Client must have QUALIFIED_LEAD status to convert to project'
      );
    });

    it('should reject conversion with invalid service amount', async () => {
      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.QUALIFIED_LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: '50000.00',
            priority: 'HIGH',
            expected_start_date: new Date('2024-06-01'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await expect(
        service.convertToProject(mockLeadId, { ...projectData, serviceAmount: -1000 })
      ).rejects.toThrow('Service amount must be greater than 0');
    });

    it('should generate sequential project reference numbers', async () => {
      const year = new Date().getFullYear();

      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.QUALIFIED_LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: '50000.00',
            priority: 'HIGH',
            expected_start_date: new Date('2024-06-01'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock project reference number generation with existing reference
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ reference_number: `TST-PRJ-${year}-000005` }],
      });

      // Mock BEGIN transaction
      (db.query as jest.Mock).mockResolvedValueOnce({});

      // Mock client update
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.PROJECT,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: '50000.00',
            priority: 'HIGH',
            expected_start_date: new Date('2024-06-01'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock project creation
      const mockProjectId = '789e4567-e89b-12d3-a456-426614174003';
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockProjectId,
            reference_number: `TST-PRJ-${year}-000006`,
            client_id: mockLeadId,
            status: 'PENDING_APPROVAL',
            service_amount: '100000.00',
            currency: 'USD',
            start_date: new Date('2024-06-01'),
            end_date: new Date('2024-12-31'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock COMMIT transaction
      (db.query as jest.Mock).mockResolvedValueOnce({});

      const result = await service.convertToProject(mockLeadId, projectData);

      expect(result.project.referenceNumber).toBe(`TST-PRJ-${year}-000006`);
    });

    it('should rollback transaction on error', async () => {
      // Mock getClient
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: mockLeadId,
            reference_number: 'TST-2024-000001',
            name: 'Test Client',
            email: 'client@example.com',
            phone: '+254712345678',
            country: 'Kenya',
            industry_category: IndustryCategory.SCHOOLS,
            service_description: 'Need a school management system',
            status: ClientStatus.QUALIFIED_LEAD,
            agent_id: '123e4567-e89b-12d3-a456-426614174000',
            estimated_value: '50000.00',
            priority: 'HIGH',
            expected_start_date: new Date('2024-06-01'),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Mock project reference number generation
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      // Mock BEGIN transaction
      (db.query as jest.Mock).mockResolvedValueOnce({});

      // Mock client update failure
      (db.query as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Mock ROLLBACK transaction
      (db.query as jest.Mock).mockResolvedValueOnce({});

      await expect(service.convertToProject(mockLeadId, projectData)).rejects.toThrow(
        'Database error'
      );
    });
  });
});
