import Tesseract from 'tesseract.js';

/**
 * OCR Extraction Module
 * Handles text extraction from website screenshots using Tesseract.js
 */

export interface OCROptions {
  imageBuffer: Buffer;
  languages?: string[];
  timeout?: number;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  processingTime: number;
  blocks: OCRBlock[];
}

/**
 * Extract text from image buffer using Tesseract.js
 * Supports multiple languages with configurable timeout
 */
export async function extractTextFromImage(
  options: OCROptions
): Promise<OCRResult> {
  const startTime = Date.now();
  const languages = options.languages || ['eng', 'deu', 'fra', 'spa'];
  const timeout = options.timeout || 15000;

  let worker: any = null;

  try {
    // Create worker instance
    worker = await Tesseract.createWorker();

    // Initialize worker with languages
    try {
      await (worker as any).load();
    } catch (e) {
      // load() might not exist, continue
    }
    await (worker as any).loadLanguage(languages.join('+'));
    await (worker as any).initialize(languages.join('+'));

    // Set timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('OCR timeout exceeded')), timeout)
    );

    // Perform recognition with timeout
    const result = await Promise.race([
      worker.recognize(options.imageBuffer),
      timeoutPromise,
    ]);

    const processingTime = Date.now() - startTime;
    const data = result.data;

    // Extract blocks with confidence
    const blocks: OCRBlock[] = [];
    if (data.text) {
      // Split text into lines for blocks
      const lines = data.text.split('\n').filter((l: string) => l.trim());
      lines.forEach((line: string) => {
        blocks.push({
          text: line,
          confidence: Math.min(data.confidence / 100, 1),
        });
      });
    }

    return {
      text: data.text || '',
      confidence: Math.min(data.confidence / 100, 1),
      language: languages[0],
      processingTime,
      blocks,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('OCR extraction failed:', error);

    // Return empty result on error instead of throwing
    return {
      text: '',
      confidence: 0,
      language: 'unknown',
      processingTime,
      blocks: [],
    };
  } finally {
    // Always terminate worker
    if (worker) {
      try {
        await (worker as any).terminate();
      } catch (e) {
        console.error('Failed to terminate OCR worker:', e);
      }
    }
  }
}

/**
 * Normalize and clean extracted OCR text
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Limit to 5000 characters
 */
export function normalizeOCRText(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s@.,-]/g, '') // Remove special chars except common ones
    .trim()
    .substring(0, 5000);
}

/**
 * Extract high-confidence text blocks
 * Filters blocks by confidence threshold
 */
export function extractHighConfidenceText(
  blocks: OCRBlock[],
  minConfidence: number = 0.7
): string {
  return blocks
    .filter((block) => block.confidence >= minConfidence)
    .map((block) => block.text)
    .join(' ')
    .trim();
}

/**
 * Detect dominant language from OCR result
 * Returns language code (eng, deu, fra, spa, etc.)
 */
export function detectLanguage(result: OCRResult): string {
  // Simple heuristic: check for common words in different languages
  const text = result.text.toLowerCase();

  const languageKeywords: Record<string, string[]> = {
    eng: ['the', 'and', 'to', 'of', 'a', 'is', 'in'],
    deu: ['der', 'die', 'und', 'in', 'den', 'von', 'zu'],
    fra: ['le', 'de', 'et', 'la', 'les', 'un', 'une'],
    spa: ['el', 'de', 'y', 'la', 'en', 'un', 'una'],
  };

  let maxMatches = 0;
  let detectedLanguage = 'eng';

  for (const [lang, keywords] of Object.entries(languageKeywords)) {
    const matches = keywords.filter((kw) => text.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedLanguage = lang;
    }
  }

  return detectedLanguage;
}

/**
 * Calculate OCR quality score (0-1)
 * Based on confidence, text length, and block count
 */
export function calculateOCRQuality(result: OCRResult): number {
  const confidenceScore = result.confidence;
  const textLengthScore = Math.min(result.text.length / 500, 1);
  const blockCountScore = Math.min(result.blocks.length / 10, 1);

  return (confidenceScore + textLengthScore + blockCountScore) / 3;
}
