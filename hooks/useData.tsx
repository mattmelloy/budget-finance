import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { Transaction, Category, Rule, Budget } from '../types';
import { db } from '../services/database';
import { recategorizeUncategorizedTransactions } from '../services/categorizer';

interface DataContextProps {
  isLoading: boolean;
  initializationError: Error | null;
  transactions: Transaction[];
  addTransactions: (newTransactions: Transaction[]) => Promise<void>;
  updateTransaction: (updatedTransaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  categories: Category[];
  addCategory: (newCategory: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (updatedCategory: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  rules: Rule[];
  addRule: (newRule: Omit<Rule, 'id'>) => Promise<Rule>;
  updateRule: (updatedRule: Rule) => Promise<Rule>;
  deleteRule: (id: string) => Promise<void>;
  reorderRules: (ids: string[]) => Promise<void>;
  applyRuleToTransactions: (rule: Rule) => Promise<number>;
  resetAllData: () => Promise<void>;
  retryInitialization: () => void;
  ruleToEdit: Omit<Rule, 'id'> | null;
  setRuleToEdit: (rule: Omit<Rule, 'id'> | null) => void;
  exportAll: () => Promise<void>;
  importFromFile: (file: File) => Promise<void>;
  recategorizeUncategorizedWithAI: (onProgress?: (processed: number, total: number) => void) => Promise<number>;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<Error | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [ruleToEdit, setRuleToEdit] = useState<Omit<Rule, 'id'> | null>(null);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setInitializationError(null);
    try {
      await db.init();
      const [initialTransactions, initialCategories, initialRules, initialBudgets] = await Promise.all([
        db.getTransactions(),
        db.getCategories(),
        db.getRules(),
        db.getBudgets(),
      ]);
      setTransactions(initialTransactions);
      setCategories(initialCategories);
      setRules(initialRules);
      setBudgets(initialBudgets);
    } catch (error) {
      console.error("Failed to initialize database:", error);
      setInitializationError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const addTransactions = async (newTransactions: Transaction[]) => {
    await db.addTransactions(newTransactions);
    const updatedTransactions = await db.getTransactions();
    setTransactions(updatedTransactions);
  };

  const updateTransaction = async (updatedTransaction: Transaction) => {
    await db.updateTransaction(updatedTransaction);
    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
  };
  
  const deleteTransaction = async (id: string) => {
    await db.deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const addCategory = async (newCategory: Omit<Category, 'id'>) => {
    const category: Category = { ...newCategory, id: `cat-${Date.now()}`};
    await db.addCategory(category);
    setCategories(prev => [...prev, category]);
  };

  const updateCategory = async (updatedCategory: Category) => {
    await db.updateCategory(updatedCategory);
    setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c));
  };

  const deleteCategory = async (id: string) => {
    await db.deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
    // Also update transactions in state
    const updatedTransactions = await db.getTransactions();
    setTransactions(updatedTransactions);
  };

  const addRule = async (newRule: Omit<Rule, 'id'>): Promise<Rule> => {
    const rule: Rule = { ...newRule, id: `rule-${Date.now()}`};
    await db.addRule(rule);
    // Refresh rules from DB so we get authoritative ordering
    const updatedRules = await db.getRules();
    setRules(updatedRules);
    return rule;
  };

  const updateRule = async (updatedRule: Rule): Promise<Rule> => {
    await db.updateRule(updatedRule);
    // Refresh rules to pick up any ordering changes
    const updatedRules = await db.getRules();
    setRules(updatedRules);
    return updatedRule;
  };

  const deleteRule = async (id: string) => {
    await db.deleteRule(id);
    const updatedRules = await db.getRules();
    setRules(updatedRules);
  };

  const reorderRules = async (ids: string[]) => {
    await db.reorderRules(ids);
    const updatedRules = await db.getRules();
    setRules(updatedRules);
  };

  const applyRuleToTransactions = async (rule: Rule): Promise<number> => {
    const count = await db.applyRule(rule);

    if (count > 0) {
      // Refresh the local state to reflect DB changes
      const allTransactions = await db.getTransactions();
      setTransactions(allTransactions);
    }

    return count;
  };

  const resetAllData = async () => {
    if (window.confirm('Are you sure you want to erase ALL your data, including transactions, categories, and rules? This action cannot be undone.')) {
      await db.clearAllData();
      await initialize(); // Re-initialize with fresh default data
    }
  };

  const exportAll = async (): Promise<void> => {
    try {
      const data = await db.exportData();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `lfi-export-${safeTimestamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
      throw e;
    }
  };

  const importFromFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid import file. Expected JSON with categories, rules, and transactions.');
      }

      await db.importData(payload);
      await initialize(); // Refresh state from imported DB
    } catch (e) {
      console.error('Import failed', e);
      throw e;
    }
  };

  const recategorizeUncategorizedWithAI = async (
    onProgress?: (processed: number, total: number) => void
  ): Promise<number> => {
    // Work from the authoritative DB view to avoid stale state
    const allTransactions = await db.getTransactions();
    const uncategorized = allTransactions.filter(
      t => !t.categoryId || t.categoryId === 'cat-uncategorized'
    );

    if (uncategorized.length === 0) return 0;

    const updated = await recategorizeUncategorizedTransactions(
      uncategorized,
      rules,
      categories,
      onProgress
    );

    // Persist only the updated subset
    await db.batchUpdateTransactions(updated);

    // Refresh state from DB so all views see the new categories
    const refreshed = await db.getTransactions();
    setTransactions(refreshed);

    return updated.length;
  };

  const addBudget = async (newBudget: Omit<Budget, 'id'>) => {
    const budget: Budget = { ...newBudget, id: `bud-${Date.now()}` };
    await db.addBudget(budget);
    setBudgets(prev => [...prev, budget]);
  };

  const updateBudget = async (updatedBudget: Budget) => {
    await db.updateBudget(updatedBudget);
    setBudgets(prev => prev.map(b => b.id === updatedBudget.id ? updatedBudget : b));
  };

  const deleteBudget = async (id: string) => {
    await db.deleteBudget(id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  const value = {
    isLoading,
    initializationError,
    transactions,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    rules,
    budgets,
    addBudget,
    updateBudget,
    deleteBudget,
    addRule,
    updateRule,
    deleteRule,
    reorderRules,
    applyRuleToTransactions,
    resetAllData,
    retryInitialization: initialize,
    ruleToEdit,
    setRuleToEdit,
    exportAll,
    importFromFile,
    recategorizeUncategorizedWithAI,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
