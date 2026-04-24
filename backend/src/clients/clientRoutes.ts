import { Router, Request, Response } from 'express';
import { clientService, CreateClientInput, UpdateClientInput, ClientStatus, IndustryCategory } from './clientService';
import { activityTimelineService, TimelineEventType, TimelineFilters } from '../projects/activityTimeline';
import logger from '../utils/logger';

const router = Router();

/**
 * Create new client
 * POST /api/clients
 * Requirements: 4.1-4.6
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Get agent ID from authenticated user
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, email, phone, country, industryCategory, serviceDescription } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !country || !industryCategory || !serviceDescription) {
      return res.status(400).json({
        error: 'Missing required fields: name, email, phone, country, industryCategory, serviceDescription',
      });
    }

    const clientInput: CreateClientInput = {
      name,
      email,
      phone,
      country,
      industryCategory,
      serviceDescription,
      agentId,
    };

    const client = await clientService.createClient(clientInput);

    return res.status(201).json(client);
  } catch (error: any) {
    logger.error('Error creating client', { error, body: req.body });
    return res.status(400).json({ error: error.message || 'Failed to create client' });
  }
});

/**
 * Get client by ID
 * GET /api/clients/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).user?.id;

    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const client = await clientService.getClient(id);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Verify agent ownership (unless user has elevated permissions)
    if (client.agentId !== agentId) {
      // TODO: Check if user has elevated permissions (manager, admin, etc.)
      return res.status(403).json({ error: 'Forbidden: You can only view your own clients' });
    }

    return res.json(client);
  } catch (error: any) {
    logger.error('Error getting client', { error, clientId: req.params.id });
    return res.status(500).json({ error: 'Failed to get client' });
  }
});

/**
 * Update client
 * PUT /api/clients/:id
 * Requirements: 4.12
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).user?.id;

    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates: UpdateClientInput = {};

    // Extract allowed update fields
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.country !== undefined) updates.country = req.body.country;
    if (req.body.industryCategory !== undefined) updates.industryCategory = req.body.industryCategory;
    if (req.body.serviceDescription !== undefined) updates.serviceDescription = req.body.serviceDescription;
    if (req.body.estimatedValue !== undefined) updates.estimatedValue = req.body.estimatedValue;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.expectedStartDate !== undefined) updates.expectedStartDate = req.body.expectedStartDate;

    const client = await clientService.updateClient(id, agentId, updates);

    return res.json(client);
  } catch (error: any) {
    logger.error('Error updating client', { error, clientId: req.params.id, body: req.body });
    return res.status(400).json({ error: error.message || 'Failed to update client' });
  }
});

/**
 * Delete client
 * DELETE /api/clients/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).user?.id;

    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await clientService.deleteClient(id, agentId);

    return res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting client', { error, clientId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to delete client' });
  }
});

/**
 * List clients for authenticated agent
 * GET /api/clients
 * Requirements: 4.11
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;

    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters = {
      status: req.query.status as ClientStatus | undefined,
      country: req.query.country as string | undefined,
      industryCategory: req.query.industryCategory as IndustryCategory | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await clientService.listClientsForAgent(agentId, filters);

    return res.json(result);
  } catch (error: any) {
    logger.error('Error listing clients', { error, query: req.query });
    return res.status(500).json({ error: 'Failed to list clients' });
  }
});

/**
 * Convert client to LEAD status after commitment payment
 * POST /api/clients/:id/convert-to-lead
 * Requirements: 4.8
 */
router.post('/:id/convert-to-lead', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Missing required field: transactionId' });
    }

    const client = await clientService.convertToLead(id, transactionId);

    return res.json(client);
  } catch (error: any) {
    logger.error('Error converting client to lead', { error, clientId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to convert client to lead' });
  }
});

/**
 * Initiate commitment payment for client
 * POST /api/clients/:id/initiate-commitment-payment
 * Requirements: 4.7, 4.9, 4.10
 */
router.post('/:id/initiate-commitment-payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { phoneNumber, amount, currency } = req.body;
    const agentId = (req as any).user?.id;

    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields
    if (!phoneNumber || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: phoneNumber, amount',
      });
    }

    // Verify client exists and belongs to agent
    const client = await clientService.getClient(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (client.agentId !== agentId) {
      return res.status(403).json({ error: 'Forbidden: You can only initiate payments for your own clients' });
    }

    // Verify client status is PENDING_COMMITMENT
    if (client.status !== ClientStatus.PENDING_COMMITMENT) {
      return res.status(400).json({
        error: 'Client must have PENDING_COMMITMENT status to initiate commitment payment',
      });
    }

    // Import payment service
    const { paymentService } = await import('../payments/paymentService');

    // Initiate commitment payment
    const payment = await paymentService.initiateCommitmentPayment(
      id,
      phoneNumber,
      parseFloat(amount),
      currency || 'KES'
    );

    return res.status(201).json(payment);
  } catch (error: any) {
    logger.error('Error initiating commitment payment', { error, clientId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to initiate commitment payment' });
  }
});

/**
 * Qualify lead with estimated value, priority, and expected start date
 * POST /api/clients/:id/qualify
 * Requirements: 6.1-6.3
 */
router.post('/:id/qualify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estimatedValue, priority, expectedStartDate, notes } = req.body;

    // Validate required fields
    if (!estimatedValue || !priority || !expectedStartDate) {
      return res.status(400).json({
        error: 'Missing required fields: estimatedValue, priority, expectedStartDate',
      });
    }

    const qualificationData = {
      estimatedValue: parseFloat(estimatedValue),
      priority,
      expectedStartDate: new Date(expectedStartDate),
      notes,
    };

    const client = await clientService.qualifyLead(id, qualificationData);

    return res.json(client);
  } catch (error: any) {
    logger.error('Error qualifying lead', { error, clientId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to qualify lead' });
  }
});

/**
 * Convert qualified lead to project
 * POST /api/clients/:id/convert-to-project
 * Requirements: 6.4-6.10
 */
router.post('/:id/convert-to-project', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { serviceAmount, currency, startDate, endDate } = req.body;

    // Validate required fields
    if (!serviceAmount) {
      return res.status(400).json({ error: 'Missing required field: serviceAmount' });
    }

    const projectData = {
      serviceAmount: parseFloat(serviceAmount),
      currency,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const result = await clientService.convertToProject(id, projectData);

    return res.json(result);
  } catch (error: any) {
    logger.error('Error converting lead to project', { error, clientId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to convert lead to project' });
  }
});

/**
 * Get timeline for a client
 * GET /api/clients/:id/timeline
 * Requirements: 26.1, 26.3, 26.5
 */
router.get('/:id/timeline', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters: TimelineFilters = {
      eventType: req.query.eventType as TimelineEventType | undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await activityTimelineService.getTimeline('client', req.params.id, filters);

    return res.json(result);
  } catch (error: any) {
    logger.error('Error getting client timeline', { error, clientId: req.params.id });
    return res.status(500).json({ error: 'Failed to get client timeline' });
  }
});

/**
 * Add a manual note to a client timeline
 * POST /api/clients/:id/timeline/notes
 * Requirements: 26.7, 26.8, 26.9
 */
router.post('/:id/timeline/notes', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { note, mentions } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'Missing required field: note' });
    }

    const event = await activityTimelineService.addNote(
      'client',
      req.params.id,
      userId,
      note,
      mentions
    );

    return res.status(201).json(event);
  } catch (error: any) {
    logger.error('Error adding client timeline note', { error, clientId: req.params.id });
    if (error.message?.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to add client timeline note' });
  }
});

export default router;
