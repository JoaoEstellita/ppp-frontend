"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Case } from "./types";
import { getMockCases, addMockCase, getMockCaseById } from "./mockData";

interface CaseContextType {
  cases: Case[];
  refreshCases: () => void;
  addCase: (newCase: Omit<Case, "id" | "createdAt">) => Case;
  getCaseById: (id: string) => Case | undefined;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export function CaseProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<Case[]>(getMockCases());

  const refreshCases = () => {
    setCases(getMockCases());
  };

  const addCase = (newCase: Omit<Case, "id" | "createdAt">) => {
    const added = addMockCase(newCase);
    refreshCases();
    return added;
  };

  const getCaseById = (id: string) => {
    return getMockCaseById(id);
  };

  return (
    <CaseContext.Provider value={{ cases, refreshCases, addCase, getCaseById }}>
      {children}
    </CaseContext.Provider>
  );
}

export function useCases() {
  const context = useContext(CaseContext);
  if (context === undefined) {
    throw new Error("useCases must be used within a CaseProvider");
  }
  return context;
}

