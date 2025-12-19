import { Budget, Category } from './types';

export type AIModelId =
  | 'gemini-3-flash-preview'
  | 'gemini-flash-lite-latest';

export const AI_MODEL_STORAGE_KEY = 'lfi-ai-model';
export const AI_MODEL_TEMP_STORAGE_KEY = 'lfi-ai-model-temp';
export const AI_MODEL_THINKING_STORAGE_KEY = 'lfi-ai-model-thinking';
export const AI_BATCH_SIZE_STORAGE_KEY = 'lfi-ai-batch-size';
export const DEFAULT_AI_BATCH_SIZE = 50;

export const AI_MODEL_OPTIONS: {
  id: AIModelId;
  label: string;
  provider: 'google';
  modelName: string;
  description: string;
}[] = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini Flash',
    provider: 'google',
    modelName: 'gemini-3-flash-preview',
    description: 'Google Gemini 3 Flash – fast and efficient.',
  },
  {
    id: 'gemini-flash-lite-latest',
    label: 'Gemini Flash Lite (default)',
    provider: 'google',
    modelName: 'gemini-flash-lite-latest',
    description: 'Lightweight Gemini Flash option (default).',
  },
];

export const DEFAULT_AI_MODEL: AIModelId = 'gemini-flash-lite-latest';

export const SENSITIVE_COLUMNS = [
  'account number',
  'bsb',
  'name',
  'account',
  'card',
  'balance'
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-uncategorized', name: 'Uncategorized', color: '#a0aec0', icon: 'question', description: 'Transactions that could not be automatically categorized.' },
  { id: 'cat-groceries', name: 'Groceries', color: '#48bb78', icon: 'shoppingCart', description: 'Food at home, essentials. Can vary based on family size.' },
  { id: 'cat-transport', name: 'Transport', color: '#4299e1', icon: 'car', description: 'Fuel, car maintenance, public transport, ride share. High for people with long commutes.' },
  { id: 'cat-dining', name: 'Dining', color: '#ed8936', icon: 'dining', description: 'Eating out, takeaway, cafes. Easy category to overspend in.' },
  { id: 'cat-subscriptions', name: 'Subscriptions', color: '#9f7aea', icon: 'subscription', description: 'Streaming services, apps, memberships. Many people underestimate this category.' },
  { id: 'cat-income', name: 'Income', color: '#38b2ac', icon: 'income', description: 'Treated as total inflow, used for percentage calculations.' },
  { id: 'cat-shopping', name: 'Shopping', color: '#ed64a6', icon: 'shoppingBag', description: 'Clothing, household goods, personal items. Big variation.' },
  { id: 'cat-housing-utilities', name: 'Housing and Utilities', color: '#ecc94b', icon: 'home', description: 'Rent/mortgage, rates, electricity, gas, water. Aim for <30% where possible.' },
  { id: 'cat-education-childcare', name: 'Education and Childcare', color: '#718096', icon: 'education', description: 'School fees, daycare, extracurriculars. Some families spend much more depending on stage of life.' },
  { id: 'cat-savings-investments', name: 'Savings and Investments', color: '#2b6cb0', icon: 'savings', description: 'Emergency fund, investing, extra super, offset. Under the 50/30/20 rule, savings = 20%.' },
  { id: 'cat-health', name: 'Health', color: '#f56565', icon: 'health', description: 'GP visits, specialists, pharmacy, health insurance gap payments. Highly variable per person.' },
  { id: 'cat-entertainment', name: 'Entertainment', color: '#667eea', icon: 'entertainment', description: 'Movies, outings, hobbies, sports, events.' },
  { id: 'cat-alcohol', name: 'Alcohol', color: '#805AD5', icon: 'dining', description: 'Bars, bottle shops. ABS places alcohol & tobacco around ~3-4% of household spend.' },
];

export const DEFAULT_BUDGETS: Budget[] = [
  {
    id: 'budget-housing',
    categoryId: 'cat-housing-utilities',
    recommendedMinPercent: 25,
    recommendedMaxPercent: 35,
  },
  {
    id: 'budget-groceries',
    categoryId: 'cat-groceries',
    recommendedMinPercent: 10,
    recommendedMaxPercent: 15,
  },
  {
    id: 'budget-dining',
    categoryId: 'cat-dining',
    recommendedMinPercent: 3,
    recommendedMaxPercent: 8,
  },
  {
    id: 'budget-transport',
    categoryId: 'cat-transport',
    recommendedMinPercent: 10,
    recommendedMaxPercent: 15,
  },
  {
    id: 'budget-health',
    categoryId: 'cat-health',
    recommendedMinPercent: 3,
    recommendedMaxPercent: 6,
  },
  {
    id: 'budget-education',
    categoryId: 'cat-education-childcare',
    recommendedMinPercent: 0,
    recommendedMaxPercent: 10,
  },
  {
    id: 'budget-entertainment',
    categoryId: 'cat-entertainment',
    recommendedMinPercent: 2,
    recommendedMaxPercent: 5,
  },
  {
    id: 'budget-shopping',
    categoryId: 'cat-shopping',
    recommendedMinPercent: 3,
    recommendedMaxPercent: 10,
  },
  {
    id: 'budget-subscriptions',
    categoryId: 'cat-subscriptions',
    recommendedMinPercent: 1,
    recommendedMaxPercent: 3,
  },
  {
    id: 'budget-alcohol',
    categoryId: 'cat-alcohol',
    recommendedMinPercent: 1,
    recommendedMaxPercent: 3,
  },
  {
    id: 'budget-savings',
    categoryId: 'cat-savings-investments',
    recommendedMinPercent: 10,
    recommendedMaxPercent: 20,
  },
  {
    id: 'budget-income',
    categoryId: 'cat-income',
  }
];
