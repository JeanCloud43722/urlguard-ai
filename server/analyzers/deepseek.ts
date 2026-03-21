import { ENV } from "../_core/env";

export interface DeepSeekAnalysisResult {
  riskScore: number; // 0-100
  riskLevel: "safe" | "suspicious" | "dangerous";
  analysis: string;
  phishingIndicators: string[];
  confidence: number;
}

/**
 * Analyze URL for phishing indicators using DeepSeek API
 */
export async function analyzeURLWithDeepSeek(url: string): Promise<DeepSeekAnalysisResult> {
  if (!ENV.deepseekApiKey) {
    throw new Error("DeepSeek API key not configured");
  }

  const prompt = `Analyze this URL for phishing and security risks: ${url}

Provide a JSON response with:
{
  "riskScore": <0-100>,
  "riskLevel": "<safe|suspicious|dangerous>",
  "analysis": "<brief explanation>",
  "phishingIndicators": [<list of detected indicators>],
  "confidence": <0-1>
}

Consider:
- Domain similarity to known brands
- Suspicious subdomains
- URL structure and encoding
- Common phishing patterns
- SSL certificate indicators (if available)
- Affiliate/redirect patterns`;

  try {
    const response = await fetch(`${ENV.deepseekApiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a security expert analyzing URLs for phishing threats. Always respond with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from DeepSeek API");
    }

    // Parse JSON response
    const parsed = JSON.parse(content);

    return {
      riskScore: Math.min(100, Math.max(0, parsed.riskScore || 0)),
      riskLevel: parsed.riskLevel || "suspicious",
      analysis: parsed.analysis || "Unable to analyze URL",
      phishingIndicators: parsed.phishingIndicators || [],
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    };
  } catch (error) {
    console.error("DeepSeek analysis error:", error);
    throw error;
  }
}

/**
 * Batch analyze multiple URLs with rate limiting
 */
export async function analyzeURLsBatch(
  urls: string[],
  delayMs = 500
): Promise<Map<string, DeepSeekAnalysisResult>> {
  const results = new Map<string, DeepSeekAnalysisResult>();

  for (const url of urls) {
    try {
      const result = await analyzeURLWithDeepSeek(url);
      results.set(url, result);
      // Rate limiting between requests
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      console.error(`Failed to analyze ${url}:`, error);
      results.set(url, {
        riskScore: 50,
        riskLevel: "suspicious",
        analysis: `Error analyzing URL: ${(error as Error).message}`,
        phishingIndicators: ["Analysis failed"],
        confidence: 0,
      });
    }
  }

  return results;
}
