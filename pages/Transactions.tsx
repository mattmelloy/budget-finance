import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { useFilters } from '../hooks/useFilters';
import { Transaction, Category } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { getMonthWindow, getYearWindow, txInWindow, Window } from '../utils/analytics';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { Page } from '../App';

const availableIcons = [
    'shoppingCart', 'car', 'dining', 'subscription', 'income', 
    'shoppingBag', 'utilities', 'health', 'entertainment', 'question'
];

// Category Management Component
const CategoryManager: React.FC<{categories: Category[], addCategory: (c: Omit<Category, 'id'>) => void, updateCategory: (c: Category) => void, deleteCategory: (id: string) => void}> = 
({ categories, addCategory, updateCategory, deleteCategory }) => {
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const handleAdd = () => {
        if (newCategoryName.trim()) {
            addCategory({ name: newCategoryName.trim(), color: '#a0aec0', icon: 'question' });
            setNewCategoryName('');
        }
    };

    const handleEditStart = (category: Category) => {
        setEditingCategory({ ...category });
    };

    const handleEditCancel = () => {
        setEditingCategory(null);
    };

    const handleEditSave = () => {
        if (editingCategory) {
            updateCategory(editingCategory);
            setEditingCategory(null);
        }
    };

    const handleEditChange = (field: keyof Omit<Category, 'id'>, value: string) => {
        if (editingCategory) {
            setEditingCategory(prev => prev ? { ...prev, [field]: value } : null);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this category? All associated transactions will be marked as "Uncategorized".')) {
            deleteCategory(id);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800">Manage Categories</h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {categories.filter(c => c.id !== 'cat-uncategorized').sort((a,b) => a.name.localeCompare(b.name)).map(cat => (
                    <div key={cat.id}>
                        {editingCategory?.id === cat.id ? (
                            <div className="p-3 bg-gray-50 rounded-lg border border-blue-300 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2">
                                        <label htmlFor="cat-name" className="text-xs font-medium text-gray-600">Name</label>
                                        <input 
                                            id="cat-name"
                                            type="text"
                                            value={editingCategory.name}
                                            onChange={(e) => handleEditChange('name', e.target.value)}
                                            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="cat-color" className="text-xs font-medium text-gray-600">Color</label>
                                        <input 
                                            id="cat-color"
                                            type="color"
                                            value={editingCategory.color}
                                            onChange={(e) => handleEditChange('color', e.target.value)}
                                            className="mt-1 w-full h-[34px] p-1 border border-gray-300 rounded-md cursor-pointer"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="cat-icon" className="text-xs font-medium text-gray-600">Icon</label>
                                    <select
                                        id="cat-icon"
                                        value={editingCategory.icon}
                                        onChange={(e) => handleEditChange('icon', e.target.value)}
                                        className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {availableIcons.map(icon => <option key={icon} value={icon}>{icon.charAt(0).toUpperCase() + icon.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div className="flex justify-end space-x-2 pt-1">
                                    <Button variant="secondary" onClick={handleEditCancel}>Cancel</Button>
                                    <Button onClick={handleEditSave}>Save</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
                                <div className="flex items-center space-x-3">
                                    <div style={{ backgroundColor: cat.color }} className="p-1 rounded-full">
                                        <Icon name={cat.icon} className="h-5 w-5 text-white" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => handleEditStart(cat)} className="p-1 text-gray-500 hover:text-blue-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label={`Edit ${cat.name}`}>
                                        <Icon name="edit" className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDelete(cat.id)} className="p-1 text-gray-500 hover:text-red-600 rounded-full focus:outline-none focus:ring-2 focus:ring-red-400" aria-label={`Delete ${cat.name}`}>
                                        <Icon name="trash" className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="pt-2 border-t">
                <label htmlFor="new-cat-name" className="text-sm font-medium text-gray-700">Add New Category</label>
                 <div className="flex space-x-2 mt-1">
                    <input
                        id="new-cat-name"
                        type="text"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder="New category name"
                        className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Button onClick={handleAdd}>Add</Button>
                </div>
            </div>
        </div>
    );
};

interface TransactionsProps {
    setCurrentPage: (page: Page) => void;
}

const Transactions: React.FC<TransactionsProps> = ({ setCurrentPage }) => {
  const { transactions, categories, updateTransaction, addCategory, updateCategory, deleteCategory, setRuleToEdit } = useData();
  const { transactionFilters, setTransactionFilters } = useFilters();
  const { searchQuery, categoryId, periodType, selectedMonth, selectedYear, startDate, endDate } = transactionFilters;

  const setSearchQuery = (val: string) => setTransactionFilters(prev => ({ ...prev, searchQuery: val }));
  const setLocalCategory = (val: string | null) => setTransactionFilters(prev => ({ ...prev, categoryId: val }));
  const setPeriodType = (val: 'all' | 'month' | 'year') => setTransactionFilters(prev => ({ 
    ...prev, 
    periodType: val,
    startDate: val === 'all' ? prev.startDate : undefined,
    endDate: val === 'all' ? prev.endDate : undefined
  }));
  const setSelectedMonth = (val: string | null) => setTransactionFilters(prev => ({ ...prev, selectedMonth: val }));
  const setSelectedYear = (val: string | null) => setTransactionFilters(prev => ({ ...prev, selectedYear: val }));

  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  // Available months/years derived from transactions
  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach(t => s.add(t.date.substring(0,7)));
    return Array.from(s).sort().reverse();
  }, [transactions]);

  const availableYears = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach(t => s.add(t.date.substring(0,4)));
    return Array.from(s).sort().reverse();
  }, [transactions]);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // Build a period window based on user's selection (month/year)
  const currentWindow: Window | null = useMemo(() => {
    try {
      if (periodType === 'month' && selectedMonth) return getMonthWindow(selectedMonth);
      if (periodType === 'year' && selectedYear) return getYearWindow(selectedYear);
      return null;
    } catch {
      return null;
    }
  }, [periodType, selectedMonth, selectedYear]);

  const filteredTransactions = useMemo(() => {
    let results = sortedTransactions;

    if (categoryId) {
      results = results.filter(t => t.categoryId === categoryId);
    }

    // Period filtering
    if (startDate && endDate) {
      // Build an inclusive UTC window from the provided YYYY-MM-DD strings and use txInWindow
      // to ensure correct comparison with transaction dates (which may include time/timezone).
      try {
        const start = new Date(startDate + 'T00:00:00Z');
        const end = new Date(endDate + 'T23:59:59Z');
        const dateWindow: Window = { start, end };
        results = results.filter(t => txInWindow(t, dateWindow));
      } catch {
        // fallback to string compare if parsing fails
        results = results.filter(t => t.date >= startDate! && t.date <= endDate!);
      }
    } else if (currentWindow) {
      results = results.filter(t => txInWindow(t, currentWindow));
    }

    if (searchQuery) {
      const lowercasedFilter = searchQuery.toLowerCase();
      results = results.filter(t => t.description.toLowerCase().includes(lowercasedFilter));
    }

    return results;
  }, [sortedTransactions, categoryId, currentWindow, searchQuery, startDate, endDate]);

  const handleCategoryChange = (transactionId: string, newCategoryId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
      updateTransaction({ ...transaction, categoryId: newCategoryId, categorizedByRule: false, categorizedByAI: false });
    }
  };

  const handleCreateRule = (transaction: Transaction) => {
    setRuleToEdit({
        conditionType: 'contains',
        conditionValue: transaction.description,
        categoryId: transaction.categoryId || 'cat-uncategorized'
    });
    setCurrentPage('rules');
  };
  
  const getCategorySelectClasses = (t: Transaction) => {
    const base = 'p-1 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500';
    if (t.categorizedByRule) {
      return `${base} bg-green-100 border-green-300`;
    }
    if (t.categorizedByAI) {
      return `${base} bg-purple-100 border-purple-300`;
    }
    return `${base} border-gray-300`;
  }

  const categoryFilterName = useMemo(() => {
    if (!categoryId) return null;
    return categories.find(c => c.id === categoryId)?.name;
  }, [categoryId, categories]);

  const dateFilterLabel = useMemo(() => {
    if (startDate && endDate) {
      // If it's a full month or year, display that, otherwise a range.
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start.getUTCDate() === 1 && end.getUTCDate() === new Date(end.getUTCFullYear(), end.getUTCMonth() + 1, 0).getUTCDate()) {
        if (start.getUTCMonth() === 0 && end.getUTCMonth() === 11) {
          return `Year: ${start.getUTCFullYear()}`;
        }
        return `Month: ${start.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
      }
      return `Range: ${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    return null;
  }, [startDate, endDate]);

  const handleClearFilter = () => {
    setTransactionFilters({
      searchQuery: '',
      categoryId: null,
      periodType: 'year',
      selectedMonth: availableMonths[0] || null,
      selectedYear: availableYears[0] || null,
      startDate: undefined,
      endDate: undefined
    });
  };


  return (
    <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <Button variant="outline" size="sm" onClick={() => setIsCategoryManagerOpen(true)}>
              <Icon name="edit" className="mr-2 h-4 w-4" />
              Manage Categories
            </Button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Search</Label>
                    <div className="relative">
                        <Icon name="search" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-full md:w-64 h-10"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Category</Label>
                    <Select value={categoryId || "all"} onValueChange={(val) => setLocalCategory(val === "all" ? null : val)}>
                        <SelectTrigger className="w-[180px] h-10">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Period</Label>
                    <div className="flex items-center bg-gray-100 p-1 rounded-md h-10">
                        <Button
                            variant={periodType === 'all' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-4 text-xs"
                            onClick={() => setPeriodType('all')}
                        >
                            All
                        </Button>
                        <Button
                            variant={periodType === 'month' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-4 text-xs"
                            onClick={() => setPeriodType('month')}
                        >
                            Month
                        </Button>
                        <Button
                            variant={periodType === 'year' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-4 text-xs"
                            onClick={() => setPeriodType('year')}
                        >
                            Year
                        </Button>
                    </div>
                </div>

                {periodType === 'month' && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Select Month</Label>
                        <Select value={selectedMonth || ''} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[180px] h-10">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map(m => (
                                    <SelectItem key={m} value={m}>
                                        {new Date(`${m}-02`).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {periodType === 'year' && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Select Year</Label>
                        <Select value={selectedYear || ''} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px] h-10">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableYears.map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="md:ml-auto flex items-end">
                    <Button variant="outline" size="sm" className="h-10 px-4" onClick={handleClearFilter}>
                        Reset Filters
                    </Button>
                </div>
            </div>
        </div>

        {(categoryFilterName || dateFilterLabel) && (
            <div className="bg-blue-100 border border-blue-200 text-blue-800 px-4 py-2 rounded-md flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {categoryFilterName && (
                    <span>
                        Filtering by category: <span className="font-semibold">{categoryFilterName}</span>
                    </span>
                  )}
                  {dateFilterLabel && (
                    <span>
                        Filtering by date: <span className="font-semibold">{dateFilterLabel}</span>
                    </span>
                  )}
                </div>
                <button 
                    onClick={handleClearFilter} 
                    className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    aria-label="Clear filters"
                >
                    <Icon name="close" className="h-4 w-4" /> Clear All Filters
                </button>
            </div>
        )}
      
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTransactions.map((t) => (
                        <tr key={t.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(t.date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{t.description}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(t.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <select
                            value={t.categoryId || 'cat-uncategorized'}
                            onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                            className={getCategorySelectClasses(t)}
                            >
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>
                                {c.name}
                                </option>
                            ))}
                            </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button variant="secondary" onClick={() => handleCreateRule(t)}>
                                Create Rule
                            </Button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                 {filteredTransactions.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p>No transactions match your criteria.</p>
                    </div>
                )}
            </div>
        </div>
        <Modal isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} title="Manage Categories">
            <CategoryManager 
                categories={categories}
                addCategory={addCategory}
                updateCategory={updateCategory}
                deleteCategory={deleteCategory}
            />
        </Modal>
    </div>
  );
};

export default Transactions;
