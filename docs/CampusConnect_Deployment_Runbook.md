# Deployment and Operational Runbook
## CampusConnect: University Club, Event & Activity Management Platform

**Document Identifier:** CC-OPS-2026-V1.0  
**Engineering Baseline Version:** 1.0  
**Date:** October 2026  
**Software Engineering Lead:** Md. Shakhawat Hossain (Student ID: 0432320005101009) | Department of Computer Science and Engineering  
**Academic Supervisor & Course Advisor:** Al Imtiaz | Department of Computer Science and Engineering  
**Standard Compliance:** IEEE Std 828-2012 (Configuration Management in Systems and Software Engineering)  
**Status:** Approved Operational Baseline  

---

## 1. Introduction and System Overview

### 1.1 Purpose
This Deployment and Operational Runbook establishes standard operating procedures for installing, configuring, deploying, monitoring, and maintaining **CampusConnect**, a centralized university extracurricular and club management platform. It serves as the operational guide for software engineers, DevOps personnel, and campus systems administrators.

### 1.2 System Topology
CampusConnect is architected as a modular containerized stack comprising an Express.js/TypeScript REST API, a single-page web frontend, a persistent PostgreSQL 16 database, an in-memory Redis 7 instance, and an Nginx reverse proxy providing TLS termination and static caching.

### 1.3 Standards and Punctuation
- **Punctuation Standard:** Strictly utilizes standard ASCII hyphens (-), colons (:), and pipes (|). Zero em-dashes or en-dashes are permitted across all documentation and configuration templates.
- **Operational Standard:** IEEE Std 828-2012 (Configuration Management) and NIST SP 800-145 (Cloud Computing Standards).

---

## 2. Infrastructure Prerequisites and Environment Matrix

### 2.1 Hardware and OS Requirements

| Component | Minimum Specification | Recommended Production Specification |
| :--- | :--- | :--- |
| **Compute / CPU** | 2 Virtual Cores (x86_64 or ARM64) | 4 Virtual Cores (Dedicated) |
| **Random Access Memory** | 4 GB RAM | 8 GB to 16 GB ECC RAM |
| **Disk Storage** | 20 GB SSD Storage | 100 GB NVMe SSD with automated snapshots |
| **Operating System** | Ubuntu Linux 22.04 LTS / 24.04 LTS | Ubuntu Linux 24.04 LTS (HWE Kernel) |
| **Network Interface** | 100 Mbps Ethernet | 1 Gbps redundant network interfaces |

### 2.2 Software Runtime Dependencies

| Technology | Minimum Supported Version | Purpose in Stack |
| :--- | :--- | :--- |
| **Node.js** | Version 20.x LTS (Iron) | Backend API and worker process execution. |
| **PostgreSQL** | Version 16.x Alpine | Persistent ACID relational database core. |
| **Redis** | Version 7.x Alpine | Fast session cache, rate-limiting, and queue store. |
| **Docker Engine** | Version 24.0+ | Containerized infrastructure execution. |
| **Docker Compose** | Version 2.20+ | Multi-container service orchestration. |
| **Nginx** | Version 1.24+ | Reverse proxy, SSL/TLS termination, and gzip compression. |

---

## 3. Environment Variable Configuration Schema

Create a `.env` file in the project root by copying the documented configuration template:

```bash
# =========================================================================
# CAMPUSCONNECT ENVIRONMENT CONFIGURATION
# =========================================================================

# Server Runtime
NODE_ENV=production
PORT=5000
API_PREFIX=/api/v1
CLIENT_ORIGIN=https://campusconnect.edu

# PostgreSQL Relational Core
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=campusconnect_db
POSTGRES_USER=campusconnect_user
POSTGRES_PASSWORD=your_secure_db_password_here
POSTGRES_POOL_MIN=4
POSTGRES_POOL_MAX=20

# Redis Cache and Rate Limiting
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_password_here
REDIS_TTL_DEFAULT=300

# Authentication and Cryptography
JWT_ACCESS_SECRET=your_super_secret_jwt_access_key_min_64_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key_min_64_chars
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECRET=your_cookie_encryption_key_32_chars

# Dynamic Attendance Cryptography
ATTENDANCE_HMAC_SECRET=your_hmac_attendance_signing_secret_key
ATTENDANCE_WINDOW_SECONDS=20

# Public Certificate Verification
CERTIFICATE_SIGNING_KEY=your_university_certificate_rsa_private_key
CERTIFICATE_VERIFY_BASE_URL=https://campusconnect.edu/verify

# Email SMTP Gateway
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@campusconnect.edu
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=CampusConnect <noreply@campusconnect.edu>
```

---

## 4. Local Development and Testing Setup

### 4.1 Step-by-Step Local Deployment Procedure

```bash
# Step 1: Clone repository and enter project root
cd /home/tr/Desktop/project/sakib

# Step 2: Install dependencies across all npm workspaces
npm install

# Step 3: Launch backing infrastructure containers (PostgreSQL and Redis)
docker compose up -d postgres redis

# Step 4: Verify health of background containers
docker compose ps

# Step 5: Execute database migrations and seed baseline data
npm run seed --workspace=server

# Step 6: Launch application development servers with hot reload
npm run dev
```

### 4.2 Verifying Database Connectivity

```bash
# Connect to PostgreSQL container CLI
docker exec -it campusconnect-postgres psql -U campusconnect_user -d campusconnect_db

# Query seeded records count
SELECT count(*) FROM users;
SELECT count(*) FROM clubs;
SELECT count(*) FROM events;
\q
```

---

## 5. Production Deployment and Docker Orchestration

In production environments, services are managed via Docker Compose with health checks and restart policies:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:1.25-alpine
    container_name: campusconnect-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/ssl/certs:ro
    depends_on:
      - server
    networks:
      - campusconnect-network

  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: campusconnect-server
    restart: always
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    expose:
      - "5000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - campusconnect-network

  postgres:
    image: postgres:16-alpine
    container_name: campusconnect-postgres
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - campusconnect-network

  redis:
    image: redis:7-alpine
    container_name: campusconnect-redis
    restart: always
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - campusconnect-network

networks:
  campusconnect-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

---

## 6. Health Check and Observability Runbook

### 6.1 Service Health Endpoints

| Endpoint | Method | Expected Status | Checked Subsystems |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | GET | HTTP 200 OK | Process liveness, process uptime, memory RSS. |
| `/api/v1/health/ready` | GET | HTTP 200 OK | PostgreSQL connection pool query (`SELECT 1`), Redis ping (`PONG`). |

### Sample Readiness Check Response:
```json
{
  "status": "UP",
  "timestamp": "2026-10-30T12:00:00Z",
  "checks": {
    "database": {
      "status": "UP",
      "latency_ms": 2.4,
      "pool_active": 3,
      "pool_idle": 17
    },
    "redis": {
      "status": "UP",
      "latency_ms": 0.8
    }
  }
}
```

---

## 7. Backup, Disaster Recovery, and Point-In-Time Restoration

### 7.1 Automated Daily Database Backup Script

Save as `/home/tr/Desktop/project/sakib/scripts/backup_database.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/campusconnect"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/campusconnect_db_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Commencing database backup at $(date)..."
docker exec campusconnect-postgres pg_dump -U campusconnect_user -d campusconnect_db | gzip > "${BACKUP_FILE}"

echo "[INFO] Backup successfully written to ${BACKUP_FILE} (Size: $(du -h ${BACKUP_FILE} | cut -f1))"

# Retention policy: Prune backups older than 30 days
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +30 -delete
echo "[INFO] Old backup pruning complete."
```

### 7.2 Emergency Database Restoration Procedure

```bash
# Step 1: Place API service into maintenance mode
docker stop campusconnect-server

# Step 2: Drop existing database connections and recreate target DB
docker exec -i campusconnect-postgres psql -U campusconnect_user -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'campusconnect_db';"
docker exec -i campusconnect-postgres psql -U campusconnect_user -d postgres -c \
  "DROP DATABASE campusconnect_db; CREATE DATABASE campusconnect_db OWNER campusconnect_user;"

# Step 3: Stream uncompressed backup file into PostgreSQL
gunzip -c /var/backups/campusconnect/campusconnect_db_TARGET.sql.gz | \
  docker exec -i campusconnect-postgres psql -U campusconnect_user -d campusconnect_db

# Step 4: Restart API server and verify service readiness
docker start campusconnect-server
curl -f http://localhost:5000/api/v1/health/ready
```

---

## 8. Incident Response and Troubleshooting Playbook

### 8.1 Scenario A: PostgreSQL Connection Exhaustion
- **Symptom:** API logs report `error: remaining connection slots are reserved for non-replication superuser connections`.
- **Diagnosis:** Connection leak in unclosed async queries or excessive pool sizing.
- **Remediation:**
  1. Inspect active connection count:
     `docker exec -it campusconnect-postgres psql -U campusconnect_user -d campusconnect_db -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"`
  2. Terminate idle connections older than 5 minutes:
     `docker exec -it campusconnect-postgres psql -U campusconnect_user -d campusconnect_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';"`
  3. Adjust `POSTGRES_POOL_MAX` in `.env` to prevent exceeding server `max_connections`.

### 8.2 Scenario B: Attendance QR Clock Drift
- **Symptom:** Students reporting valid scans being rejected with `QR token expired`.
- **Diagnosis:** Host server system clock out of synchronization with standard NTP time servers.
- **Remediation:**
  1. Check host clock offset: `timedatectl status`
  2. Force NTP synchronization: `sudo systemctl restart systemd-timesyncd`
  3. Verify grace window: Verify that backend attendance validator checks both current window (T0) and previous window (T-1).

### 8.3 Scenario C: Redis Memory Saturation
- **Symptom:** Redis logs report `OOM command not allowed when used memory > 'maxmemory'`.
- **Diagnosis:** Rate-limiting keys or cached queries missing Time-To-Live (TTL).
- **Remediation:**
  1. Inspect memory usage: `docker exec -it campusconnect-redis redis-cli info memory`
  2. Set maxmemory eviction policy to allkeys-lru:
     `docker exec -it campusconnect-redis redis-cli config set maxmemory-policy allkeys-lru`

---
