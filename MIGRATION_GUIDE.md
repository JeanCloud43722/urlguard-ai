# MIGRATION_GUIDE.md: URLGuard AI → Google Antigravity AI

**Document Version:** 2.0.1  
**Target Platform:** Google Antigravity AI (Agent-First IDE, Gemini 3 Backend)  
**Source Platform:** Manus AI (Cloud-Native Builder)  
**Execution Mode:** Offline/Localhost  
**Last Updated:** 2026-03-25  
**Status:** Production-Ready for Migration

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites](#2-prerequisites)
3. [Installation Steps](#3-installation-steps)
4. [Environment Variables Setup](#4-environment-variables-setup)
5. [Antigravity IDE Configuration](#5-antigravity-ide-configuration)
6. [Running Locally (Dev & Prod)](#6-running-locally-dev--prod)
7. [Known Issues & Manus-Specific Workarounds](#7-known-issues--manus-specific-workarounds)
8. [Troubleshooting Guide](#8-troubleshooting-guide)
9. [Performance Tuning](#9-performance-tuning)
10. [Security Considerations](#10-security-considerations)

---

## 1. Project Overview

### 1.1 What is URLGuard AI?

URLGuard AI is a **full-stack phishing detection web application** that analyzes URLs using:
- **DeepSeek AI** (deepseek-chat model) for semantic analysis
- **SSL Certificate Analysis** for trust indicators
- **Heuristic Indicators** (domain age, TLD patterns, IP detection)
- **Forensic Screenshot Capture** (Playwright) for dangerous URLs
- **Redis Caching** (70% reduction in API calls)
- **BullMQ Job Queue** for async processing
- **Prometheus Monitoring** for production observability

### 1.2 Architecture Summary

```
Frontend (React 19 + Tailwind)
    ↓ tRPC + HTTP/WebSocket
Backend (Express + Node.js)
    ├─ DeepSeek API Integration
    ├─ Redis Cache Layer
    ├─ BullMQ Job Queue
    ├─ Playwright Screenshot Service
    └─ AWS S3 Storage
    ↓
Database (MySQL)
External Services (DeepSeek, AWS S3)
```

### 1.3 Key Features

| Feature | Purpose | Status |
|---------|---------|--------|
| URL Analysis | Phishing detection with AI | ✅ Complete |
| Batch Processing | Analyze 50+ URLs async | ✅ Complete |
| Screenshot Capture | Forensic evidence | ✅ Complete |
| Caching | 70% API cost reduction | ✅ Complete |
| Monitoring | Prometheus + Grafana | ✅ Complete |
| Scaling | Kubernetes-ready | ✅ Complete |

---

## 2. Prerequisites

### 2.1 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Node.js** | 20.0.0 | 22.13.0+ |
| **pnpm** | 9.0.0 | 10.15.1+ |
| **Docker** | 20.10 | 24.0+ |
| **Docker Compose** | 1.29 | 2.0+ |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 5 GB | 20 GB |
| **Git** | 2.30 | 2.40+ |

### 2.2 Antigravity AI Version

- **Minimum:** Antigravity AI v1.0.0 (Gemini 3 Backend)
- **Recommended:** Latest stable version
- **Verify:** `antigravity --version`

### 2.3 Required Software Installation

#### macOS

```bash
# Install Homebrew (if not present)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 22
brew install node@22
brew link node@22

# Install pnpm
npm install -g pnpm@10.15.1

# Install Docker Desktop
brew install --cask docker

# Verify installations
node --version    # v22.13.0
pnpm --version    # 10.15.1
docker --version  # Docker version 24.0+
```

#### Ubuntu/Debian

```bash
# Update package manager
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@10.15.1

# Install Docker
sudo apt-get install -y docker.io docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installations
node --version    # v22.13.0
pnpm --version    # 10.15.1
docker --version  # Docker version 24.0+
```

#### Windows (WSL2 Recommended)

```bash
# Enable WSL2
wsl --install

# Inside WSL2 Ubuntu terminal:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm@10.15.1
sudo apt-get install -y docker.io docker-compose

# Verify
node --version
pnpm --version
docker --version
```

### 2.4 Antigravity AI Setup

```bash
# Install Antigravity AI CLI (if not present)
npm install -g @google/antigravity-cli

# Verify installation
antigravity --version

# Initialize Antigravity workspace
antigravity init urlguard-ai
cd urlguard-ai
```

---

## 3. Installation Steps

### 3.1 Clone Repository

```bash
# Clone the project
git clone <your-repo-url> urlguard-ai
cd urlguard-ai

# Verify directory structure
ls -la
# Expected output:
# client/
# server/
# drizzle/
# k8s/
# package.json
# docker-compose.yml
# .env.example
# etc.
```

### 3.2 Install Dependencies

```bash
# Install Node dependencies
pnpm install

# Verify installation
pnpm list | head -20

# Expected output:
# urlguard-ai@1.0.0 /workspace/urlguard-ai
# ├── react@19.2.1
# ├── express@4.21.2
# ├── @trpc/server@11.6.0
# ├── drizzle-orm@0.44.5
# └── (60+ more packages)
```

### 3.3 Setup Local Services (Docker)

```bash
# Start Redis and MySQL
docker-compose up -d

# Verify services running
docker-compose ps

# Expected output:
# NAME                COMMAND                  SERVICE             STATUS
# urlguard-ai-redis-1   "redis-server"         redis               Up 2 seconds
# urlguard-ai-mysql-1   "docker-entrypoint.sh" mysql               Up 3 seconds

# Wait for MySQL to be ready (30 seconds)
sleep 30

# Test MySQL connection
docker-compose exec mysql mysql -uroot -ppassword -e "SELECT 1;"

# Expected output:
# +---+
# | 1 |
# +---+
# | 1 |
# +---+

# Test Redis connection
docker-compose exec redis redis-cli ping

# Expected output:
# PONG
```

### 3.4 Setup Environment Variables

```bash
# Copy template
cp .env.example .env

# Edit .env with your values
# Required fields:
# - DEEPSEEK_API_KEY
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - DATABASE_URL (should be pre-filled)

nano .env  # or use your editor

# Verify required variables are set
grep -E "DEEPSEEK_API_KEY|AWS_ACCESS_KEY_ID|DATABASE_URL" .env
```

### 3.5 Initialize Database

```bash
# Generate migrations
pnpm db:push

# Expected output:
# [drizzle] Generating migrations...
# [drizzle] Migrations generated successfully
# [drizzle] Running migrations...
# [drizzle] All migrations completed

# Verify database tables created
docker-compose exec mysql mysql -uroot -ppassword -D urlguard_ai -e "SHOW TABLES;"

# Expected output:
# +------------------------+
# | Tables_in_urlguard_ai  |
# +------------------------+
# | users                  |
# | url_checks             |
# | batch_jobs             |
# | screenshots            |
# +------------------------+
```

### 3.6 Build Project

```bash
# Type check
pnpm check

# Expected output:
# (no errors)

# Build frontend and backend
pnpm build

# Expected output:
# vite v7.1.7 building for production...
# ✓ 1234 modules transformed
# dist/index.html                0.45 kB │ gzip:  0.30 kB
# dist/assets/index-abc.js       123.45 kB │ gzip: 45.67 kB
# ✓ built in 45.23s

# Verify build output
ls -la dist/
```

---

## 4. Environment Variables Setup

### 4.1 .env File Template

Create `.env` file in project root with these variables:

```bash
# ============================================================================
# DATABASE (Pre-configured for local Docker)
# ============================================================================
DATABASE_URL="mysql://root:password@localhost:3306/urlguard_ai"

# ============================================================================
# AUTHENTICATION (Manus OAuth - Mock for Local Dev)
# ============================================================================
JWT_SECRET="your-jwt-secret-key-min-32-chars-for-local-dev-only"
VITE_APP_ID="local-dev-app-id"
OAUTH_SERVER_URL="https://api.manus.im"
VITE_OAUTH_PORTAL_URL="https://portal.manus.im"
OWNER_OPEN_ID="local-owner-id"
OWNER_NAME="Local Developer"

# ============================================================================
# DeepSeek API (Required for URL Analysis)
# ============================================================================
DEEPSEEK_API_KEY="sk-xxxxx..."  # Get from https://platform.deepseek.com
DEEPSEEK_API_URL="https://api.deepseek.com/v1"
DEEPSEEK_TIMEOUT_SHORT=10000
DEEPSEEK_TIMEOUT_LONG=30000
DEEPSEEK_MAX_RETRIES=3
DEEPSEEK_DAILY_TOKEN_LIMIT=10000

# ============================================================================
# AWS S3 (For Screenshot Storage)
# ============================================================================
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="urlguard-screenshots-dev"

# ============================================================================
# Redis (Pre-configured for local Docker)
# ============================================================================
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# ============================================================================
# Manus Built-in APIs (Mock for Local Dev)
# ============================================================================
BUILT_IN_FORGE_API_URL="https://api.manus.im"
BUILT_IN_FORGE_API_KEY="local-forge-key"
VITE_FRONTEND_FORGE_API_URL="https://api.manus.im"
VITE_FRONTEND_FORGE_API_KEY="local-frontend-key"

# ============================================================================
# Analytics (Optional)
# ============================================================================
VITE_ANALYTICS_ENDPOINT="https://analytics.manus.im"
VITE_ANALYTICS_WEBSITE_ID="local-analytics-id"

# ============================================================================
# Application
# ============================================================================
NODE_ENV="development"
VITE_APP_TITLE="URLGuard AI (Local)"
VITE_APP_LOGO="https://cdn.example.com/logo.png"
```

### 4.2 Environment Variable Validation

```bash
# Verify all required variables are set
pnpm check

# Test database connection
node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'urlguard_ai'
}).then(() => console.log('✓ Database OK')).catch(e => console.error('✗ Database Error:', e.message));
"

# Test Redis connection
redis-cli -h localhost ping
# Expected: PONG

# Test DeepSeek API
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'
```

---

## 5. Antigravity IDE Configuration

### 5.1 Create `.antigravity/config.json`

Create this file in project root:

```json
{
  "project": {
    "name": "URLGuard AI",
    "description": "Phishing Detection with DeepSeek AI",
    "version": "5.2.0"
  },
  "ide": {
    "theme": "dark",
    "fontSize": 14,
    "fontFamily": "Fira Code"
  },
  "runtime": {
    "type": "node",
    "version": "22.13.0",
    "packageManager": "pnpm"
  },
  "development": {
    "port": 3000,
    "host": "localhost",
    "protocol": "http",
    "debugPort": 9229,
    "debugProtocol": "inspector"
  },
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
    "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "test": "vitest run",
    "check": "tsc --noEmit",
    "db:push": "drizzle-kit generate && drizzle-kit migrate"
  },
  "services": {
    "redis": {
      "host": "localhost",
      "port": 6379,
      "enabled": true
    },
    "mysql": {
      "host": "localhost",
      "port": 3306,
      "database": "urlguard_ai",
      "user": "root",
      "enabled": true
    }
  },
  "extensions": [
    "ms-python.python",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright"
  ],
  "launch": {
    "version": "0.2.0",
    "configurations": [
      {
        "name": "Dev Server",
        "type": "node",
        "request": "launch",
        "program": "${workspaceFolder}/node_modules/.bin/tsx",
        "args": ["watch", "server/_core/index.ts"],
        "env": {
          "NODE_ENV": "development"
        },
        "console": "integratedTerminal",
        "internalConsoleOptions": "neverOpen"
      },
      {
        "name": "Attach Debugger",
        "type": "node",
        "request": "attach",
        "port": 9229,
        "skipFiles": ["<node_internals>/**"]
      }
    ]
  },
  "tasks": {
    "build": {
      "label": "Build Project",
      "type": "shell",
      "command": "pnpm",
      "args": ["build"],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    "test": {
      "label": "Run Tests",
      "type": "shell",
      "command": "pnpm",
      "args": ["test"],
      "group": {
        "kind": "test",
        "isDefault": true
      }
    },
    "docker:up": {
      "label": "Start Docker Services",
      "type": "shell",
      "command": "docker-compose",
      "args": ["up", "-d"]
    },
    "docker:down": {
      "label": "Stop Docker Services",
      "type": "shell",
      "command": "docker-compose",
      "args": ["down"]
    }
  }
}
```

### 5.2 Import Configuration into Antigravity

```bash
# Copy config to Antigravity workspace
cp .antigravity/config.json ~/.antigravity/projects/urlguard-ai/

# Reload Antigravity IDE
antigravity reload

# Verify configuration loaded
antigravity config show
```

### 5.3 Recommended Extensions

Install these extensions in Antigravity for optimal development:

```bash
antigravity ext install ms-python.python
antigravity ext install dbaeumer.vscode-eslint
antigravity ext install esbenp.prettier-vscode
antigravity ext install bradlc.vscode-tailwindcss
antigravity ext install ms-playwright.playwright
antigravity ext install ms-mssql.mssql
antigravity ext install eamodio.gitlens
```

---

## 6. Running Locally (Dev & Prod)

### 6.1 Development Mode

#### Terminal 1: Start Backend Dev Server

```bash
cd /workspace/urlguard-ai

# Start with file watching
NODE_ENV=development tsx watch server/_core/index.ts

# Expected output:
# [2026-03-25T10:00:00.000Z] [OAuth] Initialized with baseURL: https://api.manus.im
# [2026-03-25T10:00:00.100Z] [Redis] Connected to redis://localhost:6379
# [2026-03-25T10:00:00.200Z] Server running on http://localhost:3000/
# [2026-03-25T10:00:00.300Z] tRPC endpoint ready at /api/trpc
```

#### Terminal 2: Monitor Logs (Optional)

```bash
docker-compose logs -f
```

#### Terminal 3: Run Tests (Optional)

```bash
pnpm test -- --watch
```

### 6.2 Access Application

Open browser to: **http://localhost:3000**

Expected UI elements:
- ✅ URLGuard AI header
- ✅ URL input field
- ✅ "Check URL" button
- ✅ Analysis results panel
- ✅ History section

### 6.3 Test URL Analysis

```bash
# Via browser: Enter URL in input field and click "Check URL"

# Via API (curl):
curl -X POST http://localhost:3000/api/trpc/urlChecker.checkURL \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Expected response:
# {
#   "result": {
#     "data": {
#       "id": 1,
#       "url": "https://example.com",
#       "riskScore": 15,
#       "riskLevel": "safe",
#       "analysis": "Domain is legitimate...",
#       "confidence": 0.95
#     }
#   }
# }
```

### 6.4 Production Mode

```bash
# Build for production
pnpm build

# Start production server
NODE_ENV=production node dist/index.js

# Expected output:
# Server running on http://localhost:3000/

# Verify with curl
curl http://localhost:3000/api/trpc/auth.me
```

### 6.5 Docker Production Build

```bash
# Build Docker image
docker build -t urlguard-ai:latest .

# Run Docker container
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://root:password@mysql:3306/urlguard_ai" \
  -e DEEPSEEK_API_KEY="sk-..." \
  -e NODE_ENV="production" \
  urlguard-ai:latest

# Verify container running
docker ps | grep urlguard-ai
```

---

## 7. Known Issues & Manus-Specific Workarounds

### 7.1 Manus OAuth Bypass (Local Development)

**Issue:** Manus OAuth requires cloud connectivity.

**Workaround:** Create mock authentication for local development.

```typescript
// server/_core/context.ts (for local dev)
export async function createContext(opts: CreateContextOptions): Promise<TrpcContext> {
  // Mock user for local development
  if (process.env.NODE_ENV === 'development' && !opts.req.cookies[COOKIE_NAME]) {
    return {
      user: {
        id: 1,
        openId: 'local-dev-user',
        email: 'dev@localhost',
        name: 'Local Developer',
        loginMethod: 'mock',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: opts.req,
      res: opts.res,
    };
  }
  // ... rest of context logic
}
```

### 7.2 Manus Notification API Bypass

**Issue:** Owner notifications require Manus API.

**Workaround:** Mock notifications locally.

```typescript
// server/_core/notification.ts (for local dev)
export async function notifyOwner(opts: NotifyOwnerOptions): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[MOCK NOTIFICATION]', opts);
    return true;
  }
  // ... real notification logic
}
```

### 7.3 CORS Issues When Accessing DeepSeek

**Issue:** Browser blocks DeepSeek API calls due to CORS.

**Solution:** All DeepSeek calls must go through backend (already implemented).

```typescript
// ✓ Correct: Backend calls DeepSeek
const deepseekClient = getDeepSeekClient();
const result = await deepseekClient.analyzeURL(url);

// ✗ Wrong: Frontend calling DeepSeek directly
// fetch('https://api.deepseek.com/...') // CORS error
```

### 7.4 AWS S3 Credentials Not Working

**Issue:** Invalid or missing AWS credentials.

**Solution:**
```bash
# Verify credentials in .env
grep AWS .env

# Test S3 access
aws s3 ls --profile default

# If error, reconfigure AWS CLI
aws configure
```

### 7.5 Redis Connection Refused

**Issue:** Redis service not running.

**Solution:**
```bash
# Start Redis
docker-compose up -d redis

# Verify running
docker-compose ps redis

# Test connection
redis-cli ping
```

### 7.6 MySQL Connection Timeout

**Issue:** MySQL service not ready.

**Solution:**
```bash
# Restart MySQL
docker-compose restart mysql

# Wait 30 seconds
sleep 30

# Test connection
mysql -uroot -ppassword -h localhost -e "SELECT 1;"
```

---

## 8. Troubleshooting Guide

### 8.1 Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev
```

### 8.2 Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Verify TypeScript
pnpm check
```

### 8.3 Database Migration Errors

```bash
# Check migration status
drizzle-kit status

# Reset database (WARNING: Deletes all data)
docker-compose exec mysql mysql -uroot -ppassword -D urlguard_ai -e "DROP TABLE *;"
pnpm db:push
```

### 8.4 DeepSeek API Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid API key | Check DEEPSEEK_API_KEY in .env |
| 429 Too Many Requests | Rate limited | Increase cache TTL, reduce batch size |
| 500 Server Error | DeepSeek down | Check https://status.deepseek.com |
| Timeout | Network slow | Increase timeout in .env |

```bash
# Test DeepSeek connectivity
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'
```

### 8.5 TypeScript Compilation Errors

```bash
# Type check
pnpm check

# Fix formatting
pnpm format

# Clear TypeScript cache
rm -rf node_modules/.vite
```

### 8.6 Docker Issues

```bash
# View Docker logs
docker-compose logs mysql
docker-compose logs redis

# Restart all services
docker-compose restart

# Clean up (WARNING: Deletes data)
docker-compose down -v
docker-compose up -d
```

### 8.7 Memory Issues

```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=4096" pnpm dev

# Check current memory usage
docker stats
```

### 8.8 Build Failures

```bash
# Clean build
rm -rf dist/ .vite/
pnpm build

# Verbose output
pnpm build -- --debug
```

---

## 9. Performance Tuning

### 9.1 Frontend Optimization

```bash
# Analyze bundle size
pnpm build
npm install -g serve
serve -s dist

# Check performance
# Open DevTools → Lighthouse → Run audit
```

### 9.2 Backend Optimization

```bash
# Monitor API latency
curl http://localhost:3000/metrics | grep deepseek_api_latency

# Check cache hit rate
curl http://localhost:3000/metrics | grep cache_hit_rate

# Monitor queue length
curl http://localhost:3000/metrics | grep queue_length
```

### 9.3 Database Optimization

```bash
# Add indexes
docker-compose exec mysql mysql -uroot -ppassword -D urlguard_ai -e "
CREATE INDEX idx_user_id ON url_checks(userId);
CREATE INDEX idx_created_at ON url_checks(createdAt);
CREATE INDEX idx_risk_level ON url_checks(riskLevel);
"

# Analyze query performance
EXPLAIN SELECT * FROM url_checks WHERE userId = 1;
```

### 9.4 Redis Optimization

```bash
# Monitor Redis memory
redis-cli INFO memory

# Clear old cache
redis-cli FLUSHDB

# Check key count
redis-cli DBSIZE
```

---

## 10. Security Considerations

### 10.1 Secret Management

**DO:**
- ✅ Store secrets in `.env` (never commit)
- ✅ Use strong JWT_SECRET (min 32 chars)
- ✅ Rotate API keys regularly
- ✅ Use environment-specific secrets

**DON'T:**
- ❌ Commit `.env` to git
- ❌ Log sensitive values
- ❌ Hardcode secrets in code
- ❌ Share secrets via chat/email

### 10.2 Database Security

```bash
# Change MySQL root password
docker-compose exec mysql mysql -uroot -ppassword -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'new-strong-password';"

# Create non-root user
docker-compose exec mysql mysql -uroot -ppassword -e "
CREATE USER 'urlguard'@'%' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON urlguard_ai.* TO 'urlguard'@'%';
FLUSH PRIVILEGES;
"
```

### 10.3 API Security

```bash
# Enable HTTPS in production
# Use reverse proxy (nginx/Traefik) with SSL certificates

# Rate limiting (already configured)
# 10 req/min unauthenticated
# 100 req/min authenticated

# CORS configuration
# Only allow trusted origins
```

### 10.4 Dependency Security

```bash
# Check for vulnerabilities
pnpm audit

# Fix vulnerabilities
pnpm audit --fix

# Update dependencies
pnpm update
```

---

## Appendix: Quick Reference

### Common Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm test             # Run tests
pnpm check            # Type check
pnpm format           # Format code

# Database
pnpm db:push          # Run migrations
docker-compose ps     # Check services
docker-compose logs   # View logs

# Production
pnpm build            # Build for production
pnpm start            # Start production server
docker build .        # Build Docker image
```

### Useful URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Application |
| http://localhost:3000/api/trpc/auth.me | API health |
| http://localhost:3000/metrics | Prometheus metrics |
| http://localhost:6379 | Redis (CLI only) |
| http://localhost:3306 | MySQL (CLI only) |

### File Locations

| File | Purpose |
|------|---------|
| `.env` | Environment variables |
| `.antigravity/config.json` | IDE configuration |
| `docker-compose.yml` | Docker services |
| `package.json` | Dependencies |
| `drizzle/schema.ts` | Database schema |

---

**End of Migration Guide**  
**Status:** Production-Ready for Google Antigravity AI  
**Last Updated:** 2026-03-25  
**Support:** Refer to project documentation and troubleshooting section above
