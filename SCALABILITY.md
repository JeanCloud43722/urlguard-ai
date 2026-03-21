# URLGuard AI - Scalability & Production Deployment Guide

## Architecture Overview

URLGuard AI is designed for horizontal scalability with the following components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer / Ingress                  │
└────────────┬──────────────────────────────────────────────────┬─┘
             │                                                  │
    ┌────────▼────────┐                            ┌───────────▼────────┐
    │  URLGuard App   │                            │  URLGuard App      │
    │  Instance 1     │                            │  Instance N        │
    │  (Node.js)      │                            │  (Node.js)         │
    └────────┬────────┘                            └───────────┬────────┘
             │                                                  │
             └──────────────────────┬───────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
         ┌──────────▼──────┐  ┌────▼────────┐  ┌──▼──────────────┐
         │  Redis Cluster  │  │   MySQL     │  │  Prometheus    │
         │  (Cache/Pub/Sub)│  │  (Database) │  │  (Metrics)     │
         └─────────────────┘  └─────────────┘  └────────────────┘
```

## Key Components

### 1. Redis Cluster (Caching & Pub/Sub)

**Purpose**: Distributed cache, rate limiting, and real-time messaging

**Configuration**:
```yaml
- Analysis cache: 24h TTL (exact URLs), 1h TTL (similar domains)
- Certificate cache: 1h TTL
- Rate limiting: Per-user counters with sliding windows
- Pub/Sub: Real-time batch job progress updates
```

**Deployment**:
```bash
# Docker Compose
docker-compose up redis

# Kubernetes
kubectl apply -f k8s/redis-mysql.yaml
```

**Monitoring**:
```bash
# Check Redis memory usage
redis-cli INFO memory

# Monitor key count
redis-cli DBSIZE

# Check eviction policy
redis-cli CONFIG GET maxmemory-policy
```

### 2. BullMQ Job Queue (Batch Processing)

**Purpose**: Asynchronous batch URL analysis with progress tracking

**Features**:
- Up to 50 URLs per batch
- Automatic retries (3 attempts, exponential backoff)
- Progress tracking via Redis Pub/Sub
- Job persistence and recovery

**Usage**:
```typescript
const processor = await getBatchProcessor();
const jobId = await processor.enqueueBatch(userId, urls);

// Monitor progress
const status = await processor.getJobStatus(jobId);
console.log(`Progress: ${status.progress}%`);
```

**Queue Statistics**:
```typescript
const stats = await processor.getQueueStats();
console.log(`Waiting: ${stats.waiting}, Active: ${stats.active}`);
```

### 3. Rate Limiting & Concurrency Control

**tRPC Middleware**:
```typescript
- Unauthenticated: 10 req/min per endpoint
- Authenticated: 100 req/min per endpoint
- DeepSeek: Max 5 concurrent calls per user (semaphore pattern)
```

**Implementation**:
```typescript
import { rateLimitingMiddleware, deepseekConcurrencyMiddleware } from './middleware/rateLimiting';

const limiter = getRateLimiter();
const rateLimitMiddleware = rateLimitingMiddleware(limiter);
const deepseekMiddleware = deepseekConcurrencyMiddleware(limiter);
```

### 4. WebSocket Streaming

**Real-time Updates**:
- Batch job progress (0-100%)
- Current URL being analyzed
- Final results upon completion

**Client Connection**:
```javascript
const ws = new WebSocket('wss://urlguard.example.com/ws');

ws.send(JSON.stringify({
  type: 'subscribe',
  channel: `batch:${userId}`,
  jobId: jobId
}));

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'update') {
    console.log(`Progress: ${message.data.progress}%`);
  }
};
```

### 5. Prometheus Metrics

**Key Metrics**:
- `urlguard_urls_analyzed_total`: Total URLs analyzed by risk level
- `urlguard_cache_hits_total`: Cache hit rate by type
- `urlguard_deepseek_latency_seconds`: DeepSeek API latency (P50, P95, P99)
- `urlguard_active_deepseek_calls`: Current concurrent DeepSeek calls
- `urlguard_queue_length`: Batch job queue length
- `urlguard_websocket_connections`: Active WebSocket connections

**Alerting Rules** (alert_rules.yml):
```yaml
- alert: HighDeepSeekLatency
  expr: histogram_quantile(0.95, urlguard_deepseek_latency_seconds) > 5
  for: 5m
  annotations:
    summary: "DeepSeek latency exceeds 5s"

- alert: HighErrorRate
  expr: rate(urlguard_deepseek_errors_total[5m]) > 0.05
  for: 5m
  annotations:
    summary: "Error rate exceeds 5%"

- alert: QueueBacklog
  expr: urlguard_queue_length > 100
  for: 10m
  annotations:
    summary: "Batch job queue backlog exceeds 100"
```

## Deployment Strategies

### Local Development

```bash
# Start all services
docker-compose up

# Access services
- App: http://localhost:3000
- Prometheus: http://localhost:9091
- Grafana: http://localhost:3001 (admin/admin)
```

### Kubernetes Deployment

```bash
# 1. Create secrets
kubectl create secret generic urlguard-secrets \
  --from-literal=database-url="mysql://..." \
  --from-literal=deepseek-api-key="..." \
  --from-literal=jwt-secret="..." \
  --from-literal=mysql-root-password="..." \
  --from-literal=mysql-password="..."

# 2. Deploy Redis and MySQL
kubectl apply -f k8s/redis-mysql.yaml

# 3. Deploy application
kubectl apply -f k8s/deployment.yaml

# 4. Check status
kubectl get pods -l app=urlguard
kubectl logs -f deployment/urlguard-app

# 5. Scale manually
kubectl scale deployment urlguard-app --replicas=5

# 6. Check HPA status
kubectl get hpa urlguard-hpa
```

### Auto-Scaling Configuration

**Kubernetes HPA**:
- Min replicas: 3
- Max replicas: 10
- CPU target: 70% utilization
- Memory target: 80% utilization
- Scale-up: 100% increase per 30s (max 2 pods/min)
- Scale-down: 50% decrease per 60s (stabilization: 5min)

**Monitoring Auto-Scaling**:
```bash
kubectl describe hpa urlguard-hpa
kubectl get hpa urlguard-hpa --watch
```

## Performance Optimization

### Cache Hit Rate Targets

| Cache Type | Target Hit Rate | TTL |
|-----------|-----------------|-----|
| URL Analysis (exact) | >70% | 24h |
| URL Analysis (similar) | >40% | 1h |
| SSL Certificates | >60% | 1h |
| Heuristic Indicators | >50% | 5min |

### DeepSeek Cost Optimization

**Token Budget**:
- Per-request limit: 500 tokens
- Per-user daily limit: 10,000 tokens
- Prompt compression: Send only essential certificate fields

**Estimated Savings**:
- Cache hit rate: 70% → 70% fewer API calls
- Batch processing: 50 URLs → 1 DeepSeek call (vs. 50 individual calls)
- Total monthly cost reduction: ~60-70%

### Database Optimization

**Indexes**:
```sql
CREATE INDEX idx_user_id ON url_checks(userId);
CREATE INDEX idx_created_at ON url_checks(createdAt);
CREATE INDEX idx_risk_level ON url_checks(riskLevel);
CREATE INDEX idx_user_created ON url_checks(userId, createdAt DESC);
```

**Read Replicas**:
```sql
-- For high-traffic read queries (user history, statistics)
SELECT * FROM url_checks WHERE userId = ? ORDER BY createdAt DESC LIMIT 100;
```

**Partitioning by Date**:
```sql
-- Archive old records
ALTER TABLE url_checks PARTITION BY RANGE (YEAR(createdAt)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

## Monitoring & Alerting

### Grafana Dashboards

**Dashboard 1: System Health**
- CPU, Memory, Disk usage
- Request rate and latency
- Error rate and types

**Dashboard 2: API Performance**
- DeepSeek latency (P50, P95, P99)
- Cache hit rates by type
- Rate limit violations

**Dashboard 3: Batch Processing**
- Queue length and throughput
- Job success/failure rates
- Average job duration

**Dashboard 4: Business Metrics**
- URLs analyzed by risk level
- Top risky domains
- User activity trends

### Alert Thresholds

| Alert | Threshold | Action |
|-------|-----------|--------|
| High DeepSeek latency | P95 > 5s | Investigate API performance |
| High error rate | >5% | Check error logs, rollback if needed |
| Queue backlog | >100 jobs | Scale up workers |
| Cache miss rate | <50% | Review TTL settings |
| Memory usage | >85% | Scale up or optimize |

## Cost Estimation

### Monthly Costs (1M URLs/month)

| Component | Cost | Notes |
|-----------|------|-------|
| DeepSeek API | $300-500 | 70% cache hit rate |
| Redis (1GB) | $50-100 | Managed service |
| MySQL (20GB) | $100-150 | Managed service |
| Kubernetes (3 nodes) | $400-600 | 3x t3.medium instances |
| **Total** | **$850-1,350** | |

### Cost Optimization Tips

1. **Increase cache TTL** for stable URLs (24h → 48h)
2. **Use batch processing** for bulk analysis
3. **Implement read replicas** for analytics queries
4. **Archive old data** to reduce storage costs
5. **Use spot instances** in Kubernetes for non-critical workloads

## Troubleshooting

### High DeepSeek Latency

```bash
# Check Redis connectivity
redis-cli ping

# Monitor DeepSeek metrics
curl http://localhost:9090/metrics | grep deepseek_latency

# Check network latency
ping api.deepseek.com
```

### Queue Backlog

```bash
# Check queue stats
redis-cli LLEN bull:url-analysis-batch:wait

# Check active jobs
redis-cli LLEN bull:url-analysis-batch:active

# Restart workers
kubectl rollout restart deployment/urlguard-app
```

### High Memory Usage

```bash
# Check Redis memory
redis-cli INFO memory

# Check MySQL buffer pool
mysql -e "SHOW ENGINE INNODB STATUS\G" | grep "Buffer pool"

# Reduce cache TTL or enable eviction
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## Production Checklist

- [ ] Redis cluster with replication (3+ nodes)
- [ ] MySQL with read replicas and backups
- [ ] Kubernetes cluster with auto-scaling enabled
- [ ] Prometheus and Grafana dashboards configured
- [ ] Alert rules and notification channels set up
- [ ] SSL/TLS certificates configured
- [ ] Rate limiting and DDoS protection enabled
- [ ] Database backups automated (daily)
- [ ] Log aggregation (ELK/CloudWatch) configured
- [ ] Disaster recovery plan documented

## References

- [Redis Cluster Documentation](https://redis.io/docs/management/scaling/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Kubernetes HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/instrumentation/)
