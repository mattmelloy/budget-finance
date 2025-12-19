import { Transaction, ParsedTransaction, Rule, Category } from '../types';
import { getCategoryBatchFromAIService, type AICategorizationLog, type AIConfigOverrides } from './aiClient';
import { AI_BATCH_SIZE_STORAGE_KEY, DEFAULT_AI_BATCH_SIZE } from '../constants';

export type { AICategorizationLog };

// Keep debug logs available in dev, but never log secrets.
const DEBUG_LOGGING_ENABLED = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  (typeof process !== 'undefined' && (process as any).env?.NODE_ENV === 'development');

// Helper function to get batch size from localStorage with fallback to default
const getBatchSize = (): number => {
  if (typeof window === 'undefined') return DEFAULT_AI_BATCH_SIZE;
  try {
    const stored = window.localStorage.getItem(AI_BATCH_SIZE_STORAGE_KEY);
    const parsed = parseInt(stored || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_BATCH_SIZE;
  } catch {
    return DEFAULT_AI_BATCH_SIZE;
  }
};

/**
 * AI-powered batch categorization.
 *
 * SECURITY NOTE: This intentionally calls a local backend service so that AI API keys
 * never enter the browser bundle.
 */
const getCategoryBatchFromAI = async (
  batch: { description: string; index: number }[],
  categories: Category[],
  onDebugLog?: (log: AICategorizationLog) => void,
  overrides?: AIConfigOverrides
): Promise<Map<number, string>> => {
  return getCategoryBatchFromAIService(batch, categories, onDebugLog, overrides);
};

export const categorizeTransactions = async (
  parsedTransactions: ParsedTransaction[],
  rules: Rule[],
  categories: Category[],
  onProgress?: (processed: number, total: number) => void,
  onDebugLog?: (log: AICategorizationLog) => void
): Promise<Transaction[]> => {
  const categoryNameToIdMap = new Map<string, string>();
  categories.forEach(c => categoryNameToIdMap.set(c.name.toLowerCase(), c.id));
  
  const finalTransactions = new Array<Transaction>(parsedTransactions.length);
  const transactionsForAI: (ParsedTransaction & { originalIndex: number })[] = [];
  const batchSize = getBatchSize();

  // 1. First pass: Apply user-defined rules (highest priority)
  parsedTransactions.forEach((pt, index) => {
    let categoryId: string | null = null;
    let categorizedByRule = false;
    const descriptionLower = pt.description.toLowerCase();

    for (const rule of rules) {
      const valueLower = rule.conditionValue.toLowerCase();
      let match = false;
      switch (rule.conditionType) {
        case 'contains': if (descriptionLower.includes(valueLower)) match = true; break;
        case 'startsWith': if (descriptionLower.startsWith(valueLower)) match = true; break;
        case 'equals': if (descriptionLower === valueLower) match = true; break;
      }
      if (match) {
        categoryId = rule.categoryId;
        categorizedByRule = true;
        break; 
      }
    }

    if (categorizedByRule) {
      finalTransactions[index] = {
        id: `txn-${Date.now()}-${index}`,
        ...pt,
        categoryId: categoryId || 'cat-uncategorized',
        categorizedByRule: true,
        categorizedByAI: false,
      };
    } else {
      transactionsForAI.push({ ...pt, originalIndex: index });
    }
  });

  let processedCount = parsedTransactions.length - transactionsForAI.length;
  if (onProgress) onProgress(processedCount, parsedTransactions.length);

  // 2. Second pass: Batch process remaining transactions with AI
  const totalBatches = Math.ceil(transactionsForAI.length / batchSize);
  let currentBatch = 0;

  for (let i = 0; i < transactionsForAI.length; i += batchSize) {
    currentBatch++;
    const batch = transactionsForAI.slice(i, i + batchSize);
    const batchForPrompt = batch.map(t => ({ description: t.description, index: t.originalIndex }));

    if (DEBUG_LOGGING_ENABLED) {
      onDebugLog?.({
        timestamp: new Date(),
        type: 'info',
        message: `Starting batch ${currentBatch}/${totalBatches} with ${batch.length} transactions`,
        details: { batchNumber: currentBatch, totalBatches, batchSize: batch.length }
      });
    }

    // Hardcoded for Bulk Upload: Gemini Flash Lite, Temp 0, No Thinking
    const aiResults = await getCategoryBatchFromAI(batchForPrompt, categories, onDebugLog, {
      modelId: 'gemini-flash-lite-latest',
      temperature: 0,
      enableThinking: false
    });

    batch.forEach(t => {
      let categoryId = aiResults.get(t.originalIndex) || null;
      let categorizedByAI = !!categoryId;

      // 3. Heuristic for income if still uncategorized by AI
      if (!categoryId && t.amount > 0) {
        const incomeCategoryId = categoryNameToIdMap.get('income');
        if (incomeCategoryId) categoryId = incomeCategoryId;
      }
      
      finalTransactions[t.originalIndex] = {
        id: `txn-${Date.now()}-${t.originalIndex}`,
        ...t,
        categoryId: categoryId || 'cat-uncategorized',
        categorizedByRule: false,
        categorizedByAI,
      };
    });

    processedCount += batch.length;
    if (onProgress) onProgress(processedCount, parsedTransactions.length);
  }

  return finalTransactions;
};

/**
 * Re-categorize a set of EXISTING transactions that are currently uncategorized.
 * - Keeps existing transaction IDs and dates intact.
 * - Re-applies rules first, then AI (with same batching logic).
 */
export const recategorizeUncategorizedTransactions = async (
  uncategorized: Transaction[],
  rules: Rule[],
  categories: Category[],
  onProgress?: (processed: number, total: number) => void
): Promise<Transaction[]> => {
  const categoryNameToIdMap = new Map<string, string>();
  categories.forEach(c => categoryNameToIdMap.set(c.name.toLowerCase(), c.id));

  const total = uncategorized.length;
  const updated: Transaction[] = new Array(uncategorized.length);
  const toSendToAI: { tx: Transaction; index: number }[] = [];
  const batchSize = getBatchSize();

  // 1. Apply rules again to see if any now match
  uncategorized.forEach((tx, index) => {
    let categoryId: string | null = null;
    let categorizedByRule = false;
    const descriptionLower = tx.description.toLowerCase();

    for (const rule of rules) {
      const valueLower = rule.conditionValue.toLowerCase();
      let match = false;
      switch (rule.conditionType) {
        case 'contains':
          if (descriptionLower.includes(valueLower)) match = true;
          break;
        case 'startsWith':
          if (descriptionLower.startsWith(valueLower)) match = true;
          break;
        case 'equals':
          if (descriptionLower === valueLower) match = true;
          break;
      }
      if (match) {
        categoryId = rule.categoryId;
        categorizedByRule = true;
        break;
      }
    }

    if (categorizedByRule) {
      updated[index] = {
        ...tx,
        categoryId: categoryId || 'cat-uncategorized',
        categorizedByRule: true,
        categorizedByAI: false,
      };
    } else {
      toSendToAI.push({ tx, index });
    }
  });

  let processedCount = total - toSendToAI.length;
  if (onProgress) onProgress(processedCount, total);

  // 2. Batch remaining transactions through AI
  for (let i = 0; i < toSendToAI.length; i += batchSize) {
    const batch = toSendToAI.slice(i, i + batchSize);
    const batchForPrompt = batch.map(({ tx, index }) => ({
      description: tx.description,
      index,
    }));
    
    // Hardcoded for Re-categorisation: Gemini 3 Flash Preview, Temp 0.5, Thinking Enabled
    const aiResults = await getCategoryBatchFromAI(batchForPrompt, categories, undefined, {
      modelId: 'gemini-3-flash-preview',
      temperature: 0.5,
      enableThinking: true
    });

    batch.forEach(({ tx, index }) => {
      let categoryId = aiResults.get(index) || null;
      let categorizedByAI = !!categoryId;

      // Heuristic for income if still uncategorized by AI
      if (!categoryId && tx.amount > 0) {
        const incomeCategoryId = categoryNameToIdMap.get('income');
        if (incomeCategoryId) categoryId = incomeCategoryId;
      }

      updated[index] = {
        ...tx,
        categoryId: categoryId || 'cat-uncategorized',
        categorizedByRule: false,
        categorizedByAI,
      };
    });

    processedCount += batch.length;
    if (onProgress) onProgress(processedCount, total);
  }

  // For safety, fill any untouched slots with original tx
  uncategorized.forEach((tx, index) => {
    if (!updated[index]) {
      updated[index] = tx;
    }
  });

  return updated;
};
