# URLGuard AI – DeepSeek Optimization Guide

## Overview

Diese Dokumentation beschreibt die erweiterten DeepSeek-Optimierungen für URLGuard AI, einschließlich Retry-Mechanismen, Caching, Streaming, Function Calling, Monitoring und zukunftsorientierter Architektur.

## 1. Enhanced DeepSeek Client

### Retry-Mechanismen mit Exponentieller Backoff

Die `EnhancedDeepSeekClient` Klasse implementiert automatische Wiederholungen mit exponentieller Backoff-Logik:

```typescript
const client = getDeepSeekClient();

// Automatische Wiederholungen bei:
// - Rate Limits (429)
// - Server Errors (5xx)
// - Netzwerkfehler
```

**Konfiguration:**
- Max Retries: 3
- Initial Delay: 1000ms
- Max Delay: 10000ms
- Backoff Multiplier: 2x
- Jitter: ±10% zur Vermeidung von Thundering Herd

### Timeout-Verwaltung

```typescript
// Kurze Anfragen: 10 Sekunden
// Lange Anfragen: 30 Sekunden
```

### Function Calling für strukturierte Ergebnisse

```typescript
const result = await client.analyzeURLWithFunctionCalling(url);
// Returns: { riskScore, riskLevel, analysis, phishingIndicators, confidence, tokensUsed }
```

## 2. Caching-System

### In-Memory Cache mit TTL

```typescript
const cache = getCache();

// Exakte URLs: 24 Stunden Cache
// Ähnliche Domains: 1 Stunde Cache
```

### Token-Budget Management

```typescript
// Pro Nutzer: max 500 Tokens pro Request
// Automatische Deduktion bei API-Aufrufen
// Budget-Reset täglich

cache.checkTokenBudget(userId, tokensRequired);
cache.deductTokens(userId, tokensUsed);
cache.resetUserBudget(userId);
```

### Concurrent Request Limiting

```typescript
// Max 5 parallele Anfragen pro Nutzer
cache.canMakeRequest(userId);
cache.incrementConcurrent(userId);
cache.decrementConcurrent(userId);
```

## 3. LLM Adapter Pattern

### Abstrakte Basis-Klasse

```typescript
abstract class LLMAdapter {
  abstract analyzeURL(url: string): Promise<LLMAnalysisResult>;
  abstract validateConfig(): boolean;
  abstract getHealthStatus(): Promise<boolean>;
}
```

### Provider-Registrierung

```typescript
// DeepSeek (aktuell)
LLMAdapterFactory.registerAdapter("deepseek", DeepSeekAdapter);

// Zukünftig: OpenAI, Ollama, etc.
LLMAdapterFactory.registerAdapter("openai", OpenAIAdapter);

// Adapter erstellen
const adapter = LLMAdapterFactory.createAdapter("deepseek", config);
```

## 4. Prompt-Versionierung

### Verfügbare Versionen

**v1 (Standard):**
- Fokus: Phishing-Erkennung
- Max Tokens: 500
- Temperature: 0.3

**v2 (Erweitert):**
- Fokus: Umfassende Sicherheitsanalyse
- Max Tokens: 800
- Temperature: 0.2

### Prompt-Wechsel

```typescript
const manager = getPromptManager();

// Aktive Version setzen
manager.setActiveVersion("v2");

// Prompt abrufen
const prompt = manager.getPrompt("v2");
```

## 5. Monitoring & Metriken

### Verfügbare Metriken

```typescript
const metrics = client.getMetrics();
// {
//   "analyzeURL:https://example.com": {
//     requests: 5,
//     avgTokensPerRequest: 250,
//     avgDurationMs: 2500,
//     totalTokens: 1250
//   }
// }
```

### Logs

Alle API-Aufrufe werden mit folgenden Informationen geloggt:
- Operation Name
- Tokens Used
- Duration
- Error Details (falls vorhanden)
- Retry Attempts

## 6. Integration in bestehende API

### URL Check mit AI

```typescript
// Endpoint: POST /api/trpc/urlChecker.checkURL
{
  "url": "https://example.com",
  "useAI": true  // Optional, default: true
}

// Response
{
  "id": 123,
  "url": "https://example.com",
  "riskScore": 25,
  "riskLevel": "safe",
  "analysis": "URL appears safe...",
  "indicators": [],
  "aiScore": 25,
  "aiExplanation": "DeepSeek Analysis: ...",
  "tokensUsed": 250,
  "cached": false
}
```

## 7. Fehlerbehandlung & Fallbacks

### Automatische Fallbacks

```typescript
try {
  const result = await analyzeWithDeepSeek(url);
} catch (error) {
  // Fallback auf heuristische Analyse
  const fallbackResult = await analyzeWithHeuristics(url);
}
```

### Fehlertypen

| Fehler | Aktion |
|--------|--------|
| Rate Limit (429) | Retry mit Backoff |
| Server Error (5xx) | Retry mit Backoff |
| Invalid Response | Log + Fallback |
| API Key Missing | Fallback + Alert |
| Timeout | Retry + Fallback |

## 8. Performance-Optimierung

### Cache-Hit-Rate

Ziel: >70% Cache-Hit-Rate für häufig geprüfte URLs

```typescript
// Monitoring
const stats = cache.getStats();
console.log(`Cache Size: ${stats.cacheSize}`);
```

### Token-Effizienz

- Durchschnittliche Tokens pro Request: 250
- Max Tokens pro Request: 500
- Budget pro Nutzer: 500 Tokens

### Latenz-Ziele

- Cached Response: <50ms
- API Response: <5s (mit Retry)
- P95 Latency: <3s

## 9. Zukunftsorientierte Erweiterungen

### Neue LLM-Provider hinzufügen

```typescript
class OpenAIAdapter extends LLMAdapter {
  async analyzeURL(url: string): Promise<LLMAnalysisResult> {
    // OpenAI-spezifische Implementierung
  }
  
  async validateConfig(): boolean {
    return !!this.config.apiKey;
  }
  
  async getHealthStatus(): Promise<boolean> {
    // Health Check gegen OpenAI API
  }
}

LLMAdapterFactory.registerAdapter("openai", OpenAIAdapter);
```

### Neue Prompt-Versionen

```typescript
const manager = getPromptManager();
manager.addPrompt({
  version: "v3",
  systemPrompt: "...",
  userPromptTemplate: "...",
  responseFormat: "json",
  maxTokens: 1000,
  temperature: 0.25
});
```

## 10. Konfiguration

### Umgebungsvariablen

```bash
# DeepSeek API
DEEPSEEK_API_KEY=sk_...
DEEPSEEK_API_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# Cache Konfiguration
CACHE_TTL_EXACT=86400
CACHE_TTL_SIMILAR=3600
CACHE_MAX_TOKENS=500
CACHE_MAX_CONCURRENT=5

# Retry Konfiguration
RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_DELAY=1000
RETRY_MAX_DELAY=10000

# Timeouts
TIMEOUT_SHORT=10000
TIMEOUT_LONG=30000
```

## 11. Best Practices

### 1. Caching nutzen
- Exakte URLs immer cachen (24h TTL)
- Ähnliche Domains mit kürzerer TTL cachen

### 2. Token-Budget respektieren
- Budget vor API-Aufrufen prüfen
- Tokens nach Aufrufen deduktieren
- Budget regelmäßig zurücksetzen

### 3. Fehlerbehandlung
- Immer Fallback auf Heuristik haben
- Fehler loggen für Monitoring
- User-freundliche Fehlermeldungen

### 4. Monitoring
- Metriken regelmäßig prüfen
- Cache-Hit-Rate überwachen
- Token-Verbrauch tracken

### 5. Skalierung
- Concurrent Request Limits beachten
- Batch-Operationen mit Delays
- Rate Limits der DeepSeek API respektieren

## 12. Troubleshooting

### Problem: Hohe Latenz

**Lösung:**
1. Cache-Hit-Rate prüfen
2. Token-Limits prüfen
3. DeepSeek API Status prüfen
4. Timeout-Werte anpassen

### Problem: Rate Limits

**Lösung:**
1. Concurrent Requests reduzieren
2. Batch-Delays erhöhen
3. Token-Budget senken
4. Cache-TTL erhöhen

### Problem: Ungültige Responses

**Lösung:**
1. Prompt-Version prüfen
2. Response-Format validieren
3. Fallback nutzen
4. DeepSeek API-Dokumentation prüfen

## Referenzen

- [DeepSeek API Docs](https://api-docs.deepseek.com)
- [URLGuard AI README](./README.md)
- [LLM Adapter Pattern](./server/analyzers/llmAdapter.ts)
- [Enhanced DeepSeek Client](./server/analyzers/deepseekEnhanced.ts)
