// FIX: Moved ParsedTransaction definition here to break a circular dependency
// with services/parser.ts. This resolves the import errors.
export interface ParsedTransaction {
  date: string; // ISO string (parsed)
  rawDate?: string; // original raw date string from the file
  description: string;
  amount: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  categoryId: string | null;
  notes?: string;
  categorizedByRule?: boolean;
  categorizedByAI?: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string; // Icon name from Icon component
  description?: string;
}

export type RuleConditionType = 'contains' | 'startsWith' | 'equals';

export interface Rule {
  id: string;
  conditionType: RuleConditionType;
  conditionValue: string;
  categoryId: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  recommendedMinPercent?: number | null;
  recommendedMaxPercent?: number | null;
  notes?: string;
  customPercent?: number | null;
  description?: string;
  updatedAt?: string;
}
