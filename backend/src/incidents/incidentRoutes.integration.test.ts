import request from 'supertest';
import app from '../index';
import { db } from '../database/connection';

describe('Incidents API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let incidentId: string;

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
  });

  afterAll(async () => {
    // Cleanup test data
    if (incidentId) {
      await db.query('DELETE FROM incidents WHERE id = $1', [incidentId]);
    }
    await db.close();
  });

  describe('POST /api/v1/incidents', () => {
    it('should create a new incident', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Incident',
          description: 'This is a test incident',
          severity: 'MEDIUM',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Test Incident');
      expect(res.body.severity).toBe('MEDIUM');
      expect(res.body.status).toBe('OPEN');

      incidentId = res.body.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .send({
          title: 'Test Incident',
          description: 'This is a test incident',
          severity: 'MEDIUM',
        });

      expect(res.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Incident',
          // Missing description
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/incidents', () => {
    it('should list all incidents', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data || res.body)).toBe(true);
    });

    it('should filter incidents by status', async () => {
      const res = await request(app)
        .get('/api/v1/incidents?status=OPEN')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const incidents = res.body.data || res.body;
      incidents.forEach((incident: any) => {
        expect(incident.status).toBe('OPEN');
      });
    });

    it('should filter incidents by severity', async () => {
      const res = await request(app)
        .get('/api/v1/incidents?severity=CRITICAL')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/v1/incidents/:id', () => {
    it('should update an incident', async () => {
      if (!incidentId) {
        // Create incident first
        const createRes = await request(app)
          .post('/api/v1/incidents')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Test Incident for Update',
            description: 'This is a test incident',
            severity: 'LOW',
          });
        incidentId = createRes.body.id;
      }

      const res = await request(app)
        .put(`/api/v1/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'IN_PROGRESS',
          severity: 'HIGH',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.severity).toBe('HIGH');
    });

    it('should return 404 for non-existent incident', async () => {
      const res = await request(app)
        .put('/api/v1/incidents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'RESOLVED',
        });

      expect(res.status).toBe(404);
    });
  });
});
