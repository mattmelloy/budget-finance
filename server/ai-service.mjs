import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

import { GoogleGenAI, Type } from '@google/genai';

const PORT = Number(process.env.AI_SERVICE_PORT || 8787);

const DEFAULT_PROVIDER = process.env.AI_PROVIDER || 'google';
const DEFAULT_MODEL = process.env.AI_MODEL || 'gemini-flash-lite-latest';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    // Basic hardening
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      // basic protection against accidentally huge payloads
      if (data.length > 2_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function generateWithGemini(modelName, prompt, enableThinking, temperature) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  // Use the requested model, do not swap.
  const finalModel = modelName;

  // If thinking is enabled, we disable strict JSON schema to allow reasoning text.
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
  // 1. Try to find markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }
  // 2. Try to find array-like structure if strictly no code block but mixed text
  const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }
  // 3. Fallback: return whole text (assumes strict JSON mode was used)
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const origin = req.headers.origin;

    // Basic CORS
    if (origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/categorize') {
      const bodyRaw = await readBody(req);
      const parsed = JSON.parse(bodyRaw || '{}');

      if (!parsed || !Array.isArray(parsed.batch) || !Array.isArray(parsed.categories)) {
        sendJson(res, 400, { error: 'Invalid request body' });
        return;
      }

      const modelName = parsed.modelName || DEFAULT_MODEL;
      const enableThinking = !!parsed.enableThinking;
      const temperature = parsed.temperature; // Optional

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

      sendJson(res, 200, response);
      return;
    }

    // Handle static files for anything else (Single Server Mode)
    let filePath = path.join(DIST_PATH, url.pathname === '/' ? 'index.html' : url.pathname);
    
    // Safety check: ensure file is within DIST_PATH
    if (!filePath.startsWith(DIST_PATH)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      
      const content = await fs.promises.readFile(filePath);
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(content);
    } catch (err) {
      // Fallback to index.html for SPA routing if file not found
      if (err.code === 'ENOENT') {
        try {
          const indexContent = await fs.promises.readFile(path.join(DIST_PATH, 'index.html'));
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(indexContent);
        } catch (indexErr) {
          sendJson(res, 404, { error: 'Not found and dist/index.html missing. Run npm run build first.' });
        }
      } else {
        throw err;
      }
    }
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  // Intentionally do not log secrets
  console.log(`[ai-service] listening on http://0.0.0.0:${PORT}`);
});
