// Central API client para o frontend
// Este arquivo fornece um conjunto de funções para consumir o backend PPP.

// Leitura da variável de ambiente (compatível com Vite, CRA e Next.js)
const viteEnv = typeof import.meta !== "undefined" && (import.meta as any).env ? (import.meta as any).env.VITE_API_URL : undefined;
const nextEnv = typeof process !== "undefined" && process.env ? process.env.NEXT_PUBLIC_API_BASE_URL : undefined;
const craEnv = typeof process !== "undefined" && process.env ? process.env.REACT_APP_API_URL : undefined;

export const API_BASE_URL: string = (nextEnv || viteEnv || craEnv || "http://localhost:4000");

// Tipos básicos usados pelo frontend

export type CaseStatus = "EM_ANALISE" | "COMPLETO" | "INCOMPLETO";

export type FrontendCompany = {
  name: string;
  cnpj?: string;
};

export type FrontendWorker = {
  name: string;
  cpf?: string;
};

export type FrontendDocument = {
  id: string;
  type: string; // ex: 'PPP'
  fileName?: string;
  url?: string;
};

export type FrontendCase = {
  id: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  company?: FrontendCompany;
  worker?: FrontendWorker;
  documents?: FrontendDocument[];
  analysis?: any;
};

// Tipo compatível com a estrutura antiga (para retrocompatibilidade com mock data)
export type Case = {
  id: string;
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
  status: CaseStatus;
  createdAt: string;
  pppFileName?: string;
};

export type BlockAnalysis = {
  status: string;
  erros: string[];
};

export type AnalysisResult = {
  id: string;
  blocks: {
    bloco_5_1: BlockAnalysis;
    bloco_5_2: BlockAnalysis;
    bloco_5_3: BlockAnalysis;
    bloco_5_4: BlockAnalysis;
    bloco_5_5: BlockAnalysis;
  };
  conclusion: 1 | 2 | 3;
};

// Helper para checar resposta
async function handleJsonResponse(response: Response) {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP error ${response.status}`);
  }
  return response.json();
}

// 1. getCases
export async function getCases(): Promise<FrontendCase[]> {
  const res = await fetch(`${API_BASE_URL}/cases`);
  return handleJsonResponse(res);
}

// 1b. createCase
export async function createCase(payload: {
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
}): Promise<FrontendCase> {
  const res = await fetch(`${API_BASE_URL}/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

// 2. getCaseById
export async function getCaseById(id: string): Promise<FrontendCase> {
  const res = await fetch(`${API_BASE_URL}/cases/${id}`);
  return handleJsonResponse(res);
}

// 3. uploadPPP
export async function uploadPPP(caseId: string, file: File): Promise<FrontendCase> {
  const formData = new FormData();
  formData.append("ppp", file);

  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/ppp`, {
    method: "POST",
    body: formData,
  });

  return handleJsonResponse(res);
}

// 4. generateAnalysis
export async function generateAnalysis(caseId: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/analysis`);
  return handleJsonResponse(res);
}

// 5. downloadPPP -> retorna Blob
export async function downloadPPP(caseId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/ppp`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP error ${res.status}`);
  }
  return await res.blob();
}

// 6. downloadReport -> retorna Blob
export async function downloadReport(caseId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/report`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP error ${res.status}`);
  }
  return await res.blob();
}

// Helpers que retornam URLs diretas (úteis para abrir em nova aba)
export function getPPPUrl(caseId: string) {
  return `${API_BASE_URL}/cases/${caseId}/ppp`;
}

export function getReportUrl(caseId: string) {
  return `${API_BASE_URL}/cases/${caseId}/report`;
}
