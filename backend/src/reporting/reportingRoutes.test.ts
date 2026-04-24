import express from 'express';
import request from 'supertest';

jest.mock('../database/connection', () => ({ db: { query: jest.fn() } }));
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
  },
}));

import reportingRouter from './reportingRoutes';

const app = express();
app.use(express.json());
app.use('/api/reports', reportingRouter);

describe('Reporting Routes', () => {
  describe('GET /api/reports/types', () => {
    it('returns list of report types', async () => {
      const res = await request(app).get('/api/reports/types');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reportTypes');
      expect(Array.isArray(res.body.reportTypes)).toBe(true);
      expect(res.body.reportTypes.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/reports/generate', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .send({ type: 'CLIENTS', format: 'csv' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid report type', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, _res: any, next: any) => {
        req.user = { id: 'user-1' };
        next();
      });
      app2.use('/api/reports', reportingRouter);

      const res = await request(app2)
        .post('/api/reports/generate')
        .send({ type: 'INVALID_TYPE', format: 'csv' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid format', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, _res: any, next: any) => {
        req.user = { id: 'user-1' };
        next();
      });
      app2.use('/api/reports', reportingRouter);

      const res = await request(app2)
        .post('/api/reports/generate')
        .send({ type: 'CLIENTS', format: 'docx' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/reports/:reportType', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/reports/clients');
      expect(res.status).toBe(401);
    });

    it('returns 404 for unknown report type', async () => {
      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, _res: any, next: any) => {
        req.user = { id: 'user-1' };
        next();
      });
      app2.use('/api/reports', reportingRouter);

      const res = await request(app2).get('/api/reports/unknown_type');
      expect(res.status).toBe(404);
    });
  });
});
