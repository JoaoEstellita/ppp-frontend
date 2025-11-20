import { supabaseClient } from "@/lib/supabaseClient";

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

// Tipos basicos usados pelo frontend

export type BackendCaseStatus = "new" | "received" | "processing" | "analyzed" | "error";

export type CaseStatus = "EM_ANALISE" | "COMPLETO" | "INCOMPLETO" | "ERRO";

const BACKEND_TO_FRONTEND_STATUS: Record<BackendCaseStatus, CaseStatus> = {
  new: "INCOMPLETO",
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
  birthDate?: string;
};

export type FrontendDocument = {
  id: string;
  type: string; // ex: 'PPP'
  fileName?: string;
  url?: string;
};

export interface WorkflowLog {
  id: string;
  step: string;
  status?: string;
  message?: string | null;
  metadata?: any;
  created_at: string;
}

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
  id?: '5.1' | '5.2' | '5.3' | '5.4' | '5.5' | string;
  blockId?: string;
  title?: string;       // ex: 'Dados Administrativos (Itens 1 a 12)'
  status?: BlockStatus;
  findings?: BlockFinding[];
  analysis?: string;
  isCompliant?: boolean;
  issues?: string[];
}

export interface AnalysisResult {
  blocks?: BlockAnalysis[];
  finalClassification?: FinalClassification;
  summary?: string;
  flags?: string[];
}

export interface CaseAnalysis {
  id: string;
  case_id: string;
  created_at?: string | null;
  final_classification?: FinalClassification | string;
  emailsSentTo?: string[];
  raw_ai_result?: any;
  extra_metadata?: any;
  rules_result?: AnalysisResult | null;
  parecerHtml?: string | null;
}

export interface CaseDetail {
  case: FrontendCase;
  worker?: FrontendWorker | null;
  company?: FrontendCompany | null;
  documents?: FrontendDocument[];
  analysis?: CaseAnalysis | null;
  workflowLogs?: WorkflowLog[];
  emailsSentTo?: string[];
}

const BACKEND_STATUS_VALUES: BackendCaseStatus[] = [
  "new",
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

function normalizeWorkflowLogs(raw: any): WorkflowLog[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((log) => {
      if (!log) return null;
      const idSource = log.id ?? log.log_id ?? log.workflow_log_id;
      if (!idSource) return null;
      const createdAt = log.created_at ?? log.createdAt ?? null;
      if (!createdAt) return null;
      return {
        id: String(idSource),
        step: String(log.step ?? "UNKNOWN"),
        status: log.status ?? undefined,
        message: log.message ?? null,
        metadata: log.metadata ?? null,
        created_at: createdAt,
      } as WorkflowLog;
    })
    .filter((log): log is WorkflowLog => Boolean(log));
}

function normalizeAnalysisPayload(raw: any): AnalysisResult | null {
  if (raw === undefined || raw === null) return null;

  const value = parseMaybeJson<Record<string, any>>(raw);

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
  const nestedResults =
    value.results && value.results !== value
      ? normalizeAnalysisPayload(value.results)
      : null;

  const blocks =
    (Array.isArray(value.blocks) ? value.blocks : undefined) ??
    nestedResults?.blocks ??
    nestedRules?.blocks ??
    nestedAnalysis?.blocks ??
    [];

  const finalClassification =
    (value.finalClassification ??
      value.final_classification ??
      nestedResults?.finalClassification ??
      nestedRules?.finalClassification ??
      nestedAnalysis?.finalClassification) as FinalClassification | undefined;

  const summary =
    value.summary ?? nestedResults?.summary ?? nestedRules?.summary ?? nestedAnalysis?.summary;

  const flags =
    (Array.isArray(value.flags) ? value.flags.map((flag) => String(flag)) : undefined) ??
    nestedResults?.flags ??
    nestedRules?.flags ??
    nestedAnalysis?.flags;

  if ((!blocks || blocks.length === 0) && !finalClassification && !summary && !flags?.length) {
    return null;
  }

  return {
    blocks,
    finalClassification,
    summary,
    flags,
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
  const value = parseMaybeJson<Record<string, any>>(raw);
  if (!value || typeof value !== "object") return null;

  const rulesPayload =
    value.results ??
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

  const rawAiResult =
    value.raw_ai_result ??
    value.rawAiResult ??
    value.raw ??
    null;
  const extraMetadata = value.extra_metadata ?? value.extraMetadata ?? value.metadata ?? null;
  const parecerHtml =
    value.parecerHtml ??
    value.parecer_html ??
    extraMetadata?.parecerHtml ??
    rawAiResult?.parecerHtml ??
    null;

  return {
    id: String(idSource),
    case_id: String(value.case_id ?? value.caseId ?? value.id ?? idSource),
    created_at: value.created_at ?? value.createdAt ?? value.generated_at ?? value.generatedAt ?? null,
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
    raw_ai_result: rawAiResult,
    extra_metadata: extraMetadata,
    rules_result: rulesResult,
    parecerHtml,
  };
}

function normalizeCaseResponse(payload: any): FrontendCase {
  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta do backend invalida ao carregar o caso.");
  }

  const base = payload.case ?? payload;

  const idSource = base.id ?? base.case_id ?? base.caseId;
  if (idSource === undefined || idSource === null) {
    throw new Error("Resposta do backend sem identificador do caso.");
  }

  const { status, raw } = normalizeCaseStatus(base.status);

  const companyFromFlat =
    payload.company_name || payload.companyCNPJ || base.company_name || base.companyCNPJ
      ? {
          name:
            payload.company_name ??
            payload.companyName ??
            base.company_name ??
            base.companyName ??
            "",
          cnpj:
            payload.company_cnpj ??
            payload.companyCNPJ ??
            base.company_cnpj ??
            base.companyCNPJ,
        }
      : null;

  const workerFromFlat =
    payload.worker_name ||
    payload.workerCPF ||
    base.worker_name ||
    base.workerCPF
      ? {
          name:
            payload.worker_name ??
            payload.workerName ??
            base.worker_name ??
            base.workerName ??
            "",
          cpf:
            payload.worker_cpf ??
            payload.workerCPF ??
            base.worker_cpf ??
            base.workerCPF,
          birthDate: payload.worker_birth_date ?? base.worker_birth_date,
        }
      : null;

  return {
    id: String(idSource),
    status,
    statusRaw: raw,
    createdAt: base.created_at ?? payload.created_at ?? base.createdAt ?? null,
    updatedAt: base.updated_at ?? payload.updated_at ?? base.updatedAt ?? null,
    company:
      payload.company ??
      base.company ??
      payload.companies ??
      companyFromFlat ??
      null,
    worker:
      payload.worker ??
      base.worker ??
      payload.workers ??
      workerFromFlat ??
      null,
    documents: normalizeDocuments(
      payload.documents ?? base.documents ?? payload.case_documents ?? []
    ),
    analysis: normalizeAnalysisPayload(
      payload.analysis ??
        base.analysis ??
        payload.case_analysis ??
        base.case_analysis ??
        null
    ),
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
    workflowLogs: normalizeWorkflowLogs(
      payload.workflowLogs ?? payload.workflow_logs ?? []
    ),
    emailsSentTo: analysis?.emailsSentTo,
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
  } = await supabaseClient.auth.getSession();

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

export async function generateCaseAnalysis(
  caseId: string,
  file: File
): Promise<{
  case: FrontendCase;
  analysis: CaseAnalysis | null;
  emailsSentTo: string[];
  workflowLogs: WorkflowLog[];
}> {
  const formData = new FormData();
  formData.append("pppFile", file);

  const res = await apiFetch(`/cases/${caseId}/analysis`, {
    method: "POST",
    body: formData,
  });

  const data = await handleJsonResponse(res);

  return {
    case: normalizeCaseResponse(data.case ?? data),
    analysis: normalizeCaseAnalysis(data.analysis ?? data),
    emailsSentTo:
      ensureStringArray(data.emailsSentTo ?? data.analysis?.emailsSentTo) ?? [],
    workflowLogs: normalizeWorkflowLogs(data.workflowLogs ?? data.workflow_logs ?? []),
  };
}








