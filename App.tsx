import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { DataProvider } from './hooks/useData';
import { FilterProvider, useFilters } from './hooks/useFilters';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Transactions from './pages/Transactions';
import Rules from './pages/Rules';
import Budgets from './pages/Budgets';
import Settings from './pages/Settings';

export type Page = 'dashboard' | 'upload' | 'transactions' | 'rules' | 'budgets' | 'settings';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const { setTransactionFilters } = useFilters();

  const handleCategoryFilterSelect = (categoryId: string, startDate?: string, endDate?: string) => {
    setTransactionFilters(prev => ({
      ...prev,
      categoryId,
      startDate,
      endDate,
      // When navigating from dashboard, if dates are provided, we should probably switch to 'all' period type 
      // to respect the specific dates passed.
      periodType: (startDate && endDate) ? 'all' : prev.periodType
    }));
    setCurrentPage('transactions');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onCategorySelect={handleCategoryFilterSelect} />;
      case 'upload':
        return <Upload onUploadSuccess={() => setCurrentPage('transactions')} />;
      case 'transactions':
        return <Transactions setCurrentPage={setCurrentPage} />;
      case 'rules':
        return <Rules />;
      case 'budgets':
        return <Budgets />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onCategorySelect={handleCategoryFilterSelect} />;
    }
  };

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <FilterProvider>
        <Toaster position="top-right" richColors closeButton />
        <AppContent />
      </FilterProvider>
    </DataProvider>
  );
};

export default App;
