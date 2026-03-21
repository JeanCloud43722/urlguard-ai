/**
 * Prometheus Metrics Service
 * Tracks performance, cache hit rates, API latency, and queue metrics
 */

import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

class MetricsService {
  // Counters
  private urlsAnalyzed: Counter;
  private cacheHits: Counter;
  private cacheMisses: Counter;
  private deepseekRequests: Counter;
  private deepseekErrors: Counter;
  private certificateFetches: Counter;
  private certificateErrors: Counter;

  // Histograms (latency tracking)
  private deepseekLatency: Histogram;
  private certificateLatency: Histogram;
  private analysisLatency: Histogram;
  private cacheLatency: Histogram;

  // Gauges (current state)
  private activeDeepseekCalls: Gauge;
  private queueLength: Gauge;
  private activeBatchJobs: Gauge;
  private wsConnections: Gauge;

  constructor() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register });

    // Initialize counters
    this.urlsAnalyzed = new Counter({
      name: 'urlguard_urls_analyzed_total',
      help: 'Total number of URLs analyzed',
      labelNames: ['risk_level'],
    });

    this.cacheHits = new Counter({
      name: 'urlguard_cache_hits_total',
      help: 'Total cache hits',
      labelNames: ['cache_type'],
    });

    this.cacheMisses = new Counter({
      name: 'urlguard_cache_misses_total',
      help: 'Total cache misses',
      labelNames: ['cache_type'],
    });

    this.deepseekRequests = new Counter({
      name: 'urlguard_deepseek_requests_total',
      help: 'Total DeepSeek API requests',
    });

    this.deepseekErrors = new Counter({
      name: 'urlguard_deepseek_errors_total',
      help: 'Total DeepSeek API errors',
      labelNames: ['error_type'],
    });

    this.certificateFetches = new Counter({
      name: 'urlguard_certificate_fetches_total',
      help: 'Total certificate fetches',
    });

    this.certificateErrors = new Counter({
      name: 'urlguard_certificate_errors_total',
      help: 'Total certificate fetch errors',
    });

    // Initialize histograms
    this.deepseekLatency = new Histogram({
      name: 'urlguard_deepseek_latency_seconds',
      help: 'DeepSeek API latency in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    });

    this.certificateLatency = new Histogram({
      name: 'urlguard_certificate_latency_seconds',
      help: 'Certificate fetch latency in seconds',
      buckets: [0.05, 0.1, 0.5, 1, 2, 5],
    });

    this.analysisLatency = new Histogram({
      name: 'urlguard_analysis_latency_seconds',
      help: 'Total URL analysis latency in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    });

    this.cacheLatency = new Histogram({
      name: 'urlguard_cache_latency_seconds',
      help: 'Cache operation latency in seconds',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
    });

    // Initialize gauges
    this.activeDeepseekCalls = new Gauge({
      name: 'urlguard_active_deepseek_calls',
      help: 'Currently active DeepSeek API calls',
    });

    this.queueLength = new Gauge({
      name: 'urlguard_queue_length',
      help: 'Current batch job queue length',
    });

    this.activeBatchJobs = new Gauge({
      name: 'urlguard_active_batch_jobs',
      help: 'Currently active batch jobs',
    });

    this.wsConnections = new Gauge({
      name: 'urlguard_websocket_connections',
      help: 'Active WebSocket connections',
    });
  }

  /**
   * Record URL analysis
   */
  recordUrlAnalysis(riskLevel: string, durationSeconds: number): void {
    this.urlsAnalyzed.inc({ risk_level: riskLevel });
    this.analysisLatency.observe(durationSeconds);
  }

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string, durationSeconds: number): void {
    this.cacheHits.inc({ cache_type: cacheType });
    this.cacheLatency.observe(durationSeconds);
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string, durationSeconds: number): void {
    this.cacheMisses.inc({ cache_type: cacheType });
    this.cacheLatency.observe(durationSeconds);
  }

  /**
   * Record DeepSeek request
   */
  recordDeepseekRequest(durationSeconds: number): void {
    this.deepseekRequests.inc();
    this.deepseekLatency.observe(durationSeconds);
  }

  /**
   * Record DeepSeek error
   */
  recordDeepseekError(errorType: string): void {
    this.deepseekErrors.inc({ error_type: errorType });
  }

  /**
   * Record certificate fetch
   */
  recordCertificateFetch(durationSeconds: number): void {
    this.certificateFetches.inc();
    this.certificateLatency.observe(durationSeconds);
  }

  /**
   * Record certificate error
   */
  recordCertificateError(): void {
    this.certificateErrors.inc();
  }

  /**
   * Set active DeepSeek calls
   */
  setActiveDeepseekCalls(count: number): void {
    this.activeDeepseekCalls.set(count);
  }

  /**
   * Set queue length
   */
  setQueueLength(length: number): void {
    this.queueLength.set(length);
  }

  /**
   * Set active batch jobs
   */
  setActiveBatchJobs(count: number): void {
    this.activeBatchJobs.set(count);
  }

  /**
   * Set WebSocket connections
   */
  setWebSocketConnections(count: number): void {
    this.wsConnections.set(count);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  getMetricsJSON(): any {
    return {
      timestamp: Date.now(),
      metrics: {
        urlsAnalyzed: this.urlsAnalyzed.get(),
        cacheHits: this.cacheHits.get(),
        cacheMisses: this.cacheMisses.get(),
        deepseekRequests: this.deepseekRequests.get(),
        deepseekErrors: this.deepseekErrors.get(),
        certificateFetches: this.certificateFetches.get(),
        certificateErrors: this.certificateErrors.get(),
        activeDeepseekCalls: this.activeDeepseekCalls.get(),
        queueLength: this.queueLength.get(),
        activeBatchJobs: this.activeBatchJobs.get(),
        wsConnections: this.wsConnections.get(),
      },
    };
  }

  /**
   * Calculate cache hit rate
   */
  getCacheHitRate(): number {
    // Simplified: return 0 for now, can be enhanced with actual metric values
    return 0;
  }
}

// Singleton instance
let metricsService: MetricsService | null = null;

export function getMetricsService(): MetricsService {
  if (!metricsService) {
    metricsService = new MetricsService();
  }
  return metricsService;
}

export default MetricsService;
