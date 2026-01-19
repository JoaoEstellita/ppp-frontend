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

export type CaseStatus =
  | "awaiting_payment"
  | "awaiting_pdf"
  | "ready_to_process"
  | "processing"
  | "paid_processing"
  | "done"
  | "pending_info"
  | "error";

const KNOWN_CASE_STATUSES: CaseStatus[] = [
  "awaiting_payment",
  "awaiting_pdf",
  "ready_to_process",
  "processing",
  "paid_processing",
  "done",
  "pending_info",
  "error",
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
  document_type?: string;
  fileName?: string;
  url?: string;
};

export type CasePayment = {
  id: string;
  status: string;
  amount?: number;
  payment_url?: string | null;
  paymentUrl?: string | null;
  paid_at?: string | null;
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
  createdAt: string | null;
  updatedAt?: string | null;
  company?: FrontendCompany | null;
  worker?: FrontendWorker | null;
  documents?: FrontendDocument[];
  analysis?: CaseAnalysis | null;
  payment?: CasePayment | null;
  manual_override_paid?: boolean;
  // Campos N8N robustez
  processing_started_at?: string | null;
  last_submit_at?: string | null;
  submit_attempts?: number;
  last_n8n_status?: 'submitted' | 'success' | 'error' | 'timeout' | 'network_error' | null;
  last_n8n_error?: string | null;
  last_n8n_callback_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  last_error_step?: string | null;
  last_error_at?: string | null;
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
  blockId?: '5.1' | '5.2' | '5.3' | '5.4' | '5.5' | string;
  title?: string;       // ex: 'Dados Administrativos (Itens 1 a 12)'
  analysis?: string;
  isCompliant?: boolean;
  issues?: string[];
  status?: BlockStatus;
  findings?: BlockFinding[];
  [key: string]: any;
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
  html?: string | null;
  parsedPpp?: any;
  results?: AnalysisResult;
  finalClassification?: string;
  extraMetadata?: {
    specialPeriods?: string[];
    observations?: string;
    [key: string]: any;
  } | null;
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

export type OrgNotification = {
  id: string;
  org_id: string;
  user_id?: string | null;
  case_id?: string | null;
  type: string;
  title?: string | null;
  body?: string | null;
  read_at?: string | null;
  created_at?: string | null;
};

export type OrgMetrics = {
  year_month: string;
  statusCounts: Record<string, number>;
  paidCount: number;
  grossAmount: number;
  referralCount?: number;
  referralPaidCount?: number;
};

export type OrgUnionCode = {
  id: string;
  union_code: string | null;
  union_code_active: boolean;
  union_code_expires_at: string | null;
  union_code_updated_at: string | null;
};

export type OrgWorker = {
  id: string;
  name: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  created_at?: string | null;
};

export type OrgCompany = {
  id: string;
  name: string | null;
  cnpj?: string | null;
  created_at?: string | null;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at?: string | null;
};

export type BillingMonth = {
  org_id: string;
  year_month: string;
  paid_count: number;
  gross_amount: number;
  share_percent: number;
  share_amount: number;
  status: string;
  generated_at?: string | null;
};

function normalizeCaseStatus(rawStatus: unknown): { status: CaseStatus; raw: string | null } {
  if (rawStatus === undefined || rawStatus === null) {
    return { status: "awaiting_payment", raw: null };
  }

  const rawString = String(rawStatus);
  const lower = rawString.toLowerCase();

  const match = KNOWN_CASE_STATUSES.find((status) => status === lower);
  if (match) {
    return { status: match, raw: rawString };
  }

  return { status: "awaiting_payment", raw: rawString };
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

  const rawBlocks =
    (Array.isArray(value.blocks) ? value.blocks : undefined) ??
    nestedResults?.blocks ??
    nestedRules?.blocks ??
    nestedAnalysis?.blocks ??
    [];
  const blocks: BlockAnalysis[] | undefined = Array.isArray(rawBlocks)
    ? rawBlocks.map((block: any) => {
        if (!block) return null;
        const blockId = block.blockId ?? block.id;
        const isCompliant =
          typeof block.isCompliant === "boolean"
            ? block.isCompliant
            : block.status
            ? String(block.status).toUpperCase() === "APPROVED"
            : undefined;
        const issues = Array.isArray(block.issues)
          ? block.issues.map((item: any) => String(item))
          : [];
        return {
          blockId,
          title: block.title ?? block.name ?? block.label,
          analysis: block.analysis ?? block.text ?? block.details,
          isCompliant,
          issues,
          status: block.status,
          findings: block.findings,
        } as BlockAnalysis;
      }).filter((b): b is BlockAnalysis => Boolean(b))
    : undefined;

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
    value.html ??
    extraMetadata?.parecerHtml ??
    extraMetadata?.html ??
    rawAiResult?.parecerHtml ??
    rawAiResult?.html ??
    null;
  const parsedPpp =
    value.parsedPpp ??
    value.parsed_ppp ??
    extraMetadata?.parsedPpp ??
    rawAiResult?.parsedPpp ??
    null;
  const results = normalizeAnalysisPayload(value.results ?? value.rules_result ?? value.rulesResult);

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
    html: parecerHtml ?? undefined,
    parsedPpp,
    results: results ?? undefined,
    finalClassification:
      value.finalClassification ??
      value.final_classification ??
      rulesResult?.finalClassification,
    extraMetadata:
      extraMetadata ??
      value.extra_metadata ??
      value.extraMetadata ??
      value.metadata ??
      null,
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
    payment: payload.payment ?? base.payment ?? null,
    analysis: normalizeCaseAnalysis(
      payload.analysis ??
        base.analysis ??
        payload.case_analysis ??
        base.case_analysis ??
        null
    ),
    manual_override_paid: base.manual_override_paid ?? payload.manual_override_paid ?? false,
    // Campos N8N robustez
    processing_started_at: base.processing_started_at ?? payload.processing_started_at ?? null,
    last_submit_at: base.last_submit_at ?? payload.last_submit_at ?? null,
    submit_attempts: base.submit_attempts ?? payload.submit_attempts ?? 0,
    last_n8n_status: base.last_n8n_status ?? payload.last_n8n_status ?? null,
    last_n8n_error: base.last_n8n_error ?? payload.last_n8n_error ?? null,
    last_n8n_callback_at: base.last_n8n_callback_at ?? payload.last_n8n_callback_at ?? null,
    last_error_code: base.last_error_code ?? payload.last_error_code ?? null,
    last_error_message: base.last_error_message ?? payload.last_error_message ?? null,
    last_error_step: base.last_error_step ?? payload.last_error_step ?? null,
    last_error_at: base.last_error_at ?? payload.last_error_at ?? null,
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

function orgPath(orgSlug: string, path: string) {
  return `/orgs/${orgSlug}${path}`;
}

// 1. getCases
export async function getCases(orgSlug: string): Promise<FrontendCase[]> {
  const res = await apiFetch(orgPath(orgSlug, "/cases"));

  const raw = await handleJsonResponse(res);

  const list = Array.isArray(raw) ? raw : raw?.data;
  if (!Array.isArray(list)) {
    return raw ? [normalizeCaseResponse(raw)] : [];
  }

  // Garante o formato esperado no frontend
  return list.map((item) => normalizeCaseResponse(item));
}

// 1b. createCase
export async function createCase(
  orgSlug: string,
  payload: {
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
}): Promise<FrontendCase> {
  const res = await apiFetch(orgPath(orgSlug, "/cases"), {
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
export async function getCaseDetail(orgSlug: string, id: string): Promise<CaseDetail> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${id}`));
  const data = await handleJsonResponse(res);
  return normalizeCaseDetail(data);
}

export async function generateCaseAnalysis(
  orgSlug: string,
  caseId: string,
  file: File
): Promise<CaseDetail> {
  const formData = new FormData();
  formData.append("pppFile", file);

  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/analysis`), {
    method: "POST",
    body: formData,
  });

  const data = await handleJsonResponse(res);

  return normalizeCaseDetail(data);
}

export async function createPaymentLink(
  orgSlug: string,
  caseId: string
): Promise<{ payment_url?: string | null; paymentUrl?: string | null }> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/payment-link`), {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data ?? {};
}

export async function getNotifications(orgSlug: string, limit = 50): Promise<OrgNotification[]> {
  const res = await apiFetch(orgPath(orgSlug, `/notifications?limit=${limit}`));
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

export async function markNotificationRead(orgSlug: string, id: string): Promise<OrgNotification> {
  const res = await apiFetch(orgPath(orgSlug, `/notifications/${id}/read`), {
    method: "PATCH",
  });
  const data = await handleJsonResponse(res);
  return data as OrgNotification;
}

export async function getOrgMetrics(orgSlug: string, yearMonth?: string): Promise<OrgMetrics> {
  const suffix = yearMonth ? `?year_month=${yearMonth}` : "";
  const res = await apiFetch(orgPath(orgSlug, `/metrics${suffix}`));
  const data = await handleJsonResponse(res);
  return data as OrgMetrics;
}

export async function getOrgUnionCode(orgId: string): Promise<OrgUnionCode> {
  const res = await apiFetch(`/orgs/${orgId}/union-code`);
  return handleJsonResponse(res);
}

export async function updateOrgUnionCode(
  orgId: string,
  payload: {
    union_code?: string | null;
    union_code_active?: boolean;
    union_code_expires_at?: string | null;
  }
): Promise<OrgUnionCode> {
  const res = await apiFetch(`/orgs/${orgId}/union-code`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(res);
}

export async function getWorkers(orgSlug: string): Promise<OrgWorker[]> {
  const res = await apiFetch(orgPath(orgSlug, "/workers"));
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

export async function createWorker(
  orgSlug: string,
  payload: { name: string; cpf?: string; birth_date?: string }
): Promise<OrgWorker> {
  const res = await apiFetch(orgPath(orgSlug, "/workers"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await handleJsonResponse(res);
  return data as OrgWorker;
}

export async function getCompanies(orgSlug: string): Promise<OrgCompany[]> {
  const res = await apiFetch(orgPath(orgSlug, "/companies"));
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

export async function createCompany(
  orgSlug: string,
  payload: { name: string; cnpj?: string }
): Promise<OrgCompany> {
  const res = await apiFetch(orgPath(orgSlug, "/companies"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await handleJsonResponse(res);
  return data as OrgCompany;
}

export async function getOrganizations(): Promise<Organization[]> {
  const res = await apiFetch("/admin/organizations");
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

export async function createOrganization(payload: {
  name: string;
  slug: string;
  user_id: string;
}): Promise<Organization> {
  const res = await apiFetch("/admin/organizations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await handleJsonResponse(res);
  return data as Organization;
}

export async function getAdminPayments(): Promise<any[]> {
  const res = await apiFetch("/admin/payments");
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

export async function getAdminUsage(): Promise<any[]> {
  const res = await apiFetch("/admin/usage");
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

export async function getBillingMonths(yearMonth?: string): Promise<BillingMonth[]> {
  const suffix = yearMonth ? `?year_month=${yearMonth}` : "";
  const res = await apiFetch(`/admin/billing-months${suffix}`);
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

export async function generateBillingMonths(yearMonth: string): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/admin/billing-months/generate?year_month=${yearMonth}`, {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean };
}

// ========== DEV ENDPOINTS (apenas para ambiente de desenvolvimento) ==========

export type DevMarkPaidResponse = {
  ok: boolean;
  message: string;
  case_id: string;
  status: CaseStatus;
  amount?: number;
  currency?: string;
  idempotent?: boolean;
};

export type DevAttachPdfResponse = {
  ok: boolean;
  message: string;
  case_id: string;
  status: CaseStatus;
  file_path: string;
};

/**
 * Simula pagamento aprovado para um caso (apenas em ambiente DEV)
 */
export async function devMarkCaseAsPaid(
  orgSlug: string,
  caseId: string
): Promise<DevMarkPaidResponse> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/dev/mark-paid`), {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as DevMarkPaidResponse;
}

/**
 * Anexa um PDF fake para testar download (apenas em ambiente DEV)
 */
export async function devAttachFakePdf(
  orgSlug: string,
  caseId: string
): Promise<DevAttachPdfResponse> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/dev/attach-pdf`), {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as DevAttachPdfResponse;
}

// ========== AUTH / MEMBERSHIP ==========

export type SyncMembershipResponse = {
  ok: boolean;
  status: "already_member" | "platform_admin" | "no_invite" | "invite_accepted";
  org_slug: string | null;
};

/**
 * Sincroniza membership do usuário - aceita convite pendente se existir
 */
export async function syncMembership(): Promise<SyncMembershipResponse> {
  const res = await apiFetch("/auth/sync-membership", {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as SyncMembershipResponse;
}

// ========== ADMIN INVITES ==========

export type OrgInvite = {
  id: string;
  org_id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked";
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
};

export async function createOrgInvite(
  orgId: string,
  email: string,
  role: string = "org_admin"
): Promise<OrgInvite> {
  const res = await apiFetch(`/admin/orgs/${orgId}/invites`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
  const data = await handleJsonResponse(res);
  return data as OrgInvite;
}

export async function createBulkOrgInvites(
  orgId: string,
  emails: string[],
  role: string = "org_admin"
): Promise<{ ok: boolean; results: Array<{ email: string; status: string; invite_id?: string; error?: string }> }> {
  const res = await apiFetch(`/admin/orgs/${orgId}/invites/bulk`, {
    method: "POST",
    body: JSON.stringify({ emails, role }),
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean; results: Array<{ email: string; status: string; invite_id?: string; error?: string }> };
}

export async function listOrgInvites(orgId: string): Promise<OrgInvite[]> {
  const res = await apiFetch(`/admin/orgs/${orgId}/invites`);
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

export async function revokeOrgInvite(orgId: string, inviteId: string): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/admin/orgs/${orgId}/invites/${inviteId}`, {
    method: "DELETE",
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean };
}

// ========== RETRY E SUPORTE ==========

export type RetryResponse = {
  ok: boolean;
  message: string;
  retry_count: number;
};

export type SupportRequestResponse = {
  ok: boolean;
  message: string;
  request_id: string;
};

export type SupportCaseItem = {
  case_id: string;
  org_id: string;
  org_name: string | null;
  org_slug: string | null;
  case_status: string;
  retry_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  last_error_step: string | null;
  last_error_at: string | null;
  worker_name: string | null;
  worker_cpf: string | null;
  company_name: string | null;
  company_cnpj: string | null;
  support_request: {
    id: string;
    status: string;
    message: string | null;
    created_at: string;
  } | null;
  created_at: string;
};

/**
 * Sindicato solicita retry de um caso com erro
 */
export async function retryCase(orgSlug: string, caseId: string): Promise<RetryResponse> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/retry`), {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as RetryResponse;
}

/**
 * Sindicato solicita ajuda do suporte
 */
export async function requestSupport(
  orgSlug: string,
  caseId: string,
  message?: string
): Promise<SupportRequestResponse> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/support-request`), {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  const data = await handleJsonResponse(res);
  return data as SupportRequestResponse;
}

/**
 * Admin lista casos com erro/suporte
 */
export async function adminListSupportCases(filter?: "open" | "all" | "error" | "processing"): Promise<SupportCaseItem[]> {
  const suffix = filter ? `?status=${filter}` : "";
  const res = await apiFetch(`/admin/support/cases${suffix}`);
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

/**
 * Admin força retry de um caso
 */
export async function adminRetryCase(caseId: string): Promise<RetryResponse> {
  const res = await apiFetch(`/admin/support/cases/${caseId}/retry`, {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as RetryResponse;
}

/**
 * Admin resolve solicitação de suporte
 */
export async function adminResolveSupport(requestId: string): Promise<{ ok: boolean; message: string }> {
  const res = await apiFetch(`/admin/support/requests/${requestId}/resolve`, {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean; message: string };
}

/**
 * Admin reprocessa casos em lote
 */
export async function adminRetryBulk(params?: { status?: string; limit?: number }): Promise<{
  ok: boolean;
  message: string;
  processed: number;
  skipped: number;
  total?: number;
}> {
  const res = await apiFetch("/admin/support/cases/retry-bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean; message: string; processed: number; skipped: number; total?: number };
}

/**
 * Admin reseta caso para aguardando PDF
 */
export async function adminResetAwaitingPdf(caseId: string): Promise<{ ok: boolean; message: string; status: string }> {
  const res = await apiFetch(`/admin/cases/${caseId}/reset-awaiting-pdf`, {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean; message: string; status: string };
}

/**
 * Admin lista eventos de um caso (auditoria)
 */
export type CaseEvent = {
  id: string;
  case_id: string;
  org_id: string;
  type: string;
  actor_user_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export async function adminListCaseEvents(caseId: string, limit?: number): Promise<CaseEvent[]> {
  const suffix = limit ? `?limit=${limit}` : "";
  const res = await apiFetch(`/admin/cases/${caseId}/events${suffix}`);
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

// ========== SUBMIT PARA ANÁLISE (N8N) ==========

export type SubmitResponse = {
  ok: boolean;
  message: string;
  status?: CaseStatus;
  idempotent?: boolean;
};

/**
 * Sindicato envia caso para análise (n8n)
 */
export async function submitCase(orgSlug: string, caseId: string): Promise<SubmitResponse> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/submit`), {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as SubmitResponse;
}

/**
 * Admin envia caso para análise (n8n)
 */
export async function adminSubmitCase(caseId: string): Promise<SubmitResponse> {
  const res = await apiFetch(`/admin/cases/${caseId}/submit`, {
    method: "POST",
  });
  const data = await handleJsonResponse(res);
  return data as SubmitResponse;
}

/**
 * Admin envia múltiplos casos para análise em lote
 */
export async function adminSubmitBulk(params?: { status?: string; limit?: number }): Promise<{
  ok: boolean;
  message: string;
  submitted: number;
  skipped: number;
  failed: number;
  total?: number;
}> {
  const res = await apiFetch("/admin/support/cases/submit-bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean; message: string; submitted: number; skipped: number; failed: number; total?: number };
}

/**
 * Admin marca caso stuck como erro manualmente
 */
export async function adminMarkCaseAsError(caseId: string, reason?: string): Promise<{ ok: boolean; message: string }> {
  const res = await apiFetch(`/admin/cases/${caseId}/mark-error`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean; message: string };
}

// ========== DOCUMENTOS ==========

export type CaseDocument = {
  id: string;
  case_id?: string;
  document_type: string;
  original_name: string | null;
  mime_type: string | null;
  storage_path: string | null;
  file_url: string | null;
  created_at: string;
};

export type UploadPppInputResponse = {
  ok: boolean;
  documentId: string;
  status: CaseStatus;
  message: string;
};

export type DownloadResponse = {
  signedUrl: string;
  fileName: string;
  expiresIn: number;
};

export type UpdateCaseDetailsPayload = {
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
};

/**
 * Upload do PDF do PPP (sindicato)
 */
export async function uploadPppInput(
  orgSlug: string,
  caseId: string,
  file: File
): Promise<UploadPppInputResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/documents/ppp-input`), {
    method: "POST",
    body: formData,
  });
  const data = await handleJsonResponse(res);
  return data as UploadPppInputResponse;
}

export async function adminUploadPppInput(
  caseId: string,
  file: File
): Promise<UploadPppInputResponse> {
  const formData = new FormData();
  formData.append("pppFile", file);

  const res = await apiFetch(`/admin/cases/${caseId}/documents/ppp-input`, {
    method: "POST",
    body: formData,
  });
  const data = await handleJsonResponse(res);
  return data as UploadPppInputResponse;
}

/**
 * Listar documentos de um caso
 */
export async function listCaseDocuments(
  orgSlug: string,
  caseId: string
): Promise<CaseDocument[]> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/documents`));
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

/**
 * Obter signed URL para download de documento
 */
export async function getDocumentDownloadUrl(
  orgSlug: string,
  caseId: string,
  docId: string
): Promise<DownloadResponse> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/documents/${docId}/download`));
  const data = await handleJsonResponse(res);
  return data as DownloadResponse;
}

/**
 * Atualiza dados cadastrais do caso (sindicato)
 */
export async function updateCaseDetails(
  orgSlug: string,
  caseId: string,
  payload: UpdateCaseDetailsPayload
): Promise<{ ok: boolean }> {
  const res = await apiFetch(orgPath(orgSlug, `/cases/${caseId}/details`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean };
}

// ========== ADMIN CASES ==========

export type AdminCaseItem = {
  id: string;
  org_id: string;
  org_name: string | null;
  org_slug: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  retry_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  last_error_step: string | null;
  last_error_at: string | null;
  worker_name: string | null;
  worker_cpf: string | null;
  company_name: string | null;
  company_cnpj: string | null;
};

export type AdminCaseDetail = {
  case: {
    id: string;
    org_id: string;
    org_name: string | null;
    org_slug: string | null;
    status: string;
    created_at: string;
    updated_at: string | null;
    user_id: string;
    retry_count: number;
    last_error_code: string | null;
    last_error_message: string | null;
    last_error_step: string | null;
    last_error_at: string | null;
    // Campos N8N robustness
    processing_started_at: string | null;
    last_submit_at: string | null;
    submit_attempts: number;
    last_n8n_status: string | null;
    last_n8n_error: string | null;
    last_n8n_callback_at: string | null;
    n8n_correlation_id: string | null;
  };
  worker: { id: string; name: string | null; cpf: string | null; birth_date?: string } | null;
  company: { id: string; name: string | null; cnpj: string | null } | null;
  documents: CaseDocument[];
  analysis: { id: string; final_classification: string | null; created_at: string } | null;
  payment: { id: string; status: string; amount: number | null; paid_at: string | null } | null;
  supportRequest: { id: string; status: string; message: string | null; created_at: string; resolved_at: string | null } | null;
  workflowLogs: { id: string; step: string; status: string; message: string | null; created_at: string }[];
};

/**
 * Admin lista todos os casos
 */
export async function adminListCases(status?: string): Promise<AdminCaseItem[]> {
  const suffix = status && status !== "all" ? `?status=${status}` : "";
  const res = await apiFetch(`/admin/cases${suffix}`);
  const data = await handleJsonResponse(res);
  return Array.isArray(data) ? data : [];
}

/**
 * Admin obtém detalhes de um caso
 */
export async function adminGetCase(caseId: string): Promise<AdminCaseDetail> {
  const res = await apiFetch(`/admin/cases/${caseId}`);
  const data = await handleJsonResponse(res);
  return data as AdminCaseDetail;
}

/**
 * Admin download de documento
 */
export async function adminGetDocumentDownloadUrl(
  caseId: string,
  docId: string
): Promise<DownloadResponse> {
  const res = await apiFetch(`/admin/cases/${caseId}/documents/${docId}/download`);
  const data = await handleJsonResponse(res);
  return data as DownloadResponse;
}

/**
 * Atualiza dados cadastrais do caso (admin)
 */
export async function adminUpdateCaseDetails(
  caseId: string,
  payload: UpdateCaseDetailsPayload
): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/admin/cases/${caseId}/details`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJsonResponse(res);
  return data as { ok: boolean };
}








export type PublicUnionCodeResponse = {
  valid: boolean;
  org_name?: string | null;
  price: number;
  normalized_code?: string;
};

export type PublicCaseResponse = {
  case_id: string;
  status: string;
  price: number;
  ref_org_id?: string | null;
  union_code_applied?: string | null;
};

export type PublicCaseDetail = {
  case: any;
  payment: any | null;
};

export async function validateUnionCodePublic(code: string): Promise<PublicUnionCodeResponse> {
  const res = await apiFetch('/public/union-code/validate', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return handleJsonResponse(res);
}

export async function createPublicCase(params: {
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
  workerEmail?: string;
  unionCode?: string;
  file: File;
}): Promise<PublicCaseResponse> {
  const formData = new FormData();
  formData.append('workerName', params.workerName);
  formData.append('workerCPF', params.workerCPF);
  formData.append('companyName', params.companyName);
  formData.append('companyCNPJ', params.companyCNPJ);
  if (params.workerEmail) {
    formData.append('email', params.workerEmail);
  }
  if (params.unionCode) {
    formData.append('union_code', params.unionCode);
  }
  formData.append('file', params.file);

  const res = await apiFetch('/public/cases', {
    method: 'POST',
    body: formData,
  });

  return handleJsonResponse(res);
}

export async function createPublicPayment(caseId: string): Promise<{ payment_url: string; final_price: number }> {
  const res = await apiFetch(`/public/cases/${caseId}/payment`, {
    method: 'POST',
  });
  return handleJsonResponse(res);
}

export async function getPublicCase(caseId: string): Promise<PublicCaseDetail> {
  const res = await apiFetch(`/public/cases/${caseId}`);
  return handleJsonResponse(res);
}

export async function reuploadPublicPpp(caseId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch(`/public/cases/${caseId}/ppp`, {
    method: 'POST',
    body: formData,
  });
  return handleJsonResponse(res);
}

export async function getPublicResultDownload(caseId: string): Promise<{
  signedUrl: string;
  fileName?: string | null;
  expiresIn?: number;
}> {
  const res = await apiFetch(`/public/cases/${caseId}/result/download`);
  return handleJsonResponse(res);
}
