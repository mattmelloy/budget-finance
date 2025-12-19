import { GoogleGenAI, Type } from '@google/genai';

const DEFAULT_MODEL = process.env.AI_MODEL || 'gemini-flash-lite-latest';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generateWithGemini(modelName, prompt, enableThinking, temperature) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const finalModel = modelName;

  const config = enableThinking
    ? {}
    : {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.NUMBER },
              categoryId: { type: Type.STRING },
            },
            required: ['index', 'categoryId'],
          },
        },
      };

  if (typeof temperature === 'number') {
    config.temperature = temperature;
  }

  const response = await client.models.generateContent({
    model: finalModel,
    contents: prompt,
    config,
  });

  const jsonStr = (response.text || '').trim();
  const usage = response.usageMetadata || {};

  return {
    text: jsonStr,
    usage: {
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
    },
  };
}

function buildPrompt(batch, categories, enableThinking) {
  const availableCategories = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const transactionsToCategorize = batch
    .map(
      (t) => `{ "index": ${t.index}, "description": "${t.description.replace(/"/g, '\\"')}" }`,
    )
    .join(',\n');

  const outputInstructions = enableThinking
    ? `
### OUTPUT FORMAT:
1. First, you MAY briefly reason about the transactions and categories to ensure accuracy.
2. Then, output the final result as a JSON array inside a markdown code block (e.g. \`\`\`json [ ... ] \`\`\`).
The JSON array must contain objects with "index" and "categoryId".
If no category is a good fit, assign "cat-uncategorized".
`
    : `
### OUTPUT FORMAT:
Return a strictly valid single JSON array where each object contains the original "index" and the single most appropriate "categoryId" from the list provided. Do not output markdown code blocks.
If no category is a good fit, assign "cat-uncategorized". Do not return any other text or explanation.
`;

  return `
You are an expert financial analyst. Your goal is to categorize bank transactions accurately for a personal budget.

### INSTRUCTIONS:
1. Analyze the 'description' to identify the MERCHANT name (e.g., "Woolworths", "Uber", "Netflix"). Ignore random numbers, dates, or location codes (e.g., ignore "NSW 2000", "POS 5543").
2. Match the merchant/purpose to the most appropriate 'categoryId' from the list below.
3. CRITICAL: Only assign a category if you are confident it is correct.
4. If the description is vague, ambiguous, or you are unsure, you MUST assign "cat-uncategorized".
5. It is better to leave an item uncategorized than to guess incorrectly.

### CATEGORY LIST:
${availableCategories}

### EXAMPLES (Learn from these):
Input: "APPLE.COM/BILL SYDNEY" -> Merchant: "Apple Services" -> Category: "Entertainment"
Input: "SHELL COLES EXP 3342" -> Merchant: "Shell / Coles Express" -> Category: "Transport"
Input: "AMZN MKTPLC PAYMENT" -> Merchant: "Amazon" -> Category: "Shopping"
Input: "TFL TRAVEL CHG" -> Merchant: "Transport for London" -> Category: "Transport"
Input: "MCDONALDS 442" -> Merchant: "McDonalds" -> Category: "Dining"
Input: "L/LAND QLD 2242 - Visa Purchase - Receipt" -> Merchant: "L/LAND" -> Category: "Alcohol"

### TRANSACTIONS TO CATEGORIZE:
[
  ${transactionsToCategorize}
]

${outputInstructions}
`;
}

function extractJson(text) {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }
  const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }
  return text;
}

function validateAndFilterResults(raw, categories) {
  const allowed = new Set(categories.map((c) => c.id));
  if (!Array.isArray(raw)) return [];

  const out = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof item.index === 'number' &&
      typeof item.categoryId === 'string' &&
      allowed.has(item.categoryId)
    ) {
      out.push({ index: item.index, categoryId: item.categoryId });
    }
  }
  return out;
}

export default async function handler(req, res) {
  // Basic CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const parsed = req.body;

    if (!parsed || !Array.isArray(parsed.batch) || !Array.isArray(parsed.categories)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const modelName = parsed.modelName || DEFAULT_MODEL;
    const enableThinking = !!parsed.enableThinking;
    const temperature = parsed.temperature;

    const prompt = buildPrompt(parsed.batch, parsed.categories, enableThinking);
    const sdkResponse = await generateWithGemini(modelName, prompt, enableThinking, temperature);

    const cleanJson = extractJson(sdkResponse.text);
    const decoded = JSON.parse(cleanJson);
    const results = validateAndFilterResults(decoded, parsed.categories);

    const response = {
      results,
      usage: sdkResponse.usage,
      modelName: parsed.modelName,
      enableThinking,
      temperature,
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('AI Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
