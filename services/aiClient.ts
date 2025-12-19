import type { Category } from '../types';
import type { AIModelId } from '../constants';
import {
  AI_MODEL_OPTIONS,
  DEFAULT_AI_MODEL,
  AI_MODEL_THINKING_STORAGE_KEY,
  AI_MODEL_TEMP_STORAGE_KEY,
} from '../constants';

export interface AICategorizationLog {
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'debug';
  message: string;
  details?: any;
}

interface CategorizeBatchResponse {
  results: { index: number; categoryId: string }[];
  usage?: { inputTokens: number; outputTokens: number };
  modelName?: string;
  enableThinking?: boolean;
  temperature?: number;
}

export interface AIConfigOverrides {
  modelId?: AIModelId;
  enableThinking?: boolean;
  temperature?: number;
}

const getSelectedModelConfig = (overrideId?: AIModelId) => {
  if (overrideId) {
     const found = AI_MODEL_OPTIONS.find((o) => o.id === overrideId);
     if (found) return found;
  }
  // Keep existing behaviour: read from localStorage if available
  let id: AIModelId = DEFAULT_AI_MODEL;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('lfi-ai-model') as AIModelId | null;
    if (stored && AI_MODEL_OPTIONS.some((o) => o.id === stored)) {
      id = stored;
    }
  }
  return AI_MODEL_OPTIONS.find((o) => o.id === id)!;
};

export async function getCategoryBatchFromAIService(
  batch: { description: string; index: number }[],
  categories: Category[],
  onDebugLog?: (log: AICategorizationLog) => void,
  overrides?: AIConfigOverrides,
): Promise<Map<number, string>> {
  const modelConfig = getSelectedModelConfig(overrides?.modelId);

  // Determine thinking setting (override -> localStorage -> default false)
  let enableThinking = false;
  if (overrides && typeof overrides.enableThinking === 'boolean') {
    enableThinking = overrides.enableThinking;
  } else if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(AI_MODEL_THINKING_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      enableThinking = !!parsed[modelConfig.id];
    } catch {}
  }

  // Determine temperature setting (override -> localStorage -> undefined)
  let temperature: number | undefined;
  if (overrides && typeof overrides.temperature === 'number') {
    temperature = overrides.temperature;
  } else if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(AI_MODEL_TEMP_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      const val = parsed[modelConfig.id];
      if (typeof val === 'number') temperature = val;
    } catch {}
  }

  const startTime = Date.now();
  onDebugLog?.({
    timestamp: new Date(),
    type: 'info',
    message: `Requesting AI categorization via local service (${modelConfig.label})${enableThinking ? ' [Thinking Enabled]' : ''}`,
    details: {
      provider: modelConfig.provider,
      model: modelConfig.modelName,
      batchSize: batch.length,
      enableThinking,
      temperature,
    },
  });

  const resp = await fetch('/api/ai/categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: modelConfig.provider,
      modelName: modelConfig.modelName,
      enableThinking,
      temperature,
      batch,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    onDebugLog?.({
      timestamp: new Date(),
      type: 'error',
      message: `AI service error: HTTP ${resp.status}`,
      details: text,
    });
    return new Map();
  }

  const data = (await resp.json()) as CategorizeBatchResponse;
  const resultMap = new Map<number, string>();

  for (const item of data.results || []) {
    if (typeof item.index === 'number' && typeof item.categoryId === 'string') {
      resultMap.set(item.index, item.categoryId);
    }
  }

  onDebugLog?.({
    timestamp: new Date(),
    type: 'success',
    message: `AI service categorized ${resultMap.size}/${batch.length} in ${Date.now() - startTime}ms`,
    details: {
      categorizedCount: resultMap.size,
      totalRequested: batch.length,
      inputTokens: data.usage?.inputTokens || 0,
      outputTokens: data.usage?.outputTokens || 0,
      serverModelName: data.modelName,
      serverEnableThinking: data.enableThinking,
      serverTemperature: data.temperature,
    },
  });

  return resultMap;
}
