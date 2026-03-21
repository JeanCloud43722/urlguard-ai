# Screenshot Feature Finalization Guide

This guide explains how to apply the three critical improvements to make the screenshot feature production-ready:

1. **Idempotency Check** - Prevent duplicate screenshots
2. **Prometheus Metrics** - Production monitoring
3. **Comprehensive Tests** - Automated validation

---

## Part 1: Idempotency Implementation

### Step 1: Update screenshotJob.ts

In `server/queues/screenshotJob.ts`, modify the `processScreenshotJob` method:

**Location:** Line 101-120 (after the riskLevel check)

**Add this code after line 120:**

```typescript
// IDEMPOTENCY CHECK: Skip if screenshot already exists
const db = await getDb();
if (db) {
  const existing = await db
    .select()
    .from(urlChecks)
    .where(eq(urlChecks.id, urlCheckId))
    .limit(1);

  if (existing[0]?.screenshotUrl) {
    console.log(
      `[ScreenshotJob] Screenshot already exists for URL check ${urlCheckId}, skipping capture (idempotent)`
    );
    return {
      urlCheckId,
      screenshotUrl: existing[0].screenshotUrl,
      screenshotKey: existing[0].screenshotKey || '',
      size: 0,
      capturedAt: timestamp,
      success: true, // Mark as success (idempotent)
    };
  }
}
```

**Imports needed:**
```typescript
import { getDb } from '../db';
import { urlChecks } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
```

### Why This Works

- **Before S3 upload:** Query database for existing screenshot
- **If exists:** Return existing URL (idempotent)
- **If not:** Proceed with capture and upload
- **Retry safety:** If upload fails after capture, retry will find existing screenshot and return it

---

## Part 2: Prometheus Metrics Implementation

### Step 1: Create Metrics Service

Create `server/metrics/screenshotMetrics.ts` (already provided in this repo).

### Step 2: Update screenshotJob.ts with Metrics

In `server/queues/screenshotJob.ts`, add metrics tracking:

**At the top of processScreenshotJob method (line 101):**

```typescript
const startTime = Date.now();
const metrics = getScreenshotMetrics();
```

**After successful completion (line 170):**

```typescript
const durationSeconds = (Date.now() - startTime) / 1000;
metrics.recordSuccess(durationSeconds);
```

**In the catch block (line 180):**

```typescript
const durationSeconds = (Date.now() - startTime) / 1000;
metrics.recordFailure(durationSeconds);
```

**For skipped jobs (line 111):**

```typescript
metrics.recordSkipped();
```

**Imports needed:**
```typescript
import { getScreenshotMetrics } from '../metrics/screenshotMetrics';
```

### Step 3: Update Queue Length Metric

In `ScreenshotJobProcessor.initialize()` method, add periodic queue length update:

```typescript
// Update queue metrics every 10 seconds
setInterval(async () => {
  try {
    const stats = await this.queue.getJobCounts();
    const metrics = getScreenshotMetrics();
    const totalPending = (stats.waiting || 0) + (stats.delayed || 0);
    metrics.setQueueLength(totalPending);
  } catch (error) {
    console.error('[ScreenshotJob] Error updating queue metrics:', error);
  }
}, 10000);
```

### Step 4: Verify Metrics Endpoint

The `/metrics` endpoint should already exist in your Express app. Verify it's using prom-client:

```typescript
// In server/_core/index.ts or similar
import { register } from 'prom-client';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Verify Metrics

After deployment, check metrics:

```bash
curl http://localhost:3000/metrics | grep urlguard_screenshot
```

Expected output:
```
# HELP urlguard_screenshot_jobs_total Total screenshot jobs processed
# TYPE urlguard_screenshot_jobs_total counter
urlguard_screenshot_jobs_total{status="success"} 5
urlguard_screenshot_jobs_total{status="failure"} 1
urlguard_screenshot_jobs_total{status="skipped"} 2

# HELP urlguard_screenshot_duration_seconds Screenshot job duration in seconds
# TYPE urlguard_screenshot_duration_seconds histogram
urlguard_screenshot_duration_seconds_bucket{status="success",le="0.5"} 0
urlguard_screenshot_duration_seconds_bucket{status="success",le="1"} 2
urlguard_screenshot_duration_seconds_bucket{status="success",le="30"} 5

# HELP urlguard_screenshot_queue_length Number of pending screenshot jobs in queue
# TYPE urlguard_screenshot_queue_length gauge
urlguard_screenshot_queue_length 3
```

---

## Part 3: Testing Implementation

### Step 1: Install Test Dependencies

```bash
pnpm add -D vitest @vitest/ui
```

### Step 2: Add Test File

Create `server/__tests__/screenshot.test.ts` (already provided in this repo).

### Step 3: Configure Vitest

Update `vitest.config.ts` (or create it):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
```

### Step 4: Run Tests

```bash
# Run all tests
pnpm test

# Run only screenshot tests
pnpm test screenshot

# Run with UI
pnpm test -- --ui

# Run with coverage
pnpm test -- --coverage
```

### Test Coverage

The test suite covers:

- ✅ Playwright browser lifecycle (singleton pattern)
- ✅ Screenshot capture (success, timeout, unreachable URLs)
- ✅ S3 upload (key format, retry logic, credentials)
- ✅ Metrics recording (success, failure, skipped, queue length)
- ✅ Job enqueuing and status tracking
- ✅ Queue statistics
- ✅ Idempotency (duplicate prevention)
- ✅ Error handling (invalid URLs, S3 failures, timeouts)

---

## Implementation Checklist

### Phase 1: Idempotency (15 minutes)
- [ ] Add idempotency check to `processScreenshotJob`
- [ ] Add required imports (getDb, urlChecks, eq)
- [ ] Test: Enqueue same URL twice, verify only one screenshot created
- [ ] Verify: Both jobs return success=true

### Phase 2: Metrics (30 minutes)
- [ ] Create `server/metrics/screenshotMetrics.ts`
- [ ] Add metrics initialization to `processScreenshotJob`
- [ ] Add queue length update in `initialize()`
- [ ] Add prom-client import
- [ ] Test: `curl http://localhost:3000/metrics | grep urlguard_screenshot`
- [ ] Verify: All 3 metrics present (counter, histogram, gauge)

### Phase 3: Testing (1-2 hours)
- [ ] Create `server/__tests__/screenshot.test.ts`
- [ ] Configure vitest
- [ ] Run tests: `pnpm test screenshot`
- [ ] Verify: All tests pass
- [ ] Add to CI/CD pipeline

### Final Verification
- [ ] All 3 critical improvements implemented
- [ ] Tests passing (100% of screenshot tests)
- [ ] Metrics exposed via `/metrics` endpoint
- [ ] Idempotency verified manually
- [ ] No console errors or warnings
- [ ] Code review completed

---

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Metrics configured and tested
- [ ] Idempotency verified
- [ ] Docker image built with all dependencies
- [ ] Kubernetes manifests updated
- [ ] Monitoring alerts configured (latency >5s, failure rate >5%)
- [ ] Rollback plan documented
- [ ] Load testing completed
- [ ] Disaster recovery tested

---

## Troubleshooting

### Tests Failing

**Issue:** Tests timeout or fail to connect to services

**Solution:**
1. Ensure Redis is running: `docker ps | grep redis`
2. Ensure database is accessible
3. Check AWS credentials for S3 tests
4. Increase test timeout: `vi.setConfig({ testTimeout: 30000 })`

### Metrics Not Appearing

**Issue:** Metrics endpoint returns no screenshot metrics

**Solution:**
1. Verify metrics service initialized: `grep getScreenshotMetrics server/queues/screenshotJob.ts`
2. Check prom-client installed: `npm list prom-client`
3. Verify `/metrics` endpoint exists
4. Trigger a screenshot job and check again

### Idempotency Not Working

**Issue:** Duplicate screenshots still being created

**Solution:**
1. Verify database check is before S3 upload
2. Check `screenshotUrl` column exists in `url_checks` table
3. Verify database connection in job processor
4. Check logs for "Screenshot already exists" message

---

## Performance Optimization

After implementing these improvements, consider:

1. **Caching**: Cache screenshot URLs in Redis (1-hour TTL)
2. **Batch Processing**: Process multiple jobs concurrently (increase concurrency from 2 to 5)
3. **Compression**: Compress screenshots before S3 upload (PNG → WebP)
4. **Cleanup**: Implement automatic screenshot cleanup after 90 days

---

## Monitoring & Alerting

Set up Prometheus alerts:

```yaml
groups:
  - name: urlguard_screenshot
    rules:
      - alert: ScreenshotJobFailureRate
        expr: rate(urlguard_screenshot_jobs_total{status="failure"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "Screenshot job failure rate > 10%"

      - alert: ScreenshotQueueBacklog
        expr: urlguard_screenshot_queue_length > 50
        for: 10m
        annotations:
          summary: "Screenshot queue has 50+ pending jobs"

      - alert: ScreenshotJobLatency
        expr: histogram_quantile(0.95, urlguard_screenshot_duration_seconds) > 5
        for: 10m
        annotations:
          summary: "Screenshot job P95 latency > 5 seconds"
```

---

## Summary

| Component | Status | Effort | Impact |
|-----------|--------|--------|--------|
| Idempotency | ⚠️ TODO | 15 min | CRITICAL |
| Metrics | ⚠️ TODO | 30 min | HIGH |
| Testing | ⚠️ TODO | 1-2 hrs | HIGH |
| **Total** | | **2-2.5 hrs** | **Production-Ready** |

---

**Next Steps:**
1. Apply idempotency check (15 min)
2. Add metrics service (30 min)
3. Write and run tests (1-2 hours)
4. Deploy to staging and verify
5. Deploy to production with monitoring

**Estimated Time to Production:** 2.5-3 hours
