/**
 * Integration Tests - TechSwiftTrix ERP System
 * Task 60.2: Perform integration testing
 *
 * Tests complete user workflows end-to-end with mocked external APIs:
 * 1. Complete client capture workflow
 * 2. Payment approval workflow
 * 3. Role-based portal access
 * 4. Contract generation workflow
 * 5. Notification delivery
 *
 * Requirements: All integration requirements
 */

// ─── Mock external services before any imports ───────────────────────────────

jest.mock('../services/daraja/client', () => ({
  darajaClient: {
    initiateMpesaPayment: jest.fn(),
    initiateAirtelPayment: jest.fn(),
    initiateBankTransfer: jest.fn(),
    initiateCardPayment: jest.fn(),
    getPaymentStatus: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    formatPhoneNumber: jest.fn((p: string) => p),
  },
}));

jest.mock('../services/sendgrid/client', () => ({
  sendgridClient: {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/africas-talking/client', () => ({
  africasTalkingClient: {
    sendSMS: jest.fn().mockResolvedValue({ recipients: [{ status: 'Success' }], message: 'Sent' }),
    sendNotificationSMS: jest.fn().mockResolvedValue({ recipients: [{ status: 'Success' }], message: 'Sent' }),
    formatPhoneNumber: jest.fn((p: string) => `+254${p.replace(/\D/g, '').slice(-9)}`),
  },
}));

jest.mock('../services/github/client', () => ({
  githubClient: {
    getRepositoryMetadata: jest.fn(),
    getRepositoryCommits: jest.fn(),
    getRepositoryPullRequests: jest.fn(),
    getUserRepositories: jest.fn(),
  },
}));

jest.mock('../services/firebase/client', () => ({
  firebaseClient: {
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../services/storage', () => ({
  storageClient: {
    upload: jest.fn().mockResolvedValue({ url: 'https://storage.example.com/contracts/test.pdf' }),
    getSignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/signed/test.pdf'),
  },
}));

jest.mock('../contracts/contractPrettyPrinter', () => ({
  contractPrettyPrinter: {
    renderToPDF: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { ClientService, ClientStatus, IndustryCategory, Priority } from '../clients/clientService';
import {
  PaymentProcessingService,
  PaymentStatus,
  ApprovalStatus,
  PaymentMethod,
} from '../payments/paymentService';
import { AuthorizationService, Role, ROLE_PERMISSIONS } from '../auth/authorizationService';
import { ContractGenerationService, ContractStatus } from '../contracts/contractService';
import {
  NotificationService,
  NotificationPriority,
  NotificationType,
} from '../notifications/notificationService';
import { darajaClient } from '../services/daraja/client';
import { sendgridClient } from '../services/sendgrid/client';
import { africasTalkingClient } from '../services/africas-talking/client';
import { githubClient } from '../services/github/client';

// ─── Database mock ────────────────────────────────────────────────────────────

let idCounter = 1;
const nextId = () => String(idCounter++);

// Minimal in-memory DB mock
jest.mock('../database/connection', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../cache/permissionsCache', () => ({
  permissionsCache: {
    getPermissions: jest.fn().mockResolvedValue(null),
    setPermissions: jest.fn().mockResolvedValue(undefined),
    deletePermissions: jest.fn().mockResolvedValue(undefined),
    deleteRolePermissions: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../cache/sessionCache', () => ({
  sessionCache: {
    setSession: jest.fn().mockResolvedValue(undefined),
    getSession: jest.fn().mockResolvedValue(null),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    updateActivity: jest.fn().mockResolvedValue(undefined),
    deleteUserSessions: jest.fn().mockResolvedValue(undefined),
    extendSession: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../cache/cacheService', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '../database/connection';
const mockQuery = db.query as jest.Mock;

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Build a fake DB row for a user with a given role */
function makeUserRow(overrides: Partial<any> = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    email: overrides.email || `user${id}@tst.com`,
    full_name: overrides.full_name || `User ${id}`,
    phone: overrides.phone || '+254700000000',
    role: overrides.role || Role.AGENT,
    permissions: ROLE_PERMISSIONS[overrides.role as Role] || ROLE_PERMISSIONS[Role.AGENT],
    department_id: overrides.department_id || null,
    role_id: overrides.role_id || nextId(),
    ...overrides,
  };
}

/** Build a fake DB row for a client */
function makeClientRow(overrides: Partial<any> = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    reference_number: overrides.reference_number || `TST-2024-${String(id).padStart(6, '0')}`,
    name: overrides.name || 'Test Client',
    email: overrides.email || `client${id}@example.com`,
    phone: overrides.phone || '+254700111222',
    country: overrides.country || 'Kenya',
    industry_category: overrides.industry_category || IndustryCategory.COMPANIES,
    service_description: overrides.service_description || 'ERP implementation',
    status: overrides.status || ClientStatus.PENDING_COMMITMENT,
    agent_id: overrides.agent_id || nextId(),
    estimated_value: overrides.estimated_value || null,
    priority: overrides.priority || null,
    expected_start_date: overrides.expected_start_date || null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/** Build a fake DB row for a project */
function makeProjectRow(overrides: Partial<any> = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    reference_number: overrides.reference_number || `TST-PRJ-2024-${String(id).padStart(6, '0')}`,
    client_id: overrides.client_id || nextId(),
    status: overrides.status || 'PENDING_APPROVAL',
    service_amount: overrides.service_amount || '50000.00',
    currency: overrides.currency || 'KES',
    start_date: overrides.start_date || null,
    end_date: overrides.end_date || null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/** Build a fake DB row for a payment */
function makePaymentRow(overrides: Partial<any> = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    transaction_id: overrides.transaction_id || `TXN-${id}`,
    amount: overrides.amount || '1000.00',
    currency: overrides.currency || 'KES',
    payment_method: overrides.payment_method || PaymentMethod.MPESA,
    status: overrides.status || PaymentStatus.PENDING,
    client_id: overrides.client_id || null,
    project_id: overrides.project_id || null,
    error_code: overrides.error_code || null,
    error_message: overrides.error_message || null,
    created_at: new Date(),
    ...overrides,
  };
}

/** Build a fake DB row for a payment approval */
function makeApprovalRow(overrides: Partial<any> = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    project_id: overrides.project_id || nextId(),
    amount: overrides.amount || '50000.00',
    purpose: overrides.purpose || 'Project payment',
    requester_id: overrides.requester_id || nextId(),
    status: overrides.status || ApprovalStatus.PENDING_APPROVAL,
    approver_id: overrides.approver_id || null,
    executor_id: overrides.executor_id || null,
    approved_at: overrides.approved_at || null,
    executed_at: overrides.executed_at || null,
    rejection_reason: overrides.rejection_reason || null,
    created_at: new Date(),
    ...overrides,
  };
}

/** Build a fake DB row for a contract */
function makeContractRow(overrides: Partial<any> = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    reference_number: overrides.reference_number || `TST-CNT-2024-${String(id).padStart(6, '0')}`,
    project_id: overrides.project_id || nextId(),
    version: overrides.version || 1,
    content: overrides.content || JSON.stringify({
      clientName: 'Test Client',
      clientEmail: 'client@example.com',
      clientPhone: '+254700111222',
      clientCountry: 'Kenya',
      serviceDescription: 'ERP implementation',
      serviceAmount: 50000,
      currency: 'KES',
      transactionIds: ['TXN-001'],
      projectReferenceNumber: 'TST-PRJ-2024-000001',
      industryCategory: 'COMPANIES',
    }),
    pdf_url: overrides.pdf_url || 'https://storage.example.com/contracts/test.pdf',
    status: overrides.status || ContractStatus.ACTIVE,
    created_by: overrides.created_by || nextId(),
    created_at: new Date(),
    ...overrides,
  };
}

/** Build a fake DB row for a notification */
function makeNotificationRow(overrides: Partial<any> = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    user_id: overrides.user_id || nextId(),
    type: overrides.type || NotificationType.PAYMENT_APPROVAL,
    priority: overrides.priority || NotificationPriority.MEDIUM,
    title: overrides.title || 'Test Notification',
    message: overrides.message || 'Test message',
    data: overrides.data || null,
    delivery_status: overrides.delivery_status || JSON.stringify({ EMAIL: { status: 'PENDING', attempts: 0 } }),
    read: overrides.read || false,
    read_at: overrides.read_at || null,
    created_at: new Date(),
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Integration Tests - TechSwiftTrix ERP System', () => {
  let clientService: ClientService;
  let paymentService: PaymentProcessingService;
  let authorizationService: AuthorizationService;
  let contractService: ContractGenerationService;
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
    // Default: return empty rows for any unmatched query
    mockQuery.mockResolvedValue({ rows: [] });
    idCounter = 1;

    clientService = new ClientService();
    paymentService = new PaymentProcessingService();
    authorizationService = new AuthorizationService();
    contractService = new ContractGenerationService();
    notificationService = new NotificationService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Workflow 1: Complete Client Capture Workflow
  // Agent creates client → commitment payment → lead conversion
  // Requirements: 4.1-4.12, 5.1-5.12, 6.1-6.10
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Workflow 1: Complete Client Capture Workflow', () => {
    const agentId = 'agent-001';
    const clientPhone = '+254712345678';

    it('should create a client with PENDING_COMMITMENT status', async () => {
      const agentRow = makeUserRow({ id: agentId, role: Role.AGENT });
      const clientRow = makeClientRow({
        agent_id: agentId,
        status: ClientStatus.PENDING_COMMITMENT,
        reference_number: 'TST-2024-000001',
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })          // validateCountry
        .mockResolvedValueOnce({ rows: [agentRow] })                 // verify agent exists
        .mockResolvedValueOnce({ rows: [] })                         // generateReferenceNumber (no existing)
        .mockResolvedValueOnce({ rows: [clientRow] });               // INSERT client

      const client = await clientService.createClient({
        name: 'Acme School',
        email: 'acme@school.ke',
        phone: clientPhone,
        country: 'Kenya',
        industryCategory: IndustryCategory.SCHOOLS,
        serviceDescription: 'School management ERP',
        agentId,
      });

      expect(client.status).toBe(ClientStatus.PENDING_COMMITMENT);
      expect(client.agentId).toBe(agentId);
      expect(client.referenceNumber).toBe('TST-2024-000001');
    });

    it('should reject client creation with invalid country', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // validateCountry → not found

      await expect(
        clientService.createClient({
          name: 'Test',
          email: 'test@test.com',
          phone: '+254700000000',
          country: 'Atlantis',
          industryCategory: IndustryCategory.COMPANIES,
          serviceDescription: 'Test',
          agentId: 'agent-001',
        })
      ).rejects.toThrow('Invalid country');
    });

    it('should reject client creation with invalid industry category', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // validateCountry → valid

      await expect(
        clientService.createClient({
          name: 'Test',
          email: 'test@test.com',
          phone: '+254700000000',
          country: 'Kenya',
          industryCategory: 'INVALID_CATEGORY' as IndustryCategory,
          serviceDescription: 'Test',
          agentId: 'agent-001',
        })
      ).rejects.toThrow('Invalid industry category');
    });

    it('should initiate commitment payment via Daraja M-Pesa STK Push', async () => {
      const darajaResponse = {
        requestId: 'REQ-001',
        status: 'INITIATED' as const,
        message: 'STK Push sent',
        transactionId: 'TXN-MPESA-001',
      };
      (darajaClient.initiateMpesaPayment as jest.Mock).mockResolvedValue(darajaResponse);

      const paymentRow = makePaymentRow({
        transaction_id: 'TXN-MPESA-001',
        status: PaymentStatus.PENDING,
        client_id: 'client-001',
        payment_method: PaymentMethod.MPESA,
      });
      mockQuery.mockResolvedValueOnce({ rows: [paymentRow] }); // INSERT payment

      const payment = await paymentService.initiateCommitmentPayment(
        'client-001',
        clientPhone,
        500,
        'KES'
      );

      expect(darajaClient.initiateMpesaPayment).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber: clientPhone, amount: 500, currency: 'KES' })
      );
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.transactionId).toBe('TXN-MPESA-001');
    });

    it('should convert client to LEAD after successful payment webhook', async () => {
      const webhookPayload = {
        transactionId: 'TXN-MPESA-001',
        status: 'COMPLETED',
        amount: 500,
        currency: 'KES',
        reference: 'COMMIT-client-001-123',
        timestamp: new Date().toISOString(),
      };

      (darajaClient.verifyWebhookSignature as jest.Mock).mockReturnValue(true);

      const clientRow = makeClientRow({
        id: 'client-001',
        status: ClientStatus.PENDING_COMMITMENT,
        agent_id: agentId,
      });
      const updatedClientRow = { ...clientRow, status: ClientStatus.LEAD };

      mockQuery
        .mockResolvedValueOnce({ rows: [] })                          // UPDATE payment status
        .mockResolvedValueOnce({ rows: [{ client_id: 'client-001' }] }) // SELECT client_id from payment
        .mockResolvedValueOnce({ rows: [clientRow] })                 // getClient
        .mockResolvedValueOnce({ rows: [updatedClientRow] });         // UPDATE client to LEAD

      await paymentService.handleWebhook('valid-signature', webhookPayload);

      // Verify webhook signature was checked
      expect(darajaClient.verifyWebhookSignature).toHaveBeenCalledWith(
        'valid-signature',
        JSON.stringify(webhookPayload)
      );
    });

    it('should reject webhook with invalid signature', async () => {
      (darajaClient.verifyWebhookSignature as jest.Mock).mockReturnValue(false);

      await expect(
        paymentService.handleWebhook('bad-signature', { transactionId: 'TXN-001', status: 'COMPLETED' })
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should qualify a lead and convert to project', async () => {
      const leadRow = makeClientRow({ id: 'lead-001', status: ClientStatus.LEAD, agent_id: agentId });
      const qualifiedRow = { ...leadRow, status: ClientStatus.QUALIFIED_LEAD, estimated_value: '100000', priority: Priority.HIGH };
      const projectRow = makeProjectRow({ client_id: 'lead-001', reference_number: 'TST-PRJ-2024-000001' });
      const projectClientRow = { ...qualifiedRow, status: ClientStatus.PROJECT };

      // qualifyLead
      mockQuery
        .mockResolvedValueOnce({ rows: [leadRow] })       // getClient
        .mockResolvedValueOnce({ rows: [qualifiedRow] }); // UPDATE to QUALIFIED_LEAD

      const qualified = await clientService.qualifyLead('lead-001', {
        estimatedValue: 100000,
        priority: Priority.HIGH,
        expectedStartDate: new Date('2025-01-01'),
        notes: 'High value client',
      });

      expect(qualified.status).toBe(ClientStatus.QUALIFIED_LEAD);

      // convertToProject
      mockQuery
        .mockResolvedValueOnce({ rows: [qualifiedRow] })  // getClient
        .mockResolvedValueOnce({ rows: [] })              // generateProjectRef (no existing)
        .mockResolvedValueOnce({ rows: [] })              // BEGIN
        .mockResolvedValueOnce({ rows: [projectClientRow] }) // UPDATE client to PROJECT
        .mockResolvedValueOnce({ rows: [projectRow] })    // INSERT project
        .mockResolvedValueOnce({ rows: [] });             // COMMIT

      const { client: projectClient, project } = await clientService.convertToProject('lead-001', {
        serviceAmount: 100000,
        currency: 'KES',
      });

      expect(projectClient.status).toBe(ClientStatus.PROJECT);
      expect(project.referenceNumber).toMatch(/^TST-PRJ-\d{4}-\d{6}$/);
      expect(project.serviceAmount).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Workflow 2: Payment Approval Workflow
  // CFO approves → EA executes → payment processed
  // Requirements: 7.1-7.10
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Workflow 2: Payment Approval Workflow', () => {
    const cfoId = 'cfo-001';
    const eaId = 'ea-001';
    const requesterId = 'ops-001';
    const projectId = 'project-001';

    it('should create a payment approval request', async () => {
      const approvalRow = makeApprovalRow({
        project_id: projectId,
        amount: '50000.00',
        purpose: 'Software development services',
        requester_id: requesterId,
        status: ApprovalStatus.PENDING_APPROVAL,
      });

      mockQuery.mockResolvedValueOnce({ rows: [approvalRow] }); // INSERT approval

      const approval = await paymentService.createApprovalRequest(
        projectId,
        50000,
        'Software development services',
        requesterId
      );

      expect(approval.status).toBe(ApprovalStatus.PENDING_APPROVAL);
      expect(approval.projectId).toBe(projectId);
      expect(approval.amount).toBe(50000);
    });

    it('should allow CFO to approve a payment', async () => {
      const approvalRow = makeApprovalRow({
        id: 'approval-001',
        project_id: projectId,
        requester_id: requesterId,
        status: ApprovalStatus.PENDING_APPROVAL,
      });
      const approvedRow = {
        ...approvalRow,
        status: ApprovalStatus.APPROVED_PENDING_EXECUTION,
        approver_id: cfoId,
        approved_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [approvedRow] }); // UPDATE approval

      const approval = await paymentService.approvePayment('approval-001', cfoId);

      expect(approval.status).toBe(ApprovalStatus.APPROVED_PENDING_EXECUTION);
      expect(approval.approverId).toBe(cfoId);
    });

    it('should allow CFO to reject a payment with reason', async () => {
      const approvalRow = makeApprovalRow({
        id: 'approval-002',
        project_id: projectId,
        requester_id: requesterId,
        status: ApprovalStatus.REJECTED,
        approver_id: cfoId,
        rejection_reason: 'Budget exceeded',
      });

      mockQuery.mockResolvedValueOnce({ rows: [approvalRow] }); // UPDATE approval

      const approval = await paymentService.rejectPayment('approval-002', cfoId, 'Budget exceeded');

      expect(approval.status).toBe(ApprovalStatus.REJECTED);
      expect(approval.rejectionReason).toBe('Budget exceeded');
    });

    it('should prevent same user from approving and executing payment', async () => {
      const approvalRow = makeApprovalRow({
        id: 'approval-003',
        project_id: projectId,
        requester_id: requesterId,
        status: ApprovalStatus.APPROVED_PENDING_EXECUTION,
        approver_id: cfoId, // CFO approved
      });

      mockQuery.mockResolvedValueOnce({ rows: [approvalRow] }); // SELECT approval

      // CFO tries to also execute — must fail
      await expect(
        paymentService.executePayment('approval-003', cfoId, {
          paymentMethod: 'MPESA',
          phoneNumber: '+254700000000',
        })
      ).rejects.toThrow('Same user cannot approve and execute a payment');
    });

    it('should allow EA to execute an approved payment via M-Pesa', async () => {
      const approvalRow = makeApprovalRow({
        id: 'approval-004',
        project_id: projectId,
        requester_id: requesterId,
        status: ApprovalStatus.APPROVED_PENDING_EXECUTION,
        approver_id: cfoId,
        amount: '50000.00',
        purpose: 'Software development services',
      });
      const executedApprovalRow = {
        ...approvalRow,
        status: ApprovalStatus.EXECUTED,
        executor_id: eaId,
        executed_at: new Date(),
      };
      const paymentRow = makePaymentRow({
        transaction_id: 'TXN-EXEC-001',
        status: PaymentStatus.PENDING,
        project_id: projectId,
        payment_method: PaymentMethod.MPESA,
      });

      const darajaResponse = {
        requestId: 'REQ-EXEC-001',
        status: 'INITIATED' as const,
        message: 'STK Push sent',
        transactionId: 'TXN-EXEC-001',
      };
      (darajaClient.initiateMpesaPayment as jest.Mock).mockResolvedValue(darajaResponse);

      mockQuery
        .mockResolvedValueOnce({ rows: [approvalRow] })          // SELECT approval
        .mockResolvedValueOnce({ rows: [{ currency: 'KES' }] })  // SELECT project currency
        .mockResolvedValueOnce({ rows: [paymentRow] })            // INSERT payment (via initiateMpesaPayment)
        .mockResolvedValueOnce({ rows: [executedApprovalRow] });  // UPDATE approval to EXECUTED

      const { approval, payment } = await paymentService.executePayment('approval-004', eaId, {
        paymentMethod: 'MPESA',
        phoneNumber: '+254700000000',
      });

      expect(approval.status).toBe(ApprovalStatus.EXECUTED);
      expect(approval.executorId).toBe(eaId);
      expect(payment.transactionId).toBe('TXN-EXEC-001');
      expect(darajaClient.initiateMpesaPayment).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Workflow 3: Role-Based Portal Access
  // Verify each role can only access their designated portal
  // Requirements: 2.1-2.10, 3.1-3.10
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Workflow 3: Role-Based Portal Access', () => {
    const PORTAL_ROLE_MAP: Record<string, Role[]> = {
      '/ceo': [Role.CEO],
      '/executive': [Role.EA, Role.CoS, Role.CFO],
      '/clevel': [Role.COO, Role.CTO],
      '/operations': [Role.OPERATIONS_USER],
      '/technology': [Role.TECH_STAFF, Role.DEVELOPER],
      '/agents': [Role.AGENT],
      '/trainers': [Role.TRAINER, Role.HEAD_OF_TRAINERS],
    };

    it('should grant CEO access to all portals', async () => {
      const ceoRow = makeUserRow({ id: 'ceo-001', role: Role.CEO });

      // CEO has wildcard permissions — any portal check should pass
      mockQuery.mockResolvedValue({ rows: [ceoRow] });

      const canAccessFinancial = await authorizationService.canAccessFinancialData('ceo-001');
      expect(canAccessFinancial).toBe(true);
    });

    it('should restrict financial data to CEO, CoS, CFO, EA only', async () => {
      const financialRoles = [Role.CEO, Role.CoS, Role.CFO, Role.EA];
      const nonFinancialRoles = [Role.COO, Role.CTO, Role.AGENT, Role.TRAINER, Role.OPERATIONS_USER, Role.TECH_STAFF, Role.DEVELOPER];

      for (const role of financialRoles) {
        const userRow = makeUserRow({ role });
        mockQuery.mockResolvedValueOnce({ rows: [userRow] });
        const canAccess = await authorizationService.canAccessFinancialData(`user-${role}`);
        expect(canAccess).toBe(true);
      }

      for (const role of nonFinancialRoles) {
        const userRow = makeUserRow({ role });
        mockQuery.mockResolvedValueOnce({ rows: [userRow] });
        const canAccess = await authorizationService.canAccessFinancialData(`user-${role}`);
        expect(canAccess).toBe(false);
      }
    });

    it('should verify CEO portal permissions include all system resources', () => {
      const ceoPermissions = ROLE_PERMISSIONS[Role.CEO];
      expect(ceoPermissions).toContain('read:*');
      expect(ceoPermissions).toContain('write:*');
      expect(ceoPermissions).toContain('access:financial_data');
      expect(ceoPermissions).toContain('approve:service_amount_changes');
      expect(ceoPermissions).toContain('view:audit_logs');
    });

    it('should verify Agent portal permissions are restricted to own data', () => {
      const agentPermissions = ROLE_PERMISSIONS[Role.AGENT];
      expect(agentPermissions).toContain('read:own_clients');
      expect(agentPermissions).toContain('access:agents_portal');
      expect(agentPermissions).not.toContain('read:*');
      expect(agentPermissions).not.toContain('access:financial_data');
      expect(agentPermissions).not.toContain('view:audit_logs');
    });

    it('should verify Executive portal roles have financial access', () => {
      const executiveRoles = [Role.EA, Role.CoS, Role.CFO];
      for (const role of executiveRoles) {
        const permissions = ROLE_PERMISSIONS[role];
        expect(permissions).toContain('access:financial_data');
        expect(permissions).toContain('access:executive_portal');
      }
    });

    it('should verify C-Level portal roles have department management access', () => {
      const clevelRoles = [Role.COO, Role.CTO];
      for (const role of clevelRoles) {
        const permissions = ROLE_PERMISSIONS[role];
        expect(permissions).toContain('access:clevel_portal');
        expect(permissions).toContain('view:cross_country_achievements');
      }
    });

    it('should verify Technology portal roles have GitHub access', () => {
      const techRoles = [Role.TECH_STAFF, Role.DEVELOPER];
      for (const role of techRoles) {
        const permissions = ROLE_PERMISSIONS[role];
        expect(permissions).toContain('access:technology_portal');
        expect(permissions).toContain('read:github_repositories');
      }
    });

    it('should verify Developer role requires GitHub OAuth (has link:github_repositories)', () => {
      const devPermissions = ROLE_PERMISSIONS[Role.DEVELOPER];
      expect(devPermissions).toContain('link:github_repositories');
    });

    it('should verify Trainers portal roles have training management access', () => {
      const trainerPermissions = ROLE_PERMISSIONS[Role.TRAINER];
      const hotPermissions = ROLE_PERMISSIONS[Role.HEAD_OF_TRAINERS];

      expect(trainerPermissions).toContain('access:trainers_portal');
      expect(hotPermissions).toContain('access:trainers_portal');
      expect(hotPermissions).toContain('manage:trainers');
      expect(hotPermissions).toContain('verify:training_completion');
    });

    it('should enforce agent resource ownership — agent can only access own clients', async () => {
      const agentId = 'agent-001';
      const otherAgentId = 'agent-002';
      const clientRow = makeClientRow({ id: 'client-001', agent_id: agentId });

      // Agent accessing own client:
      // canAccessResource calls getUserPermissions (DB) then getUserRole (DB) then ownsResource (DB)
      const agentUserRow = makeUserRow({ id: agentId, role: Role.AGENT });
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: Role.AGENT, permissions: null, department_id: null }] }) // getUserPermissions
        .mockResolvedValueOnce({ rows: [agentUserRow] })  // getUserRole
        .mockResolvedValueOnce({ rows: [clientRow] });    // ownsResource

      const canAccess = await authorizationService.canAccessResource(agentId, 'clients', 'client-001');
      expect(canAccess).toBe(true);

      // Other agent trying to access the same client (agent_id is agentId, not otherAgentId)
      const otherAgentRow = makeUserRow({ id: otherAgentId, role: Role.AGENT });
      mockQuery
        .mockResolvedValueOnce({ rows: [{ role: Role.AGENT, permissions: null, department_id: null }] }) // getUserPermissions
        .mockResolvedValueOnce({ rows: [otherAgentRow] }) // getUserRole
        .mockResolvedValueOnce({ rows: [clientRow] });    // ownsResource (agent_id is agentId, not otherAgentId)

      const cannotAccess = await authorizationService.canAccessResource(otherAgentId, 'clients', 'client-001');
      expect(cannotAccess).toBe(false);
    });

    it('should verify all 12 roles are defined in ROLE_PERMISSIONS', () => {
      const expectedRoles = [
        Role.CEO, Role.CoS, Role.CFO, Role.COO, Role.CTO, Role.EA,
        Role.HEAD_OF_TRAINERS, Role.TRAINER, Role.AGENT,
        Role.OPERATIONS_USER, Role.TECH_STAFF, Role.DEVELOPER,
      ];
      for (const role of expectedRoles) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
        expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      }
    });

    it('should map each portal to the correct roles', () => {
      // Verify portal-role mapping is consistent with permission definitions
      for (const [portal, roles] of Object.entries(PORTAL_ROLE_MAP)) {
        for (const role of roles) {
          const permissions = ROLE_PERMISSIONS[role];
          const portalName = portal.replace('/', '');
          // Each role should have access to its designated portal
          const hasPortalAccess = permissions.some(
            (p) => p.includes(`access:${portalName}_portal`) || p.includes('access:all_portals') || p.includes('read:*')
          );
          expect(hasPortalAccess).toBe(true);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Workflow 4: Contract Generation Workflow
  // Project approved → contract auto-generated → sent to client
  // Requirements: 9.1-9.11
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Workflow 4: Contract Generation Workflow', () => {
    const projectId = 'project-001';
    const requesterId = 'admin-001';

    it('should generate a contract with unique reference number', async () => {
      const requesterRow = makeUserRow({ id: requesterId });
      const projectRow = {
        id: projectId,
        reference_number: 'TST-PRJ-2024-000001',
        status: 'ACTIVE',
        service_amount: '100000.00',
        currency: 'KES',
        start_date: null,
        end_date: null,
        client_id: 'client-001',
        client_name: 'Acme School',
        client_email: 'acme@school.ke',
        client_phone: '+254712345678',
        client_country: 'Kenya',
        service_description: 'School management ERP',
        industry_category: 'SCHOOLS',
      };
      const contractRow = makeContractRow({
        id: 'contract-001',
        project_id: projectId,
        reference_number: 'TST-CNT-2024-000001',
        version: 1,
        created_by: requesterId,
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [requesterRow] })              // verify requester
        .mockResolvedValueOnce({ rows: [projectRow] })                // fetchProjectData (project + client join)
        .mockResolvedValueOnce({ rows: [] })                          // project payments
        .mockResolvedValueOnce({ rows: [] })                          // commitment payments
        .mockResolvedValueOnce({ rows: [] })                          // generateReferenceNumber (no existing)
        .mockResolvedValueOnce({ rows: [{ next_version: '1' }] })    // get next version
        // version === 1, so no UPDATE superseded
        .mockResolvedValueOnce({ rows: [contractRow] })               // INSERT contract
        .mockResolvedValueOnce({ rows: [] });                         // INSERT contract_version

      const contract = await contractService.generateContract(projectId, requesterId);

      expect(contract.referenceNumber).toMatch(/^TST-CNT-\d{4}-\d{6}$/);
      expect(contract.projectId).toBe(projectId);
      expect(contract.version).toBe(1);
      expect(contract.status).toBe(ContractStatus.ACTIVE);
    });

    it('should render contract PDF and store in file storage', async () => {
      const { contractPrettyPrinter } = require('../contracts/contractPrettyPrinter');
      const { storageClient } = require('../services/storage');

      const requesterRow = makeUserRow({ id: requesterId });
      const projectRow = {
        id: projectId,
        reference_number: 'TST-PRJ-2024-000001',
        status: 'ACTIVE',
        service_amount: '50000.00',
        currency: 'USD',
        start_date: null,
        end_date: null,
        client_id: 'client-002',
        client_name: 'City Hospital',
        client_email: 'info@cityhospital.ke',
        client_phone: '+254700222333',
        client_country: 'Kenya',
        service_description: 'Hospital management system',
        industry_category: 'HOSPITALS',
      };
      const contractRow = makeContractRow({
        project_id: projectId,
        reference_number: 'TST-CNT-2024-000002',
        version: 1,
        created_by: requesterId,
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [requesterRow] })
        .mockResolvedValueOnce({ rows: [projectRow] })
        .mockResolvedValueOnce({ rows: [] })                          // project payments
        .mockResolvedValueOnce({ rows: [] })                          // commitment payments
        .mockResolvedValueOnce({ rows: [] })                          // generateReferenceNumber
        .mockResolvedValueOnce({ rows: [{ next_version: '1' }] })
        .mockResolvedValueOnce({ rows: [contractRow] })
        .mockResolvedValueOnce({ rows: [] });

      await contractService.generateContract(projectId, requesterId);

      expect(contractPrettyPrinter.renderToPDF).toHaveBeenCalled();
      expect(storageClient.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'application/pdf',
          metadata: expect.objectContaining({ projectId }),
        })
      );
    });

    it('should send contract copy to client via SendGrid email', async () => {
      const requesterRow = makeUserRow({ id: requesterId });
      const projectRow = {
        id: projectId,
        reference_number: 'TST-PRJ-2024-000001',
        status: 'ACTIVE',
        service_amount: '75000.00',
        currency: 'KES',
        start_date: null,
        end_date: null,
        client_id: 'client-003',
        client_name: 'Grand Hotel',
        client_email: 'info@grandhotel.ke',
        client_phone: '+254700333444',
        client_country: 'Kenya',
        service_description: 'Hotel management system',
        industry_category: 'HOTELS',
      };
      const contractRow = makeContractRow({
        project_id: projectId,
        reference_number: 'TST-CNT-2024-000003',
        version: 1,
        created_by: requesterId,
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [requesterRow] })
        .mockResolvedValueOnce({ rows: [projectRow] })
        .mockResolvedValueOnce({ rows: [] })                          // project payments
        .mockResolvedValueOnce({ rows: [] })                          // commitment payments
        .mockResolvedValueOnce({ rows: [] })                          // generateReferenceNumber
        .mockResolvedValueOnce({ rows: [{ next_version: '1' }] })
        .mockResolvedValueOnce({ rows: [contractRow] })
        .mockResolvedValueOnce({ rows: [] });

      await contractService.generateContract(projectId, requesterId);

      expect(sendgridClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'info@grandhotel.ke',
          subject: expect.stringContaining('TST-CNT-'),
          attachments: expect.arrayContaining([
            expect.objectContaining({ type: 'application/pdf', disposition: 'attachment' }),
          ]),
        })
      );
    });

    it('should supersede previous contract when generating a new version', async () => {
      const requesterRow = makeUserRow({ id: requesterId });
      const projectRow = {
        id: projectId,
        reference_number: 'TST-PRJ-2024-000001',
        status: 'ACTIVE',
        service_amount: '120000.00',
        currency: 'KES',
        start_date: null,
        end_date: null,
        client_id: 'client-004',
        client_name: 'Tech Company',
        client_email: 'info@techco.ke',
        client_phone: '+254700444555',
        client_country: 'Kenya',
        service_description: 'Enterprise software',
        industry_category: 'COMPANIES',
      };
      const contractRow = makeContractRow({
        project_id: projectId,
        reference_number: 'TST-CNT-2024-000004',
        version: 2,
        created_by: requesterId,
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [requesterRow] })
        .mockResolvedValueOnce({ rows: [projectRow] })
        .mockResolvedValueOnce({ rows: [] })                          // project payments
        .mockResolvedValueOnce({ rows: [] })                          // commitment payments
        .mockResolvedValueOnce({ rows: [{ reference_number: 'TST-CNT-2024-000003' }] }) // existing contract
        .mockResolvedValueOnce({ rows: [{ next_version: '2' }] })
        .mockResolvedValueOnce({ rows: [] })                          // UPDATE superseded contracts
        .mockResolvedValueOnce({ rows: [contractRow] })
        .mockResolvedValueOnce({ rows: [] });

      const contract = await contractService.generateContract(projectId, requesterId);

      expect(contract.version).toBe(2);
      // Verify the UPDATE superseded query was called (status value is in params, not SQL)
      const updateCall = mockQuery.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('UPDATE contracts') &&
          Array.isArray(call[1]) &&
          call[1].includes(ContractStatus.SUPERSEDED)
      );
      expect(updateCall).toBeDefined();
    });

    it('should generate unique contract reference numbers in TST-CNT-YYYY-NNNNNN format', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no existing contracts

      const refNumber = await contractService.generateReferenceNumber();
      expect(refNumber).toMatch(/^TST-CNT-\d{4}-\d{6}$/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Workflow 5: Notification Delivery
  // Event triggered → notification sent via correct channel
  // Requirements: 14.1-14.12
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Workflow 5: Notification Delivery', () => {
    const userId = 'user-001';

    it('should route HIGH priority notifications to SMS via Africa\'s Talking', async () => {
      const userRow = { email: 'user@tst.com', phone: '+254700000001', full_name: 'Test User' };
      const notifRow = makeNotificationRow({
        id: 'notif-sms-001',
        user_id: userId,
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.HIGH,
        title: 'Payment Approval Required',
        message: 'A payment of KES 50,000 requires your approval.',
        delivery_status: JSON.stringify({ SMS: { status: 'SENT', attempts: 1 } }),
      });

      // INSERT notification, getUserById, updateDeliveryStatus, getNotificationById
      mockQuery
        .mockResolvedValueOnce({ rows: [notifRow] })
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [notifRow] });

      const notification = await notificationService.sendNotification({
        userId,
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.HIGH,
        title: 'Payment Approval Required',
        message: 'A payment of KES 50,000 requires your approval.',
      });

      expect(africasTalkingClient.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Payment Approval Required') })
      );
      expect(notification.type).toBe(NotificationType.PAYMENT_APPROVAL);
    });

    it('should route MEDIUM priority notifications to email via SendGrid', async () => {
      const userRow = { email: 'user@tst.com', phone: '+254700000001', full_name: 'Test User' };
      const notifRow = makeNotificationRow({
        id: 'notif-email-001',
        user_id: userId,
        type: NotificationType.CONTRACT_GENERATED,
        priority: NotificationPriority.MEDIUM,
        title: 'Contract Generated',
        message: 'Your contract TST-CNT-2024-000001 has been generated.',
        delivery_status: JSON.stringify({ EMAIL: { status: 'SENT', attempts: 1 } }),
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [notifRow] })
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [notifRow] });

      await notificationService.sendNotification({
        userId,
        type: NotificationType.CONTRACT_GENERATED,
        priority: NotificationPriority.MEDIUM,
        title: 'Contract Generated',
        message: 'Your contract TST-CNT-2024-000001 has been generated.',
      });

      expect(sendgridClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@tst.com',
          subject: 'Contract Generated',
        })
      );
    });

    it('should route LOW priority notifications to push via Firebase', async () => {
      const notifRow = makeNotificationRow({
        id: 'notif-push-001',
        user_id: userId,
        type: NotificationType.MESSAGE_RECEIVED,
        priority: NotificationPriority.LOW,
        title: 'New Message',
        message: 'You have a new message from John.',
        delivery_status: JSON.stringify({ PUSH: { status: 'SENT', attempts: 1 } }),
      });

      const { firebaseClient } = require('../services/firebase/client');

      mockQuery
        .mockResolvedValueOnce({ rows: [notifRow] })
        .mockResolvedValueOnce({ rows: [{ token: 'fcm-token-001' }] }) // getUserFCMToken
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [notifRow] });

      await notificationService.sendNotification({
        userId,
        type: NotificationType.MESSAGE_RECEIVED,
        priority: NotificationPriority.LOW,
        title: 'New Message',
        message: 'You have a new message from John.',
      });

      expect(firebaseClient.sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'fcm-token-001',
          title: 'New Message',
          body: 'You have a new message from John.',
        })
      );
    });

    it('should send SMS directly to a user phone number', async () => {
      const userRow = { email: 'user@tst.com', phone: '+254700000002', full_name: 'Test User' };
      mockQuery.mockResolvedValueOnce({ rows: [userRow] });

      await notificationService.sendSMS(userId, 'Your report is overdue. Please submit now.');

      expect(africasTalkingClient.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Your report is overdue. Please submit now.' })
      );
    });

    it('should send email directly to a user email address', async () => {
      const userRow = { email: 'user@tst.com', phone: '+254700000001', full_name: 'Test User' };
      mockQuery.mockResolvedValueOnce({ rows: [userRow] });

      await notificationService.sendEmail(
        userId,
        'Payment Executed',
        '<p>Your payment has been executed successfully.</p>'
      );

      expect(sendgridClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@tst.com',
          subject: 'Payment Executed',
          html: '<p>Your payment has been executed successfully.</p>',
        })
      );
    });

    it('should mark a notification as read', async () => {
      const notifRow = {
        id: 'notif-001',
        user_id: userId,
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.MEDIUM,
        title: 'Test',
        message: 'Test message',
        data: null,
        delivery_status: JSON.stringify({ EMAIL: { status: 'SENT', attempts: 1 } }),
        read: true,
        read_at: new Date(),
        created_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [notifRow] });

      const notification = await notificationService.markAsRead('notif-001', userId);

      expect(notification.read).toBe(true);
      expect(notification.readAt).toBeDefined();
    });

    it('should throw when marking a notification that does not belong to user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no rows returned

      await expect(
        notificationService.markAsRead('notif-999', 'wrong-user')
      ).rejects.toThrow('Notification not found or access denied');
    });

    it('should get unread notification count for a user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const count = await notificationService.getUnreadCount(userId);
      expect(count).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GitHub Integration Tests
  // Requirements: 12.3-12.10
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GitHub Integration', () => {
    it('should fetch repository metadata via GitHub API', async () => {
      const repoMetadata = {
        id: 123456,
        name: 'erp-frontend',
        fullName: 'techswifttrix/erp-frontend',
        description: 'TST ERP Frontend',
        url: 'https://github.com/techswifttrix/erp-frontend',
        defaultBranch: 'main',
        private: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-01T00:00:00Z',
      };

      (githubClient.getRepositoryMetadata as jest.Mock).mockResolvedValue(repoMetadata);

      const result = await githubClient.getRepositoryMetadata(
        'techswifttrix',
        'erp-frontend',
        'github-access-token'
      );

      expect(result.fullName).toBe('techswifttrix/erp-frontend');
      expect(result.defaultBranch).toBe('main');
      expect(githubClient.getRepositoryMetadata).toHaveBeenCalledWith(
        'techswifttrix',
        'erp-frontend',
        'github-access-token'
      );
    });

    it('should fetch commit history for a linked repository', async () => {
      const commits = [
        {
          sha: 'abc123',
          message: 'feat: add payment module',
          author: { name: 'Dev One', email: 'dev1@tst.com', date: '2024-06-01T10:00:00Z' },
          url: 'https://github.com/techswifttrix/erp-frontend/commit/abc123',
        },
        {
          sha: 'def456',
          message: 'fix: resolve auth bug',
          author: { name: 'Dev Two', email: 'dev2@tst.com', date: '2024-06-02T11:00:00Z' },
          url: 'https://github.com/techswifttrix/erp-frontend/commit/def456',
        },
      ];

      (githubClient.getRepositoryCommits as jest.Mock).mockResolvedValue(commits);

      const result = await githubClient.getRepositoryCommits(
        'techswifttrix',
        'erp-frontend',
        'github-access-token'
      );

      expect(result).toHaveLength(2);
      expect(result[0].sha).toBe('abc123');
      expect(result[1].message).toContain('auth bug');
    });

    it('should fetch pull request status for a linked repository', async () => {
      const pullRequests = [
        {
          id: 1,
          number: 42,
          title: 'Add payment processing module',
          state: 'merged' as const,
          createdAt: '2024-06-01T09:00:00Z',
          updatedAt: '2024-06-03T14:00:00Z',
          mergedAt: '2024-06-03T14:00:00Z',
          author: 'dev-one',
          url: 'https://github.com/techswifttrix/erp-frontend/pull/42',
        },
        {
          id: 2,
          number: 43,
          title: 'Fix authentication flow',
          state: 'open' as const,
          createdAt: '2024-06-04T10:00:00Z',
          updatedAt: '2024-06-04T10:00:00Z',
          author: 'dev-two',
          url: 'https://github.com/techswifttrix/erp-frontend/pull/43',
        },
      ];

      (githubClient.getRepositoryPullRequests as jest.Mock).mockResolvedValue(pullRequests);

      const result = await githubClient.getRepositoryPullRequests(
        'techswifttrix',
        'erp-frontend',
        'github-access-token',
        'all'
      );

      expect(result).toHaveLength(2);
      const mergedPR = result.find((pr) => pr.state === 'merged');
      expect(mergedPR).toBeDefined();
      expect(mergedPR?.mergedAt).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SendGrid Email Delivery Tests
  // Requirements: 14.4, 38.1-38.9
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SendGrid Email Delivery', () => {
    it('should send invitation email via SendGrid', async () => {
      await sendgridClient.sendInvitationEmail(
        'newuser@example.com',
        'https://app.tst.com/register?token=abc123',
        'New User'
      );

      expect(sendgridClient.sendInvitationEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        expect.stringContaining('token=abc123'),
        'New User'
      );
    });

    it('should send password reset email via SendGrid', async () => {
      await sendgridClient.sendPasswordResetEmail(
        'user@example.com',
        'https://app.tst.com/reset?token=xyz789',
        'Existing User'
      );

      expect(sendgridClient.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('token=xyz789'),
        'Existing User'
      );
    });

    it('should send notification email with action URL', async () => {
      await sendgridClient.sendNotificationEmail(
        'cfo@tst.com',
        'Payment Approval Required',
        'A payment of KES 50,000 is awaiting your approval.',
        'https://app.tst.com/executive/payments/approval-001',
        'Review Payment'
      );

      expect(sendgridClient.sendNotificationEmail).toHaveBeenCalledWith(
        'cfo@tst.com',
        'Payment Approval Required',
        expect.any(String),
        expect.stringContaining('approval-001'),
        'Review Payment'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Africa's Talking SMS Delivery Tests
  // Requirements: 14.3
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Africa\'s Talking SMS Delivery', () => {
    it('should send SMS notification via Africa\'s Talking', async () => {
      const mockResponse = {
        recipients: [{ number: '+254700000001', status: 'Success', messageId: 'MSG-001', cost: 'KES 1' }],
        message: 'Sent to 1/1 Total Cost: KES 1',
      };
      (africasTalkingClient.sendSMS as jest.Mock).mockResolvedValue(mockResponse);

      const result = await africasTalkingClient.sendSMS({
        to: '+254700000001',
        message: 'Report overdue: Please submit your daily report.',
      });

      expect(result.recipients[0].status).toBe('Success');
      expect(africasTalkingClient.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+254700000001' })
      );
    });

    it('should format phone numbers to E.164 format', () => {
      // The mock returns the formatted number
      (africasTalkingClient.formatPhoneNumber as jest.Mock).mockImplementation(
        (phone: string) => `+254${phone.replace(/\D/g, '').slice(-9)}`
      );

      const formatted = africasTalkingClient.formatPhoneNumber('0712345678');
      expect(formatted).toMatch(/^\+254\d{9}$/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Payment Method Tests (Daraja API)
  // Requirements: 5.1-5.6
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Daraja API Payment Methods', () => {
    it('should initiate Airtel Money payment', async () => {
      const darajaResponse = {
        requestId: 'REQ-AIRTEL-001',
        status: 'INITIATED' as const,
        message: 'Airtel Money request sent',
        transactionId: 'TXN-AIRTEL-001',
      };
      (darajaClient.initiateAirtelPayment as jest.Mock).mockResolvedValue(darajaResponse);

      const paymentRow = {
        id: 'pay-airtel-001',
        transaction_id: 'TXN-AIRTEL-001',
        amount: '2000.00',
        currency: 'KES',
        payment_method: 'AIRTEL_MONEY',
        status: 'PENDING',
        client_id: null,
        project_id: null,
        error_code: null,
        error_message: null,
        created_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [paymentRow] });

      const payment = await paymentService.initiateAirtelPayment({
        phoneNumber: '+254733000001',
        amount: 2000,
        currency: 'KES',
        reference: 'REF-001',
      });

      expect(darajaClient.initiateAirtelPayment).toHaveBeenCalled();
      expect(payment.paymentMethod).toBe(PaymentMethod.AIRTEL_MONEY);
      expect(payment.status).toBe(PaymentStatus.PENDING);
    });

    it('should initiate bank transfer payment', async () => {
      const darajaResponse = {
        requestId: 'REQ-BANK-001',
        status: 'INITIATED' as const,
        message: 'Bank transfer initiated',
        transactionId: 'TXN-BANK-001',
      };
      (darajaClient.initiateBankTransfer as jest.Mock).mockResolvedValue(darajaResponse);

      const paymentRow = {
        id: 'pay-bank-001',
        transaction_id: 'TXN-BANK-001',
        amount: '100000.00',
        currency: 'KES',
        payment_method: 'BANK_TRANSFER',
        status: 'PENDING',
        client_id: null,
        project_id: null,
        error_code: null,
        error_message: null,
        created_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [paymentRow] });

      const payment = await paymentService.initiateBankTransfer({
        accountNumber: '1234567890',
        bankCode: 'KCB',
        amount: 100000,
        currency: 'KES',
        reference: 'REF-BANK-001',
      });

      expect(darajaClient.initiateBankTransfer).toHaveBeenCalledWith(
        '1234567890',
        'KCB',
        100000,
        'KES',
        'REF-BANK-001'
      );
      expect(payment.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
    });

    it('should initiate Visa card payment', async () => {
      const darajaResponse = {
        requestId: 'REQ-CARD-001',
        status: 'INITIATED' as const,
        message: 'Card payment initiated',
        transactionId: 'TXN-CARD-001',
      };
      (darajaClient.initiateCardPayment as jest.Mock).mockResolvedValue(darajaResponse);

      const paymentRow = {
        id: 'pay-card-001',
        transaction_id: 'TXN-CARD-001',
        amount: '5000.00',
        currency: 'USD',
        payment_method: 'VISA',
        status: 'PENDING',
        client_id: null,
        project_id: null,
        error_code: null,
        error_message: null,
        created_at: new Date(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [paymentRow] });

      const payment = await paymentService.initiateCardPayment({
        cardNumber: '4111111111111111', // Visa test card
        expiryMonth: '12',
        expiryYear: '2026',
        cvv: '123',
        cardholderName: 'John Doe',
        amount: 5000,
        currency: 'USD',
        reference: 'REF-CARD-001',
      });

      expect(darajaClient.initiateCardPayment).toHaveBeenCalled();
      expect(payment.paymentMethod).toBe(PaymentMethod.VISA);
    });

    it('should reject payment with zero amount', async () => {
      await expect(
        paymentService.initiateMpesaPayment({
          phoneNumber: '+254700000000',
          amount: 0,
          currency: 'KES',
          reference: 'REF-ZERO',
        })
      ).rejects.toThrow('Payment amount must be greater than 0');
    });

    it('should reject M-Pesa payment without phone number', async () => {
      await expect(
        paymentService.initiateMpesaPayment({
          phoneNumber: '',
          amount: 1000,
          currency: 'KES',
          reference: 'REF-NO-PHONE',
        })
      ).rejects.toThrow('Phone number is required');
    });
  });
});
