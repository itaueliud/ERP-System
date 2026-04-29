import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TechSwiftTrix ERP API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for TechSwiftTrix ERP system',
      contact: {
        name: 'TechSwiftTrix Support',
        email: 'support@techswifttrix.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.techswifttrix.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        Incident: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            severity: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            },
            status: {
              type: 'string',
              enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
            },
            reportedBy: {
              type: 'string',
              format: 'uuid',
            },
            assignedTo: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            resolvedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Deployment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            projectId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            version: {
              type: 'string',
            },
            environment: {
              type: 'string',
              enum: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'ROLLED_BACK'],
            },
            deployedBy: {
              type: 'string',
              format: 'uuid',
            },
            deploymentNotes: {
              type: 'string',
              nullable: true,
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Risk: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            projectId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            title: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            probability: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH'],
            },
            impact: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            },
            mitigationPlan: {
              type: 'string',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['IDENTIFIED', 'MITIGATING', 'MITIGATED', 'ACCEPTED'],
            },
            ownerId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/**/*Routes.ts',
    './src/**/*routes.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
