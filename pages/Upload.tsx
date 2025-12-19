import React, { useState } from 'react';
import FileInput from '../components/FileInput';
import { parseFile } from '../services/parser';
import { categorizeTransactions, AICategorizationLog } from '../services/categorizer';
import { useData } from '../hooks/useData';
import type { Transaction, ParsedTransaction } from '../types';
import { Button } from '../components/ui/button';
import Icon from '../components/Icon';
import { formatCurrency } from '../utils/helpers';
import AICategorizationDebug from '../components/AICategorizationDebug';


interface UploadProps {
    onUploadSuccess: () => void;
}


const Upload: React.FC<UploadProps> = ({ onUploadSuccess }) => {
  const { addTransactions, rules, categories, transactions } = useData();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [categorizedTransactions, setCategorizedTransactions] = useState<Transaction[]>([]);
  const [dateFormatHint, setDateFormatHint] = useState<'auto'|'DMY'|'MDY'>('auto');

  // Debug modal state
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState<AICategorizationLog[]>([]);
  const [debugStartTime, setDebugStartTime] = useState<Date | null>(null);
  const [debugProgress, setDebugProgress] = useState({
    processed: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0
  });

  const debugLogCallback = (log: AICategorizationLog) => {
    setDebugLogs(prev => [...prev, log]);
  };

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setCategorizedTransactions([]);
    setLoadingMessage('Parsing file...');

    try {
      const parsed = await parseFile(file, dateFormatHint);
      if (parsed.length === 0) {
        throw new Error("No transactions found in the file, or the format is unsupported.");
      }

      // Deduplicate against existing transactions BEFORE sending to AI
      const normalize = (s: string) => s ? s.trim().toLowerCase().replace(/\s+/g, ' ') : '';
      const existingSet = new Set<string>();
      transactions.forEach(t => {
        const key = `${t.date}|${t.amount}|${normalize(t.description)}`;
        existingSet.add(key);
      });

      const uniqueParsed = (parsed as ParsedTransaction[]).filter(p => {
        const key = `${p.date}|${p.amount}|${normalize(p.description)}`;
        return !existingSet.has(key);
      });

      const duplicatesCount = parsed.length - uniqueParsed.length;
      if (uniqueParsed.length === 0) {
        setError(`All ${parsed.length} transactions in the file appear to already exist in the database. No new transactions to import.`);
        setIsLoading(false);
        setLoadingMessage('Processing...');
        return;
      }

      if (duplicatesCount > 0) {
        setLoadingMessage(`Filtered out ${duplicatesCount} duplicate transaction(s). Preparing ${uniqueParsed.length} new transaction(s) for categorization...`);
      } else {
        setLoadingMessage('Categorizing with AI...');
      }

      // Initialize debug state
      setDebugLogs([]);
      setDebugStartTime(new Date());
      setDebugProgress({
        processed: 0,
        total: uniqueParsed.length,
        currentBatch: 0,
        totalBatches: 0
      });
      setDebugModalOpen(true); // Auto-open debug modal

      const progressCallback = (processed: number, total: number) => {
          setLoadingMessage(`Categorizing with AI... (${processed}/${total})`);
          setDebugProgress(prev => ({ ...prev, processed, total }));
      };

      const categorized = await categorizeTransactions(uniqueParsed, rules, categories, progressCallback, debugLogCallback);
      setCategorizedTransactions(categorized);
    } catch (e: any) {
      setError(e.message || 'Failed to process file.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('Processing...');
    }
  };

  const handleAccept = () => {
    addTransactions(categorizedTransactions);
    onUploadSuccess();
  };
  
  const handleCategoryChange = (transactionId: string, newCategoryId: string) => {
    setCategorizedTransactions(prev => 
        prev.map(t => t.id === transactionId ? { ...t, categoryId: newCategoryId, categorizedByRule: false, categorizedByAI: false } : t)
    );
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

  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload & Import</h1>
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4" role="alert">
            <p className="font-bold">✨ Now with AI Categorization</p>
            <p>Your data is processed locally. For uncategorized items, we securely use the Gemini API to suggest a category, ensuring your privacy is respected.</p>
        </div>
        
        {!categorizedTransactions.length && (
            <div className="max-w-xl mx-auto space-y-3">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Date format</label>
                  <select
                    value={dateFormatHint}
                    onChange={(e) => setDateFormatHint(e.target.value as 'auto'|'DMY'|'MDY')}
                    className="rounded-md border-gray-300"
                  >
                    <option value="auto">Auto (detect from locale)</option>
                    <option value="DMY">DD/MM/YYYY</option>
                    <option value="MDY">MM/DD/YYYY</option>
                  </select>
                </div>
                <FileInput onFileSelect={handleFileSelect} acceptedTypes=".csv,.ofx" />
                {isLoading && <p className="text-center mt-4">{loadingMessage}</p>}
                {error && <p className="text-center text-red-500 mt-4">{error}</p>}
            </div>
        )}

        {categorizedTransactions.length > 0 && (
            <div>
                <h2 className="text-xl font-semibold mb-4">Preview Imported Transactions</h2>
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parsed Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                        {categorizedTransactions.slice(0, 10).map(t => (
                                            <tr key={t.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.rawDate || new Date(t.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900 truncate" title={t.description}>{t.description}</td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(t.amount)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <select
                                                        value={t.categoryId || 'cat-uncategorized'}
                                                        onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                                                        className={getCategorySelectClasses(t)}
                                                    >
                                                        {categories.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                            </tbody>
                        </table>
                    </div>
                    {categorizedTransactions.length > 10 && (
                        <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500">
                            ... and {categorizedTransactions.length - 10} more transactions.
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <Button variant="secondary" onClick={() => setCategorizedTransactions([])}>Cancel</Button>
                    <Button variant="outline" onClick={() => setDebugModalOpen(true)}>View Debug Log</Button>
                    <Button variant="default" onClick={handleAccept}>Accept and Update ({categorizedTransactions.length})</Button>
                </div>
            </div>
        )}

        {/* Debug Modal */}
        <AICategorizationDebug
          isOpen={debugModalOpen}
          onClose={() => setDebugModalOpen(false)}
          progress={debugProgress}
          logs={debugLogs}
          startTime={debugStartTime}
          categorizedTransactions={categorizedTransactions}
        />
    </div>
  );
};

export default Upload;
