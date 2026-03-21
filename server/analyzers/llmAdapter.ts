/**
 * Abstract LLM adapter for provider-agnostic implementation
 * Allows easy switching between DeepSeek, OpenAI, Ollama, etc.
 */

export interface LLMAnalysisResult {
  riskScore: number;
  riskLevel: "safe" | "suspicious" | "dangerous";
  analysis: string;
  phishingIndicators: string[];
  confidence: number;
  tokensUsed: number;
  cached: boolean;
  provider: string;
}

export interface LLMConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMAdapter {
  protected config: LLMConfig;
  protected name: string;

  constructor(config: LLMConfig, name: string) {
    this.config = config;
    this.name = name;
  }

  /**
   * Analyze URL for phishing
   */
  abstract analyzeURL(url: string): Promise<LLMAnalysisResult>;

  /**
   * Get provider name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Validate configuration
   */
  abstract validateConfig(): boolean;

  /**
   * Get health status
   */
  abstract getHealthStatus(): Promise<boolean>;
}

/**
 * Factory for creating LLM adapters
 */
export class LLMAdapterFactory {
  private static adapters: Map<string, typeof LLMAdapter> = new Map();

  static {
    // Register available adapters
    // DeepSeek will be registered when imported
    // OpenAI can be registered similarly
  }

  /**
   * Register a new adapter
   */
  static registerAdapter(name: string, adapterClass: typeof LLMAdapter): void {
    this.adapters.set(name.toLowerCase(), adapterClass);
  }

  /**
   * Create adapter instance
   */
  static createAdapter(providerName: string, config: LLMConfig): LLMAdapter {
    const AdapterClass = this.adapters.get(providerName.toLowerCase());

    if (!AdapterClass) {
      throw new Error(`Unknown LLM provider: ${providerName}`);
    }

    // Use type assertion to bypass abstract class check
    return new (AdapterClass as any)(config, providerName);
  }

  /**
   * Get list of available adapters
   */
  static getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Prompt configuration for versioning
 */
export interface PromptConfig {
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  responseFormat: "json" | "text" | "structured";
  maxTokens: number;
  temperature: number;
}

/**
 * Prompt manager for version control
 */
export class PromptManager {
  private prompts: Map<string, PromptConfig> = new Map();
  private activeVersion: string = "v1";

  constructor() {
    this.initializeDefaultPrompts();
  }

  /**
   * Initialize default prompts
   */
  private initializeDefaultPrompts(): void {
    this.prompts.set("v1", {
      version: "v1",
      systemPrompt:
        "You are a security expert analyzing URLs for phishing and fraud. Analyze the given URL and return a JSON object with fraud_score (0-100), risk_level (safe/suspicious/dangerous), reasons array, and confidence (0-1).",
      userPromptTemplate: "Analyze this URL for phishing/fraud: {url}",
      responseFormat: "json",
      maxTokens: 500,
      temperature: 0.3,
    });

    this.prompts.set("v2", {
      version: "v2",
      systemPrompt:
        "You are an expert cybersecurity analyst. Evaluate URLs for phishing, malware, and fraud risks. Consider domain reputation, SSL certificates, content analysis, and user reports. Return structured analysis.",
      userPromptTemplate:
        "Security Analysis Required:\nURL: {url}\nProvide: risk_score (0-100), risk_level, detailed_reasons, confidence_level",
      responseFormat: "json",
      maxTokens: 800,
      temperature: 0.2,
    });
  }

  /**
   * Get prompt configuration
   */
  getPrompt(version?: string): PromptConfig {
    const v = version || this.activeVersion;
    const prompt = this.prompts.get(v);

    if (!prompt) {
      throw new Error(`Prompt version not found: ${v}`);
    }

    return prompt;
  }

  /**
   * Set active prompt version
   */
  setActiveVersion(version: string): void {
    if (!this.prompts.has(version)) {
      throw new Error(`Prompt version not found: ${version}`);
    }
    this.activeVersion = version;
  }

  /**
   * Add new prompt version
   */
  addPrompt(config: PromptConfig): void {
    this.prompts.set(config.version, config);
  }

  /**
   * Get all available versions
   */
  getAvailableVersions(): string[] {
    return Array.from(this.prompts.keys());
  }

  /**
   * Get active version
   */
  getActiveVersion(): string {
    return this.activeVersion;
  }
}

// Singleton instances
let promptManager: PromptManager | null = null;

export function getPromptManager(): PromptManager {
  if (!promptManager) {
    promptManager = new PromptManager();
  }
  return promptManager;
}
