import request from 'supertest';
import app from '../index';
import { db } from '../database/connection';

describe('Deployments API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let deploymentId: string;
  let projectId: string;

  beforeAll(async () => {
    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@techswifttrix.com',
        password: 'test_password',
      });

    if (loginRes.status === 200) {
      authToken = loginRes.body.token;
      userId = loginRes.body.user.id;
    }

    // Get or create a test project
    const projectRes = await db.query(
      'SELECT id FROM projects LIMIT 1'
    );
    if (projectRes.rows.length > 0) {
      projectId = projectRes.rows[0].id;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (deploymentId) {
      await db.query('DELETE FROM deployments WHERE id = $1', [deploymentId]);
    }
    await db.close();
  });

  describe('POST /api/v1/deployments', () => {
    it('should create a new deployment', async () => {
      const res = await request(app)
        .post('/api/v1/deployments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          version: 'v1.0.0',
          environment: 'STAGING',
          deploymentNotes: 'Test deployment',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.version).toBe('v1.0.0');
      expect(res.body.environment).toBe('STAGING');
      expect(res.body.status).toBe('PENDING');

      deploymentId = res.body.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/v1/deployments')
        .send({
          version: 'v1.0.0',
          environment: 'PRODUCTION',
        });

      expect(res.status).toBe(401);
    });

    it('should validate environment values', async () => {
      const res = await request(app)
        .post('/api/v1/deployments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          version: 'v1.0.0',
          environment: 'INVALID_ENV',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/deployments', () => {
    it('should list all deployments', async () => {
      const res = await request(app)
        .get('/api/v1/deployments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data || res.body)).toBe(true);
    });

    it('should filter deployments by environment', async () => {
      const res = await request(app)
        .get('/api/v1/deployments?environment=PRODUCTION')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const deployments = res.body.data || res.body;
      deployments.forEach((deployment: any) => {
        expect(deployment.environment).toBe('PRODUCTION');
      });
    });

    it('should filter deployments by status', async () => {
      const res = await request(app)
        .get('/api/v1/deployments?status=SUCCESS')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should filter deployments by project', async () => {
      if (projectId) {
        const res = await request(app)
          .get(`/api/v1/deployments?projectId=${projectId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
      }
    });
  });

  describe('PATCH /api/v1/deployments/:id/status', () => {
    it('should update deployment status', async () => {
      if (!deploymentId) {
        // Create deployment first
        const createRes = await request(app)
          .post('/api/v1/deployments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            version: 'v1.0.1',
            environment: 'DEVELOPMENT',
          });
        deploymentId = createRes.body.id;
      }

      const res = await request(app)
        .patch(`/api/v1/deployments/${deploymentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'IN_PROGRESS',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('should validate status values', async () => {
      if (deploymentId) {
        const res = await request(app)
          .patch(`/api/v1/deployments/${deploymentId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'INVALID_STATUS',
          });

        expect(res.status).toBe(400);
      }
    });

    it('should return 404 for non-existent deployment', async () => {
      const res = await request(app)
        .patch('/api/v1/deployments/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'SUCCESS',
        });

      expect(res.status).toBe(404);
    });
  });
});
