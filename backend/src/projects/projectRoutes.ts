import { Router, Request, Response } from 'express';
import { projectService, ProjectStatus, ProjectFilters, serviceAmountChangeService } from './projectService';
import { githubIntegrationService } from './githubIntegration';
import { activityTimelineService, TimelineEventType, TimelineFilters, EntityType } from './activityTimeline';
import logger from '../utils/logger';

const router = Router();

/**
 * Create project
 * POST /api/projects
 * Requirements: 6.5-6.8
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { clientId, serviceAmount, currency, startDate, endDate } = req.body;

    if (!clientId || serviceAmount === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: clientId, serviceAmount',
      });
    }

    const project = await projectService.createProject({
      clientId,
      agentId: userId,
      serviceAmount: parseFloat(serviceAmount),
      currency,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return res.status(201).json(project);
  } catch (error: any) {
    logger.error('Error creating project', { error, body: req.body });
    return res.status(400).json({ error: error.message || 'Failed to create project' });
  }
});

/**
 * List projects
 * GET /api/projects
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters: ProjectFilters = {
      clientId: req.query.clientId as string | undefined,
      agentId: req.query.agentId as string | undefined,
      status: req.query.status as ProjectStatus | undefined,
      currency: req.query.currency as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await projectService.listProjects(filters);

    return res.json(result);
  } catch (error: any) {
    logger.error('Error listing projects', { error, query: req.query });
    return res.status(500).json({ error: 'Failed to list projects' });
  }
});

/**
 * Get project by ID
 * GET /api/projects/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await projectService.getProject(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json(project);
  } catch (error: any) {
    logger.error('Error getting project', { error, projectId: req.params.id });
    return res.status(500).json({ error: 'Failed to get project' });
  }
});

/**
 * Update project fields
 * PATCH /api/projects/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates: any = {};
    if (req.body.serviceAmount !== undefined) updates.serviceAmount = parseFloat(req.body.serviceAmount);
    if (req.body.currency !== undefined) updates.currency = req.body.currency;
    if (req.body.startDate !== undefined) updates.startDate = new Date(req.body.startDate);
    if (req.body.endDate !== undefined) updates.endDate = new Date(req.body.endDate);
    if (req.body.githubRepoId !== undefined) updates.githubRepoId = req.body.githubRepoId;

    const project = await projectService.updateProject(req.params.id, updates);

    return res.json(project);
  } catch (error: any) {
    logger.error('Error updating project', { error, projectId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to update project' });
  }
});

/**
 * Update project status
 * PATCH /api/projects/:id/status
 * Requirement 6.5: Project status workflow
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    if (!Object.values(ProjectStatus).includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${Object.values(ProjectStatus).join(', ')}`,
      });
    }

    const project = await projectService.updateProjectStatus(req.params.id, status, userId);

    return res.json(project);
  } catch (error: any) {
    logger.error('Error updating project status', { error, projectId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to update project status' });
  }
});

// ============================================================================
// Service Amount Change Routes
// Requirements: 8.1-8.10
// ============================================================================

/**
 * Request a service amount change
 * POST /api/projects/:id/service-amount-changes
 * Requirement 8.1, 8.9: Create change request with justification
 */
router.post('/:id/service-amount-changes', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { newAmount, justification } = req.body;

    if (newAmount === undefined || !justification) {
      return res.status(400).json({
        error: 'Missing required fields: newAmount, justification',
      });
    }

    const change = await serviceAmountChangeService.requestServiceAmountChange({
      projectId: req.params.id,
      newAmount: parseFloat(newAmount),
      justification,
      requesterId: userId,
    });

    return res.status(201).json(change);
  } catch (error: any) {
    logger.error('Error requesting service amount change', { error, projectId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to request service amount change' });
  }
});

/**
 * Get pending service amount changes (CEO dashboard)
 * GET /api/projects/service-amount-changes/pending
 * Requirement 8.7: Display pending changes on CEO dashboard
 */
router.get('/service-amount-changes/pending', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const changes = await serviceAmountChangeService.getPendingServiceAmountChanges();
    return res.json(changes);
  } catch (error: any) {
    logger.error('Error getting pending service amount changes', { error });
    return res.status(500).json({ error: 'Failed to get pending service amount changes' });
  }
});

/**
 * Get overdue service amount changes (pending > 24 hours)
 * GET /api/projects/service-amount-changes/overdue
 * Requirement 8.8: Escalation for requests pending > 24 hours
 */
router.get('/service-amount-changes/overdue', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const changes = await serviceAmountChangeService.getOverdueServiceAmountChanges();
    return res.json(changes);
  } catch (error: any) {
    logger.error('Error getting overdue service amount changes', { error });
    return res.status(500).json({ error: 'Failed to get overdue service amount changes' });
  }
});

/**
 * Get service amount changes for a project
 * GET /api/projects/:id/service-amount-changes
 * Requirement 8.6: Retrieve change history
 */
router.get('/:id/service-amount-changes', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const changes = await serviceAmountChangeService.getServiceAmountChanges(req.params.id);
    return res.json(changes);
  } catch (error: any) {
    logger.error('Error getting service amount changes', { error, projectId: req.params.id });
    return res.status(500).json({ error: 'Failed to get service amount changes' });
  }
});

/**
 * CEO approves a service amount change
 * POST /api/projects/service-amount-changes/:changeId/approve
 * Requirement 8.4: Apply new amount when CEO confirms
 */
router.post('/service-amount-changes/:changeId/approve', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notes } = req.body;

    const change = await serviceAmountChangeService.approveServiceAmountChange(
      req.params.changeId,
      userId,
      notes
    );

    return res.json(change);
  } catch (error: any) {
    logger.error('Error approving service amount change', { error, changeId: req.params.changeId });
    return res.status(400).json({ error: error.message || 'Failed to approve service amount change' });
  }
});

/**
 * CEO rejects a service amount change
 * POST /api/projects/service-amount-changes/:changeId/reject
 * Requirement 8.5: Maintain original amount when CEO rejects
 */
router.post('/service-amount-changes/:changeId/reject', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ error: 'Missing required field: notes' });
    }

    const change = await serviceAmountChangeService.rejectServiceAmountChange(
      req.params.changeId,
      userId,
      notes
    );

    return res.json(change);
  } catch (error: any) {
    logger.error('Error rejecting service amount change', { error, changeId: req.params.changeId });
    return res.status(400).json({ error: error.message || 'Failed to reject service amount change' });
  }
});

// ============================================================================
// GitHub Integration Routes
// Requirements: 12.3-12.10
// ============================================================================

/**
 * Link a GitHub repository to a project
 * POST /api/projects/:id/github/link
 * Requirement 12.3: Allow linking Projects to GitHub repositories
 * Requirement 12.4: Fetch repository metadata via GitHub API
 */
router.post('/:id/github/link', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { githubRepoFullName, accessToken } = req.body;

    if (!githubRepoFullName || !accessToken) {
      return res.status(400).json({
        error: 'Missing required fields: githubRepoFullName, accessToken',
      });
    }

    const repo = await githubIntegrationService.linkRepository(
      req.params.id,
      githubRepoFullName,
      userId,
      accessToken
    );

    return res.status(201).json(repo);
  } catch (error: any) {
    logger.error('Error linking GitHub repository', { error, projectId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to link GitHub repository' });
  }
});

/**
 * Unlink a GitHub repository from a project
 * DELETE /api/projects/:id/github/link
 * Requirement 12.3: Allow unlinking Projects from GitHub repositories
 */
router.delete('/:id/github/link', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await githubIntegrationService.unlinkRepository(req.params.id, userId);

    return res.status(204).send();
  } catch (error: any) {
    logger.error('Error unlinking GitHub repository', { error, projectId: req.params.id });
    return res.status(400).json({ error: error.message || 'Failed to unlink GitHub repository' });
  }
});

/**
 * Get repository data (metadata, commits, PRs) for a project
 * GET /api/projects/:id/github
 * Requirements 12.4, 12.5, 12.6
 */
router.get('/:id/github', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accessToken = req.headers['x-github-token'] as string;
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing GitHub access token (x-github-token header)' });
    }

    const data = await githubIntegrationService.getRepositoryData(req.params.id, accessToken);

    return res.json(data);
  } catch (error: any) {
    logger.error('Error getting GitHub repository data', { error, projectId: req.params.id });
    if (error.message?.includes('No GitHub repository linked')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to get GitHub repository data' });
  }
});

/**
 * Get commit history for a project's linked repository
 * GET /api/projects/:id/github/commits
 * Requirement 12.5: Display commit history on project pages
 */
router.get('/:id/github/commits', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accessToken = req.headers['x-github-token'] as string;
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing GitHub access token (x-github-token header)' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

    const commits = await githubIntegrationService.getCommitHistory(
      req.params.id,
      accessToken,
      limit
    );

    return res.json(commits);
  } catch (error: any) {
    logger.error('Error getting commit history', { error, projectId: req.params.id });
    if (error.message?.includes('No GitHub repository linked')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to get commit history' });
  }
});

/**
 * Get pull requests for a project's linked repository
 * GET /api/projects/:id/github/pull-requests
 * Requirement 12.6: Fetch pull request status
 */
router.get('/:id/github/pull-requests', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accessToken = req.headers['x-github-token'] as string;
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing GitHub access token (x-github-token header)' });
    }

    const state = (req.query.state as 'open' | 'closed' | 'all') || 'all';

    const pullRequests = await githubIntegrationService.getPullRequests(
      req.params.id,
      accessToken,
      state
    );

    return res.json(pullRequests);
  } catch (error: any) {
    logger.error('Error getting pull requests', { error, projectId: req.params.id });
    if (error.message?.includes('No GitHub repository linked')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to get pull requests' });
  }
});

/**
 * Manually trigger a sync of the linked GitHub repository
 * POST /api/projects/:id/github/sync
 * Requirement 12.10: Refresh GitHub data
 */
router.post('/:id/github/sync', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accessToken = req.headers['x-github-token'] as string || req.body.accessToken;
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing GitHub access token' });
    }

    const repo = await githubIntegrationService.syncRepository(req.params.id, accessToken);

    return res.json(repo);
  } catch (error: any) {
    logger.error('Error syncing GitHub repository', { error, projectId: req.params.id });
    if (error.message?.includes('No GitHub repository linked')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to sync GitHub repository' });
  }
});

// ============================================================================
// Activity Timeline Routes
// Requirements: 26.1-26.10
// ============================================================================

/**
 * Get timeline for an entity (project, client, or lead)
 * GET /api/timeline/:entityType/:entityId
 * Requirements: 26.1, 26.3, 26.5
 */
router.get('/timeline/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { entityType, entityId } = req.params;

    const filters: TimelineFilters = {
      eventType: req.query.eventType as TimelineEventType | undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await activityTimelineService.getTimeline(
      entityType as EntityType,
      entityId,
      filters
    );

    return res.json(result);
  } catch (error: any) {
    logger.error('Error getting timeline', { error, params: req.params });
    if (error.message?.startsWith('Invalid entity type')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to get timeline' });
  }
});

/**
 * Add a manual note to an entity timeline
 * POST /api/timeline/:entityType/:entityId/notes
 * Requirements: 26.7, 26.8, 26.9
 */
router.post('/timeline/:entityType/:entityId/notes', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { entityType, entityId } = req.params;
    const { note, mentions } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'Missing required field: note' });
    }

    const event = await activityTimelineService.addNote(
      entityType as EntityType,
      entityId,
      userId,
      note,
      mentions
    );

    return res.status(201).json(event);
  } catch (error: any) {
    logger.error('Error adding timeline note', { error, params: req.params });
    if (error.message?.startsWith('Invalid entity type') || error.message?.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to add timeline note' });
  }
});

/**
 * Get all valid event types
 * GET /api/timeline/event-types
 */
router.get('/timeline/event-types', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const eventTypes = activityTimelineService.getEventTypes();
    return res.json({ eventTypes });
  } catch (error: any) {
    logger.error('Error getting event types', { error });
    return res.status(500).json({ error: 'Failed to get event types' });
  }
});

/**
 * GET /api/projects/strategic-goals
 */
router.get('/strategic-goals', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const r = await db.query(
      `SELECT id, title, description, status, progress, created_at as "createdAt"
       FROM strategic_goals ORDER BY created_at DESC`
    ).catch(() => ({ rows: [] }));
    res.json({ success: true, data: r.rows });
  } catch (e: any) {
    res.json({ success: true, data: [] });
  }
});

/**
 * POST /api/projects/strategic-goals
 */
router.post('/strategic-goals', async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });
    const { db } = await import('../database/connection');
    const r = await db.query(
      `INSERT INTO strategic_goals (title, description, status, progress, created_at)
       VALUES ($1, $2, 'IN_PROGRESS', 0, NOW()) RETURNING id, title, description, status, progress`,
      [title, description || '']
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to create goal' });
  }
});

/**
 * POST /api/projects/:id/assign-team
 */
router.post('/:id/assign-team', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ success: false, error: 'teamId is required' });
    const { db } = await import('../database/connection');
    await db.query(`UPDATE projects SET team_id = $1 WHERE id = $2`, [teamId, id]);
    res.json({ success: true, message: 'Project assigned to team' });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to assign project' });
  }
});

export default router;
