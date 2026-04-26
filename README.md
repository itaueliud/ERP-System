TechSwiftTrix ERP System

A multi-tenant Enterprise Resource Platform for managing clients, projects, payments, contracts, teams, agents, and reporting across an organisation.


OVERVIEW

The system is split into two workspaces:

  backend   — Express REST API (Node.js + TypeScript), runs on port 3000
  frontend  — Six role-based React portals (Vite + TypeScript + Tailwind CSS)


TECH STACK

  Backend:   Node.js 18+, Express, TypeScript, PostgreSQL, Redis, Socket.io, Bull (job queues), Winston
  Frontend:  React 18, Redux Toolkit, React Router 6, Chart.js, Tailwind CSS, Vite
  Auth:      JWT (8h access token, 7d refresh), GitHub OAuth (developers only), TOTP 2FA
  Storage:   AWS S3 or Cloudflare R2
  Email:     SendGrid
  SMS:       Africa's Talking
  Push:      Firebase Admin
  PDF:       Puppeteer
  Payments:  Daraja API (Safaricom M-Pesa)


PREREQUISITES

  Node.js >= 18
  npm >= 9
  PostgreSQL
  Redis


SETUP

1. Install all dependencies from the root:

     npm install

2. Copy and fill in the backend environment file:

     cp backend/.env.example backend/.env

   Key variables to set:

     DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
     REDIS_HOST, REDIS_PORT
     JWT_SECRET, JWT_REFRESH_SECRET
     SENDGRID_API_KEY
     AFRICAS_TALKING_USERNAME, AFRICAS_TALKING_API_KEY
     FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
     AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
     GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

3. Initialise and migrate the database:

     npm run db:init --workspace=backend
     npm run db:migrate --workspace=backend

4. Start everything:

     npm run dev

   Or use the convenience script:

     ./start.sh

   To start services individually:

     npm run dev:backend
     npm run dev:ceo
     npm run dev:executive
     npm run dev:clevel
     npm run dev:operations
     npm run dev:technology
     npm run dev:agents


PORTALS AND URLS

  Portal       URL                          Intended Users
  ---------    --------------------------   --------------------------------
  CEO          http://localhost:5173        Chief Executive Officer
  Executive    http://localhost:5174        CFO, CoS, EA
  C-Level      http://localhost:5175        COO, CTO
  Operations   http://localhost:5176        Operations team
  Technology   http://localhost:5177        Tech leads, Developers
  Agents       http://localhost:5178        Field agents, Sales reps

  Backend API  http://localhost:3000
  Health check http://localhost:3000/health
  Metrics      http://localhost:3000/metrics


DEFAULT LOGIN CREDENTIALS

  Production / CEO account (change password immediately after first login):

    Email:    ceo@techswifttrix.com
    Password: Admin@TST2024!
    Portal:   http://localhost:5173

  Development seed accounts (for local use only — do not deploy to production):

    Role              Email                  Password           Portal
    ---------------   --------------------   ----------------   -----
    CEO               ceo@tst.com            Ceo@123456789!     :5173
    CFO               cfo@tst.com            Cfo@123456789!     :5174
    CoS               cos@tst.com            Cfo@123456789!     :5174
    EA                ea@tst.com             Cfo@123456789!     :5174
    COO               coo@tst.com            Coo@123456789!     :5175
    CTO               cto@tst.com            Coo@123456789!     :5175
    Operations        ops@tst.com            Ops@123456789!     :5176
    Head of Trainers  headtrainer@tst.com    Ops@123456789!     :5176
    Trainer           trainer@tst.com        Ops@123456789!     :5176
    Technology        tech@tst.com           Tech@12345678!     :5177
    Developer         dev@tst.com            Tech@12345678!     :5177
    Agent             agent@tst.com          Agent@1234567!     :5178

  Note: Developers authenticate via GitHub OAuth at http://localhost:5177.
  The developer account (dev@tst.com) must have a matching GitHub email to log in.

  Note: CEO, CoS, CFO, and EA roles require 2FA (TOTP). In development mode
  (NODE_ENV=development) 2FA enforcement is skipped so all roles can log in freely.


ROLES AND PERMISSIONS

  CEO              Full access to everything (wildcard permissions)
  CoS              Users, clients, projects, payments, reports, audit, executive dashboard
  CFO              Payment approval, financial reports, executive dashboard
  COO              COO departments, clients, projects, operations reports, achievements
  CTO              CTO departments, projects, GitHub integration, technology reports
  EA               Payment execution, contracts, reports
  HEAD_OF_TRAINERS Trainer management, training, reports
  TRAINER          Agent read, training read/assign, reports
  AGENT            Own clients, properties, daily reports
  OPERATIONS_USER  Clients, properties, operations reports
  TECH_STAFF  Projects read, GitHub read, technology reports
  DEVELOPER        Projects read, full GitHub access, technology reports
  CFO_ASSISTANT    Payment read/review/request, financial read, CFO chat


API

  Base URL:  http://localhost:3000/api/v1
  Auth:      Bearer JWT token required on all routes except /api/v1/auth

  Main route groups:
    /api/v1/auth
    /api/v1/users
    /api/v1/organization
    /api/v1/clients
    /api/v1/payments
    /api/v1/contracts
    /api/v1/projects
    /api/v1/tasks
    /api/v1/teams
    /api/v1/properties
    /api/v1/dashboard
    /api/v1/reports
    /api/v1/daily-reports
    /api/v1/audit-logs
    /api/v1/chat
    /api/v1/notifications
    /api/v1/training
    /api/v1/trainer
    /api/v1/agents
    /api/v1/admin
    /api/v1/pricing


DATABASE CLI

  npm run db:init --workspace=backend          Initialise schema and seed data
  npm run db:migrate --workspace=backend       Run pending migrations
  npm run db:status --workspace=backend        Show migration status
  npm run db:test --workspace=backend          Test database connection


TESTING

  npm run test                                 Run all tests
  npm run test --workspace=backend             Backend tests only
  npm run test --workspace=frontend            Frontend tests only


BUILD

  npm run build                                Build all workspaces
  npm run build:ceo --workspace=frontend       Build a specific portal


LINTING AND FORMATTING

  npm run lint
  npm run format


LOGS

  Runtime logs are written to backend/logs/app.log and backend/logs/error.log.
  When using start.sh, per-service logs are written to /tmp/tst-*.log.
  Log level is controlled by the LOG_LEVEL environment variable (default: debug in development).


GRACEFUL SHUTDOWN

  The server handles SIGTERM and SIGINT, closing the database pool and Redis
  connection cleanly before exiting.
# ERP-2-edited-copy
