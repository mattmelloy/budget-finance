import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
import { useData } from './useData';

export interface DashboardFilters {
  periodType: 'all' | 'month' | 'year';
  selectedMonth: string | null;
  selectedYear: string | null;
  selectedCategory: string;
  comparePrevious: boolean;
}

export interface TransactionFilters {
  searchQuery: string;
  categoryId: string | null;
  periodType: 'all' | 'month' | 'year';
  selectedMonth: string | null;
  selectedYear: string | null;
  startDate?: string;
  endDate?: string;
}

interface FilterContextProps {
  dashboardFilters: DashboardFilters;
  setDashboardFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  transactionFilters: TransactionFilters;
  setTransactionFilters: React.Dispatch<React.SetStateAction<TransactionFilters>>;
}

const FilterContext = createContext<FilterContextProps | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { transactions } = useData();

  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilters>({
    periodType: 'year',
    selectedMonth: null,
    selectedYear: null,
    selectedCategory: '',
    comparePrevious: false,
  });

  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>({
    searchQuery: '',
    categoryId: null,
    periodType: 'year',
    selectedMonth: null,
    selectedYear: null,
  });

  // Derived available years/months
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.date) {
        set.add(t.date.substring(0, 4));
      }
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.date) {
        set.add(t.date.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // Set defaults when data arrives
  useEffect(() => {
    if (availableYears.length > 0) {
      const mostRecentYear = availableYears[0];
      
      setDashboardFilters(prev => ({
        ...prev,
        selectedYear: prev.selectedYear || mostRecentYear,
      }));

      setTransactionFilters(prev => ({
        ...prev,
        selectedYear: prev.selectedYear || mostRecentYear,
      }));
    }

    if (availableMonths.length > 0) {
      const mostRecentMonth = availableMonths[0];
      setDashboardFilters(prev => ({
        ...prev,
        selectedMonth: prev.selectedMonth || mostRecentMonth,
      }));
      setTransactionFilters(prev => ({
        ...prev,
        selectedMonth: prev.selectedMonth || mostRecentMonth,
      }));
    }
  }, [availableYears, availableMonths]);

  return (
    <FilterContext.Provider value={{
      dashboardFilters,
      setDashboardFilters,
      transactionFilters,
      setTransactionFilters
    }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};
