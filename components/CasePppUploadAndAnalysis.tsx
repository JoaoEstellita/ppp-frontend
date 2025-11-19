"use client";

import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadPppAndGenerateAnalysis } from "@/src/services/api";
import { Button } from "@/components/Button";

interface Props {
  caseId: string;
  onCompleted?: () => Promise<void> | void;
}

export function CasePppUploadAndAnalysis({ caseId, onCompleted }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!file) return;
    try {
      setLoading(true);
      await uploadPppAndGenerateAnalysis(caseId, file);
      await onCompleted?.();
      router.refresh();
      alert("PPP enviado para analise. O parecer sera enviado por e-mail.");
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Erro ao enviar PPP para analise.");
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="text-sm"
      />
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!file || loading}
      >
        {loading ? "Enviando e gerando parecer..." : "Enviar PPP e gerar parecer"}
      </Button>
    </div>
  );
}
