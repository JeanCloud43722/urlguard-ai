# URLGuard AI – System Architecture

**Project:** URLGuard AI – Phishing & URL Security Checker  
**Version:** 8.7  
**Last Updated:** 2026-04-06  
**Architecture Pattern:** tRPC + React + Express (Full-Stack TypeScript)

---

## 📋 Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Technology Stack](#technology-stack)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Database Schema](#database-schema)
6. [API Design](#api-design)
7. [Authentication Flow](#authentication-flow)
8. [Data Flow](#data-flow)
9. [Performance Optimization](#performance-optimization)
10. [Security Architecture](#security-architecture)
11. [Deployment Architecture](#deployment-architecture)
12. [Scalability Considerations](#scalability-considerations)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React 19)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages: Home.tsx                                     │   │
│  │  Components: BorderGlow, GlassCard, DecryptedText   │   │
│  │  Hooks: useAuth, useHapticFeedback, useGlassHaptics │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ tRPC Client
                     │ (Type-Safe RPC)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   API GATEWAY (Express)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/trpc/* – tRPC Router                          │   │
│  │  /api/oauth/callback – OAuth Redirect              │   │
│  │  /api/health – Health Check                        │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌──────────┐
    │ tRPC   │  │ Auth   │  │ External │
    │Router  │  │Handler │  │ APIs     │
    └────────┘  └────────┘  └──────────┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌──────────┐
    │Database│  │ S3     │  │ DeepSeek │
    │(MySQL) │  │Storage │  │ AI       │
    └────────┘  └────────┘  └──────────┘
```

---

## Technology Stack

### Frontend
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React | 19 | UI rendering |
| **Language** | TypeScript | 5.x | Type safety |
| **Build Tool** | Vite | 7.1.7 | Fast bundling |
| **Styling** | Tailwind CSS | 4 | Utility-first CSS |
| **UI Library** | shadcn/ui | Latest | Pre-built components |
| **State Mgmt** | React Query | 5.90.2 | Server state |
| **RPC Client** | tRPC | 11.6.0 | Type-safe API |
| **Routing** | Wouter | 3.3.5 | Client-side routing |
| **Animations** | GSAP, Framer Motion | 3.14.2, 12.23.22 | Advanced animations |
| **Icons** | Lucide React | Latest | Icon library |
| **Notifications** | Sonner | 2.0.7 | Toast notifications |

### Backend
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 22.13.0 | JavaScript runtime |
| **Framework** | Express | 4.21.2 | HTTP server |
| **Language** | TypeScript | 5.x | Type safety |
| **RPC** | tRPC | 11.6.0 | Type-safe API |
| **ORM** | Drizzle | 0.44.5 | Database abstraction |
| **Database** | MySQL/TiDB | Latest | Data persistence |
| **Auth** | Manus OAuth | Built-in | Authentication |
| **Job Queue** | BullMQ | 5.71.0 | Async jobs |
| **Validation** | Zod | Latest | Schema validation |
| **Serialization** | Superjson | Latest | Date/BigInt support |

### External Services
| Service | Purpose | Integration |
|---------|---------|-------------|
| **DeepSeek AI** | URL analysis & threat detection | REST API |
| **Playwright** | Website screenshot capture | Node.js library |
| **AWS S3** | File storage (screenshots, exports) | SDK |
| **VirusTotal** | URL reputation check | REST API |
| **Manus OAuth** | User authentication | Built-in |

---

## Frontend Architecture

### Directory Structure

```
client/
├── public/                    # Static assets
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── pages/
│   │   └── Home.tsx          # Main landing page
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── BorderGlow.tsx    # Custom glow effect
│   │   ├── GlassCard.tsx     # Glassmorphism card
│   │   ├── DotGrid.tsx       # Dot grid background
│   │   ├── Aurora.tsx        # Aurora effect
│   │   ├── StarBorder.tsx    # Star border animation
│   │   ├── DecryptedText.tsx # Text decryption effect
│   │   ├── ResultModal.tsx   # Result display modal
│   │   └── DashboardLayout.tsx # Dashboard layout
│   ├── hooks/
│   │   ├── useHapticFeedback.ts # Haptic feedback
│   │   └── useGlassHaptics.ts   # Glass component haptics
│   ├── contexts/
│   │   └── ThemeContext.tsx  # Theme management
│   ├── lib/
│   │   └── trpc.ts           # tRPC client setup
│   ├── _core/
│   │   └── hooks/
│   │       └── useAuth.ts    # Authentication hook
│   ├── App.tsx               # Main app component
│   ├── main.tsx              # React entry point
│   ├── index.css             # Global styles
│   └── responsive-utilities.css # Responsive utilities
└── index.html                # HTML template
```

### Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── Navigation
│   └── Auth Button
├── Home
│   ├── Aurora (Background)
│   ├── DotGrid (Background)
│   ├── Hero Section
│   │   ├── DecryptedText (Title)
│   │   └── DecryptedText (Subtitle)
│   ├── URL Checker Card
│   │   ├── BorderGlow
│   │   └── GlassCard
│   │       ├── Input Field
│   │       ├── Check Button
│   │       └── Show History Button
│   ├── Result Modal
│   │   ├── Risk Level Display
│   │   ├── Analysis Text
│   │   ├── Indicators List
│   │   └── Export Options
│   └── History Section
│       └── History List
│           └── History Items
└── Footer
```

### State Management

**Local State (useState):**
- `urlInput` – Current URL input value
- `isLoading` – Loading state during analysis
- `result` – Last analysis result
- `showHistory` – History panel visibility
- `showResultModal` – Result modal visibility
- `mounted` – Component mount state

**Server State (React Query/tRPC):**
- `checkURLMutation` – URL check mutation
- `historyQuery` – History fetch query
- `auth.me` – Current user info

**Global State (Context):**
- Theme (dark/light)
- User authentication

### Data Flow

```
User Input
    ↓
handleCheckURL()
    ↓
Validation
    ↓
checkURLMutation.mutateAsync()
    ↓
tRPC Client → Server
    ↓
Result State Update
    ↓
ResultModal Display
    ↓
Auto-close (5s) or Manual Close
```

---

## Backend Architecture

### Directory Structure

```
server/
├── _core/
│   ├── context.ts            # tRPC context setup
│   ├── env.ts                # Environment variables
│   ├── llm.ts                # DeepSeek AI integration
│   ├── screenshot.ts         # Playwright integration
│   ├── voiceTranscription.ts # Whisper API
│   ├── imageGeneration.ts    # Image generation
│   ├── map.ts                # Google Maps integration
│   ├── notification.ts       # Owner notifications
│   └── oauth.ts              # OAuth handling
├── routers/
│   ├── urlChecker.ts         # URL checking procedures
│   ├── auth.ts               # Auth procedures
│   └── system.ts             # System procedures
├── db.ts                     # Database queries
├── storage.ts                # S3 storage helpers
├── routers.ts                # Main router export
└── index.ts                  # Server entry point
```

### tRPC Router Structure

```
router
├── urlChecker
│   ├── checkURL(url)         # Check URL for threats
│   ├── getHistory(limit)     # Get user's history
│   ├── deleteCheck(id)       # Delete check
│   └── exportHistory(format) # Export history
├── auth
│   ├── me()                  # Get current user
│   └── logout()              # Logout user
└── system
    └── notifyOwner(title, content) # Send notification
```

### Middleware Stack

```
Express
  ↓
CORS Middleware
  ↓
Body Parser
  ↓
Session Middleware
  ↓
OAuth Middleware
  ↓
tRPC Middleware
  ├── Context Builder
  ├── Auth Check
  └── Error Handler
```

---

## Database Schema

### Tables

#### `users`
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(email),
  INDEX(createdAt)
);
```

#### `urlChecks`
```sql
CREATE TABLE urlChecks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  normalizedUrl VARCHAR(2048) NOT NULL,
  riskScore INT NOT NULL,
  riskLevel ENUM('safe', 'suspicious', 'dangerous') NOT NULL,
  analysis LONGTEXT NOT NULL,
  indicators JSON NOT NULL,
  confidence INT NOT NULL,
  screenshotUrl VARCHAR(2048),
  certificateInfo JSON,
  virusTotalData JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX(userId),
  INDEX(createdAt),
  INDEX(riskLevel),
  UNIQUE KEY unique_check (userId, normalizedUrl, DATE(createdAt))
);
```

#### `batchJobs`
```sql
CREATE TABLE batchJobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  urls JSON NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  results JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX(userId),
  INDEX(status)
);
```

#### `screenshots`
```sql
CREATE TABLE screenshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  checkId INT NOT NULL,
  s3Key VARCHAR(2048) NOT NULL,
  s3Url VARCHAR(2048) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(checkId) REFERENCES urlChecks(id) ON DELETE CASCADE,
  INDEX(checkId)
);
```

### Relationships

```
users (1) ──────→ (∞) urlChecks
users (1) ──────→ (∞) batchJobs
urlChecks (1) ──→ (∞) screenshots
```

---

## API Design

### tRPC Procedure Types

#### Public Procedures
- `auth.me()` – Get current user (or null)
- Health checks

#### Protected Procedures
- `urlChecker.checkURL()` – Requires authentication
- `urlChecker.getHistory()` – Requires authentication
- `urlChecker.deleteCheck()` – Requires authentication
- `auth.logout()` – Requires authentication

#### Admin Procedures
- `system.notifyOwner()` – Owner only

### Request/Response Pattern

**Request:**
```ts
{
  url: "https://example.com"
}
```

**Response (Success):**
```ts
{
  id: 1,
  url: "https://example.com",
  normalizedUrl: "https://example.com/",
  riskScore: 25,
  riskLevel: "safe",
  analysis: "URL appears to be legitimate...",
  indicators: ["valid_ssl", "known_domain"],
  confidence: 95,
  createdAt: "2026-04-06T12:00:00Z"
}
```

**Response (Error):**
```ts
{
  code: "INVALID_URL",
  message: "Invalid URL format",
  status: 400
}
```

### Error Handling

| Error Code | Status | Cause |
|-----------|--------|-------|
| `INVALID_URL` | 400 | URL format invalid |
| `NETWORK_ERROR` | 503 | Cannot reach URL |
| `AI_TIMEOUT` | 504 | AI analysis timeout |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

---

## Authentication Flow

### OAuth Flow (Manus)

```
1. User clicks "Sign In"
   ↓
2. Frontend redirects to Manus OAuth portal
   ↓
3. User authenticates with Manus
   ↓
4. Manus redirects to /api/oauth/callback?code=...&state=...
   ↓
5. Backend exchanges code for token
   ↓
6. Backend creates session cookie
   ↓
7. Frontend redirected to dashboard
   ↓
8. Session cookie sent with every request
```

### Session Management

**Cookie Structure:**
```
Name: session
Value: JWT (signed with JWT_SECRET)
HttpOnly: true
Secure: true (HTTPS only)
SameSite: Strict
Max-Age: 7 days
```

**JWT Payload:**
```ts
{
  userId: "user-123",
  email: "user@example.com",
  name: "User Name",
  role: "user",
  iat: 1234567890,
  exp: 1234654290
}
```

### Context Building

```ts
// server/_core/context.ts
export async function createContext(opts: CreateNextContextOptions) {
  // Extract session from cookie
  const session = opts.req.cookies.session;
  
  // Verify JWT
  const user = session ? verifyJWT(session) : null;
  
  return {
    user,
    req: opts.req,
    res: opts.res
  };
}
```

---

## Data Flow

### URL Check Flow

```
1. User enters URL in input field
   ↓
2. User clicks CHECK button
   ↓
3. handleCheckURL() validates input
   ↓
4. checkURLMutation.mutateAsync() sends to server
   ↓
5. Server receives tRPC call
   ├─ Validates URL format
   ├─ Normalizes URL
   ├─ Checks database cache
   │  └─ If found: return cached result
   │  └─ If not found: continue
   ├─ Calls DeepSeek AI for analysis
   ├─ Extracts SSL certificate info
   ├─ Checks VirusTotal reputation
   ├─ Captures screenshot (if dangerous)
   ├─ Stores in database
   └─ Returns result
   ↓
6. Client receives result
   ↓
7. ResultModal displays result
   ├─ Shows risk level with color coding
   ├─ Displays analysis text
   ├─ Lists threat indicators
   └─ Offers export options
   ↓
8. Auto-close after 5 seconds (or manual close)
```

### History Fetch Flow

```
1. User clicks "Show History" button
   ↓
2. setShowHistory(true)
   ↓
3. useEffect triggers historyQuery
   ├─ Checks if user is authenticated
   └─ Calls trpc.urlChecker.getHistory.useQuery()
   ↓
4. Server receives request
   ├─ Verifies user session
   ├─ Queries database:
   │  SELECT * FROM urlChecks 
   │  WHERE userId = ? 
   │  ORDER BY createdAt DESC 
   │  LIMIT 10
   └─ Returns results
   ↓
5. Client displays history list
   ├─ Maps over results
   └─ Renders history items with risk colors
```

---

## Performance Optimization

### Frontend Optimizations

#### Code Splitting
```tsx
const ResultModal = React.lazy(() => import('./ResultModal'));
const DashboardLayout = React.lazy(() => import('./DashboardLayout'));
```

#### Memoization
```tsx
const memoizedValue = useMemo(() => expensiveCalculation(), [dep]);
const memoizedCallback = useCallback(() => handleClick(), []);
```

#### Image Optimization
- All images uploaded to S3 CDN
- No local image storage
- Lazy loading on scroll

#### CSS Optimization
- Tailwind CSS purging unused styles
- CSS variables for theming
- GPU-accelerated animations (transform, opacity)

#### Bundle Size
- Tree-shaking unused code
- Minification in production
- Gzip compression

### Backend Optimizations

#### Database Caching
```ts
// Check cache before AI call
const cached = await db.getCheckByNormalizedUrl(normalizedUrl);
if (cached) return cached;

// If not cached, analyze and store
const result = await analyzeURL(url);
await db.createCheck(userId, url, result);
return result;
```

#### Query Optimization
- Indexed columns: `userId`, `createdAt`, `riskLevel`
- Unique constraint on `(userId, normalizedUrl, DATE(createdAt))`
- Pagination with LIMIT

#### Job Queue (BullMQ)
```ts
// Async screenshot capture
const screenshotQueue = new Queue('screenshots');
screenshotQueue.add({ url, checkId }, { delay: 1000 });
```

#### Connection Pooling
- MySQL connection pool (10-20 connections)
- Reuse connections across requests

### Network Optimization

#### API Response Compression
- Gzip compression on responses
- JSON minification

#### Request Batching
- Multiple checks in single batch job
- Batch export functionality

#### Caching Headers
```
Cache-Control: public, max-age=3600
ETag: "abc123"
```

---

## Security Architecture

### Input Validation

#### URL Validation
```ts
// Zod schema
const urlSchema = z.string()
  .url("Invalid URL format")
  .max(2048, "URL too long")
  .refine(url => !url.includes('javascript:'), "Invalid protocol");

const validated = urlSchema.parse(input);
```

#### SQL Injection Prevention
- Parameterized queries via Drizzle ORM
- No raw SQL construction

#### XSS Prevention
- React escapes JSX by default
- Content Security Policy headers
- DOMPurify for user-generated content

### Authentication Security

#### Password-less Auth
- OAuth via Manus (no password storage)
- Session tokens signed with JWT_SECRET
- HttpOnly cookies prevent JavaScript access

#### CORS Protection
```ts
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
```

#### Rate Limiting
```ts
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/trpc', limiter);
```

### Data Protection

#### Encryption at Rest
- Database passwords encrypted
- S3 bucket encryption enabled
- API keys stored in environment variables

#### Encryption in Transit
- HTTPS/TLS for all connections
- Secure WebSocket (WSS)

#### Data Minimization
- No sensitive data in logs
- User data deleted on account deletion
- Compliance with GDPR/CCPA

### API Security

#### tRPC Type Safety
- Automatic input validation
- Type-safe responses
- No manual serialization

#### Protected Procedures
```ts
export const protectedProcedure = baseProcedure
  .use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({ ctx });
  });
```

---

## Deployment Architecture

### Development Environment
```
Local Machine
├── Node.js 22.13.0
├── MySQL 8.0 (local)
├── Vite dev server (port 5173)
├── Express dev server (port 3000)
└── Hot Module Replacement (HMR)
```

### Production Environment (Manus)
```
Manus Platform
├── Frontend (React SPA)
│  ├── Vite build (optimized bundle)
│  ├── CDN distribution
│  └── Static asset caching
├── Backend (Node.js)
│  ├── Express server
│  ├── tRPC router
│  ├── Environment variables
│  └── Health checks
├── Database (MySQL/TiDB)
│  ├── Connection pooling
│  ├── Automated backups
│  └── Replication
└── External Services
   ├── DeepSeek AI API
   ├── AWS S3
   ├── VirusTotal API
   └── Manus OAuth
```

### CI/CD Pipeline

```
Git Push
  ↓
GitHub Actions
  ├─ Run tests (vitest)
  ├─ Lint code (ESLint)
  ├─ Type check (TypeScript)
  └─ Build (Vite)
  ↓
Deploy to Manus
  ├─ Build Docker image
  ├─ Push to registry
  ├─ Deploy to production
  └─ Health check
```

---

## Scalability Considerations

### Horizontal Scaling

#### Stateless Backend
- No session storage on server
- Sessions stored in JWT cookies
- Allows multiple server instances

#### Load Balancing
```
Load Balancer
├── Server 1
├── Server 2
├── Server 3
└── Server N
```

#### Database Replication
```
Primary DB
├── Replica 1 (read-only)
├── Replica 2 (read-only)
└── Replica N (read-only)
```

### Vertical Scaling

#### Caching Layer
- Redis for session cache
- Query result caching
- API response caching

#### CDN for Static Assets
- S3 CloudFront distribution
- Screenshot caching
- Export file caching

### Database Optimization

#### Sharding Strategy
```
User ID Hash
├── Shard 1 (users 0-999999)
├── Shard 2 (users 1000000-1999999)
└── Shard N
```

#### Archival Strategy
- Move old checks to archive table
- Compress historical data
- Automated cleanup

### API Rate Limiting

```ts
const limits = {
  checkURL: 100, // per hour
  getHistory: 1000, // per hour
  exportHistory: 10 // per hour
};
```

---

## Monitoring & Observability

### Logging
```ts
// Server-side logging
logger.info('URL check started', { url, userId });
logger.error('AI timeout', { url, error });
```

### Metrics
- Request latency (p50, p95, p99)
- Error rate
- Database query time
- AI API response time
- S3 upload/download speed

### Health Checks
```
GET /api/health
├── Database connection
├── External API connectivity
└── S3 access
```

### Alerting
- High error rate (>5%)
- Database connection pool exhaustion
- API timeout (>30s)
- Disk space low (<10%)

---

## Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 19 + TypeScript | UI rendering |
| **Styling** | Tailwind CSS 4 | Responsive design |
| **Backend** | Express + tRPC | API server |
| **Database** | MySQL/TiDB | Data persistence |
| **Auth** | Manus OAuth | User authentication |
| **AI** | DeepSeek API | URL analysis |
| **Storage** | AWS S3 | File storage |
| **Deployment** | Manus Platform | Production hosting |

---

**Last Updated:** 2026-04-06  
**Maintained By:** URLGuard AI Development Team  
**For External Architects:** Use this document to understand system design, make infrastructure decisions, and plan scaling strategies.
