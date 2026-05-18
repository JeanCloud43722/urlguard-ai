import axios from "axios";

export async function detectFraudWithDeepSeek(
  url: string,
  heuristicIndicators: string[]
): Promise<any> {
  try {
    const { buildFraudPrompt, FRAUD_SYSTEM_PROMPT } = await import(
      "../analyzers/fraudPrompt"
    );
    const prompt = buildFraudPrompt(url, heuristicIndicators.slice(0, 3));

    const deepseekApiUrl = process.env.DEEPSEEK_API_URL;
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

    if (!deepseekApiUrl || !deepseekApiKey) {
      console.warn("[FraudDetector] DeepSeek API credentials missing");
      return null;
    }

    console.log("[FraudDetector] Starte DeepSeek-Anfrage für:", url);

    const response = await axios.post(
      `${deepseekApiUrl}/chat/completions`,
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: FRAUD_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
      },
      {
        headers: { Authorization: `Bearer ${deepseekApiKey}` },
        timeout: 5000,
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) throw new Error("Leere Antwort von DeepSeek");

    const result = JSON.parse(content);
    console.log("[FraudDetector] ✅ Ergebnis:", {
      fraud_score: result.fraud_score,
      risk_level: result.risk_level,
    });

    return result;
  } catch (err) {
    console.error(
      "[FraudDetector] ❌ Fehler:",
      (err as Error).message
    );
    return null;
  }
}
