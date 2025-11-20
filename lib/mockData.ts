import { Case } from "./types";

let mockCases: Case[] = [
  {
    id: "1",
    workerName: "João Silva",
    workerCPF: "123.456.789-00",
    companyName: "Empresa ABC Ltda",
    companyCNPJ: "12.345.678/0001-90",
    status: "processing",
    createdAt: "2024-01-15T10:30:00Z",
    pppFileName: "ppp_joao_silva.pdf",
  },
  {
    id: "2",
    workerName: "Maria Santos",
    workerCPF: "987.654.321-00",
    companyName: "Indústria XYZ S.A.",
    companyCNPJ: "98.765.432/0001-10",
    status: "analyzed",
    createdAt: "2024-01-10T14:20:00Z",
    pppFileName: "ppp_maria_santos.pdf",
  },
  {
    id: "3",
    workerName: "Pedro Oliveira",
    workerCPF: "111.222.333-44",
    companyName: "Construções DEF ME",
    companyCNPJ: "11.222.333/0001-44",
    status: "pending_documents",
    createdAt: "2024-01-20T09:15:00Z",
    pppFileName: "ppp_pedro_oliveira.pdf",
  },
];

export function getMockCases(): Case[] {
  return [...mockCases];
}

export function addMockCase(newCase: Omit<Case, "id" | "createdAt">): Case {
  const caseWithId: Case = {
    ...newCase,
    id: String(mockCases.length + 1),
    createdAt: new Date().toISOString(),
  };
  mockCases.push(caseWithId);
  return caseWithId;
}

export function getMockCaseById(id: string): Case | undefined {
  return mockCases.find((c) => c.id === id);
}

