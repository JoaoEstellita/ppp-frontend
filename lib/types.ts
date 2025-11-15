export type CaseStatus = "PENDENTE" | "EM_ANALISE" | "COMPLETO" | "INCOMPLETO" | "GENÉRICO";

export interface Case {
  id: string;
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
  status: CaseStatus;
  createdAt: string;
  pppFileName: string;
}

