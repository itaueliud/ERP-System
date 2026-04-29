TechSwiftTrix ERP System
========================

TechSwiftTrix is a full-stack, multi-portal Enterprise Resource Planning (ERP) platform built for managing complex organizational operations across departments, roles, clients, projects, payments, and real-time collaboration.

---

Overview
--------

The system is split into a Node.js/Express backend API and a React frontend with six independent role-based portals. It is designed to support a structured organization with 13 distinct roles and 6 departments, enforcing strict access control, audit logging, and compliance at every layer.

---

Portals
-------

The frontend ships as six separate portals, each with its own Vite build config and entry point:

- CEO Portal
- Executive Portal
- C-Level Portal
- Operations Portal
- Technology Portal
- Agents Portal

Each portal exposes only the features and data relevant to its target role group.

---

Key Features
------------

Client Management
  Lead lifecycle tracking from NEW_LEAD through CONVERTED, QUALIFIED, NEGOTIATION, and CLOSED_WON. Full communication history per client.

Project Management
  Project creation and status tracking with GitHub repository integration and service amount management.

Payments
  M-Pesa (Daraja/Safaricom) integration with STK push, webhook handling, payment polling, developer team payments, staff payments, and approval workflows.

Contracts
  Contract generation with versioning, PDF templates, and digital signature support.

Tasks and Daily Reports
  Task assignment, daily accomplishment tracking, challenge logging, and team coordination.

Real-time Chat
  WebSocket-based messaging (Socket.IO) with room types: DIRECT, GROUP, DEPARTMENT, and PROJECT. Supports file sharing.

Training System
  Course and module management, trainer verification, and agent training progress tracking.

Property Listings (PlotConnect)
  Student residence and rental property management with placement tiers: Top, Medium, and Basic.

Audit and Compliance
  Comprehensive audit logging across all actions, fraud detection, and compliance tracking.

Reporting and Analytics
  Daily reports, business analytics, and role-specific dashboard customization.

Notifications
  Multi-channel delivery via email (SendGrid), SMS (Africa's Talking), and push (Firebase). Supports batch processing and user preferences.

Backup and Disaster Recovery
  Automated backups with configurable retention policies.

---

Tech Stack
----------

Backend
  - Runtime: Node.js 18+
  - Framework: Express.js
  - Language: TypeScript
  - Database: PostgreSQL 15+ (uuid-ossp, pgcrypto extensions)
  - Cache / Sessions: Redis
  - Job Queue: Bull
  - Auth: JWT (access + refresh tokens), Passport.js (GitHub OAuth), TOTP 2FA (speakeasy)
  - File Storage: AWS S3 or Cloudflare R2
  - Error Tracking: Sentry
  - Logging: Winston
  - API Docs: Swagger / OpenAPI
  - Testing: Jest, Supertest, fast-check (property-based)

Frontend
  - Framework: React 18
  - Language: TypeScript
  - Build Tool: Vite (per-portal configs)
  - State Management: Redux Toolkit
  - Routing: React Router v6
  - Styling: Tailwind CSS
  - Real-time: Socket.IO client
  - Charts: Chart.js + react-chartjs-2
  - Maps: Leaflet
  - Testing: Vitest, React Testing Library, fast-check

---

Authentication
--------------

Authentication is multi-layered:

1. JWT — Access tokens (8h default) and refresh tokens (7d default) with separate signing secrets.
2. GitHub OAuth — Passport.js integration for developer accounts.
3. Two-Factor Authentication (2FA) — TOTP via speakeasy. Mandatory for CEO, CoS, CFO, and EA roles.
4. Session Management — Redis-backed sessions with IP and user-agent tracking, timeout enforcement.
5. Cookie Support — httpOnly auth_token cookies for enhanced security.
6. Password Security — bcrypt hashing at 12 rounds, email-based password reset tokens.

---

Roles and Departments
---------------------

Roles (13 total):
  CEO, CoS, CFO, COO, CTO, EA, HEAD_OF_TRAINERS, TRAINER, AGENT,
  OPERATIONS_USER, TECH_STAFF, DEVELOPER, CFO_ASSISTANT

Account limits are enforced at the application level:
  - CEO: 1 system-wide
  - CoS: 1 system-wide
  - CFO Assistants: 3 per CFO

Departments (6 total, 3 under COO and 3 under CTO):
  Under COO:
    - Sales and Client Acquisition
    - Client Success and Account Management
    - Marketing and Business Operations

  Under CTO:
    - Technology Infrastructure and Security
    - Software Engineering and Product Development
    - Engineering Operations and Delivery

---

Integrations
------------

- Daraja (Safaricom M-Pesa) — Mobile money payments
- GitHub — OAuth and repository sync
- Firebase — Push notifications
- SendGrid — Transactional email
- Africa's Talking — SMS delivery
- AWS S3 / Cloudflare R2 — File storage with presigned URLs
- Socket.IO — Real-time chat and notifications
- Sentry — Error tracking and monitoring

---

Database
--------

PostgreSQL 15+ with the following design highlights:

- Chat messages, notifications, and audit logs are partitioned by month for performance at scale.
- UUIDs used as primary keys throughout (gen_random_uuid).
- Key tables: users, roles, departments, clients, projects, payments, contracts, tasks, training_courses, property_listings, chat_rooms, notifications, audit_logs, sessions.

---

Getting Started
---------------

Prerequisites:
  - Node.js 18+
  - PostgreSQL 15+
  - Redis
  - (Optional) Docker

Backend setup:

  cd backend
  cp .env.example .env.development
  # Fill in required environment variables (see below)
  npm install
  npm run db:init
  npm run dev

Frontend setup:

  cd frontend
  npm install
  npm run dev          # default portal
  npm run dev:all      # all six portals concurrently

Run all backend tests:

  cd backend
  npm test

---

Required Environment Variables
-------------------------------

The following variables must be set before starting the backend:

  NODE_ENV
  PORT
  DB_HOST
  DB_PORT
  DB_NAME
  DB_USER
  DB_PASSWORD
  REDIS_HOST
  REDIS_PORT
  JWT_SECRET
  JWT_REFRESH_SECRET   (must differ from JWT_SECRET in production)

See backend/.env.example for the full list including optional variables for S3, SendGrid, Firebase, Sentry, GitHub OAuth, and M-Pesa.

---

Docker
------

Separate Dockerfiles are provided for the backend and frontend:

  Dockerfile.backend
  Dockerfile.frontend

The backend exposes a /health endpoint for container health checks and a /metrics endpoint for internal monitoring.

---

API Documentation
-----------------

Swagger UI is available at /api-docs when the backend is running.

---

Testing Strategy
----------------

- Unit tests — Jest with ts-jest
- Integration tests — Supertest for API endpoints
- Property-based tests — fast-check for invariant testing (encryption, pagination, CSV round-trips, config parsing, session timeouts, etc.)

---

Project Structure
-----------------

  backend/src/
    admin/          Admin and pricing routes
    agents/         Agent management
    audit/          Audit logging and fraud detection
    auth/           Authentication, 2FA, session management
    backup/         Backup and retention services
    bulk/           Bulk import and CSV operations
    cache/          Redis cache services
    chat/           Real-time chat (Socket.IO)
    clients/        Client management and communications
    commission/     Commission calculations
    compliance/     Compliance tracking
    config/         App configuration and environment loading
    contracts/      Contract generation and versioning
    dashboard/      Role-specific dashboards
    database/       DB connection, schema, migrations, CLI
    deployments/    Deployment tracking
    incidents/      Incident management
    marketer/       Marketer-specific routes
    notifications/  Multi-channel notification delivery
    organization/   Org structure management
    payments/       Payment processing (M-Pesa, approvals)
    projects/       Project management
    properties/     PlotConnect property listings
    realtime/       SSE routes
    reports/        Reporting and daily reports
    risks/          Risk management
    tasks/          Task assignment and tracking
    teams/          Team management
    training/       Training courses and modules
    users/          User management

  frontend/src/
    portals/        One folder per portal (ceo, executive, clevel, operations, technology, agents)
    components/     Shared UI components
    store/          Redux store and slices
    hooks/          Shared React hooks
    utils/          Shared utilities
