// Central API client para o frontend
// Este arquivo fornece um conjunto de funções para consumir o backend PPP.

// Leitura da variável de ambiente (compatível com Vite, CRA e Next.js)
const viteEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? (import.meta as any).env.VITE_API_URL
    : undefined;

const nextEnv =
  typeof process !== "undefined" && process.env
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : undefined;

const craEnv =
  typeof process !== "undefined" && process.env
    ? process.env.REACT_APP_API_URL
    : undefined;

// Fallback padrão agora é o backend em produção, NÃO mais localhost
export const API_BASE_URL: string =
  nextEnv || viteEnv || craEnv || "https://ppp-backend-sjic.onrender.com";

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

export interface FrontendCase {
  id: string;
  status: CaseStatus | string;
  // ISO string vinda do backend (created_at) mapeada para camelCase
  createdAt: string | null;
  updatedAt?: string | null;
  company?: FrontendCompany | null;
  worker?: FrontendWorker | null;
  documents?: FrontendDocument[];
  analysis?: AnalysisResult | null;
}

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

// Tipos para análise do motor de regras
export type BlockStatus = 'APPROVED' | 'PENDING' | 'REPROVED' | 'NOT_EVALUATED';

export type FinalClassification =
  | 'ATENDE_INTEGRALMENTE'
  | 'POSSUI_INCONSISTENCIAS_SANAVEIS'
  | 'NAO_POSSUI_VALIDADE_TECNICA';

export interface BlockFinding {
  code: string;        // ex: 'CNPJ_INVALIDO', 'PROFISSIOGRAFIA_GENERICA_INVALIDA_PPP'
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;     // texto em português pronto pra mostrar na UI
}

export interface BlockAnalysis {
  id: '5.1' | '5.2' | '5.3' | '5.4' | '5.5';
  title: string;       // ex: 'Dados Administrativos (Itens 1 a 12)'
  status: BlockStatus;
  findings: BlockFinding[];
}

export interface AnalysisResult {
  blocks: BlockAnalysis[];
  finalClassification: FinalClassification;
}

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

  const raw = await handleJsonResponse(res);

  // Garante o formato esperado no frontend
  return (raw as any[]).map((item) => ({
    id: item.id,
    status: item.status,
    createdAt: item.created_at ?? null,
    updatedAt: item.updated_at ?? null,
    company: item.company ?? null,
    worker: item.worker ?? null,
    documents: item.documents ?? item.case_documents ?? [],
    analysis: item.analysis ?? item.case_analysis ?? null,
  }));
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

  const data = await handleJsonResponse(res);

  return {
    id: data.id,
    status: data.status,
    createdAt: data.created_at ?? null,
    updatedAt: data.updated_at ?? null,
    company: data.company ?? null,
    worker: data.worker ?? null,
    documents: data.documents ?? data.case_documents ?? [],
    analysis: data.analysis ?? data.case_analysis ?? null,
  };
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
