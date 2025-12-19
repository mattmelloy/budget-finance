import React from 'react';
import Modal from './Modal';

export interface AICategorizationLog {
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'debug';
  message: string;
  details?: any;
}

interface AICategorizationDebugProps {
  isOpen: boolean;
  onClose: () => void;
  progress: {
    processed: number;
    total: number;
    currentBatch: number;
    totalBatches: number;
  };
  logs: AICategorizationLog[];
  startTime: Date | null;
  categorizedTransactions?: any[]; // Add this to calculate stats
}

const AICategorizationDebug: React.FC<AICategorizationDebugProps> = ({
  isOpen,
  onClose,
  progress,
  logs,
  startTime,
  categorizedTransactions = [],
}) => {
  const elapsedTime = startTime ? Date.now() - startTime.getTime() : 0;
  const elapsedSeconds = Math.floor(elapsedTime / 1000);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLogTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString();
  };

  // Calculate statistics
  const isComplete = progress.processed === progress.total && progress.total > 0;
  const categorizedCount = categorizedTransactions.filter(t => t.categoryId !== 'cat-uncategorized').length;
  const uncategorizedCount = categorizedTransactions.filter(t => t.categoryId === 'cat-uncategorized').length;

  // Calculate token usage from logs
  const tokenUsage = logs.reduce((acc, log) => {
    if (log.details?.inputTokens) acc.inputTokens += log.details.inputTokens;
    if (log.details?.outputTokens) acc.outputTokens += log.details.outputTokens;
    return acc;
  }, { inputTokens: 0, outputTokens: 0 });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Categorization Debug"
      description="Real-time progress and logs for AI transaction categorization"
    >
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {/* Progress Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-2">Progress Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Transactions:</span>
              <span className="ml-2 font-medium">{progress.processed} / {progress.total}</span>
            </div>
            <div>
              <span className="text-gray-600">Elapsed Time:</span>
              <span className="ml-2 font-medium">{formatTime(elapsedSeconds)}</span>
            </div>
            <div>
              <span className="text-gray-600">Current Batch:</span>
              <span className="ml-2 font-medium">{progress.currentBatch} / {progress.totalBatches}</span>
            </div>
            <div>
              <span className="text-gray-600">Progress:</span>
              <span className="ml-2 font-medium">
                {progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%`
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Final Statistics - only show when complete */}
        {isComplete && categorizedTransactions.length > 0 && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="font-semibold text-lg mb-3 text-green-800">📊 Final Statistics</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-green-700">Categorized:</span>
                <span className="ml-2 font-bold text-green-900">{categorizedCount}</span>
              </div>
              <div>
                <span className="text-green-700">Uncategorized:</span>
                <span className="ml-2 font-bold text-green-900">{uncategorizedCount}</span>
              </div>
              <div>
                <span className="text-green-700">Success Rate:</span>
                <span className="ml-2 font-bold text-green-900">
                  {categorizedTransactions.length > 0
                    ? Math.round((categorizedCount / categorizedTransactions.length) * 100)
                    : 0}%
                </span>
              </div>
              <div>
                <span className="text-green-700">Total Time:</span>
                <span className="ml-2 font-bold text-green-900">{formatTime(elapsedSeconds)}</span>
              </div>
              {tokenUsage.inputTokens > 0 && (
                <div>
                  <span className="text-green-700">Input Tokens:</span>
                  <span className="ml-2 font-bold text-green-900">{tokenUsage.inputTokens.toLocaleString()}</span>
                </div>
              )}
              {tokenUsage.outputTokens > 0 && (
                <div>
                  <span className="text-green-700">Output Tokens:</span>
                  <span className="ml-2 font-bold text-green-900">{tokenUsage.outputTokens.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-2">AI Request Logs</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-sm">No logs yet...</p>
            ) : (
              logs.slice(-20).map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-sm font-mono text-xs ${
                    log.type === 'error'
                      ? 'bg-red-100 text-red-800'
                      : log.type === 'success'
                      ? 'bg-green-100 text-green-800'
                      : log.type === 'debug'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-gray-600 text-xs">
                      {formatLogTime(log.timestamp)}
                    </span>
                    <span className="text-xs uppercase font-semibold ml-2">
                      {log.type}
                    </span>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {log.message}
                  </div>
                  {log.details && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs">Details</summary>
                      <pre className="text-xs mt-1 whitespace-pre-wrap break-all">
                        {typeof log.details === 'string'
                          ? log.details
                          : JSON.stringify(log.details, null, 2)
                        }
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AICategorizationDebug;
