# TechSwiftTrix ERP — Production Deployment Guide

This document covers the production environment setup for `api.techswifttrix.com` and `app.techswifttrix.com`.

---

## 1. Database Setup (PostgreSQL with Replication)

### Primary Instance

```
Host:     prod-db.techswifttrix.com
Port:     5432
Database: techswifttrix_erp_prod
User:     tst_prod_user
```

Recommended instance: PostgreSQL 15+ on a dedicated server or managed service (e.g., AWS RDS Multi-AZ, Supabase, or self-hosted).

### Read Replica Configuration

Provision at least one read replica for reporting and read-heavy queries:

```
Host:     prod-db-replica.techswifttrix.com
Port:     5432
```

Configure streaming replication in `postgresql.conf` on the primary:

```conf
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1GB
synchronous_commit = on
```

On the replica, create `recovery.conf` (PostgreSQL < 12) or `postgresql.conf` (PostgreSQL 12+):

```conf
primary_conninfo = 'host=prod-db.techswifttrix.com port=5432 user=replicator password=<secret>'
hot_standby = on
```

### Connection Pooling (PgBouncer)

Use PgBouncer in transaction mode in front of both primary and replica:

```ini
[databases]
techswifttrix_erp_prod = host=prod-db.techswifttrix.com port=5432 dbname=techswifttrix_erp_prod

[pgbouncer]
pool_mode = transaction
min_pool_size = 10
max_client_conn = 100
default_pool_size = 20
server_idle_timeout = 600
```

These values align with the `DB_POOL_MIN=10` and `DB_POOL_MAX=100` settings in `backend/.env.production`.

### Failover Configuration

Target RTO: **60 seconds**.

- Use **Patroni** (self-hosted) or the managed service's built-in automatic failover (e.g., AWS RDS Multi-AZ).
- Configure a health-check interval of 10 seconds with a 3-failure threshold before promoting the replica.
- Update the application's `DB_HOST` via environment variable or a DNS CNAME (`prod-db.techswifttrix.com`) that is flipped during failover.
- Test failover quarterly by simulating a primary outage in a maintenance window.

---

## 2. Redis Cluster Configuration

### Topology

For production, use **Redis Sentinel** (3 nodes: 1 primary + 2 replicas + 3 Sentinel processes) or **Redis Cluster** (6 nodes: 3 primary shards + 3 replicas).

Sentinel example (`sentinel.conf`):

```conf
sentinel monitor mymaster prod-redis.techswifttrix.com 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

### Database Allocation

| DB  | Purpose              | Key prefix examples                  |
|-----|----------------------|--------------------------------------|
| 0   | Session storage      | `sess:`, `user:session:`             |
| 1   | Bull job queues      | `bull:`, `bull:notifications:`       |
| 2   | Application cache    | `cache:`, `dashboard:`, `perms:`     |

These match `REDIS_DB=0` (sessions) and `BULL_REDIS_DB=1` (queues) in `backend/.env.production`.

### Cache TTL Policies

| Cache type          | TTL        |
|---------------------|------------|
| User sessions       | 8 hours    |
| Dashboard data      | 5 minutes  |
| Permission sets     | 15 minutes |
| Currency rates      | 1 hour     |
| Static lookups      | 24 hours   |

Configure `maxmemory-policy allkeys-lru` and set `maxmemory` to 75% of available RAM to prevent OOM evictions from impacting sessions.

---

## 3. CDN Configuration

### Provider

Use **AWS CloudFront** or **Cloudflare** in front of the frontend build output.

CDN origin: `https://cdn.techswifttrix.com` (set in `VITE_CDN_BASE_URL`).

### Frontend Build Deployment

```bash
# Build the frontend
cd frontend
npm run build

# Sync dist/ to S3 (CloudFront origin)
aws s3 sync dist/ s3://techswifttrix-prod-frontend/ --delete

# Invalidate CloudFront cache after each deploy
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

### Cache Headers

Configure the following cache-control headers at the CDN or S3 level:

| Asset type                        | Cache-Control                          |
|-----------------------------------|----------------------------------------|
| `*.js`, `*.css` (hashed filenames)| `public, max-age=31536000, immutable`  |
| Images (`*.png`, `*.jpg`, `*.svg`)| `public, max-age=86400`                |
| `index.html`                      | `no-cache, no-store, must-revalidate`  |
| Fonts                             | `public, max-age=31536000, immutable`  |

Vite generates content-hashed filenames for JS/CSS bundles, so long-lived caching is safe for those assets.

---

## 4. SSL/TLS Configuration

### Domains

| Domain                        | Purpose              |
|-------------------------------|----------------------|
| `api.techswifttrix.com`       | Backend REST API     |
| `app.techswifttrix.com`       | Frontend web portal  |

### Certificate Provisioning

Use **Let's Encrypt** (via Certbot) or a commercial CA. For AWS, use **ACM** (free, auto-renews).

```bash
# Certbot example (nginx)
certbot --nginx -d api.techswifttrix.com -d app.techswifttrix.com
```

### Nginx TLS Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name api.techswifttrix.com;

    ssl_certificate     /etc/letsencrypt/live/api.techswifttrix.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.techswifttrix.com/privkey.pem;

    # TLS 1.2+ only
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # HSTS (6 months, include subdomains)
    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains; preload" always;

    # Additional security headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name api.techswifttrix.com app.techswifttrix.com;
    return 301 https://$host$request_uri;
}
```

---

## 5. Monitoring and Alerting

### Health Check Endpoint

```
GET /health
```

Returns `200 OK` with JSON payload when all subsystems are healthy:

```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "uptime": 123456
}
```

Configure your load balancer or uptime monitor (e.g., AWS ALB, UptimeRobot, Datadog Synthetics) to poll `/health` every 30 seconds.

### Alert Thresholds

| Metric                  | Warning   | Critical  | Action                              |
|-------------------------|-----------|-----------|-------------------------------------|
| CPU utilization         | 70%       | 80%       | Scale out / investigate             |
| Memory utilization      | 75%       | 85%       | Restart service / scale up          |
| API response time (p95) | 1.5s      | 2s        | Profile slow queries / cache review |
| HTTP 5xx error rate     | 2%        | 5%        | Page on-call engineer               |
| DB connection pool      | 80% used  | 95% used  | Increase pool or add read replica   |
| Redis memory            | 70%       | 85%       | Eviction policy review / scale      |
| Disk usage              | 75%       | 90%       | Clean logs / expand volume          |

### Log Aggregation

- Ship logs from `logs/production.log` to a centralized service (e.g., **AWS CloudWatch Logs**, **Datadog**, or **Loki + Grafana**).
- Use structured JSON logging in production (`LOG_LEVEL=warn`).
- Retain application logs for **90 days** in hot storage; archive to S3 for 7 years (matches `AUDIT_LOG_RETENTION_YEARS=7`).

Example CloudWatch agent config snippet:

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/app/logs/production.log",
            "log_group_name": "/techswifttrix/erp/production",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%dT%H:%M:%S"
          }
        ]
      }
    }
  }
}
```

---

## 6. Backup Configuration

### Schedule

| Backup type   | Frequency       | Retention                                      |
|---------------|-----------------|------------------------------------------------|
| Full          | Every 6 hours   | 30 days (daily), 90 days (weekly), 1 year (monthly) |
| Incremental   | Every 1 hour    | 7 days                                         |
| WAL archiving | Continuous      | 7 days (point-in-time recovery)                |

### Encryption

All backup archives are encrypted with **AES-256** before upload:

```bash
# Example: pg_dump + AES-256 encryption
pg_dump -Fc techswifttrix_erp_prod | \
  openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  > backup_$(date +%Y%m%d_%H%M%S).dump.enc
```

Store `BACKUP_ENCRYPTION_KEY` in AWS Secrets Manager or HashiCorp Vault — never in `.env` files.

### Storage

- **Primary region**: `us-east-1` (S3 bucket: `techswifttrix-backups-primary`)
- **Secondary region**: `eu-west-1` (S3 bucket: `techswifttrix-backups-secondary`)

Enable S3 Cross-Region Replication (CRR) between the two buckets to ensure geo-redundancy across 2+ regions.

### Retention Policy (S3 Lifecycle Rules)

```json
[
  { "id": "daily-30d",   "prefix": "daily/",   "expiration": { "days": 30  } },
  { "id": "weekly-90d",  "prefix": "weekly/",  "expiration": { "days": 90  } },
  { "id": "monthly-1yr", "prefix": "monthly/", "expiration": { "days": 365 } }
]
```

### Restore Verification

Run a restore drill monthly in a staging environment to confirm backup integrity:

```bash
# Decrypt and restore
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  -in backup_<timestamp>.dump.enc | \
  pg_restore -d techswifttrix_erp_staging
```

---

## Environment Variables Checklist

Before going live, ensure all blank values in `backend/.env.production` are populated:

- [ ] `DB_PASSWORD` — PostgreSQL production password
- [ ] `REDIS_PASSWORD` — Redis auth password
- [ ] `JWT_SECRET` — Strong random secret (min 64 chars)
- [ ] `JWT_REFRESH_SECRET` — Strong random secret (min 64 chars)
- [ ] `SESSION_SECRET` — Strong random secret (min 64 chars)
- [ ] `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — Production OAuth app
- [ ] `DARAJA_CONSUMER_KEY` / `DARAJA_CONSUMER_SECRET` / `DARAJA_SHORT_CODE` / `DARAJA_PASS_KEY` / `DARAJA_WEBHOOK_SECRET`
- [ ] `FIREBASE_*` — Production Firebase project credentials
- [ ] `SENDGRID_API_KEY`
- [ ] `AFRICAS_TALKING_USERNAME` / `AFRICAS_TALKING_API_KEY`
- [ ] `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
