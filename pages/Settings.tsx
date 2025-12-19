import React, { useMemo, useRef, useState } from 'react';
import { useData } from '../hooks/useData';
import { Category, Transaction } from '../types';
import { Button } from '../components/ui/button';
import Icon from '../components/Icon';
import { toast } from 'sonner';
import {
  AI_BATCH_SIZE_STORAGE_KEY,
  DEFAULT_AI_BATCH_SIZE,
} from '../constants';

// Reuse the same icon options as the Transactions page
const availableIcons = [
  'shoppingCart',
  'car',
  'dining',
  'subscription',
  'income',
  'shoppingBag',
  'utilities',
  'health',
  'entertainment',
  'question',
];

// Category Management Component (copied from Transactions page for reuse here)
const CategoryManager: React.FC<{
  categories: Category[];
  addCategory: (c: Omit<Category, 'id'>) => void | Promise<void>;
  updateCategory: (c: Category) => void | Promise<void>;
  deleteCategory: (id: string) => void | Promise<void>;
}> = ({ categories, addCategory, updateCategory, deleteCategory }) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAdd = async () => {
    if (newCategoryName.trim()) {
      await addCategory({
        name: newCategoryName.trim(),
        color: '#a0aec0',
        icon: 'question',
      });
      setNewCategoryName('');
    }
  };

  const handleEditStart = (category: Category) => {
    setEditingCategory({ ...category });
  };

  const handleEditCancel = () => {
    setEditingCategory(null);
  };

  const handleEditSave = async () => {
    if (editingCategory) {
      await updateCategory(editingCategory);
      setEditingCategory(null);
    }
  };

  const handleEditChange = (field: keyof Omit<Category, 'id'>, value: string) => {
    if (editingCategory) {
      setEditingCategory((prev) => (prev ? { ...prev, [field]: value } : null));
    }
  };

  const handleDelete = async (id: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this category? All associated transactions will be marked as "Uncategorized".',
      )
    ) {
      await deleteCategory(id);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800">Manage Categories</h3>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {categories
          .filter((c) => c.id !== 'cat-uncategorized')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((cat) => (
            <div key={cat.id}>
              {editingCategory?.id === cat.id ? (
                <div className="p-3 bg-gray-50 rounded-lg border border-blue-300 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`cat-name-${cat.id}`}
                        className="text-xs font-medium text-gray-600"
                      >
                        Name
                      </label>
                      <input
                        id={`cat-name-${cat.id}`}
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => handleEditChange('name', e.target.value)}
                        className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`cat-color-${cat.id}`}
                        className="text-xs font-medium text-gray-600"
                      >
                        Color
                      </label>
                      <input
                        id={`cat-color-${cat.id}`}
                        type="color"
                        value={editingCategory.color}
                        onChange={(e) => handleEditChange('color', e.target.value)}
                        className="mt-1 w-full h-[34px] p-1 border border-gray-300 rounded-md cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor={`cat-icon-${cat.id}`}
                      className="text-xs font-medium text-gray-600"
                    >
                      Icon
                    </label>
                    <select
                      id={`cat-icon-${cat.id}`}
                      value={editingCategory.icon}
                      onChange={(e) => handleEditChange('icon', e.target.value)}
                      className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {availableIcons.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon.charAt(0).toUpperCase() + icon.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <Button variant="secondary" onClick={handleEditCancel}>
                      Cancel
                    </Button>
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
                    <button
                      onClick={() => handleEditStart(cat)}
                      className="p-1 text-gray-500 hover:text-blue-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                      aria-label={`Edit ${cat.name}`}
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-1 text-gray-500 hover:text-red-600 rounded-full focus:outline-none focus:ring-2 focus:ring-red-400"
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="pt-2 border-t">
        <label
          htmlFor="new-cat-name-settings"
          className="text-sm font-medium text-gray-700"
        >
          Add New Category
        </label>
        <div className="flex space-x-2 mt-1">
          <input
            id="new-cat-name-settings"
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category name"
            className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <Button onClick={handleAdd}>Add</Button>
        </div>
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  const {
    exportAll,
    importFromFile,
    resetAllData,
    transactions,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    recategorizeUncategorizedWithAI,
  } = useData();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRecategorizing, setIsRecategorizing] = useState(false);
  const [recategorizeMessage, setRecategorizeMessage] = useState<string | null>(null);

  // AI Batch Size setting
  const [batchSize, setBatchSize] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_AI_BATCH_SIZE;
    try {
      const stored = window.localStorage.getItem(AI_BATCH_SIZE_STORAGE_KEY);
      const parsed = parseInt(stored || '', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_BATCH_SIZE;
    } catch {
      return DEFAULT_AI_BATCH_SIZE;
    }
  });

  const handleBatchSizeChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      setBatchSize(parsed);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(AI_BATCH_SIZE_STORAGE_KEY, parsed.toString());
        }
      } catch {}
    }
  };

  const uncategorizedCount = useMemo(
    () =>
      transactions.filter(
        (t: Transaction) => !t.categoryId || t.categoryId === 'cat-uncategorized',
      ).length,
    [transactions],
  );

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setImportError(null);
      await importFromFile(file);
      toast.success('Import completed successfully');
    } catch (err) {
      console.error('Import failed', err);
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(msg);
      toast.error('Import failed: ' + msg);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRecategorizeUncategorized = async () => {
    setIsRecategorizing(true);
    setRecategorizeMessage('Re-categorizing uncategorized transactions with AI...');

    try {
      const updatedCount = await recategorizeUncategorizedWithAI((processed, total) => {
        setRecategorizeMessage(`Re-categorizing with AI... (${processed}/${total})`);
      });

      if (updatedCount === 0) {
        setRecategorizeMessage('No uncategorized transactions found.');
      } else {
        setRecategorizeMessage(`Re-categorized ${updatedCount} transaction(s) with AI.`);
      }
    } catch (e: any) {
      console.error('Re-categorization failed', e);
      setRecategorizeMessage(
        e?.message || 'Failed to re-categorize uncategorized transactions.',
      );
    } finally {
      setIsRecategorizing(false);
      setTimeout(() => setRecategorizeMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
        <Icon name="settings" className="h-6 w-6 text-gray-700" />
        <span>Settings</span>
      </h1>

      {/* AI Categorization Settings */}
      <section className="bg-white shadow rounded-lg p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
          <Icon name="play" className="h-5 w-5 text-gray-700" />
          <span>AI Categorization</span>
        </h2>
        <p className="text-sm text-gray-600">
          Configure how transactions are processed in batches for AI categorization. Larger batches
          mean fewer API calls but may hit payload limits.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="batch-size" className="text-sm font-medium text-gray-700">
              Batch Size
            </label>
            <div className="flex items-center space-x-3">
              <input
                id="batch-size"
                type="number"
                min="1"
                max="100"
                value={batchSize}
                onChange={(e) => handleBatchSizeChange(e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">transactions per API call (default: 50)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section className="bg-white shadow rounded-lg p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
          <Icon name="download" className="h-5 w-5 text-gray-700" />
          <span>Data Management</span>
        </h2>
        <p className="text-sm text-gray-600">
          Export your data for backup, import from a previous export, or reset all stored
          data.
        </p>

        <div className="flex flex-wrap gap-3 items-center">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await exportAll();
                toast.success('Export completed — file should download shortly');
              } catch (e) {
                console.error('Export failed', e);
                toast.error(
                  'Export failed: ' + (e instanceof Error ? e.message : String(e)),
                );
              }
            }}
          >
            <Icon name="download" className="h-4 w-4 mr-2" />
            Export
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <Button variant="outline" onClick={triggerImport}>
            <Icon name="upload" className="h-4 w-4 mr-2" />
            Import
          </Button>

          <Button
            variant="destructive"
            onClick={resetAllData}
            className="ml-auto"
          >
            <Icon name="trash" className="h-4 w-4 mr-2" />
            Reset All Data
          </Button>
        </div>

        {importError && (
          <p className="text-xs text-red-500 mt-2">Import error: {importError}</p>
        )}
      </section>

      {/* AI Tools */}
      <section className="bg-white shadow rounded-lg p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
          <Icon name="play" className="h-5 w-5 text-gray-700" />
          <span>AI Tools</span>
        </h2>
        <p className="text-sm text-gray-600">
          Re-run uncategorized transactions through AI categorization. This is useful
          after adding new rules or categories, or if an earlier import missed some
          items.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm text-gray-700">
            {uncategorizedCount > 0
              ? `${uncategorizedCount} transaction(s) are currently uncategorized.`
              : 'No uncategorized transactions are currently detected.'}
          </div>
          <Button
            variant="outline"
            onClick={handleRecategorizeUncategorized}
            disabled={isRecategorizing || uncategorizedCount === 0}
          >
            {isRecategorizing ? 'Re-categorizing…' : 'Re-categorize uncategorized with AI'}
          </Button>
        </div>
        {recategorizeMessage && (
          <p className="mt-2 text-xs text-gray-600">{recategorizeMessage}</p>
        )}
      </section>

      {/* Category Management */}
      <section className="bg-white shadow rounded-lg p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
          <Icon name="categories" className="h-5 w-5 text-gray-700" />
          <span>Categories</span>
        </h2>
        <p className="text-sm text-gray-600">
          Add, edit, or delete categories used to organise your transactions.
        </p>
        <CategoryManager
          categories={categories}
          addCategory={addCategory}
          updateCategory={updateCategory}
          deleteCategory={deleteCategory}
        />
      </section>
    </div>
  );
};

export default Settings;
