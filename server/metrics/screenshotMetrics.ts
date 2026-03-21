/**
 * Prometheus Metrics for Screenshot Feature
 * Tracks job success/failure, duration, and queue length
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export interface ScreenshotMetricsConfig {
  registry?: Registry;
}

class ScreenshotMetrics {
  private jobsTotal: Counter;
  private jobDuration: Histogram;
  private queueLength: Gauge;

  constructor(config?: ScreenshotMetricsConfig) {
    const registry = config?.registry;

    // Counter: Total screenshot jobs by status
    this.jobsTotal = new Counter({
      name: 'urlguard_screenshot_jobs_total',
      help: 'Total screenshot jobs processed',
      labelNames: ['status'], // 'success', 'failure', 'skipped'
      registers: registry ? [registry] : undefined,
    });

    // Histogram: Job duration in seconds
    this.jobDuration = new Histogram({
      name: 'urlguard_screenshot_duration_seconds',
      help: 'Screenshot job duration in seconds',
      buckets: [0.5, 1, 2, 5, 10, 30],
      labelNames: ['status'], // 'success', 'failure'
      registers: registry ? [registry] : undefined,
    });

    // Gauge: Current queue length
    this.queueLength = new Gauge({
      name: 'urlguard_screenshot_queue_length',
      help: 'Number of pending screenshot jobs in queue',
      registers: registry ? [registry] : undefined,
    });
  }

  /**
   * Record successful screenshot job
   */
  recordSuccess(durationSeconds: number): void {
    this.jobsTotal.inc({ status: 'success' });
    this.jobDuration.observe({ status: 'success' }, durationSeconds);
  }

  /**
   * Record failed screenshot job
   */
  recordFailure(durationSeconds: number): void {
    this.jobsTotal.inc({ status: 'failure' });
    this.jobDuration.observe({ status: 'failure' }, durationSeconds);
  }

  /**
   * Record skipped screenshot job (idempotent)
   */
  recordSkipped(): void {
    this.jobsTotal.inc({ status: 'skipped' });
  }

  /**
   * Update queue length gauge
   */
  setQueueLength(length: number): void {
    this.queueLength.set(length);
  }

  /**
   * Get all metrics as Prometheus text format
   */
  async getMetrics(): Promise<string> {
    // This would be called by the /metrics endpoint
    // The registry handles serialization
    return '';
  }
}

// Singleton instance
let metricsInstance: ScreenshotMetrics | null = null;

export function getScreenshotMetrics(config?: ScreenshotMetricsConfig): ScreenshotMetrics {
  if (!metricsInstance) {
    metricsInstance = new ScreenshotMetrics(config);
  }
  return metricsInstance;
}

export default ScreenshotMetrics;
