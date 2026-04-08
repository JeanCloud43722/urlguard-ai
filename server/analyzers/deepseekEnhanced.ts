import axios, { AxiosInstance } from "axios";
import { ENV } from "../_core/env";

export interface DeepSeekRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface DeepSeekTimeoutConfig {
  shortTimeout: number;
  longTimeout: number;
}

export interface PhishingAnalysisResult {
  riskScore: number;
  riskLevel: "safe" | "suspicious" | "dangerous";
  analysis: string;
  phishingIndicators: string[];
  confidence: number;
  tokensUsed: number;
  cached: boolean;
}

/**
 * Enhanced DeepSeek client with retry logic, timeouts, and monitoring
 */
export class EnhancedDeepSeekClient {
  private client: AxiosInstance;
  private retryConfig: DeepSeekRetryConfig;
  private timeoutConfig: DeepSeekTimeoutConfig;
  private requestMetrics: Map<string, { count: number; totalTokens: number; totalDuration: number }> = new Map();

  constructor(
    retryConfig: DeepSeekRetryConfig = {
      maxRetries: 2,
      initialDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 1.5,
    },
    timeoutConfig: DeepSeekTimeoutConfig = {
      shortTimeout: 5000,
      longTimeout: 15000,
    }
  ) {
    this.retryConfig = retryConfig;
    this.timeoutConfig = timeoutConfig;

    this.client = axios.create({
      baseURL: ENV.deepseekApiUrl,
      headers: {
        Authorization: `Bearer ${ENV.deepseekApiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Exponential backoff delay calculation
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelayMs
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * delay * 0.1;
  }

  /**
   * Retry wrapper for API calls
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable || attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        const delay = this.calculateBackoffDelay(attempt);
        console.warn(
          `[DeepSeek] ${operationName} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}), retrying in ${delay}ms`,
          (error as Error).message
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error.response) {
      const status = error.response.status;
      // Retry on 429 (rate limit), 500, 502, 503, 504
      return status === 429 || (status >= 500 && status < 600);
    }

    // Retry on network errors
    if (error.code === "ECONNABORTED" || error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      return true;
    }

    return false;
  }

  /**
   * Analyze URL with DeepSeek using Function Calling
   */
  async analyzeURLWithFunctionCalling(url: string): Promise<PhishingAnalysisResult> {
    const startTime = Date.now();
    const operationName = `analyzeURL:${url}`;

    try {
      const result = await this.retryWithBackoff(async () => {
        const response = await this.client.post(
          "/chat/completions",
          {
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content:
                  "You are a security expert analyzing URLs for phishing and fraud. Analyze the given URL and return a JSON object with fraud_score (0-100), risk_level (safe/suspicious/dangerous), reasons array, and confidence (0-1).",
              },
              {
                role: "user",
                content: `Analyze this URL for phishing/fraud: ${url}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
            response_format: {
              type: "json_object",
              schema: {
                type: "object",
                properties: {
                  fraud_score: { type: "number", minimum: 0, maximum: 100 },
                  risk_level: { type: "string", enum: ["safe", "suspicious", "dangerous"] },
                  reasons: { type: "array", items: { type: "string" } },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["fraud_score", "risk_level", "reasons", "confidence"],
              },
            },
          },
          {
            timeout: this.timeoutConfig.longTimeout,
          }
        );

        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Invalid DeepSeek response: no content");
        }

        const parsed = JSON.parse(content);
        const tokensUsed = response.data.usage?.total_tokens || 0;

        // Record metrics
        this.recordMetric(operationName, tokensUsed, Date.now() - startTime);

        return {
          riskScore: parsed.fraud_score,
          riskLevel: parsed.risk_level,
          analysis: `DeepSeek Analysis: ${parsed.reasons.join(", ")}`,
          phishingIndicators: parsed.reasons,
          confidence: parsed.confidence,
          tokensUsed,
          cached: false,
        };
      }, operationName);

      return result;
    } catch (error) {
      console.error(`[DeepSeek] ${operationName} failed:`, (error as Error).message);
      throw new Error(`DeepSeek analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Record API metrics for monitoring
   */
  private recordMetric(operationName: string, tokensUsed: number, duration: number) {
    const existing = this.requestMetrics.get(operationName) || { count: 0, totalTokens: 0, totalDuration: 0 };
    existing.count++;
    existing.totalTokens += tokensUsed;
    existing.totalDuration += duration;
    this.requestMetrics.set(operationName, existing);

    console.log(
      `[DeepSeek Metrics] ${operationName}: ${tokensUsed} tokens, ${duration}ms`
    );
  }

  /**
   * Get aggregated metrics
   */
  getMetrics() {
    const metrics: Record<string, any> = {};
    this.requestMetrics.forEach((value, key) => {
      metrics[key] = {
        requests: value.count,
        avgTokensPerRequest: Math.round(value.totalTokens / value.count),
        avgDurationMs: Math.round(value.totalDuration / value.count),
        totalTokens: value.totalTokens,
      };
    });
    return metrics;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.requestMetrics.clear();
  }

  /**
   * Analyze URL with OCR data from screenshot
   */
  async analyzeWithOCRData(
    url: string,
    certificateInfo: any,
    heuristicIndicators: string[],
    affiliateInfo: any,
    ocrData?: { text: string; indicators: string[]; confidence: number }
  ): Promise<PhishingAnalysisResult> {
    const { SYSTEM_PROMPT, buildUserPrompt, validateResponse } = await import("./deepseekPrompt");
    
    // Enhance user prompt with OCR data if available
    const enhancedContext = {
      url,
      certificateInfo,
      heuristicIndicators,
      affiliateInfo,
      ocrData: ocrData ? {
        extractedText: ocrData.text.substring(0, 1000), // Limit to 1000 chars
        ocrIndicators: ocrData.indicators,
        ocrConfidence: ocrData.confidence,
      } : undefined,
    };
    
    const userPrompt = buildUserPrompt(enhancedContext);
    const startTime = Date.now();
    const operationName = `analyzeWithOCR:${url}`;

    try {
      const result = await this.retryWithBackoff(async () => {
        const response = await this.client.post(
          "/chat/completions",
          {
            model: "deepseek-chat",
            messages: [
              { role: "system", content: SYSTEM_PROMPT + "\n\nYou also have access to OCR-extracted text from the website screenshot. Use this additional data to enhance your phishing detection accuracy." },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: "json_object" },
          },
          { timeout: this.timeoutConfig.longTimeout }
        );

        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Invalid DeepSeek response: no content");
        }

        const parsed = JSON.parse(content);

        // Validate response structure
        if (!validateResponse(parsed)) {
          throw new Error("Invalid response structure from DeepSeek");
        }

        const tokensUsed = response.data.usage?.total_tokens || 0;
        this.recordMetric(operationName, tokensUsed, Date.now() - startTime);

        return {
          riskScore: parsed.fraud_score,
          riskLevel: parsed.risk_level,
          analysis: parsed.analysis + (ocrData ? `\n\n[OCR Enhanced] Analyzed ${ocrData.text.split(' ').length} words from website screenshot.` : ""),
          phishingIndicators: parsed.phishing_indicators || [],
          confidence: parsed.confidence,
          tokensUsed,
          cached: false,
        };
      }, operationName);

      return result;
    } catch (error) {
      console.error(`[DeepSeek] ${operationName} failed:`, (error as Error).message);
      throw new Error(`DeepSeek OCR analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze URL with full context (certificate, indicators, affiliate info)
   */
  async analyzeWithFullContext(
    url: string,
    certificateInfo: any,
    heuristicIndicators: string[],
    affiliateInfo: any
  ): Promise<PhishingAnalysisResult> {
    const { SYSTEM_PROMPT, buildUserPrompt, validateResponse } = await import("./deepseekPrompt");
    const userPrompt = buildUserPrompt({ url, certificateInfo, heuristicIndicators, affiliateInfo });
    const startTime = Date.now();
    const operationName = `analyzeFullContext:${url}`;
    console.log(`[DeepSeek] Starting analysis for ${url}`);

    try {
      const result = await this.retryWithBackoff(async () => {
        const response = await this.client.post(
          "/chat/completions",
          {
            model: "deepseek-chat",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 800,
            response_format: { type: "json_object" },
          },
          { timeout: this.timeoutConfig.longTimeout }
        );

        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Invalid DeepSeek response: no content");
        }

        const parsed = JSON.parse(content);

        // Validate response structure
        if (!validateResponse(parsed)) {
          throw new Error("Invalid response structure from DeepSeek");
        }

        const tokensUsed = response.data.usage?.total_tokens || 0;
        const duration = Date.now() - startTime;
        this.recordMetric(operationName, tokensUsed, duration);
        
        console.log(`[DeepSeek] ${url} analysed in ${duration}ms (${tokensUsed} tokens, score: ${parsed.fraud_score})`);
        if (duration > 3000) {
          console.warn(`[DeepSeek] SLOW RESPONSE (${duration}ms) for ${url}`);
        }

        return {
          riskScore: parsed.fraud_score,
          riskLevel: parsed.risk_level,
          analysis: parsed.analysis,
          phishingIndicators: parsed.phishing_indicators || [],
          confidence: parsed.confidence,
          tokensUsed,
          cached: false,
        };
      }, operationName);

      return result;
    } catch (error) {
      console.error(`[DeepSeek] ${operationName} failed:`, (error as Error).message);
      throw new Error(`DeepSeek full context analysis failed: ${(error as Error).message}`);
    }
  }
}

// Singleton instance
let deepseekClient: EnhancedDeepSeekClient | null = null;

export function getDeepSeekClient(): EnhancedDeepSeekClient {
  if (!deepseekClient) {
    deepseekClient = new EnhancedDeepSeekClient();
  }
  return deepseekClient;
}
