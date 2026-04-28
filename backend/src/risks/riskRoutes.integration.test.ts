import request from 'supertest';
import app from '../index';
import { db } from '../database/connection';

describe('Risks API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let riskId: string;
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
    if (riskId) {
      await db.query('DELETE FROM risks WHERE id = $1', [riskId]);
    }
    await db.close();
  });

  describe('POST /api/v1/risks', () => {
    it('should create a new risk', async () => {
      const res = await request(app)
        .post('/api/v1/risks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          title: 'Test Risk',
          description: 'This is a test risk',
          probability: 'MEDIUM',
          impact: 'HIGH',
          mitigationPlan: 'Test mitigation plan',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Test Risk');
      expect(res.body.probability).toBe('MEDIUM');
      expect(res.body.impact).toBe('HIGH');
      expect(res.body.status).toBe('IDENTIFIED');

      riskId = res.body.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/v1/risks')
        .send({
          title: 'Test Risk',
          description: 'This is a test risk',
          probability: 'LOW',
          impact: 'MEDIUM',
        });

      expect(res.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/v1/risks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Risk',
          // Missing description, probability, impact
        });

      expect(res.status).toBe(400);
    });

    it('should validate probability values', async () => {
      const res = await request(app)
        .post('/api/v1/risks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Risk',
          description: 'Test description',
          probability: 'INVALID',
          impact: 'HIGH',
        });

      expect(res.status).toBe(400);
    });

    it('should validate impact values', async () => {
      const res = await request(app)
        .post('/api/v1/risks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Risk',
          description: 'Test description',
          probability: 'LOW',
          impact: 'INVALID',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/risks', () => {
    it('should list all risks', async () => {
      const res = await request(app)
        .get('/api/v1/risks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data || res.body)).toBe(true);
    });

    it('should filter risks by status', async () => {
      const res = await request(app)
        .get('/api/v1/risks?status=IDENTIFIED')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const risks = res.body.data || res.body;
      risks.forEach((risk: any) => {
        expect(risk.status).toBe('IDENTIFIED');
      });
    });

    it('should filter risks by project', async () => {
      if (projectId) {
        const res = await request(app)
          .get(`/api/v1/risks?projectId=${projectId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
      }
    });
  });

  describe('PUT /api/v1/risks/:id', () => {
    it('should update a risk', async () => {
      if (!riskId) {
        // Create risk first
        const createRes = await request(app)
          .post('/api/v1/risks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Test Risk for Update',
            description: 'This is a test risk',
            probability: 'LOW',
            impact: 'LOW',
          });
        riskId = createRes.body.id;
      }

      const res = await request(app)
        .put(`/api/v1/risks/${riskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'MITIGATING',
          probability: 'HIGH',
          impact: 'CRITICAL',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('MITIGATING');
      expect(res.body.probability).toBe('HIGH');
      expect(res.body.impact).toBe('CRITICAL');
    });

    it('should return 404 for non-existent risk', async () => {
      const res = await request(app)
        .put('/api/v1/risks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'MITIGATED',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('Risk Lifecycle', () => {
    it('should complete full risk lifecycle', async () => {
      // Create risk
      const createRes = await request(app)
        .post('/api/v1/risks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Lifecycle Test Risk',
          description: 'Testing full lifecycle',
          probability: 'HIGH',
          impact: 'CRITICAL',
        });

      expect(createRes.status).toBe(201);
      const lifecycleRiskId = createRes.body.id;

      // Update to MITIGATING
      const mitigatingRes = await request(app)
        .put(`/api/v1/risks/${lifecycleRiskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'MITIGATING',
          mitigationPlan: 'Implementing mitigation strategies',
        });

      expect(mitigatingRes.status).toBe(200);
      expect(mitigatingRes.body.status).toBe('MITIGATING');

      // Update to MITIGATED
      const mitigatedRes = await request(app)
        .put(`/api/v1/risks/${lifecycleRiskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'MITIGATED',
        });

      expect(mitigatedRes.status).toBe(200);
      expect(mitigatedRes.body.status).toBe('MITIGATED');

      // Cleanup
      await db.query('DELETE FROM risks WHERE id = $1', [lifecycleRiskId]);
    });
  });
});
