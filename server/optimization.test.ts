import { describe, it, expect, beforeEach } from "vitest";
import { LLMCache } from "./utils/llmCache";
import { PromptManager } from "./analyzers/llmAdapter";
import { LLMAdapterFactory } from "./analyzers/llmAdapter";

describe("LLM Cache", () => {
  let cache: LLMCache;

  beforeEach(() => {
    cache = new LLMCache();
  });

  describe("Cache Operations", () => {
    it("should cache and retrieve results", () => {
      const url = "https://example.com";
      const data = { riskScore: 25, analysis: "Safe" };

      cache.set(url, data, 100);
      const retrieved = cache.get(url);

      expect(retrieved).toEqual(data);
    });

    it("should return null for expired cache", (done) => {
      const url = "https://example.com";
      const data = { riskScore: 25 };

      // Set with 100ms TTL
      cache.set(url, data, 100, 0.1);

      // Should be available immediately
      expect(cache.get(url)).toEqual(data);

      // Should expire after TTL
      setTimeout(() => {
        expect(cache.get(url)).toBeNull();
        done();
      }, 150);
    });

    it("should handle cache miss", () => {
      const result = cache.get("https://nonexistent.com");
      expect(result).toBeNull();
    });
  });

  describe("Token Budget", () => {
    it("should check token budget", () => {
      const userId = 1;
      const canUse = cache.checkTokenBudget(userId, 100);
      expect(canUse).toBe(true);
    });

    it("should deduct tokens from budget", () => {
      const userId = 1;
      cache.deductTokens(userId, 100);
      const canUse = cache.checkTokenBudget(userId, 400);
      expect(canUse).toBe(true);

      const cannotUse = cache.checkTokenBudget(userId, 401);
      expect(cannotUse).toBe(false);
    });

    it("should reset user budget", () => {
      const userId = 1;
      cache.deductTokens(userId, 400);
      cache.resetUserBudget(userId);

      const canUse = cache.checkTokenBudget(userId, 500);
      expect(canUse).toBe(true);
    });
  });

  describe("Concurrent Request Limiting", () => {
    it("should allow concurrent requests up to limit", () => {
      const userId = 1;
      const limit = 5;

      for (let i = 0; i < limit; i++) {
        expect(cache.canMakeRequest(userId)).toBe(true);
        cache.incrementConcurrent(userId);
      }

      // Should fail when exceeding limit
      expect(cache.canMakeRequest(userId)).toBe(false);
    });

    it("should decrement concurrent counter", () => {
      const userId = 1;
      cache.incrementConcurrent(userId);
      cache.incrementConcurrent(userId);

      cache.decrementConcurrent(userId);
      expect(cache.canMakeRequest(userId)).toBe(true);
    });
  });

  describe("Cache Statistics", () => {
    it("should provide cache statistics", () => {
      cache.set("https://example1.com", { data: 1 }, 100);
      cache.set("https://example2.com", { data: 2 }, 100);

      const stats = cache.getStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.totalCacheEntries).toBe(2);
    });
  });
});

describe("Prompt Manager", () => {
  let manager: PromptManager;

  beforeEach(() => {
    manager = new PromptManager();
  });

  describe("Prompt Versions", () => {
    it("should have default prompts", () => {
      const versions = manager.getAvailableVersions();
      expect(versions).toContain("v1");
      expect(versions).toContain("v2");
    });

    it("should get default prompt", () => {
      const prompt = manager.getPrompt();
      expect(prompt).toBeDefined();
      expect(prompt.version).toBe("v1");
    });

    it("should get specific prompt version", () => {
      const prompt = manager.getPrompt("v2");
      expect(prompt.version).toBe("v2");
      expect(prompt.maxTokens).toBe(800);
    });

    it("should throw for unknown version", () => {
      expect(() => manager.getPrompt("v999")).toThrow();
    });
  });

  describe("Active Version", () => {
    it("should set active version", () => {
      manager.setActiveVersion("v2");
      expect(manager.getActiveVersion()).toBe("v2");

      const prompt = manager.getPrompt();
      expect(prompt.version).toBe("v2");
    });

    it("should throw when setting unknown version", () => {
      expect(() => manager.setActiveVersion("v999")).toThrow();
    });
  });

  describe("Add New Prompt", () => {
    it("should add new prompt version", () => {
      const newPrompt = {
        version: "v3",
        systemPrompt: "New system prompt",
        userPromptTemplate: "New template",
        responseFormat: "json" as const,
        maxTokens: 1000,
        temperature: 0.25,
      };

      manager.addPrompt(newPrompt);
      const versions = manager.getAvailableVersions();
      expect(versions).toContain("v3");

      const retrieved = manager.getPrompt("v3");
      expect(retrieved.systemPrompt).toBe("New system prompt");
    });
  });
});

describe("LLM Adapter Factory", () => {
  it("should throw for unknown provider", () => {
    const config = {
      apiKey: "test",
      apiUrl: "https://api.test.com",
      model: "test-model",
      maxTokens: 500,
      temperature: 0.3,
    };

    expect(() => LLMAdapterFactory.createAdapter("unknown", config)).toThrow();
  });

  it("should get available adapters", () => {
    const adapters = LLMAdapterFactory.getAvailableAdapters();
    expect(Array.isArray(adapters)).toBe(true);
  });
});

describe("Cache Performance", () => {
  it("should handle large number of cache entries", () => {
    const cache = new LLMCache();
    const startTime = Date.now();

    // Add 1000 entries
    for (let i = 0; i < 1000; i++) {
      cache.set(`https://example${i}.com`, { data: i }, 100);
    }

    // Retrieve 1000 entries
    for (let i = 0; i < 1000; i++) {
      const result = cache.get(`https://example${i}.com`);
      expect(result).toBeDefined();
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
  });

  it("should efficiently clean up expired entries", (done) => {
    const cache = new LLMCache();

    // Add entries with short TTL
    for (let i = 0; i < 100; i++) {
      cache.set(`https://example${i}.com`, { data: i }, 100, 0.1);
    }

    const stats1 = cache.getStats();
    expect(stats1.cacheSize).toBe(100);

    // Wait for expiration
    setTimeout(() => {
      // Trigger cleanup by accessing cache
      cache.get("https://example0.com");

      const stats2 = cache.getStats();
      expect(stats2.cacheSize).toBeLessThan(100);
      done();
    }, 200);
  });
});
