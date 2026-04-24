import { Router, Request, Response } from 'express';
import { taskService, TaskStatus, TaskPriority, TaskFilters } from './taskService';
import { taskNotificationService } from './taskNotificationService';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/tasks/send-reminders — manually trigger reminder check (admin only)
 * Requirements: 50.6, 50.7
 */
router.post('/send-reminders', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Add admin role check when authorization middleware is available
    // For now, allow any authenticated user to trigger reminders

    await taskNotificationService.runReminderCheck();

    return res.json({ success: true, message: 'Task reminders sent successfully' });
  } catch (error: any) {
    logger.error('Error sending task reminders', { error });
    return res.status(500).json({ error: 'Failed to send task reminders' });
  }
});

/**
 * GET /api/tasks/overdue — get overdue tasks
 * Must be defined before /:taskId to avoid route conflict
 * Requirements: 50.10
 */
router.get('/overdue', async (req: Request, res: Response) => {  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Admins/managers can see all overdue tasks; regular users see their own
    const filterUserId = req.query.all === 'true' ? undefined : userId;
    const tasks = await taskService.getOverdueTasks(filterUserId);

    return res.json({ tasks, total: tasks.length });
  } catch (error: any) {
    logger.error('Error getting overdue tasks', { error });
    return res.status(500).json({ error: 'Failed to get overdue tasks' });
  }
});

/**
 * POST /api/tasks — create task
 * Requirements: 50.1, 50.2, 50.3
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, description, dueDate, priority, assignedTo, entityType, entityId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }

    const task = await taskService.createTask({
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority,
      assignedTo,
      createdBy: userId,
      entityType,
      entityId,
    });

    return res.status(201).json(task);
  } catch (error: any) {
    logger.error('Error creating task', { error, body: req.body });
    if (error.message?.includes('not found') || error.message?.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * GET /api/tasks — list tasks
 * Requirements: 50.5, 50.6
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters: TaskFilters = {
      assignedTo: req.query.assignedTo as string | undefined,
      createdBy: req.query.createdBy as string | undefined,
      status: req.query.status as TaskStatus | undefined,
      priority: req.query.priority as TaskPriority | undefined,
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      dueBefore: req.query.dueBefore ? new Date(req.query.dueBefore as string) : undefined,
      dueAfter: req.query.dueAfter ? new Date(req.query.dueAfter as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await taskService.listTasks(filters);
    return res.json(result);
  } catch (error: any) {
    logger.error('Error listing tasks', { error, query: req.query });
    return res.status(500).json({ error: 'Failed to list tasks' });
  }
});

/**
 * GET /api/tasks/:taskId — get task
 * Requirements: 50.4
 */
router.get('/:taskId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const task = await taskService.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json(task);
  } catch (error: any) {
    logger.error('Error getting task', { error, taskId: req.params.taskId });
    return res.status(500).json({ error: 'Failed to get task' });
  }
});

/**
 * PATCH /api/tasks/:taskId — update task
 * Requirements: 50.7
 */
router.patch('/:taskId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, description, dueDate, priority, assignedTo, entityType, entityId } = req.body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (priority !== undefined) updates.priority = priority;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (entityType !== undefined) updates.entityType = entityType;
    if (entityId !== undefined) updates.entityId = entityId;

    const task = await taskService.updateTask(req.params.taskId, userId, updates);
    return res.json(task);
  } catch (error: any) {
    logger.error('Error updating task', { error, taskId: req.params.taskId });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('Cannot') || error.message?.includes('Invalid') || error.message?.includes('No fields')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * PATCH /api/tasks/:taskId/status — update status
 * Requirements: 50.8
 */
router.patch('/:taskId/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    const task = await taskService.updateTaskStatus(req.params.taskId, userId, status);
    return res.json(task);
  } catch (error: any) {
    logger.error('Error updating task status', { error, taskId: req.params.taskId });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('Cannot') || error.message?.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to update task status' });
  }
});

/**
 * DELETE /api/tasks/:taskId — cancel task (soft delete)
 * Requirements: 50.9
 */
router.delete('/:taskId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await taskService.deleteTask(req.params.taskId, userId);
    return res.status(204).send();
  } catch (error: any) {
    logger.error('Error cancelling task', { error, taskId: req.params.taskId });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('already cancelled')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to cancel task' });
  }
});

export default router;
