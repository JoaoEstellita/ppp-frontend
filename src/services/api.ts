import { getSupabaseClient } from "@/lib/supabaseClient";

// Central API client para o frontend
// Este arquivo fornece um conjunto de funcoes para consumir o backend PPP.

// Leitura da variavel de ambiente (compativel com Vite, CRA e Next.js)
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

// Fallback padrao agora e o backend em producao, NAO mais localhost
export const API_BASE_URL: string =
  nextEnv || viteEnv || craEnv || "https://ppp-backend-sjic.onrender.com";

const supabase = getSupabaseClient();

// Tipos basicos usados pelo frontend

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

// Tipo compativel com a estrutura antiga (para retrocompatibilidade com mock data)
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

// Tipos para analise do motor de regras
export type BlockStatus = 'APPROVED' | 'PENDING' | 'REPROVED' | 'NOT_EVALUATED';

export type FinalClassification =
  | 'ATENDE_INTEGRALMENTE'
  | 'POSSUI_INCONSISTENCIAS_SANAVEIS'
  | 'NAO_POSSUI_VALIDADE_TECNICA';

export interface BlockFinding {
  code: string;        // ex: 'CNPJ_INVALIDO', 'PROFISSIOGRAFIA_GENERICA_INVALIDA_PPP'
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;     // texto em portugues pronto pra mostrar na UI
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

export interface CaseAnalysis {
  id: string;
  case_id: string;
  created_at?: string | null;
  final_classification?: FinalClassification | string;
  emailsSentTo?: string[];
  extra_metadata?: any;
  rules_result?: AnalysisResult | null;
}

export interface CaseDetail {
  case: FrontendCase;
  worker?: FrontendWorker | null;
  company?: FrontendCompany | null;
  documents?: FrontendDocument[];
  analysis?: CaseAnalysis | null;
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

function ensureStringArray(value: any): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
}

function normalizeCaseAnalysis(raw: any): CaseAnalysis | null {
  if (!raw) return null;
  const value = parseMaybeJson(raw);
  if (!value || typeof value !== "object") return null;

  const rulesPayload =
    value.rules_result ??
    value.rulesResult ??
    value.analysis ??
    value.rules ??
    null;

  const rulesResult = normalizeAnalysisPayload(rulesPayload);

  const idSource = value.id ?? value.case_analysis_id ?? value.case_id;

  if (!idSource) {
    return null;
  }

  return {
    id: String(idSource),
    case_id: String(value.case_id ?? value.caseId ?? value.id ?? idSource),
    created_at: value.created_at ?? value.createdAt ?? null,
    final_classification:
      value.final_classification ??
      value.finalClassification ??
      rulesResult?.finalClassification,
    emailsSentTo: ensureStringArray(
      value.emailsSentTo ??
        value.emails_sent_to ??
        value.recipients ??
        value.recipients_list
    ),
    extra_metadata: value.extra_metadata ?? value.metadata ?? null,
    rules_result: rulesResult,
  };
}

function normalizeCaseResponse(payload: any): FrontendCase {
  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta do backend invalida ao carregar o caso.");
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

function normalizeCaseDetail(payload: any): CaseDetail {
  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta do backend invalida para detalhes do caso.");
  }

  const casePayload = payload.case ?? payload;
  const normalizedCase = normalizeCaseResponse(casePayload);

  const analysis = normalizeCaseAnalysis(
    payload.analysis ??
      payload.case_analysis ??
      casePayload.analysis ??
      casePayload.case_analysis ??
      null
  );

  return {
    case: normalizedCase,
    worker:
      payload.worker ??
      casePayload.worker ??
      normalizedCase.worker ??
      null,
    company:
      payload.company ??
      casePayload.company ??
      normalizedCase.company ??
      null,
    documents: normalizedCase.documents,
    analysis,
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

async function apiFetch(path: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers || {});

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

// 1. getCases
export async function getCases(): Promise<FrontendCase[]> {
  const res = await apiFetch("/cases");

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
  const res = await apiFetch("/cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await handleJsonResponse(res);
  if (!data) {
    throw new Error("Resposta do backend vazia ao criar o caso.");
  }
  return normalizeCaseResponse(data);
}

// 2. getCaseDetail
export async function getCaseDetail(id: string): Promise<CaseDetail> {
  const res = await apiFetch(`/cases/${id}`);
  const data = await handleJsonResponse(res);
  return normalizeCaseDetail(data);
}

export async function uploadPppAndGenerateAnalysis(
  caseId: string,
  file: File
): Promise<CaseAnalysis> {
  const formData = new FormData();
  formData.append("pppFile", file);

  const res = await apiFetch(`/cases/${caseId}/analysis`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errorMessage = "Falha ao enviar PPP para analise";
    try {
      const errorJson = await res.json();
      if (errorJson?.error) {
        errorMessage = errorJson.error;
      } else if (errorJson?.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  return (
    normalizeCaseAnalysis(data?.analysis ?? data) ?? {
      id: String(data?.id ?? caseId),
      case_id: caseId,
      created_at: data?.created_at ?? null,
      final_classification: data?.final_classification,
      emailsSentTo: ensureStringArray(data?.emailsSentTo ?? data?.emails_sent_to),
      extra_metadata: data?.extra_metadata ?? data?.metadata ?? null,
      rules_result: normalizeAnalysisPayload(data?.rules_result ?? data),
    }
  );
}
