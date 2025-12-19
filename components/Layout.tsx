import React, { ReactNode } from 'react';
import { useData } from '../hooks/useData';
import Icon from './Icon';
import type { Page } from '../App';
import { Button } from './ui/button';

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

const NavItem: React.FC<{
  page: Page;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  icon: string;
  label: string;
}> = ({ page, currentPage, setCurrentPage, icon, label }) => {
  const isActive = currentPage === page;
  return (
    <button
      onClick={() => setCurrentPage(page)}
      className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
      }`}
    >
      <Icon name={icon} className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
};

const InitializationError: React.FC = () => {
  const { initializationError, retryInitialization, resetAllData } = useData();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white shadow-lg rounded-lg max-w-lg mx-4">
        <Icon name="logo" className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Database Error</h2>
        <p className="text-gray-600 mb-4">
          There was a problem loading your financial data. This can sometimes happen due
          to a browser glitch.
        </p>
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-xs text-left mb-6 font-mono overflow-x-auto">
          <p>
            <strong>Error details:</strong>
          </p>
          <p>{initializationError?.message || 'An unknown error occurred.'}</p>
        </div>
        <div className="flex justify-center space-x-4">
          <Button onClick={retryInitialization} variant="default">
            Try Again
          </Button>
          <Button onClick={resetAllData} variant="destructive">
            Reset All Data
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Note: Resetting will permanently delete all your transactions, categories, and
          rules.
        </p>
      </div>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children, currentPage, setCurrentPage }) => {
  const { isLoading, initializationError } = useData();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col space-y-4">
        <Icon name="logo" className="h-12 w-12 text-blue-600 animate-pulse" />
        <p className="text-gray-600">Initializing Database...</p>
      </div>
    );
  }

  if (initializationError) {
    return <InitializationError />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Icon name="logo" className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-800">Local Finance</h1>
            </div>
            <div className="flex items-center space-x-3">
              <nav className="hidden md:flex space-x-2">
                <NavItem
                  page="dashboard"
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  icon="dashboard"
                  label="Dashboard"
                />
                <NavItem
                  page="upload"
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  icon="upload"
                  label="Upload"
                />
                <NavItem
                  page="transactions"
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  icon="transactions"
                  label="Transactions"
                />
                <NavItem
                  page="rules"
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  icon="rules"
                  label="Rules"
                />
                <NavItem
                  page="budgets"
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  icon="budget"
                  label="Budgets"
                />
              </nav>
              <button
                onClick={() => setCurrentPage('settings')}
                className={`hidden md:inline-flex items-center justify-center p-2 rounded-full border transition-colors ${
                  currentPage === 'settings'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900 border-transparent'
                }`}
                aria-label="Settings"
              >
                <Icon name="settings" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</div>
      </main>

      <footer className="bg-white mt-8 py-4 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm text-gray-500">
          <p>🔒 Privacy-first design. Your data never leaves your device.</p>
        </div>
      </footer>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-10 flex justify-around">
        <NavItemMobile
          page="dashboard"
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          icon="dashboard"
          label="Dashboard"
        />
        <NavItemMobile
          page="upload"
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          icon="upload"
          label="Upload"
        />
        <NavItemMobile
          page="transactions"
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          icon="transactions"
          label="Transactions"
        />
        <NavItemMobile
          page="rules"
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          icon="rules"
          label="Rules"
        />
        <NavItemMobile
          page="budgets"
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          icon="budget"
          label="Budgets"
        />
        <NavItemMobile
          page="settings"
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          icon="settings"
          label="Settings"
        />
      </nav>
      <div className="md:hidden h-16"></div> {/* Spacer for mobile nav */}
    </div>
  );
};

const NavItemMobile: React.FC<{
  page: Page;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  icon: string;
  label: string;
}> = ({ page, currentPage, setCurrentPage, icon, label }) => {
  const isActive = currentPage === page;
  return (
    <button
      onClick={() => setCurrentPage(page)}
      className={`flex flex-col items-center justify-center w-full py-2 text-xs font-medium transition-colors ${
        isActive ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
      }`}
    >
      <Icon name={icon} className="h-6 w-6 mb-1" />
      <span>{label}</span>
    </button>
  );
};

export default Layout;
