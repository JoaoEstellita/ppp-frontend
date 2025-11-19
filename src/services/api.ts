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

export type BackendCaseStatus = "received" | "processing" | "analyzed" | "error";

export type CaseStatus = "EM_ANALISE" | "COMPLETO" | "INCOMPLETO" | "ERRO";

const BACKEND_TO_FRONTEND_STATUS: Record<BackendCaseStatus, CaseStatus> = {
  received: "INCOMPLETO",
  processing: "EM_ANALISE",
  analyzed: "COMPLETO",
  error: "ERRO",
};

const KNOWN_CASE_STATUSES: CaseStatus[] = [
  "EM_ANALISE",
  "COMPLETO",
  "INCOMPLETO",
  "ERRO",
];

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(opts: { status: number; code?: string; message?: string; details?: unknown }) {
    super(opts.message || opts.code || `HTTP error ${opts.status}`);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

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
  status: CaseStatus;
  statusRaw?: string | null;
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
  finalClassification?: FinalClassification;
}

const BACKEND_STATUS_VALUES: BackendCaseStatus[] = [
  "received",
  "processing",
  "analyzed",
  "error",
];

function isBackendCaseStatus(value: string): value is BackendCaseStatus {
  return BACKEND_STATUS_VALUES.includes(value as BackendCaseStatus);
}

function normalizeCaseStatus(rawStatus: unknown): { status: CaseStatus; raw: string | null } {
  if (rawStatus === undefined || rawStatus === null) {
    return { status: "INCOMPLETO", raw: null };
  }

  const rawString = String(rawStatus);
  const lower = rawString.toLowerCase();

  if (isBackendCaseStatus(lower)) {
    return { status: BACKEND_TO_FRONTEND_STATUS[lower], raw: rawString };
  }

  const upper = rawString.toUpperCase();
  const match = KNOWN_CASE_STATUSES.find((status) => status === upper);
  if (match) {
    return { status: match, raw: rawString };
  }

  return { status: "INCOMPLETO", raw: rawString };
}

function tryParseJson(value: string) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseMaybeJson<T = unknown>(value: any): T {
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed !== null) {
      return parsed as T;
    }
  }
  return value as T;
}

function normalizeDocuments(rawDocs: any): FrontendDocument[] {
  if (!Array.isArray(rawDocs)) return [];

  return rawDocs
    .map((doc, index) => {
      if (!doc) return null;
      const idSource =
        doc.id ??
        doc.document_id ??
        doc.case_document_id ??
        doc.file_url ??
        doc.fileUrl ??
        `doc-${index}`;
      const typeValue = doc.type ?? doc.document_type ?? doc.file_type ?? "PPP";

      return {
        id: String(idSource),
        type: String(typeValue),
        fileName:
          doc.fileName ??
          doc.file_name ??
          doc.original_name ??
          doc.filename ??
          doc.file ??
          doc.name,
        url: doc.url ?? doc.file_url ?? doc.fileUrl,
      } as FrontendDocument;
    })
    .filter((doc): doc is FrontendDocument => Boolean(doc));
}

function normalizeAnalysisPayload(raw: any): AnalysisResult | null {
  if (raw === undefined || raw === null) return null;

  const value = parseMaybeJson(raw);

  if (!value) return null;

  if (Array.isArray(value)) {
    const last = value[value.length - 1];
    return normalizeAnalysisPayload(last);
  }

  if (typeof value !== "object") {
    return null;
  }

  const nestedRules = value.rules_result ? normalizeAnalysisPayload(value.rules_result) : null;
  const nestedAnalysis = value.analysis ? normalizeAnalysisPayload(value.analysis) : null;

  const blocks =
    (Array.isArray(value.blocks) ? value.blocks : undefined) ??
    nestedRules?.blocks ??
    nestedAnalysis?.blocks ??
    [];

  const finalClassification =
    (value.finalClassification ??
      value.final_classification ??
      nestedRules?.finalClassification ??
      nestedAnalysis?.finalClassification) as FinalClassification | undefined;

  if (!blocks.length && !finalClassification) {
    return null;
  }

  return {
    blocks,
    finalClassification,
  };
}

function normalizeCaseResponse(payload: any): FrontendCase {
  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta do backend inválida ao carregar o caso.");
  }

  const idSource = payload.id ?? payload.case_id ?? payload.caseId;
  if (idSource === undefined || idSource === null) {
    throw new Error("Resposta do backend sem identificador do caso.");
  }

  const { status, raw } = normalizeCaseStatus(payload.status);

  const companyFromFlat =
    payload.company_name || payload.companyCNPJ
      ? {
          name: payload.company_name ?? payload.companyName ?? "",
          cnpj: payload.company_cnpj ?? payload.companyCNPJ,
        }
      : null;

  const workerFromFlat =
    payload.worker_name || payload.workerCPF
      ? {
          name: payload.worker_name ?? payload.workerName ?? "",
          cpf: payload.worker_cpf ?? payload.workerCPF,
        }
      : null;

  return {
    id: String(idSource),
    status,
    statusRaw: raw,
    createdAt: payload.created_at ?? payload.createdAt ?? null,
    updatedAt: payload.updated_at ?? payload.updatedAt ?? null,
    company: payload.company ?? payload.companies ?? companyFromFlat ?? null,
    worker: payload.worker ?? payload.workers ?? workerFromFlat ?? null,
    documents: normalizeDocuments(payload.documents ?? payload.case_documents ?? []),
    analysis: normalizeAnalysisPayload(payload.analysis ?? payload.case_analysis ?? null),
  };
}

async function raiseApiError(response: Response): Promise<never> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }

  let parsed: any = null;
  if (text) {
    parsed = tryParseJson(text);
  }

  const message =
    parsed?.message ||
    parsed?.error ||
    (typeof parsed === "string" ? parsed : "") ||
    text ||
    `HTTP error ${response.status}`;

  const code =
    parsed?.code ||
    parsed?.error_code ||
    parsed?.error ||
    parsed?.type ||
    undefined;

  throw new ApiError({
    status: response.status,
    code,
    message,
    details: parsed ?? text,
  });
}

// Helper para checar resposta
async function handleJsonResponse(response: Response) {
  if (!response.ok) {
    await raiseApiError(response);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function handleBlobResponse(response: Response) {
  if (!response.ok) {
    await raiseApiError(response);
  }
  return response.blob();
}

// 1. getCases
export async function getCases(): Promise<FrontendCase[]> {
  const res = await fetch(`${API_BASE_URL}/cases`);

  const raw = await handleJsonResponse(res);

  const list = Array.isArray(raw) ? raw : raw?.data;
  if (!Array.isArray(list)) {
    return raw ? [normalizeCaseResponse(raw)] : [];
  }

  // Garante o formato esperado no frontend
  return list.map((item) => normalizeCaseResponse(item));
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
  const data = await handleJsonResponse(res);
  if (!data) {
    throw new Error("Resposta do backend vazia ao criar o caso.");
  }
  return normalizeCaseResponse(data);
}

// 2. getCaseById
export async function getCaseById(id: string): Promise<FrontendCase> {
  const res = await fetch(`${API_BASE_URL}/cases/${id}`);

  const data = await handleJsonResponse(res);

  return normalizeCaseResponse(data);
}

// 3. uploadPPP
export async function uploadPPP(caseId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("ppp", file);

  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/ppp`, {
    method: "POST",
    body: formData,
  });

  await handleJsonResponse(res);
}

// 4. generateAnalysis -> agora retorna o payload completo criado pelo backend
export async function generateCaseAnalysis(caseId: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/analysis`, {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  const normalized = normalizeAnalysisPayload(
    data?.analysis ?? data?.rules_result ?? data
  );
  if (!normalized) {
    throw new Error("Resposta de anǭlise inválida do backend.");
  }
  return normalized;
}

// Alias para retrocompatibilidade
export const generateAnalysis = generateCaseAnalysis;

// 5. downloadPPP -> retorna Blob
export async function downloadPPP(caseId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/ppp`);
  return handleBlobResponse(res);
}

// 6. downloadReport -> retorna Blob
export async function downloadReport(caseId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/report`);
  return handleBlobResponse(res);
}

// Helpers que retornam URLs diretas (úteis para abrir em nova aba)
export function getPPPUrl(caseId: string) {
  return `${API_BASE_URL}/cases/${caseId}/ppp`;
}

export function getReportUrl(caseId: string) {
  return `${API_BASE_URL}/cases/${caseId}/report`;
}
