# URLGuard AI - Forensic Screenshot Capture Feature

## Overview

The forensic screenshot feature automatically captures screenshots of URLs classified as **dangerous** and stores them in AWS S3 for forensic analysis. This happens asynchronously via BullMQ to avoid blocking the main URL analysis flow.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    URL Analysis (tRPC)                          │
│                                                                   │
│  1. Validate & normalize URL                                    │
│  2. Fetch SSL certificate                                       │
│  3. Check heuristic indicators                                  │
│  4. Call DeepSeek for AI analysis                               │
│  5. Save result to database                                     │
│  6. IF riskLevel === 'dangerous':                               │
│     └─> Enqueue screenshot job (async, non-blocking)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BullMQ Screenshot Job Queue                    │
│                                                                   │
│  Job: {urlCheckId, userId, url, riskLevel, timestamp}          │
│  Retries: 3 (exponential backoff: 2s, 4s, 8s)                 │
│  Concurrency: 2 parallel jobs                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Screenshot Job Worker Process                      │
│                                                                   │
│  1. Check URL reachability (10s timeout)                        │
│  2. Launch Playwright browser (headless)                        │
│  3. Navigate to URL (30s timeout)                               │
│  4. Capture full-page screenshot (PNG)                          │
│  5. Close page (keep browser alive)                             │
│  6. Upload to S3 with retry (3 attempts)                        │
│  7. Update database with screenshot URL                         │
│  8. Create screenshot record                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS S3 Storage                             │
│                                                                   │
│  Key: screenshots/{userId}/{timestamp}-{urlHash}.png           │
│  Metadata: user-id, url-hash, capture-time                     │
│  Lifecycle: Auto-delete after 90 days                          │
│  Encryption: AES256 (server-side)                              │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Playwright Service (`server/services/playwright.ts`)

**Purpose:** Manages browser lifecycle and screenshot capture

**Key Features:**
- Lazy browser initialization (once per worker)
- Headless mode with optimized settings
- Viewport: 1920x1080
- Timeout: 30 seconds per URL
- Full-page screenshots
- Graceful shutdown

**Usage:**
```typescript
const service = getPlaywrightService();
await service.initialize();

const result = await service.captureScreenshot({
  url: 'https://example.com',
  timeout: 30000,
  fullPage: true,
  waitForNavigation: true,
});

console.log(`Screenshot: ${result.buffer.length} bytes`);
```

### 2. S3 Screenshot Service (`server/services/s3Screenshot.ts`)

**Purpose:** Handles S3 uploads with retry logic

**Key Features:**
- Automatic retry (3 attempts, exponential backoff)
- Server-side encryption (AES256)
- Metadata tagging (user-id, url-hash, capture-time)
- Lifecycle tags (retention=90days)
- Presigned URL generation
- Credential validation

**Usage:**
```typescript
const s3Service = getS3ScreenshotService();

const result = await s3Service.uploadScreenshot(
  buffer,
  userId,
  urlHash,
  3 // retries
);

console.log(`Uploaded to: ${result.url}`);
```

### 3. BullMQ Screenshot Job (`server/queues/screenshotJob.ts`)

**Purpose:** Asynchronous job processing with resilience

**Key Features:**
- Job data: urlCheckId, userId, url, riskLevel, timestamp
- Retry strategy: 3 attempts, exponential backoff (2s, 4s, 8s)
- Concurrency: 2 parallel jobs
- Job persistence in Redis
- Event listeners (completed, failed, error)
- Queue statistics

**Job Data:**
```typescript
interface ScreenshotJobData {
  urlCheckId: number;
  userId: number;
  url: string;
  riskLevel: string;
  timestamp: number;
}
```

**Job Result:**
```typescript
interface ScreenshotJobResult {
  urlCheckId: number;
  screenshotUrl: string;
  screenshotKey: string;
  size: number;
  capturedAt: number;
  success: boolean;
}
```

### 4. tRPC Screenshot Router (`server/routers/screenshots.ts`)

**Procedures:**

- `screenshots.getJobStatus(jobId)` - Get screenshot job status
- `screenshots.getQueueStats()` - Get queue statistics
- `screenshots.getProcessorStatus()` - Get processor health

### 5. URL Checker Integration (`server/routers/urlChecker.ts`)

**Changes:**
- After URL analysis, if `riskLevel === 'dangerous'`:
  - Enqueue screenshot job asynchronously
  - Don't block main analysis if job enqueuing fails
  - Log job ID for tracking

## Database Schema

### url_checks table (updated)
```sql
ALTER TABLE url_checks ADD COLUMN screenshot_url TEXT;
ALTER TABLE url_checks ADD COLUMN screenshot_key VARCHAR(255);
```

### screenshots table (new)
```sql
CREATE TABLE screenshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  urlCheckId INT NOT NULL,
  s3Key VARCHAR(255) NOT NULL,
  s3Url TEXT NOT NULL,
  captureTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt TIMESTAMP,
  FOREIGN KEY (urlCheckId) REFERENCES url_checks(id)
);
```

## Environment Variables

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# S3 Configuration
S3_BUCKET_NAME=urlguard-screenshots

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

## Docker Configuration

### Dockerfile for Worker

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Install Node.js
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Copy project
COPY . .

# Install dependencies
RUN npm install --production

# Start worker
CMD ["node", "dist/queues/screenshotJob.js"]
```

### Docker Compose

```yaml
screenshot-worker:
  build:
    context: .
    dockerfile: Dockerfile.worker
  environment:
    REDIS_HOST: redis
    AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
    AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    S3_BUCKET_NAME: urlguard-screenshots
  depends_on:
    - redis
  volumes:
    - /dev/shm:/dev/shm  # Shared memory for Playwright
```

## Kubernetes Configuration

### Deployment for Screenshot Workers

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: urlguard-screenshot-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: urlguard-screenshot-worker
  template:
    metadata:
      labels:
        app: urlguard-screenshot-worker
    spec:
      containers:
      - name: worker
        image: urlguard-screenshot-worker:latest
        env:
        - name: REDIS_HOST
          value: redis-service
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: access-key
        - name: AWS_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: secret-key
        - name: S3_BUCKET_NAME
          value: urlguard-screenshots
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        volumeMounts:
        - name: shm
          mountPath: /dev/shm
      volumes:
      - name: shm
        emptyDir:
          medium: Memory
          sizeLimit: 1Gi
```

## Error Handling

### Retry Strategy

1. **First attempt fails** → Wait 2 seconds, retry
2. **Second attempt fails** → Wait 4 seconds, retry
3. **Third attempt fails** → Job marked as failed, logged for manual review

### Graceful Degradation

- If screenshot capture fails, the main URL analysis **still completes successfully**
- Failed screenshot jobs are kept in Redis for debugging
- Owner is notified of failed screenshot jobs via metrics

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| URL not reachable | Network issue, URL offline | Retry automatically, max 3 times |
| Screenshot timeout | Slow page load | Increase timeout in Playwright config |
| S3 upload fails | AWS credentials invalid | Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY |
| Browser crash | Out of memory | Reduce concurrency, increase pod memory |

## Performance Optimization

### Browser Lifecycle

**Approach:** One browser instance per worker, multiple pages per browser

**Benefits:**
- Reduced memory overhead
- Faster page creation (no browser launch overhead)
- Connection pooling

**Lifecycle:**
```
Worker Start
    ↓
Initialize Browser (once)
    ↓
Process Job 1: Create Page → Screenshot → Close Page
    ↓
Process Job 2: Create Page → Screenshot → Close Page
    ↓
Worker Shutdown: Close Browser
```

### Concurrency Tuning

**Current:** 2 concurrent jobs per worker

**Recommendations:**
- **High-traffic:** 2-3 jobs (balance memory vs throughput)
- **Low-traffic:** 1 job (reduce memory usage)
- **Memory-constrained:** 1 job (Playwright uses ~200MB per page)

### Caching Strategy

- **URL reachability:** Not cached (URLs may go offline)
- **Screenshots:** Stored in S3 (90-day lifecycle)
- **Job results:** Kept in Redis for 24 hours

## Monitoring

### Metrics

- `urlguard_screenshot_jobs_total` - Total screenshot jobs
- `urlguard_screenshot_success_total` - Successful captures
- `urlguard_screenshot_failures_total` - Failed captures
- `urlguard_screenshot_duration_seconds` - Job duration (P50, P95, P99)
- `urlguard_screenshot_queue_length` - Pending jobs

### Alerts

```yaml
- alert: ScreenshotQueueBacklog
  expr: urlguard_screenshot_queue_length > 50
  for: 10m
  annotations:
    summary: "Screenshot queue has 50+ pending jobs"

- alert: HighScreenshotFailureRate
  expr: rate(urlguard_screenshot_failures_total[5m]) > 0.1
  for: 5m
  annotations:
    summary: "Screenshot failure rate exceeds 10%"
```

## Testing

### Unit Tests

```typescript
// Test screenshot capture
describe('PlaywrightService', () => {
  it('should capture screenshot', async () => {
    const service = getPlaywrightService();
    const result = await service.captureScreenshot({
      url: 'https://example.com',
      timeout: 30000,
    });
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});

// Test S3 upload
describe('S3ScreenshotService', () => {
  it('should upload screenshot with retry', async () => {
    const s3Service = getS3ScreenshotService();
    const result = await s3Service.uploadScreenshot(
      buffer,
      userId,
      urlHash,
      3
    );
    expect(result.url).toContain('s3.amazonaws.com');
  });
});

// Test BullMQ job
describe('ScreenshotJobProcessor', () => {
  it('should enqueue and process job', async () => {
    const processor = await getScreenshotJobProcessor();
    const jobId = await processor.enqueueScreenshot({
      urlCheckId: 1,
      userId: 1,
      url: 'https://example.com',
      riskLevel: 'dangerous',
      timestamp: Date.now(),
    });
    expect(jobId).toBeDefined();
  });
});
```

## Troubleshooting

### Browser crashes

```bash
# Check memory usage
kubectl top pod urlguard-screenshot-worker-xxx

# Increase memory limit
kubectl set resources deployment urlguard-screenshot-worker \
  --limits=memory=2Gi,cpu=2000m
```

### S3 upload fails

```bash
# Verify AWS credentials
aws s3 ls s3://urlguard-screenshots/

# Check S3 bucket policy
aws s3api get-bucket-policy --bucket urlguard-screenshots
```

### Queue backlog

```bash
# Check queue length
redis-cli LLEN bull:screenshot-capture:wait

# Scale up workers
kubectl scale deployment urlguard-screenshot-worker --replicas=5
```

## Future Enhancements

1. **OCR Integration** - Extract text from screenshots for analysis
2. **Visual Diff** - Compare screenshots with known phishing pages
3. **Video Recording** - Record user interaction on dangerous URLs
4. **Thumbnail Generation** - Create small previews for UI display
5. **Archive to Glacier** - Move old screenshots to cold storage after 90 days

## References

- [Playwright Documentation](https://playwright.dev/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
