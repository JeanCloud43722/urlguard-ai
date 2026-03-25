# Antigravity Project Migration Manifest: URLGuard AI

**Project Name:** URLGuard AI – Phishing & URL Security Checker  
**Source Platform:** Manus AI (Cloud-first, abstracted services)  
**Target Platform:** Google Antigravity AI (Agent-first IDE, local development)  
**Last Updated:** 2026-03-23  
**Status:** Production-Ready for Local Migration

---

## 1. Project Overview & Architecture

### 1.1 Project Description

URLGuard AI is a full-stack web application for detecting phishing URLs using DeepSeek AI, SSL certificate analysis, heuristic indicators, and forensic screenshot capture. The system is horizontally scalable with Redis caching, BullMQ batch processing, and Prometheus monitoring.

### 1.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript | 19.2.1 |
| **Styling** | Tailwind CSS 4 + shadcn/ui | 4.1.14 |
| **Backend** | Express 4 + Node.js | 4.21.2 |
| **API** | tRPC 11 + Superjson | 11.6.0 |
| **Database** | MySQL 8 / TiDB | 3.15.0 |
| **ORM** | Drizzle ORM | 0.44.5 |
| **AI/LLM** | DeepSeek API (deepseek-chat) | v1 |
| **Caching** | Redis (ioredis) | 5.10.1 |
| **Job Queue** | BullMQ | 5.71.0 |
| **Screenshots** | Playwright | 1.58.2 |
| **Storage** | AWS S3 (SDK) | 3.907.0 |
| **Monitoring** | Prometheus (prom-client) | 15.1.3 |
| **Build Tool** | Vite 7 + esbuild | 7.1.7 |
| **Testing** | Vitest | 2.1.4 |
| **Package Manager** | pnpm | 10.15.1 |

### 1.3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React 19)                        │
│  - Home: URL Checker with real-time validation                 │
│  - BatchChecker: Bulk URL analysis (50 URLs)                   │
│  - Export: PDF/JSON report generation                          │
│  - Auth: Manus OAuth integration                               │
└────────────────────────┬────────────────────────────────────────┘
                         │ tRPC + HTTP/WebSocket
┌────────────────────────▼────────────────────────────────────────┐
│                  Backend (Express + tRPC)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ tRPC Routers                                             │  │
│  │  - urlChecker.checkURL()      → URL analysis             │  │
│  │  - urlChecker.getHistory()    → User history            │  │
│  │  - screenshots.getStatus()    → Job status              │  │
│  │  - system.notifyOwner()       → Notifications           │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Services & Analyzers                                     │  │
│  │  - DeepSeek Client (analyzeWithFullContext)             │  │
│  │  - URL Analyzer (heuristic indicators)                  │  │
│  │  - SSL Certificate Fetcher                             │  │
│  │  - Playwright Screenshot Service                       │  │
│  │  - S3 Upload Service                                   │  │
│  │  - Redis Cache Service                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Background Jobs (BullMQ)                                 │  │
│  │  - Screenshot Capture (async, resilient)                │  │
│  │  - Batch URL Processing (50 URLs, progress tracking)    │  │
│  │  - Notification Delivery                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌─────────┐
    │ MySQL  │      │ Redis  │      │ AWS S3  │
    │ (Data) │      │(Cache) │      │(Images) │
    └────────┘      └────────┘      └─────────┘
        │
        ▼
    ┌──────────────────┐
    │ DeepSeek API     │
    │ (deepseek-chat)  │
    └──────────────────┘
```

---

## 2. Manus AI Extraction Details (Source Files to Port)

### 2.1 Frontend Source Files

```
client/src/
├── App.tsx                          # Main router & layout
├── main.tsx                         # React entry point
├── index.css                        # Global styles + design tokens
├── const.ts                         # Constants (login URL, etc.)
├── lib/
│   ├── trpc.ts                      # tRPC client setup
│   └── utils.ts                     # Utility functions
├── _core/
│   └── hooks/useAuth.ts             # Authentication hook
├── contexts/
│   └── ThemeContext.tsx             # Dark/light theme
├── hooks/
│   ├── useComposition.ts
│   ├── useMobile.tsx
│   └── usePersistFn.ts
├── pages/
│   ├── Home.tsx                     # Main URL checker
│   ├── BatchChecker.tsx             # Bulk analysis
│   ├── Export.tsx                   # Report export
│   ├── ComponentShowcase.tsx        # UI demo
│   └── NotFound.tsx                 # 404 page
└── components/
    ├── DashboardLayout.tsx          # Sidebar layout
    ├── AIChatBox.tsx                # Chat interface
    ├── Map.tsx                      # Google Maps
    ├── ErrorBoundary.tsx
    ├── ManusDialog.tsx
    └── ui/                          # shadcn/ui components (60+ files)
```

### 2.2 Backend Source Files

```
server/
├── _core/
│   ├── index.ts                     # Express app setup
│   ├── context.ts                   # tRPC context
│   ├── trpc.ts                      # tRPC router setup
│   ├── cookies.ts                   # Session management
│   ├── env.ts                       # Environment variables
│   ├── llm.ts                       # LLM invocation
│   ├── notification.ts              # Owner notifications
│   ├── voiceTranscription.ts        # Whisper API
│   ├── imageGeneration.ts           # Image gen
│   ├── map.ts                       # Maps integration
│   └── systemRouter.ts              # System procedures
├── analyzers/
│   ├── deepseekEnhanced.ts          # DeepSeek client (retry, timeout)
│   ├── deepseekPrompt.ts            # Prompts & validation
│   ├── urlAnalyzer.ts               # URL validation & heuristics
│   └── llmAdapter.ts                # LLM provider abstraction
├── services/
│   ├── redis.ts                     # Redis client & caching
│   ├── batchProcessor.ts            # BullMQ batch jobs
│   ├── playwright.ts                # Screenshot capture
│   ├── s3Screenshot.ts              # S3 upload
│   ├── metrics.ts                   # Prometheus metrics
│   └── certificate.ts               # SSL cert fetching
├── routers/
│   ├── urlChecker.ts                # URL analysis procedures
│   ├── screenshots.ts               # Screenshot job status
│   └── (other routers)
├── queues/
│   ├── screenshotJob.ts             # Screenshot job processor
│   └── screenshotJob.enhanced.ts    # Enhanced version (idempotent)
├── middleware/
│   └── rateLimiting.ts              # Rate limit middleware
├── websocket/
│   └── handler.ts                   # WebSocket + Redis Pub/Sub
├── metrics/
│   └── screenshotMetrics.ts         # Prometheus metrics
├── db.ts                            # Database helpers
├── routers.ts                       # Main router export
├── storage.ts                       # S3 helpers
├── __tests__/
│   └── screenshot.test.ts           # Test suite (30+ tests)
└── (other services & utilities)
```

### 2.3 Database Schema

```
drizzle/
├── schema.ts                        # Table definitions
│   ├── users                        # Auth users
│   ├── url_checks                   # URL analysis results
│   ├── batch_jobs                   # Batch processing jobs
│   ├── screenshots                  # Screenshot metadata
│   └── (other tables)
├── relations.ts                     # Table relationships
├── migrations/                      # SQL migration files
└── meta/                            # Drizzle metadata
```

### 2.4 Configuration Files

```
Root Directory:
├── package.json                     # Dependencies & scripts
├── pnpm-lock.yaml                   # Lockfile
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite build config
├── vitest.config.ts                 # Test config
├── drizzle.config.ts                # Drizzle ORM config
├── components.json                  # shadcn/ui config
├── docker-compose.yml               # Local Redis + MySQL
├── Dockerfile                       # Production image
├── prometheus.yml                   # Prometheus config
├── k8s/
│   ├── deployment.yaml              # K8s deployment
│   └── redis-mysql.yaml             # K8s services
└── Documentation:
    ├── DEEPSEEK_API_INTEGRATION.md
    ├── DEEPSEEK_OPTIMIZATION.md
    ├── SCALABILITY.md
    ├── SCREENSHOT_FEATURE.md
    └── (other docs)
```

---

## 3. Local Environment Setup (Required Runtimes)

### 3.1 System Requirements

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 22.13.0+ | Runtime |
| pnpm | 10.15.1+ | Package manager |
| Docker | 20.10+ | Redis + MySQL containers |
| Docker Compose | 1.29+ | Orchestration |
| Git | 2.30+ | Version control |

### 3.2 Installation Steps

```bash
# 1. Install Node.js (if not present)
# macOS: brew install node@22
# Ubuntu: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
# Windows: https://nodejs.org/

# 2. Install pnpm globally
npm install -g pnpm@10.15.1

# 3. Install Docker & Docker Compose
# macOS: brew install docker docker-compose
# Ubuntu: sudo apt-get install docker.io docker-compose
# Windows: https://www.docker.com/products/docker-desktop

# 4. Clone repository
git clone <your-repo-url> urlguard-ai
cd urlguard-ai

# 5. Install dependencies
pnpm install

# 6. Start local services (Redis + MySQL)
docker-compose up -d

# 7. Generate database migrations
pnpm db:push

# 8. Create .env file (see section 3.3)
```

### 3.3 Environment Variables (.env)

Create `.env` file in project root:

```bash
# ============================================================================
# DATABASE
# ============================================================================
DATABASE_URL="mysql://root:password@localhost:3306/urlguard_ai"

# ============================================================================
# AUTHENTICATION (Manus OAuth)
# ============================================================================
JWT_SECRET="your-jwt-secret-key-min-32-chars"
VITE_APP_ID="your-manus-app-id"
OAUTH_SERVER_URL="https://api.manus.im"
VITE_OAUTH_PORTAL_URL="https://portal.manus.im"
OWNER_OPEN_ID="your-owner-open-id"
OWNER_NAME="Your Name"

# ============================================================================
# DeepSeek API
# ============================================================================
DEEPSEEK_API_KEY="sk-xxxxx..."
DEEPSEEK_API_URL="https://api.deepseek.com/v1"
DEEPSEEK_TIMEOUT_SHORT=10000
DEEPSEEK_TIMEOUT_LONG=30000
DEEPSEEK_MAX_RETRIES=3
DEEPSEEK_DAILY_TOKEN_LIMIT=10000

# ============================================================================
# AWS S3 (Screenshots)
# ============================================================================
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="urlguard-screenshots"

# ============================================================================
# Redis (Caching & Jobs)
# ============================================================================
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# ============================================================================
# Manus Built-in APIs
# ============================================================================
BUILT_IN_FORGE_API_URL="https://api.manus.im"
BUILT_IN_FORGE_API_KEY="your-forge-api-key"
VITE_FRONTEND_FORGE_API_URL="https://api.manus.im"
VITE_FRONTEND_FORGE_API_KEY="your-frontend-forge-key"

# ============================================================================
# Analytics (Optional)
# ============================================================================
VITE_ANALYTICS_ENDPOINT="https://analytics.manus.im"
VITE_ANALYTICS_WEBSITE_ID="your-website-id"

# ============================================================================
# Application
# ============================================================================
NODE_ENV="development"
VITE_APP_TITLE="URLGuard AI"
VITE_APP_LOGO="https://cdn.example.com/logo.png"
```

### 3.4 Docker Compose Setup

The `docker-compose.yml` provides Redis and MySQL:

```bash
# Start services
docker-compose up -d

# Verify services running
docker-compose ps

# View logs
docker-compose logs -f redis
docker-compose logs -f mysql

# Stop services
docker-compose down
```

---

## 4. Target Directory Structure (Tree Format)

```
urlguard-ai/                          # Project root
├── .env                              # Environment variables (create locally)
├── .env.example                      # Template
├── .gitignore
├── .prettierrc
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── drizzle.config.ts
├── components.json
├── package.json
├── pnpm-lock.yaml
├── docker-compose.yml
├── Dockerfile
├── prometheus.yml
│
├── client/                           # Frontend (React)
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── robots.txt
│   │   └── __manus__/version.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── const.ts
│   │   ├── _core/
│   │   │   └── hooks/useAuth.ts
│   │   ├── lib/
│   │   │   ├── trpc.ts
│   │   │   └── utils.ts
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx
│   │   ├── hooks/
│   │   │   ├── useComposition.ts
│   │   │   ├── useMobile.tsx
│   │   │   └── usePersistFn.ts
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── BatchChecker.tsx
│   │   │   ├── Export.tsx
│   │   │   ├── ComponentShowcase.tsx
│   │   │   └── NotFound.tsx
│   │   └── components/
│   │       ├── DashboardLayout.tsx
│   │       ├── AIChatBox.tsx
│   │       ├── Map.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── ManusDialog.tsx
│   │       └── ui/
│   │           ├── button.tsx
│   │           ├── card.tsx
│   │           ├── input.tsx
│   │           └── (60+ shadcn/ui components)
│   └── index.html
│
├── server/                           # Backend (Express + tRPC)
│   ├── _core/
│   │   ├── index.ts                  # Express app
│   │   ├── context.ts
│   │   ├── trpc.ts
│   │   ├── cookies.ts
│   │   ├── env.ts
│   │   ├── llm.ts
│   │   ├── notification.ts
│   │   ├── voiceTranscription.ts
│   │   ├── imageGeneration.ts
│   │   ├── map.ts
│   │   └── systemRouter.ts
│   ├── analyzers/
│   │   ├── deepseekEnhanced.ts
│   │   ├── deepseekPrompt.ts
│   │   ├── urlAnalyzer.ts
│   │   └── llmAdapter.ts
│   ├── services/
│   │   ├── redis.ts
│   │   ├── batchProcessor.ts
│   │   ├── playwright.ts
│   │   ├── s3Screenshot.ts
│   │   ├── metrics.ts
│   │   └── certificate.ts
│   ├── routers/
│   │   ├── urlChecker.ts
│   │   ├── screenshots.ts
│   │   └── (other routers)
│   ├── queues/
│   │   ├── screenshotJob.ts
│   │   └── screenshotJob.enhanced.ts
│   ├── middleware/
│   │   └── rateLimiting.ts
│   ├── websocket/
│   │   └── handler.ts
│   ├── metrics/
│   │   └── screenshotMetrics.ts
│   ├── __tests__/
│   │   └── screenshot.test.ts
│   ├── db.ts
│   ├── routers.ts
│   └── storage.ts
│
├── drizzle/                          # Database
│   ├── schema.ts
│   ├── relations.ts
│   ├── migrations/
│   │   ├── 0000_initial.sql
│   │   └── 0001_add_screenshots.sql
│   └── meta/
│
├── k8s/                              # Kubernetes
│   ├── deployment.yaml
│   └── redis-mysql.yaml
│
├── storage/                          # S3 helpers
│   └── index.ts
│
├── shared/                           # Shared types
│   ├── const.ts
│   └── types.ts
│
└── Documentation/
    ├── DEEPSEEK_API_INTEGRATION.md
    ├── DEEPSEEK_OPTIMIZATION.md
    ├── SCALABILITY.md
    ├── SCREENSHOT_FEATURE.md
    ├── SCREENSHOT_FINALIZATION_GUIDE.md
    ├── CODE_REVIEW_SCREENSHOT.md
    └── antigravity-migration-manifest.md (this file)
```

---

## 5. Dependency Management (Exact Configs)

### 5.1 package.json Scripts

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
    "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "vitest run",
    "db:push": "drizzle-kit generate && drizzle-kit migrate"
  }
}
```

### 5.2 Critical Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.1 | UI framework |
| express | 4.21.2 | Backend server |
| @trpc/server | 11.6.0 | RPC framework |
| drizzle-orm | 0.44.5 | Database ORM |
| ioredis | 5.10.1 | Redis client |
| bullmq | 5.71.0 | Job queue |
| playwright | 1.58.2 | Browser automation |
| @aws-sdk/client-s3 | 3.907.0 | S3 uploads |
| prom-client | 15.1.3 | Prometheus metrics |

### 5.3 Installation Command

```bash
# Install all dependencies
pnpm install

# Install specific package
pnpm add <package-name>

# Install dev dependency
pnpm add -D <package-name>

# Update all packages
pnpm update
```

---

## 6. Antigravity Agent Directives (Exact `/agent` Commands)

### 6.1 Multi-Agent Orchestration Strategy

The following `/agent` directives split URLGuard AI setup across specialized agents:

```markdown
/agent setup-backend
  Objective: Configure backend runtime and dependencies
  Tasks:
    1. Verify Node.js 22.13.0+ installed: `node --version`
    2. Install pnpm: `npm install -g pnpm@10.15.1`
    3. Install project dependencies: `cd /workspace/urlguard-ai && pnpm install`
    4. Verify TypeScript: `pnpm check`
    5. Report: "Backend dependencies ready"

/agent setup-database
  Objective: Initialize MySQL and Redis services
  Tasks:
    1. Start Docker services: `docker-compose up -d`
    2. Wait for MySQL ready (30s): `sleep 30`
    3. Verify MySQL: `docker-compose exec mysql mysql -uroot -ppassword -e "SELECT 1"`
    4. Verify Redis: `docker-compose exec redis redis-cli ping`
    5. Generate migrations: `pnpm db:push`
    6. Report: "Database services initialized"

/agent setup-environment
  Objective: Create and validate .env configuration
  Tasks:
    1. Copy template: `cp .env.example .env`
    2. Edit .env with required values (DeepSeek API key, AWS credentials, etc.)
    3. Validate required vars: `grep -E "DEEPSEEK_API_KEY|AWS_ACCESS_KEY_ID|DATABASE_URL" .env`
    4. Report: "Environment configured"

/agent build-frontend
  Objective: Build React frontend
  Tasks:
    1. Build with Vite: `pnpm build`
    2. Verify dist/ created: `ls -la dist/`
    3. Check bundle size: `du -sh dist/`
    4. Report: "Frontend built successfully"

/agent build-backend
  Objective: Compile TypeScript backend
  Tasks:
    1. Type check: `pnpm check`
    2. Build: `pnpm build`
    3. Verify dist/index.js: `ls -la dist/index.js`
    4. Report: "Backend compiled successfully"

/agent run-tests
  Objective: Execute test suite
  Tasks:
    1. Run tests: `pnpm test`
    2. Capture output
    3. Report: "All tests passed" or list failures

/agent start-dev-server
  Objective: Start development server
  Tasks:
    1. Start: `NODE_ENV=development tsx watch server/_core/index.ts`
    2. Wait for "Server running on http://localhost:3000/"
    3. Verify tRPC endpoint: `curl http://localhost:3000/api/trpc/auth.me`
    4. Report: "Dev server ready at http://localhost:3000"

/agent verify-frontend
  Objective: Verify frontend loads in browser
  Tasks:
    1. Open browser: http://localhost:3000
    2. Check page title: "URLGuard AI"
    3. Verify no console errors
    4. Test URL input field
    5. Report: "Frontend verified"

/agent full-setup
  Objective: Complete end-to-end setup
  Depends-on:
    - setup-backend
    - setup-database
    - setup-environment
    - build-frontend
    - build-backend
    - run-tests
    - start-dev-server
    - verify-frontend
  Report: "URLGuard AI ready for development"
```

### 6.2 Agent Execution Sequence

```
┌─────────────────────────────────────────────────────────┐
│ /agent full-setup (Master Orchestrator)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │ setup-backend    │  │ setup-database   │           │
│  │ (5 min)          │  │ (2 min)          │           │
│  └────────┬─────────┘  └────────┬─────────┘           │
│           │                     │                      │
│           └─────────────────────┘                      │
│                    │                                   │
│           ┌────────▼─────────┐                        │
│           │setup-environment │                        │
│           │ (1 min)          │                        │
│           └────────┬─────────┘                        │
│                    │                                   │
│     ┌──────────────┴──────────────┐                   │
│     │                             │                    │
│  ┌──▼──────────────┐  ┌──────────▼──┐                │
│  │build-frontend   │  │build-backend │                │
│  │ (3 min)         │  │ (2 min)      │                │
│  └──┬──────────────┘  └──────────┬───┘                │
│     │                           │                     │
│     └───────────────┬───────────┘                     │
│                     │                                 │
│              ┌──────▼──────┐                          │
│              │run-tests    │                          │
│              │ (2 min)     │                          │
│              └──────┬──────┘                          │
│                     │                                 │
│           ┌─────────▼──────────┐                      │
│           │start-dev-server    │                      │
│           │ (running)          │                      │
│           └─────────┬──────────┘                      │
│                     │                                 │
│           ┌─────────▼──────────┐                      │
│           │verify-frontend     │                      │
│           │ (1 min)            │                      │
│           └─────────┬──────────┘                      │
│                     │                                 │
│              ┌──────▼──────┐                          │
│              │ READY       │                          │
│              └─────────────┘                          │
│                                                         │
│ Total Time: ~20 minutes                               │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Run & Verify (Terminal Commands and Browser Preview Targets)

### 7.1 Development Workflow

```bash
# Terminal 1: Start backend dev server
cd /workspace/urlguard-ai
NODE_ENV=development tsx watch server/_core/index.ts

# Expected output:
# [2026-03-23T16:20:00.000Z] Server running on http://localhost:3000/
# [2026-03-23T16:20:00.000Z] [OAuth] Initialized with baseURL: https://api.manus.im
# [2026-03-23T16:20:00.000Z] [Redis] Connected to redis://localhost:6379

# Terminal 2: Watch frontend with Vite (optional, for HMR)
cd /workspace/urlguard-ai
pnpm dev

# Terminal 3: Run tests in watch mode
cd /workspace/urlguard-ai
pnpm test -- --watch

# Terminal 4: Monitor logs
docker-compose logs -f
```

### 7.2 Browser Verification Targets

| Target | URL | Expected Result |
|--------|-----|-----------------|
| **Homepage** | http://localhost:3000 | URLGuard AI title, URL input field |
| **URL Analysis** | http://localhost:3000 (enter URL) | Risk score, analysis, indicators |
| **Batch Checker** | http://localhost:3000/batch | Bulk upload form, progress bar |
| **Export** | http://localhost:3000/export | Report download options |
| **API Health** | http://localhost:3000/api/trpc/auth.me | JSON response (auth status) |
| **Metrics** | http://localhost:3000/metrics | Prometheus metrics (text format) |
| **WebSocket** | ws://localhost:3000/ws | Connection established |

### 7.3 Quick Test Commands

```bash
# Test URL analysis API
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
#       "analysis": "..."
#     }
#   }
# }

# Check database
docker-compose exec mysql mysql -uroot -ppassword -D urlguard_ai -e "SELECT COUNT(*) FROM url_checks;"

# Check Redis
docker-compose exec redis redis-cli KEYS "*"

# View logs
docker-compose logs -f mysql
docker-compose logs -f redis
```

### 7.4 Production Build & Deployment

```bash
# Build for production
pnpm build

# Start production server
NODE_ENV=production node dist/index.js

# Expected output:
# Server running on http://localhost:3000/

# Verify with curl
curl http://localhost:3000/api/trpc/auth.me

# Docker build
docker build -t urlguard-ai:latest .

# Docker run
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e DEEPSEEK_API_KEY="sk-..." \
  urlguard-ai:latest
```

### 7.5 Monitoring & Debugging

```bash
# View Prometheus metrics
curl http://localhost:3000/metrics | grep urlguard

# Check database connection
pnpm check

# TypeScript type check
pnpm check

# Format code
pnpm format

# Run linter (if configured)
pnpm lint

# View database schema
docker-compose exec mysql mysql -uroot -ppassword -D urlguard_ai -e "DESCRIBE url_checks;"
```

---

## 8. Troubleshooting & Common Issues

### 8.1 Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 pnpm dev
```

### 8.2 Redis Connection Error

```bash
# Verify Redis running
docker-compose ps redis

# Restart Redis
docker-compose restart redis

# Check Redis logs
docker-compose logs redis

# Test connection
redis-cli ping
```

### 8.3 MySQL Connection Error

```bash
# Verify MySQL running
docker-compose ps mysql

# Restart MySQL
docker-compose restart mysql

# Check MySQL logs
docker-compose logs mysql

# Test connection
mysql -uroot -ppassword -h localhost
```

### 8.4 DeepSeek API Errors

```bash
# Verify API key in .env
grep DEEPSEEK_API_KEY .env

# Test API connectivity
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'
```

### 8.5 TypeScript Errors

```bash
# Type check
pnpm check

# Fix types
pnpm format

# Clear cache
rm -rf node_modules/.vite
```

---

## 9. Performance Optimization Tips

### 9.1 Frontend Optimization

```bash
# Analyze bundle size
pnpm build
du -sh dist/

# Enable source maps for debugging
# In vite.config.ts: sourcemap: true

# Monitor performance
# Open DevTools → Performance tab → Record
```

### 9.2 Backend Optimization

```bash
# Monitor DeepSeek API usage
curl http://localhost:3000/metrics | grep deepseek

# Check cache hit rate
curl http://localhost:3000/metrics | grep cache_hit_rate

# Monitor queue length
curl http://localhost:3000/metrics | grep queue_length
```

### 9.3 Database Optimization

```bash
# Add indexes
docker-compose exec mysql mysql -uroot -ppassword -D urlguard_ai -e "CREATE INDEX idx_user_id ON url_checks(userId);"

# Analyze query performance
EXPLAIN SELECT * FROM url_checks WHERE userId = 1;
```

---

## 10. Next Steps for Antigravity AI

1. **Clone Repository:** `git clone <repo> && cd urlguard-ai`
2. **Run Full Setup:** `/agent full-setup`
3. **Access Application:** Open http://localhost:3000 in browser
4. **Test Functionality:** Enter a URL, verify analysis runs
5. **Monitor Logs:** `docker-compose logs -f`
6. **Deploy:** Follow production build steps (section 7.4)

---

## 11. Additional Resources

- **DeepSeek API Docs:** https://platform.deepseek.com/docs
- **tRPC Documentation:** https://trpc.io/docs
- **Drizzle ORM Docs:** https://orm.drizzle.team
- **BullMQ Documentation:** https://docs.bullmq.io
- **Playwright Docs:** https://playwright.dev
- **Prometheus Docs:** https://prometheus.io/docs

---

**End of Migration Manifest**  
**Generated:** 2026-03-23  
**Status:** Production-Ready for Local Migration to Antigravity AI
