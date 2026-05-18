import { ENV } from "../_core/env";

export async function detectFraudWithDeepSeek(
  url: string,
  heuristicIndicators: string[]
): Promise<any> {
  console.log("[FraudDetector] 🚀 Starte DeepSeek-Anfrage für:", url);

  try {
    // Load prompt builder
    const { buildFraudPrompt, FRAUD_SYSTEM_PROMPT } = await import(
      "../analyzers/fraudPrompt"
    );
    const prompt = buildFraudPrompt(url, heuristicIndicators.slice(0, 3));

    // Get API credentials
    const deepseekApiUrl = ENV.deepseekApiUrl;
    const deepseekApiKey = ENV.deepseekApiKey;

    if (!deepseekApiUrl || !deepseekApiKey) {
      console.error("[FraudDetector] ❌ DeepSeek API credentials missing");
      return null;
    }

    console.log("[FraudDetector] 📝 Prompt-Länge:", prompt.length, "Zeichen");

    // Prepare request body
    const requestBody = {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: FRAUD_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
    };

    console.log("[FraudDetector] 🌐 Sende Anfrage an:", deepseekApiUrl);

    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("[FraudDetector] ⏱️ Timeout nach 10s");
      controller.abort();
    }, 10000); // 10 second timeout

    try {
      const response = await fetch(`${deepseekApiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deepseekApiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[FraudDetector] ❌ API-Fehler:",
          response.status,
          errorText
        );
        return null;
      }

      const data = await response.json();
      console.log("[FraudDetector] ✅ Antwort erhalten");

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error("[FraudDetector] ❌ Leere Antwort von DeepSeek");
        return null;
      }

      console.log("[FraudDetector] 📦 Parsing JSON...");
      const result = JSON.parse(content);

      console.log("[FraudDetector] ✅ Ergebnis:", {
        fraud_score: result.fraud_score,
        risk_level: result.risk_level,
        reasons: result.reasons?.slice(0, 2),
      });

      return result;
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        console.error("[FraudDetector] ❌ Request-Timeout");
      } else {
        console.error("[FraudDetector] ❌ Netzwerkfehler:", (fetchErr as Error).message);
      }
      return null;
    }
  } catch (err) {
    console.error("[FraudDetector] ❌ Kritischer Fehler:", (err as Error).message);
    return null;
  }
}
