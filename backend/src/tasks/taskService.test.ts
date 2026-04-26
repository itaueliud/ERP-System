import { TaskService, TaskPriority, TaskStatus } from './taskService';
import { db } from '../database/connection';

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
  },
}));

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockTaskId = '456e4567-e89b-12d3-a456-426614174001';

const mockDbTask = {
  id: mockTaskId,
  title: 'Test Task',
  description: 'A test task',
  due_date: new Date('2025-12-31'),
  priority: TaskPriority.MEDIUM,
  status: TaskStatus.NOT_STARTED,
  assigned_to: mockUserId,
  created_by: mockUserId,
  entity_type: 'client',
  entity_id: '789e4567-e89b-12d3-a456-426614174002',
  completed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService();
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task with valid data', async () => {
      // Mock assigned user check
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: mockUserId }] });
      // Mock creator check
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: mockUserId }] });
      // Mock insert
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });

      const result = await service.createTask({
        title: 'Test Task',
        description: 'A test task',
        dueDate: new Date('2025-12-31'),
        priority: TaskPriority.MEDIUM,
        assignedTo: mockUserId,
        createdBy: mockUserId,
        entityType: 'client',
        entityId: '789e4567-e89b-12d3-a456-426614174002',
      });

      expect(result.id).toBe(mockTaskId);
      expect(result.title).toBe('Test Task');
      expect(result.status).toBe(TaskStatus.NOT_STARTED);
      expect(result.priority).toBe(TaskPriority.MEDIUM);
    });

    it('should default priority to MEDIUM when not provided', async () => {
      // Mock creator check (no assignedTo)
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: mockUserId }] });
      // Mock insert
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ ...mockDbTask, priority: TaskPriority.MEDIUM }] });

      const result = await service.createTask({
        title: 'Task without priority',
        createdBy: mockUserId,
      });

      expect(result.priority).toBe(TaskPriority.MEDIUM);
    });

    it('should reject empty title', async () => {
      await expect(
        service.createTask({ title: '', createdBy: mockUserId })
      ).rejects.toThrow('Task title is required');
    });

    it('should reject invalid priority', async () => {
      await expect(
        service.createTask({ title: 'Task', priority: 'INVALID' as TaskPriority, createdBy: mockUserId })
      ).rejects.toThrow('Invalid priority');
    });

    it('should reject non-existent assigned user', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // assigned user not found

      await expect(
        service.createTask({ title: 'Task', assignedTo: 'non-existent', createdBy: mockUserId })
      ).rejects.toThrow('Assigned user not found');
    });

    it('should reject non-existent creator', async () => {
      // No assignedTo, so first query is creator check
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createTask({ title: 'Task', createdBy: 'non-existent' })
      ).rejects.toThrow('Creator user not found');
    });
  });

  describe('getTask', () => {
    it('should return task by ID', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });

      const result = await service.getTask(mockTaskId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockTaskId);
      expect(result!.title).toBe('Test Task');
    });

    it('should return null for non-existent task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getTask('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('listTasks', () => {
    it('should list tasks with no filters', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '2' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask, { ...mockDbTask, id: 'other-id' }] });

      const result = await service.listTasks();

      expect(result.total).toBe(2);
      expect(result.tasks).toHaveLength(2);
    });

    it('should filter by assignedTo', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });

      const result = await service.listTasks({ assignedTo: mockUserId });

      expect(result.total).toBe(1);
      expect(result.tasks[0].assignedTo).toBe(mockUserId);
    });

    it('should filter by status', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ ...mockDbTask, status: TaskStatus.IN_PROGRESS }] });

      const result = await service.listTasks({ status: TaskStatus.IN_PROGRESS });

      expect(result.tasks[0].status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should filter by entityType and entityId', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });

      const result = await service.listTasks({ entityType: 'client', entityId: mockDbTask.entity_id });

      expect(result.tasks[0].entityType).toBe('client');
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      // getTask
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });
      // update
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbTask, title: 'Updated Title', priority: TaskPriority.HIGH }],
      });

      const result = await service.updateTask(mockTaskId, mockUserId, {
        title: 'Updated Title',
        priority: TaskPriority.HIGH,
      });

      expect(result.title).toBe('Updated Title');
      expect(result.priority).toBe(TaskPriority.HIGH);
    });

    it('should reject update on completed task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbTask, status: TaskStatus.COMPLETED }],
      });

      await expect(
        service.updateTask(mockTaskId, mockUserId, { title: 'New Title' })
      ).rejects.toThrow('Cannot update a completed or cancelled task');
    });

    it('should reject update on cancelled task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbTask, status: TaskStatus.CANCELLED }],
      });

      await expect(
        service.updateTask(mockTaskId, mockUserId, { title: 'New Title' })
      ).rejects.toThrow('Cannot update a completed or cancelled task');
    });

    it('should reject update with no fields', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });

      await expect(
        service.updateTask(mockTaskId, mockUserId, {})
      ).rejects.toThrow('No fields to update');
    });

    it('should reject update for non-existent task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateTask('non-existent', mockUserId, { title: 'New' })
      ).rejects.toThrow('Task not found');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status to IN_PROGRESS', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbTask, status: TaskStatus.IN_PROGRESS }],
      });

      const result = await service.updateTaskStatus(mockTaskId, mockUserId, TaskStatus.IN_PROGRESS);
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should set completedAt when status is COMPLETED', async () => {
      const completedAt = new Date();
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbTask, status: TaskStatus.COMPLETED, completed_at: completedAt }],
      });

      const result = await service.updateTaskStatus(mockTaskId, mockUserId, TaskStatus.COMPLETED);
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
    });

    it('should reject invalid status', async () => {
      await expect(
        service.updateTaskStatus(mockTaskId, mockUserId, 'INVALID' as TaskStatus)
      ).rejects.toThrow('Invalid status');
    });

    it('should reject status change on cancelled task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbTask, status: TaskStatus.CANCELLED }],
      });

      await expect(
        service.updateTaskStatus(mockTaskId, mockUserId, TaskStatus.IN_PROGRESS)
      ).rejects.toThrow('Cannot change status of a cancelled task');
    });

    it('should reject for non-existent task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateTaskStatus('non-existent', mockUserId, TaskStatus.IN_PROGRESS)
      ).rejects.toThrow('Task not found');
    });
  });

  describe('deleteTask', () => {
    it('should cancel (soft delete) a task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbTask] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: mockTaskId }] });

      await expect(service.deleteTask(mockTaskId, mockUserId)).resolves.not.toThrow();
    });

    it('should reject cancellation of already cancelled task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbTask, status: TaskStatus.CANCELLED }],
      });

      await expect(service.deleteTask(mockTaskId, mockUserId)).rejects.toThrow('Task is already cancelled');
    });

    it('should reject for non-existent task', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(service.deleteTask('non-existent', mockUserId)).rejects.toThrow('Task not found');
    });
  });

  describe('getOverdueTasks', () => {
    it('should return overdue tasks', async () => {
      const overdueTask = { ...mockDbTask, due_date: new Date('2020-01-01'), status: TaskStatus.NOT_STARTED };
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [overdueTask] });

      const result = await service.getOverdueTasks();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockTaskId);
    });

    it('should filter overdue tasks by userId', async () => {
      const overdueTask = { ...mockDbTask, due_date: new Date('2020-01-01') };
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [overdueTask] });

      const result = await service.getOverdueTasks(mockUserId);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no overdue tasks', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getOverdueTasks();
      expect(result).toHaveLength(0);
    });
  });

  describe('Task priority and status enums', () => {
    it('should support all four priority levels', () => {
      expect(Object.values(TaskPriority)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
    });

    it('should support all four status values', () => {
      expect(Object.values(TaskStatus)).toEqual(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
    });
  });
});
