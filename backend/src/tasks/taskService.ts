import { db } from '../database/connection';
import logger from '../utils/logger';
// Lazy import to avoid circular dependency
let _taskNotificationService: any = null;
function getTaskNotificationService() {
  if (!_taskNotificationService) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _taskNotificationService = require('./taskNotificationService').taskNotificationService;
  }
  return _taskNotificationService;
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskEntityType {
  CLIENT = 'client',
  PROJECT = 'project',
  LEAD = 'lead',
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  createdBy: string;
  entityType?: string;
  entityId?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: Date;
  priority?: TaskPriority;
  assignedTo?: string;
  createdBy: string;
  entityType?: string;
  entityId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  dueDate?: Date;
  priority?: TaskPriority;
  assignedTo?: string;
  entityType?: string;
  entityId?: string;
}

export interface TaskFilters {
  assignedTo?: string;
  createdBy?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  entityType?: string;
  entityId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Task Management Service
 * Handles task CRUD operations, status transitions, and overdue tracking
 * Requirements: 50.1-50.12
 */
export class TaskService {
  /**
   * Create a new task
   * Requirements: 50.1, 50.2, 50.3
   */
  async createTask(input: CreateTaskInput): Promise<Task> {
    try {
      if (!input.title || input.title.trim() === '') {
        throw new Error('Task title is required');
      }

      // Validate priority if provided
      if (input.priority && !Object.values(TaskPriority).includes(input.priority)) {
        throw new Error(`Invalid priority. Must be one of: ${Object.values(TaskPriority).join(', ')}`);
      }

      // Validate assigned user exists if provided
      if (input.assignedTo) {
        const userResult = await db.query('SELECT id FROM users WHERE id = $1', [input.assignedTo]);
        if (userResult.rows.length === 0) {
          throw new Error('Assigned user not found');
        }
      }

      // Validate creator exists
      const creatorResult = await db.query('SELECT id FROM users WHERE id = $1', [input.createdBy]);
      if (creatorResult.rows.length === 0) {
        throw new Error('Creator user not found');
      }

      const result = await db.query(
        `INSERT INTO tasks (
          title, description, due_date, priority, status,
          assigned_to, created_by, entity_type, entity_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, title, description, due_date, priority, status,
                  assigned_to, created_by, entity_type, entity_id,
                  completed_at, created_at, updated_at`,
        [
          input.title.trim(),
          input.description || null,
          input.dueDate || null,
          input.priority || TaskPriority.MEDIUM,
          TaskStatus.NOT_STARTED,
          input.assignedTo || null,
          input.createdBy,
          input.entityType || null,
          input.entityId || null,
        ]
      );

      const task = this.mapTaskFromDb(result.rows[0]);
      logger.info('Task created', { taskId: task.id, createdBy: input.createdBy });

      // Send assignment notification if task is assigned to someone other than creator
      if (task.assignedTo && task.assignedTo !== input.createdBy) {
        getTaskNotificationService().notifyTaskAssigned(task, input.createdBy).catch((err: any) => {
          logger.error('Failed to send task assignment notification', { err, taskId: task.id });
        });
      }

      return task;
    } catch (error) {
      logger.error('Failed to create task', { error, input });
      throw error;
    }
  }

  /**
   * Get task by ID
   * Requirements: 50.4
   */
  async getTask(taskId: string): Promise<Task | null> {
    try {
      const result = await db.query(
        `SELECT id, title, description, due_date, priority, status,
                assigned_to, created_by, entity_type, entity_id,
                completed_at, created_at, updated_at
         FROM tasks
         WHERE id = $1`,
        [taskId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapTaskFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get task', { error, taskId });
      throw error;
    }
  }

  /**
   * List tasks with optional filters
   * Requirements: 50.5, 50.6
   */
  async listTasks(filters: TaskFilters = {}): Promise<{ tasks: Task[]; total: number }> {
    try {
      const conditions: string[] = ['status != $1'];
      const values: any[] = [TaskStatus.CANCELLED];
      let paramIndex = 2;

      if (filters.assignedTo) {
        conditions.push(`assigned_to = $${paramIndex++}`);
        values.push(filters.assignedTo);
      }

      if (filters.createdBy) {
        conditions.push(`created_by = $${paramIndex++}`);
        values.push(filters.createdBy);
      }

      if (filters.status) {
        // Override the default status filter
        conditions[0] = `status = $1`;
        values[0] = filters.status;
      }

      if (filters.priority) {
        conditions.push(`priority = $${paramIndex++}`);
        values.push(filters.priority);
      }

      if (filters.entityType) {
        conditions.push(`entity_type = $${paramIndex++}`);
        values.push(filters.entityType);
      }

      if (filters.entityId) {
        conditions.push(`entity_id = $${paramIndex++}`);
        values.push(filters.entityId);
      }

      if (filters.dueBefore) {
        conditions.push(`due_date <= $${paramIndex++}`);
        values.push(filters.dueBefore);
      }

      if (filters.dueAfter) {
        conditions.push(`due_date >= $${paramIndex++}`);
        values.push(filters.dueAfter);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countResult = await db.query(`SELECT COUNT(*) FROM tasks ${whereClause}`, values);
      const total = parseInt(countResult.rows[0].count);

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const query = `
        SELECT id, title, description, due_date, priority, status,
               assigned_to, created_by, entity_type, entity_id,
               completed_at, created_at, updated_at
        FROM tasks
        ${whereClause}
        ORDER BY
          CASE priority
            WHEN 'URGENT' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            WHEN 'LOW' THEN 4
          END,
          due_date ASC NULLS LAST,
          created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await db.query(query, values);

      return {
        tasks: result.rows.map((row) => this.mapTaskFromDb(row)),
        total,
      };
    } catch (error) {
      logger.error('Failed to list tasks', { error, filters });
      throw error;
    }
  }

  /**
   * Update task fields
   * Requirements: 50.7
   */
  async updateTask(taskId: string, userId: string, updates: UpdateTaskInput): Promise<Task> {
    try {
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.COMPLETED) {
        throw new Error('Cannot update a completed or cancelled task');
      }

      if (updates.priority && !Object.values(TaskPriority).includes(updates.priority)) {
        throw new Error(`Invalid priority. Must be one of: ${Object.values(TaskPriority).join(', ')}`);
      }

      if (updates.assignedTo) {
        const userResult = await db.query('SELECT id FROM users WHERE id = $1', [updates.assignedTo]);
        if (userResult.rows.length === 0) {
          throw new Error('Assigned user not found');
        }
      }

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        if (!updates.title.trim()) throw new Error('Task title cannot be empty');
        fields.push(`title = $${paramIndex++}`);
        values.push(updates.title.trim());
      }
      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.dueDate !== undefined) {
        fields.push(`due_date = $${paramIndex++}`);
        values.push(updates.dueDate);
      }
      if (updates.priority !== undefined) {
        fields.push(`priority = $${paramIndex++}`);
        values.push(updates.priority);
      }
      if (updates.assignedTo !== undefined) {
        fields.push(`assigned_to = $${paramIndex++}`);
        values.push(updates.assignedTo);
      }
      if (updates.entityType !== undefined) {
        fields.push(`entity_type = $${paramIndex++}`);
        values.push(updates.entityType);
      }
      if (updates.entityId !== undefined) {
        fields.push(`entity_id = $${paramIndex++}`);
        values.push(updates.entityId);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(taskId);

      const result = await db.query(
        `UPDATE tasks
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, title, description, due_date, priority, status,
                   assigned_to, created_by, entity_type, entity_id,
                   completed_at, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Task not found');
      }

      const updatedTask = this.mapTaskFromDb(result.rows[0]);
      logger.info('Task updated', { taskId, userId });

      // Send assignment notification if assignedTo changed
      if (
        updates.assignedTo &&
        updates.assignedTo !== task.assignedTo &&
        updates.assignedTo !== userId
      ) {
        getTaskNotificationService().notifyTaskAssigned(updatedTask, userId).catch((err: any) => {
          logger.error('Failed to send task assignment notification on update', { err, taskId });
        });
      }

      return updatedTask;
    } catch (error) {
      logger.error('Failed to update task', { error, taskId, userId });
      throw error;
    }
  }

  /**
   * Update task status
   * Requirements: 50.8
   */
  async updateTaskStatus(taskId: string, userId: string, status: TaskStatus): Promise<Task> {
    try {
      if (!Object.values(TaskStatus).includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${Object.values(TaskStatus).join(', ')}`);
      }

      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.status === TaskStatus.CANCELLED) {
        throw new Error('Cannot change status of a cancelled task');
      }

      const completedAt = status === TaskStatus.COMPLETED ? 'NOW()' : 'NULL';

      const result = await db.query(
        `UPDATE tasks
         SET status = $1, completed_at = ${completedAt}, updated_at = NOW()
         WHERE id = $2
         RETURNING id, title, description, due_date, priority, status,
                   assigned_to, created_by, entity_type, entity_id,
                   completed_at, created_at, updated_at`,
        [status, taskId]
      );

      if (result.rows.length === 0) {
        throw new Error('Task not found');
      }

      logger.info('Task status updated', { taskId, userId, status });
      return this.mapTaskFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update task status', { error, taskId, userId, status });
      throw error;
    }
  }

  /**
   * Soft delete (cancel) a task
   * Requirements: 50.9
   */
  async deleteTask(taskId: string, userId: string): Promise<void> {
    try {
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.status === TaskStatus.CANCELLED) {
        throw new Error('Task is already cancelled');
      }

      const result = await db.query(
        `UPDATE tasks
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id`,
        [TaskStatus.CANCELLED, taskId]
      );

      if (result.rows.length === 0) {
        throw new Error('Task not found');
      }

      logger.info('Task cancelled', { taskId, userId });
    } catch (error) {
      logger.error('Failed to cancel task', { error, taskId, userId });
      throw error;
    }
  }

  /**
   * Get overdue tasks (past due date and not completed/cancelled)
   * Requirements: 50.10
   */
  async getOverdueTasks(userId?: string): Promise<Task[]> {
    try {
      const conditions = [
        `due_date < CURRENT_DATE`,
        `status NOT IN ('${TaskStatus.COMPLETED}', '${TaskStatus.CANCELLED}')`,
      ];
      const values: any[] = [];
      let paramIndex = 1;

      if (userId) {
        conditions.push(`(assigned_to = $${paramIndex} OR created_by = $${paramIndex})`);
        values.push(userId);
        paramIndex++;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const result = await db.query(
        `SELECT id, title, description, due_date, priority, status,
                assigned_to, created_by, entity_type, entity_id,
                completed_at, created_at, updated_at
         FROM tasks
         ${whereClause}
         ORDER BY due_date ASC`,
        values
      );

      return result.rows.map((row) => this.mapTaskFromDb(row));
    } catch (error) {
      logger.error('Failed to get overdue tasks', { error, userId });
      throw error;
    }
  }

  private mapTaskFromDb(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      dueDate: row.due_date || undefined,
      priority: row.priority as TaskPriority,
      status: row.status as TaskStatus,
      assignedTo: row.assigned_to || undefined,
      createdBy: row.created_by,
      entityType: row.entity_type || undefined,
      entityId: row.entity_id || undefined,
      completedAt: row.completed_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const taskService = new TaskService();
export default taskService;
