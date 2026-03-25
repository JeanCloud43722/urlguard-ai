# DeepSeek API Integration in URLGuard AI

Comprehensive documentation of where and how DeepSeek API is integrated throughout the application.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    URLGuard AI Application                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (React)                                           │
│    ↓ tRPC Call                                             │
│  server/routers/urlChecker.ts                              │
│    ↓ Calls                                                 │
│  server/analyzers/deepseekEnhanced.ts                      │
│    ├─ analyzeURL() - Basic analysis                        │
│    └─ analyzeWithFullContext() - Full context analysis     │
│       ↓ HTTP Request                                       │
│  DeepSeek API (deepseek-chat model)                        │
│    ├─ Endpoint: https://api.deepseek.com/v1/chat/completions
│    ├─ Model: deepseek-chat                                │
│    └─ Auth: Bearer {DEEPSEEK_API_KEY}                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. DeepSeek API Endpoints Used

### Primary Endpoint
- **URL:** `https://api.deepseek.com/v1/chat/completions`
- **Method:** POST
- **Authentication:** Bearer Token (DEEPSEEK_API_KEY)
- **Model:** `deepseek-chat`

### Configuration
Located in: `server/_core/env.ts`

```typescript
export const ENV = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
  // ... other env vars
};
```

---

## 3. Core Implementation Files

### 3.1 Enhanced DeepSeek Client
**File:** `server/analyzers/deepseekEnhanced.ts`

**Purpose:** Wrapper around DeepSeek API with retry logic, timeout handling, and metrics

**Key Classes & Methods:**

```typescript
class EnhancedDeepSeekClient {
  // Configuration
  private retryConfig: DeepSeekRetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  };

  private timeoutConfig: DeepSeekTimeoutConfig = {
    shortTimeout: 10000,    // 10s for quick checks
    longTimeout: 30000,     // 30s for full analysis
  };

  // Main Methods
  async analyzeURL(url: string, indicators: string[]): Promise<DeepSeekAnalysisResult>
  async analyzeWithFullContext(contextData: ContextData): Promise<DeepSeekAnalysisResult>

  // Internal Methods
  private async callDeepSeekAPI(messages: Message[]): Promise<string>
  private async retryWithBackoff(operation: string, fn: () => Promise<any>): Promise<any>
}
```

**Features:**
- ✅ Exponential backoff retry (3 attempts, 1s → 10s)
- ✅ Timeout management (10s short, 30s long)
- ✅ Rate limit handling with jitter
- ✅ Metrics tracking (tokens, duration)
- ✅ Error logging and recovery

---

### 3.2 DeepSeek Prompt Engineering
**File:** `server/analyzers/deepseekPrompt.ts`

**Purpose:** Define system prompt and user prompt templates for consistent analysis

**Key Components:**

```typescript
// System Prompt (defines AI behavior)
export const SYSTEM_PROMPT = `
You are a cybersecurity expert specializing in phishing detection...
[CRITICAL SENSITIVITY RULES]
- Newly registered domains (< 30 days) = +25-30 points
- Recent SSL certificates (< 7 days) = +20-25 points
- Multiple indicators = fraud_score >= 80
...
`;

// User Prompt Builder
export function buildUserPrompt(contextData: ContextData): string {
  // Formats: URL, SSL cert info, heuristic indicators, affiliate info
  // Returns structured prompt for DeepSeek
}

// Response Validator
export function validateResponse(response: any): DeepSeekAnalysisResult {
  // Validates JSON schema
  // Ensures riskScore (0-100), riskLevel, confidence, etc.
}
```

**Prompt Structure:**

```
SYSTEM:
You are a cybersecurity expert...
[Rules for sensitivity, scoring, etc.]

USER:
URL Analysis Request:
- URL: https://gatevacessoferiao.shop
- Domain Age: 5 days (NEW)
- SSL Certificate: Issued 2 days ago (RECENT)
- Heuristic Indicators: Suspicious TLD (.shop), IP-like pattern
- Affiliate Parameters: None detected

Analyze and return JSON with:
{
  "fraud_score": 0-100,
  "riskLevel": "safe|suspicious|dangerous",
  "confidence": 0-1,
  "analysis": "explanation",
  "phishingIndicators": ["indicator1", "indicator2"]
}
```

---

## 4. Integration Points

### 4.1 URL Checker Router
**File:** `server/routers/urlChecker.ts`

**Flow:**

```typescript
// tRPC Procedure: checkURL
export const checkURL = protectedProcedure
  .input(z.object({ url: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // 1. Validate and normalize URL
    const validation = validateAndNormalizeUrl(input.url);

    // 2. Check cache (Redis)
    const cached = await redisCache.get(`analysis:${urlHash}:v1`);
    if (cached) return cached; // Return cached result

    // 3. Collect context data
    const certificateData = await fetchCertificate(validation.hostname);
    const heuristicIndicators = checkPhishingIndicators(validation.normalizedUrl);
    const affiliateInfo = extractAffiliateParameters(validation.normalizedUrl);

    // 4. Call DeepSeek with full context
    const deepseekClient = getDeepSeekClient();
    const deepseekAnalysis = await deepseekClient.analyzeWithFullContext({
      url: validation.normalizedUrl,
      certificateData,
      heuristicIndicators,
      affiliateInfo,
    });

    // 5. Store result in database
    const urlCheck = await createURLCheck({
      userId: ctx.user.id,
      url: validation.normalizedUrl,
      riskScore: deepseekAnalysis.riskScore,
      riskLevel: deepseekAnalysis.riskLevel,
      deepseekAnalysis: JSON.stringify(deepseekAnalysis),
    });

    // 6. If dangerous, enqueue screenshot job
    if (deepseekAnalysis.riskLevel === 'dangerous') {
      await screenshotProcessor.enqueueScreenshot({
        urlCheckId: urlCheck.id,
        userId: ctx.user.id,
        url: validation.normalizedUrl,
        riskLevel: deepseekAnalysis.riskLevel,
      });

      // 7. Notify owner
      await notifyOwner({
        title: 'Dangerous URL Detected',
        content: `Risk Score: ${deepseekAnalysis.riskScore}/100...`,
      });
    }

    // 8. Cache result (24h TTL)
    await redisCache.set(`analysis:${urlHash}:v1`, result, 86400);

    return result;
  });
```

---

### 4.2 Batch Processing Integration
**File:** `server/services/batchProcessor.ts`

**How it uses DeepSeek:**

```typescript
// BullMQ Worker processes each URL in batch
async processURLBatch(job: Job<BatchJobData>) {
  for (const url of job.data.urls) {
    // For each URL, calls the same DeepSeek analysis
    const deepseekClient = getDeepSeekClient();
    const result = await deepseekClient.analyzeWithFullContext({...});
    
    // Update progress
    await job.progress((processed / total) * 100);
  }
}
```

---

## 5. Request/Response Flow

### Request to DeepSeek

```typescript
// HTTP Request
POST https://api.deepseek.com/v1/chat/completions
Authorization: Bearer sk-xxxxx...
Content-Type: application/json

{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "[SYSTEM_PROMPT with sensitivity rules]"
    },
    {
      "role": "user",
      "content": "[Formatted context: URL, cert, indicators, affiliate]"
    }
  ],
  "response_format": {
    "type": "json_object",
    "json_schema": {
      "name": "phishing_analysis",
      "schema": {
        "type": "object",
        "properties": {
          "fraud_score": { "type": "integer", "minimum": 0, "maximum": 100 },
          "riskLevel": { "enum": ["safe", "suspicious", "dangerous"] },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "analysis": { "type": "string" },
          "phishingIndicators": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["fraud_score", "riskLevel", "confidence", "analysis", "phishingIndicators"]
      }
    }
  },
  "temperature": 0.3,
  "max_tokens": 500
}
```

### Response from DeepSeek

```json
{
  "id": "chatcmpl-xxxxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"fraud_score\": 85, \"riskLevel\": \"dangerous\", \"confidence\": 0.92, \"analysis\": \"Newly registered domain with recent SSL certificate and suspicious TLD pattern. Strong indicators of phishing attempt.\", \"phishingIndicators\": [\"Newly registered domain (5 days)\", \"Recent SSL certificate (2 days)\", \"Suspicious TLD (.shop)\", \"Domain pattern mimics legitimate service\"]}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 245,
    "completion_tokens": 89,
    "total_tokens": 334
  }
}
```

---

## 6. Error Handling & Retry Logic

### Retry Strategy

```typescript
// Exponential backoff with jitter
private async retryWithBackoff(operation: string, fn: () => Promise<any>): Promise<any> {
  for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === this.retryConfig.maxRetries) throw error;

      // Calculate delay: 1s, 2s, 4s, 8s (with jitter)
      const baseDelay = Math.min(
        this.retryConfig.initialDelayMs * Math.pow(2, attempt),
        this.retryConfig.maxDelayMs
      );
      const jitter = Math.random() * 0.1 * baseDelay;
      const delay = baseDelay + jitter;

      console.log(`[DeepSeek] ${operation} failed (attempt ${attempt + 1}), retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Error Types Handled

| Error | Cause | Action |
|-------|-------|--------|
| 401 Unauthorized | Invalid API key | Log error, fail fast |
| 429 Too Many Requests | Rate limited | Retry with exponential backoff |
| 500 Server Error | DeepSeek down | Retry with exponential backoff |
| Timeout | Network slow | Retry with longer timeout |
| Invalid Response | Malformed JSON | Log error, fail fast |

---

## 7. Caching Strategy

### Cache Keys

```typescript
// Exact URL analysis (24h TTL)
analysis:{urlHash}:v1

// Certificate data (1h TTL)
cert:{hostname}

// Heuristic indicators (5min TTL)
indicators:{urlHash}

// Rate limit counters (1min TTL)
ratelimit:{userId}:{endpoint}
```

### Cache Hit Rates

- **Expected:** 70% cache hit rate
- **Benefit:** Reduces DeepSeek API calls by 70%
- **Cost Savings:** ~$0.07 per 1M requests

---

## 8. Cost Optimization

### Token Usage Tracking

```typescript
// Metrics collected
- Tokens per request (prompt + completion)
- Average: ~300 tokens per analysis
- Cost: $0.14 per 1M input tokens, $0.28 per 1M output tokens

// Example costs
- 1,000 analyses: ~$0.10
- 10,000 analyses: ~$1.00
- 100,000 analyses: ~$10.00
```

### Optimization Techniques

1. **Caching:** 70% reduction via Redis
2. **Prompt Compression:** Only send relevant cert fields
3. **Per-User Daily Limit:** 10,000 tokens/day
4. **Batch Processing:** Process 50 URLs in one job
5. **Early Exit:** Skip DeepSeek for obvious safe/dangerous URLs

---

## 9. Monitoring & Metrics

### Prometheus Metrics Exposed

```
# DeepSeek API Calls
deepseek_api_calls_total{status="success|failure|timeout"}
deepseek_api_latency_seconds{percentile="p50|p95|p99"}

# Token Usage
deepseek_tokens_used_total{type="prompt|completion"}
deepseek_tokens_per_request_avg

# Cache Performance
cache_hit_rate{type="analysis|certificate|indicators"}
cache_evictions_total
```

### Grafana Dashboard Queries

```promql
# Request rate
rate(deepseek_api_calls_total[5m])

# P95 latency
histogram_quantile(0.95, deepseek_api_latency_seconds)

# Cache hit rate
cache_hits_total / (cache_hits_total + cache_misses_total)
```

---

## 10. Configuration & Environment Variables

### Required Environment Variables

```bash
# DeepSeek API
DEEPSEEK_API_KEY=sk-xxxxx...
DEEPSEEK_API_URL=https://api.deepseek.com/v1

# Optional: Override defaults
DEEPSEEK_TIMEOUT_SHORT=10000      # 10 seconds
DEEPSEEK_TIMEOUT_LONG=30000       # 30 seconds
DEEPSEEK_MAX_RETRIES=3
DEEPSEEK_DAILY_TOKEN_LIMIT=10000
```

### Configuration File

```typescript
// server/_core/env.ts
export const ENV = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
  deepseekTimeoutShort: parseInt(process.env.DEEPSEEK_TIMEOUT_SHORT || '10000'),
  deepseekTimeoutLong: parseInt(process.env.DEEPSEEK_TIMEOUT_LONG || '30000'),
  deepseekMaxRetries: parseInt(process.env.DEEPSEEK_MAX_RETRIES || '3'),
  deepseekDailyTokenLimit: parseInt(process.env.DEEPSEEK_DAILY_TOKEN_LIMIT || '10000'),
};
```

---

## 11. Testing & Validation

### Unit Tests

```bash
# Test DeepSeek client
pnpm test server/analyzers/deepseekEnhanced.test.ts

# Test prompt engineering
pnpm test server/analyzers/deepseekPrompt.test.ts

# Test full integration
pnpm test server/routers/urlChecker.test.ts
```

### Manual Testing

```bash
# Test with known phishing URL
curl -X POST http://localhost:3000/api/trpc/urlChecker.checkURL \
  -H "Content-Type: application/json" \
  -d '{"url": "https://gatevacessoferiao.shop"}'

# Expected response (riskScore >= 80, riskLevel = "dangerous")
```

---

## 12. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid API key | Check DEEPSEEK_API_KEY env var |
| 429 Too Many Requests | Rate limited | Increase cache TTL, reduce batch size |
| Timeout errors | Network slow | Increase timeout values, check network |
| Invalid JSON response | Malformed response | Check prompt format, validate schema |
| High latency (>5s) | DeepSeek slow | Check queue length, reduce concurrency |

### Debug Logging

```bash
# Enable debug logs
DEBUG=urlguard:* pnpm dev

# Check DeepSeek metrics
curl http://localhost:3000/metrics | grep deepseek
```

---

## 13. Future Enhancements

1. **Multi-Model Support:** Add OpenAI, Ollama fallback
2. **Streaming Responses:** Stream analysis results to frontend
3. **Fine-tuning:** Train custom model on URLGuard data
4. **Caching Layer:** Add Redis Cluster for distributed caching
5. **Rate Limiting:** Implement token bucket algorithm per user

---

## Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| DeepSeek Client | `server/analyzers/deepseekEnhanced.ts` | API wrapper with retry/timeout |
| Prompts | `server/analyzers/deepseekPrompt.ts` | System & user prompts |
| Integration | `server/routers/urlChecker.ts` | Main entry point |
| Batch Processing | `server/services/batchProcessor.ts` | Async batch analysis |
| Caching | `server/services/redis.ts` | Result caching |
| Metrics | `server/services/metrics.ts` | Prometheus metrics |

**Total API Calls:** ~1 per URL analysis (70% cache hit rate)
**Average Latency:** <1s (cached), 2-5s (uncached)
**Cost:** ~$0.0001 per analysis (with caching)
