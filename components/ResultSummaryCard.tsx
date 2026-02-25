type ResultIssue =
  | string
  | {
      field?: string | null;
      problem?: string | null;
      severity?: string | null;
    };

type ResultFinding = {
  field_ref?: string | null;
  explanation?: string | null;
  evidence_excerpt?: string | null;
  severity?: string | null;
};

type ResultSummaryCardProps = {
  audience: "worker" | "union" | "admin";
  status?: string | null;
  finalClassification?: string | null;
  summary?: string | null;
  validationOk?: boolean | null;
  validationIssues?: string[];
  verifierRisk?: string | null;
  verifierIssues?: ResultIssue[];
  resultAvailable?: boolean;
  lastErrorMessage?: string | null;
  nextActions?: string[];
  updatedAt?: string | null;
  formalConformity?: "CONFORME" | "NAO_CONFORME" | null;
  technicalConformity?: "CONFORME" | "PENDENTE" | "NAO_CONFORME" | null;
  probativeValue?: "SUFICIENTE" | "INSUFICIENTE" | "INEXISTENTE" | null;
  confidenceLevel?: "ALTO" | "MODERADO" | "BAIXO" | null;
  findingsWithEvidence?: ResultFinding[];
};

function classificationLabel(value?: string | null): string {
  switch (value) {
    case "ATENDE_INTEGRALMENTE":
      return "Atende integralmente";
    case "POSSUI_INCONSISTENCIAS_SANAVEIS":
      return "Possui inconsistencias sanaveis";
    case "NAO_POSSUI_VALIDADE_TECNICA":
      return "Nao possui validade tecnica";
    default:
      return value || "Nao classificado";
  }
}

function statusLabel(value?: string | null): string {
  switch (value) {
    case "done":
      return "Concluido";
    case "done_warning":
      return "Concluido com alerta";
    case "processing":
    case "paid_processing":
      return "Em processamento";
    case "ready_to_process":
      return "Pronto para enviar";
    case "error":
      return "Acao necessaria";
    case "awaiting_payment":
      return "Aguardando pagamento";
    case "awaiting_pdf":
      return "Aguardando documento";
    default:
      return value || "-";
  }
}

function panelTone(status?: string | null, resultAvailable?: boolean, hasCriticalIssue?: boolean) {
  if (resultAvailable || status === "done" || status === "done_warning") {
    return "border-emerald-200 bg-emerald-50";
  }
  if (hasCriticalIssue || status === "error") {
    return "border-red-200 bg-red-50";
  }
  if (status === "processing" || status === "paid_processing") {
    return "border-blue-200 bg-blue-50";
  }
  return "border-slate-200 bg-slate-50";
}

function normalizeIssue(issue: ResultIssue): string {
  if (typeof issue === "string") return issue;
  const field = String(issue.field || "").trim();
  const problem = String(issue.problem || "").trim();
  if (field && problem) return `${field}: ${problem}`;
  return field || problem || "";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function conformityLabel(value?: string | null): string {
  if (!value) return "-";
  if (value === "CONFORME") return "Conforme";
  if (value === "PENDENTE") return "Pendente";
  if (value === "NAO_CONFORME") return "Nao conforme";
  return value;
}

function probativeLabel(value?: string | null): string {
  if (!value) return "-";
  if (value === "SUFICIENTE") return "Suficiente";
  if (value === "INSUFICIENTE") return "Insuficiente";
  if (value === "INEXISTENTE") return "Inexistente";
  return value;
}

function confidenceLabel(value?: string | null): string {
  if (!value) return "-";
  if (value === "ALTO") return "Alto";
  if (value === "MODERADO") return "Moderado";
  if (value === "BAIXO") return "Baixo";
  return value;
}

function severityLabel(value?: string | null): string {
  const token = String(value || "").toUpperCase();
  if (token === "CRITICAL") return "Critico";
  if (token === "WARNING") return "Alerta";
  if (token === "INFO") return "Info";
  return token || "-";
}

export function ResultSummaryCard(props: ResultSummaryCardProps) {
  const issues = [
    ...(props.validationIssues || []),
    ...((props.verifierIssues || []).map(normalizeIssue).filter(Boolean)),
  ].slice(0, 4);
  const findings = (props.findingsWithEvidence || []).filter(Boolean).slice(0, 5);

  const hasCriticalIssue =
    props.validationOk === false ||
    String(props.verifierRisk || "").toLowerCase() === "high" ||
    (props.validationIssues || []).length > 0;

  const tone = panelTone(props.status, props.resultAvailable, hasCriticalIssue);
  const titleByAudience: Record<ResultSummaryCardProps["audience"], string> = {
    worker: "Resumo do seu resultado",
    union: "Resumo tecnico do caso",
    admin: "Resumo operacional do resultado",
  };

  const defaultSummary =
    props.resultAvailable || props.status === "done" || props.status === "done_warning"
      ? "Resultado final disponivel para download."
      : props.status === "processing" || props.status === "paid_processing"
      ? "Analise em andamento. Aguarde a conclusao do processamento."
      : props.status === "error"
      ? "Ha pendencias para concluir a analise."
      : "Caso em andamento.";

  const nextActions = (props.nextActions || []).filter(Boolean).slice(0, 3);

  return (
    <div className={`rounded-lg border p-5 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{titleByAudience[props.audience]}</h3>
        <span className="text-xs font-medium text-slate-700">Status: {statusLabel(props.status)}</span>
      </div>

      <p className="mt-3 text-sm text-slate-800">{props.summary || defaultSummary}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Classificacao</p>
          <p className="text-sm font-medium text-slate-900">{classificationLabel(props.finalClassification)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Atualizado em</p>
          <p className="text-sm font-medium text-slate-900">{formatDate(props.updatedAt)}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Conformidade formal</p>
          <p className="text-sm font-medium text-slate-900">{conformityLabel(props.formalConformity)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Conformidade tecnica</p>
          <p className="text-sm font-medium text-slate-900">{conformityLabel(props.technicalConformity)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Valor probatorio</p>
          <p className="text-sm font-medium text-slate-900">{probativeLabel(props.probativeValue)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Confianca</p>
          <p className="text-sm font-medium text-slate-900">{confidenceLabel(props.confidenceLevel)}</p>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold text-slate-700">Pontos de atencao</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-700 space-y-1">
            {issues.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {props.lastErrorMessage && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Ultimo alerta: {props.lastErrorMessage}
        </div>
      )}

      {nextActions.length > 0 && (
        <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold text-slate-700">Proximas acoes</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-700 space-y-1">
            {nextActions.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      {findings.length > 0 && (
        <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold text-slate-700">Achados com evidencia</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-700">
            {findings.map((finding, index) => (
              <li key={`${finding.field_ref || "field"}-${index}`} className="rounded border border-slate-100 px-2 py-2">
                <p className="font-semibold text-slate-800">
                  {finding.field_ref || "-"} - {severityLabel(finding.severity)}
                </p>
                <p>{finding.explanation || "-"}</p>
                {finding.evidence_excerpt ? (
                  <p className="mt-1 text-slate-500">Evidencia: &quot;{finding.evidence_excerpt}&quot;</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
