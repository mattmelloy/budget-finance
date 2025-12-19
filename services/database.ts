import { Transaction, Category, Rule, Budget } from '../types';
import { DEFAULT_BUDGETS, DEFAULT_CATEGORIES } from '../constants';

const DB_NAME = 'local-finance-insights';
const DB_VERSION = 2;

// Store names
const STORES = {
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  RULES: 'rules',
  BUDGETS: 'budgets',
} as const;

let dbInstance: IDBDatabase | null = null;

/**
 * Open and initialize the IndexedDB database
 */
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create transactions store
      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const transactionStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
        transactionStore.createIndex('date', 'date', { unique: false });
        transactionStore.createIndex('categoryId', 'categoryId', { unique: false });
      }

      // Create categories store
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      }

      // Create rules store
      if (!db.objectStoreNames.contains(STORES.RULES)) {
        const rulesStore = db.createObjectStore(STORES.RULES, { keyPath: 'id' });
        rulesStore.createIndex('order', 'order', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.BUDGETS)) {
        db.createObjectStore(STORES.BUDGETS, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Helper to get a transaction for read/write operations
 */
const getTransaction = async (
  storeNames: string | string[],
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBTransaction> => {
  const db = await openDatabase();
  return db.transaction(storeNames, mode);
};

/**
 * Helper to promisify IDBRequest
 */
const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Helper to get all records from a store
 */
const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
  const transaction = await getTransaction(storeName);
  const store = transaction.objectStore(storeName);
  return promisifyRequest(store.getAll());
};

/**
 * Helper to add a record to a store
 */
const addToStore = async <T>(storeName: string, record: T): Promise<void> => {
  const transaction = await getTransaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  await promisifyRequest(store.add(record));
};

/**
 * Helper to put (update or insert) a record in a store
 */
const putToStore = async <T>(storeName: string, record: T): Promise<void> => {
  const transaction = await getTransaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  await promisifyRequest(store.put(record));
};

/**
 * Helper to delete a record from a store
 */
const deleteFromStore = async (storeName: string, id: string): Promise<void> => {
  const transaction = await getTransaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  await promisifyRequest(store.delete(id));
};

/**
 * Helper to clear all records from a store
 */
const clearStore = async (storeName: string): Promise<void> => {
  const transaction = await getTransaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  await promisifyRequest(store.clear());
};

/**
 * Initialize default categories if the categories store is empty
 */
const initializeDefaultCategories = async (): Promise<void> => {
  const categories = await getAllFromStore<Category>(STORES.CATEGORIES);
  if (categories.length === 0) {
    const transaction = await getTransaction(STORES.CATEGORIES, 'readwrite');
    const store = transaction.objectStore(STORES.CATEGORIES);
    for (const category of DEFAULT_CATEGORIES) {
      store.add(category);
    }
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
};

/**
 * Initialize default budgets if budget store is empty
 */
const initializeDefaultBudgets = async (): Promise<void> => {
  const budgets = await getAllFromStore<Budget>(STORES.BUDGETS);
  if (budgets.length === 0) {
    const transaction = await getTransaction(STORES.BUDGETS, 'readwrite');
    const store = transaction.objectStore(STORES.BUDGETS);
    for (const budget of DEFAULT_BUDGETS) {
      store.add({
        ...budget,
        customPercent: budget.customPercent ?? null,
        updatedAt: new Date().toISOString(),
      });
    }
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
};

export const db = {
  /**
   * Initialize the database and seed default data
   */
  init: async (): Promise<void> => {
    await openDatabase();
    await initializeDefaultCategories();
    await initializeDefaultBudgets();
  },

  /**
   * Reset the database - clears all transactions only (preserves categories and rules)
   */
  resetDatabase: async (): Promise<void> => {
    await clearStore(STORES.TRANSACTIONS);
  },

  /**
   * Clear all data from the database (transactions, categories, rules)
   * and re-initialize with default categories
   */
  clearAllData: async (): Promise<void> => {
    await clearStore(STORES.TRANSACTIONS);
    await clearStore(STORES.RULES);
    await clearStore(STORES.CATEGORIES);
    await clearStore(STORES.BUDGETS);
    await initializeDefaultCategories();
    await initializeDefaultBudgets();
  },

  // ==================== TRANSACTIONS ====================

  getTransactions: async (): Promise<Transaction[]> => {
    const transactions = await getAllFromStore<Transaction>(STORES.TRANSACTIONS);
    // Sort by date descending (most recent first)
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  addTransactions: async (transactions: Transaction[]): Promise<void> => {
    const dbTransaction = await getTransaction(STORES.TRANSACTIONS, 'readwrite');
    const store = dbTransaction.objectStore(STORES.TRANSACTIONS);
    
    for (const t of transactions) {
      store.put(t); // Use put to allow updates if ID already exists
    }
    
    return new Promise((resolve, reject) => {
      dbTransaction.oncomplete = () => resolve();
      dbTransaction.onerror = () => reject(dbTransaction.error);
    });
  },

  updateTransaction: async (t: Transaction): Promise<void> => {
    await putToStore(STORES.TRANSACTIONS, t);
  },

  batchUpdateTransactions: async (transactions: Transaction[]): Promise<void> => {
    const dbTransaction = await getTransaction(STORES.TRANSACTIONS, 'readwrite');
    const store = dbTransaction.objectStore(STORES.TRANSACTIONS);
    
    for (const t of transactions) {
      store.put(t);
    }
    
    return new Promise((resolve, reject) => {
      dbTransaction.oncomplete = () => resolve();
      dbTransaction.onerror = () => reject(dbTransaction.error);
    });
  },

  applyRule: async (rule: Rule): Promise<number> => {
    const transactions = await db.getTransactions();
    const conditionValue = (rule.conditionValue || '').toLowerCase();
    let count = 0;
    const updatedTransactions: Transaction[] = [];

    for (const t of transactions) {
      const description = t.description.toLowerCase();
      let matches = false;

      switch (rule.conditionType) {
        case 'contains':
          matches = description.includes(conditionValue);
          break;
        case 'startsWith':
          matches = description.startsWith(conditionValue);
          break;
        case 'equals':
          matches = description === conditionValue;
          break;
      }

      if (matches && t.categoryId !== rule.categoryId) {
        updatedTransactions.push({
          ...t,
          categoryId: rule.categoryId,
          categorizedByRule: true,
          categorizedByAI: false,
        });
        count++;
      }
    }

    if (updatedTransactions.length > 0) {
      await db.batchUpdateTransactions(updatedTransactions);
    }

    return count;
  },

  deleteTransaction: async (id: string): Promise<void> => {
    await deleteFromStore(STORES.TRANSACTIONS, id);
  },

  eraseTransactions: async (): Promise<void> => {
    await clearStore(STORES.TRANSACTIONS);
  },

  // ==================== CATEGORIES ====================

  getCategories: async (): Promise<Category[]> => {
    return getAllFromStore<Category>(STORES.CATEGORIES);
  },

  addCategory: async (c: Category): Promise<void> => {
    await addToStore(STORES.CATEGORIES, c);
  },

  updateCategory: async (c: Category): Promise<void> => {
    await putToStore(STORES.CATEGORIES, c);
  },

  deleteCategory: async (id: string): Promise<void> => {
    // Update transactions that reference this category to 'uncategorized'
    const transactions = await db.getTransactions();
    const updatedTransactions = transactions
      .filter(t => t.categoryId === id)
      .map(t => ({ ...t, categoryId: 'cat-uncategorized' }));
    
    if (updatedTransactions.length > 0) {
      await db.batchUpdateTransactions(updatedTransactions);
    }
    
    await deleteFromStore(STORES.CATEGORIES, id);
  },

  // ==================== BUDGETS ====================

  getBudgets: async (): Promise<Budget[]> => {
    return getAllFromStore<Budget>(STORES.BUDGETS);
  },

  addBudget: async (b: Budget): Promise<void> => {
    await addToStore(STORES.BUDGETS, {
      ...b,
      updatedAt: new Date().toISOString(),
    });
  },

  updateBudget: async (b: Budget): Promise<void> => {
    await putToStore(STORES.BUDGETS, {
      ...b,
      updatedAt: new Date().toISOString(),
    });
  },

  deleteBudget: async (id: string): Promise<void> => {
    await deleteFromStore(STORES.BUDGETS, id);
  },

  resetBudgetsToDefault: async (): Promise<void> => {
    await clearStore(STORES.BUDGETS);
    await initializeDefaultBudgets();
  },

  // ==================== RULES ====================

  getRules: async (): Promise<Rule[]> => {
    const rules = await getAllFromStore<Rule & { order?: number }>(STORES.RULES);
    // Sort by order ascending
    return rules.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  addRule: async (r: Rule): Promise<void> => {
    // Get the current max order and add 1
    const rules = await db.getRules();
    const maxOrder = rules.reduce((max, rule) => {
      const order = (rule as Rule & { order?: number }).order || 0;
      return Math.max(max, order);
    }, 0);
    
    const ruleWithOrder = { ...r, order: maxOrder + 1 };
    await addToStore(STORES.RULES, ruleWithOrder);
  },

  updateRule: async (r: Rule): Promise<void> => {
    // Preserve the existing order when updating
    const existingRules = await db.getRules();
    const existingRule = existingRules.find(rule => rule.id === r.id) as (Rule & { order?: number }) | undefined;
    const ruleWithOrder = { ...r, order: existingRule?.order || 0 };
    await putToStore(STORES.RULES, ruleWithOrder);
  },

  deleteRule: async (id: string): Promise<void> => {
    await deleteFromStore(STORES.RULES, id);
  },

  reorderRules: async (ids: string[]): Promise<void> => {
    const rules = await db.getRules();
    const rulesMap = new Map(rules.map(r => [r.id, r]));
    
    const dbTransaction = await getTransaction(STORES.RULES, 'readwrite');
    const store = dbTransaction.objectStore(STORES.RULES);
    
    ids.forEach((id, index) => {
      const rule = rulesMap.get(id);
      if (rule) {
        store.put({ ...rule, order: index + 1 });
      }
    });
    
    return new Promise((resolve, reject) => {
      dbTransaction.oncomplete = () => resolve();
      dbTransaction.onerror = () => reject(dbTransaction.error);
    });
  },

  // ==================== EXPORT / IMPORT ====================

  exportData: async (): Promise<{ categories: Category[]; rules: Rule[]; transactions: Transaction[]; budgets: Budget[]; exportedAt: string; version: string }> => {
    const [categories, rules, transactions, budgets] = await Promise.all([
      db.getCategories(),
      db.getRules(),
      db.getTransactions(),
      db.getBudgets(),
    ]);
    
    return {
      categories,
      rules,
      transactions,
      budgets,
      exportedAt: new Date().toISOString(),
      version: '1.1',
    };
  },

  importData: async (data: { categories?: Category[]; rules?: (Rule & { order?: number })[]; transactions?: Transaction[]; budgets?: Budget[] }): Promise<{ categories: number; rules: number; transactions: number; budgets: number }> => {
    const { categories = [], rules = [], transactions = [], budgets = [] } = data;
    
    // Clear existing data
    await clearStore(STORES.TRANSACTIONS);
    await clearStore(STORES.RULES);
    await clearStore(STORES.CATEGORIES);
    await clearStore(STORES.BUDGETS);
    
    // Import categories
    if (categories.length > 0) {
      const catTransaction = await getTransaction(STORES.CATEGORIES, 'readwrite');
      const catStore = catTransaction.objectStore(STORES.CATEGORIES);
      for (const c of categories) {
        catStore.add(c);
      }
      await new Promise<void>((resolve, reject) => {
        catTransaction.oncomplete = () => resolve();
        catTransaction.onerror = () => reject(catTransaction.error);
      });
    } else {
      // If no categories in import, initialize defaults
      await initializeDefaultCategories();
    }
    
    // Import rules with order
    if (rules.length > 0) {
      const rulesTransaction = await getTransaction(STORES.RULES, 'readwrite');
      const rulesStore = rulesTransaction.objectStore(STORES.RULES);
      rules.forEach((r, index) => {
        rulesStore.add({ ...r, order: r.order ?? index + 1 });
      });
      await new Promise<void>((resolve, reject) => {
        rulesTransaction.oncomplete = () => resolve();
        rulesTransaction.onerror = () => reject(rulesTransaction.error);
      });
    }
    
    // Import transactions
    if (transactions.length > 0) {
      const txnTransaction = await getTransaction(STORES.TRANSACTIONS, 'readwrite');
      const txnStore = txnTransaction.objectStore(STORES.TRANSACTIONS);
      for (const t of transactions) {
        txnStore.add(t);
      }
      await new Promise<void>((resolve, reject) => {
        txnTransaction.oncomplete = () => resolve();
        txnTransaction.onerror = () => reject(txnTransaction.error);
      });
    }
    
    if (budgets.length > 0) {
      const budgetTransaction = await getTransaction(STORES.BUDGETS, 'readwrite');
      const budgetStore = budgetTransaction.objectStore(STORES.BUDGETS);
      budgets.forEach(b => {
        budgetStore.add({
          ...b,
          updatedAt: b.updatedAt || new Date().toISOString(),
          customPercent: b.customPercent ?? null,
        });
      });
      await new Promise<void>((resolve, reject) => {
        budgetTransaction.oncomplete = () => resolve();
        budgetTransaction.onerror = () => reject(budgetTransaction.error);
      });
    } else {
      await initializeDefaultBudgets();
    }
    
    return {
      categories: categories.length || DEFAULT_CATEGORIES.length,
      rules: rules.length,
      transactions: transactions.length,
      budgets: budgets.length || DEFAULT_BUDGETS.length,
    };
  },
};
