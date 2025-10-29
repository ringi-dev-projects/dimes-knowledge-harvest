'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CompanyContextType {
  companyId: number | null;
  setCompanyId: (id: number) => void;
  companyName: string | null;
  setCompanyName: (name: string) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage if available
  const [companyId, setCompanyIdState] = useState<number | null>(null);
  const [companyName, setCompanyNameState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedCompanyId = localStorage.getItem('companyId');
    const storedCompanyName = localStorage.getItem('companyName');

    if (storedCompanyId) {
      setCompanyIdState(parseInt(storedCompanyId));
    }
    if (storedCompanyName) {
      setCompanyNameState(storedCompanyName);
    }
    setIsLoaded(true);
  }, []);

  // Wrapper functions that also save to localStorage
  const setCompanyId = (id: number) => {
    setCompanyIdState(id);
    localStorage.setItem('companyId', id.toString());
  };

  const setCompanyName = (name: string) => {
    setCompanyNameState(name);
    localStorage.setItem('companyName', name);
  };

  return (
    <CompanyContext.Provider value={{ companyId, setCompanyId, companyName, setCompanyName }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
