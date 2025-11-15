// Types compatíveis com o backend
export type CaseStatus = "EM_ANALISE" | "COMPLETO" | "INCOMPLETO";

export interface Case {
  id: string;
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
  status: CaseStatus;
  createdAt: string;
  pppFileName?: string;
}

export interface BlockAnalysis {
  status: string;
  erros: string[];
}

export interface AnalysisResult {
  id: string;
  blocks: {
    bloco_5_1: BlockAnalysis;
    bloco_5_2: BlockAnalysis;
    bloco_5_3: BlockAnalysis;
    bloco_5_4: BlockAnalysis;
    bloco_5_5: BlockAnalysis;
  };
  conclusion: 1 | 2 | 3;
}

// Constante da URL base da API
const API_BASE_URL = "http://localhost:4000";

/**
 * Busca todos os casos
 */
export async function getCases(): Promise<Case[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/cases`);
    if (!response.ok) {
      throw new Error("Não foi possível comunicar com a API");
    }
    return await response.json();
  } catch (error) {
    throw new Error("Não foi possível comunicar com a API");
  }
}

/**
 * Busca um caso específico por ID
 */
export async function getCase(id: string): Promise<Case> {
  try {
    const response = await fetch(`${API_BASE_URL}/cases/${id}`);
    if (!response.ok) {
      throw new Error("Não foi possível comunicar com a API");
    }
    return await response.json();
  } catch (error) {
    throw new Error("Não foi possível comunicar com a API");
  }
}

/**
 * Cria um novo caso
 */
export async function createCase(payload: {
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
}): Promise<Case> {
  try {
    const response = await fetch(`${API_BASE_URL}/cases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("Não foi possível comunicar com a API");
    }
    return await response.json();
  } catch (error) {
    throw new Error("Não foi possível comunicar com a API");
  }
}

/**
 * Faz upload do arquivo PPP para um caso
 */
export async function uploadPPP(caseId: string, file: File): Promise<Case> {
  try {
    const formData = new FormData();
    formData.append("ppp", file);

    const response = await fetch(`${API_BASE_URL}/cases/${caseId}/ppp`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("Não foi possível comunicar com a API");
    }
    return await response.json();
  } catch (error) {
    throw new Error("Não foi possível comunicar com a API");
  }
}

/**
 * Busca a análise de um caso específico
 */
export async function getCaseAnalysis(id: string): Promise<AnalysisResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/cases/${id}/analysis`);
    if (!response.ok) {
      throw new Error("Não foi possível comunicar com a API");
    }
    return await response.json();
  } catch (error) {
    throw new Error("Não foi possível comunicar com a API");
  }
}

