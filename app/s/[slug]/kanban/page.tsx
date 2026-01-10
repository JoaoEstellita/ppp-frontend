"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getCases, FrontendCase } from "@/src/services/api";

const COLUMNS = [
  { key: "awaiting_payment", title: "Aguardando pagamento" },
  { key: "paid_processing", title: "Pago / Processando" },
  { key: "done", title: "Concluido" },
  { key: "pending_info", title: "Pendencias" },
  { key: "error", title: "Erro" },
];

export default function KanbanPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";
  const [cases, setCases] = useState<FrontendCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    getCases(slug)
      .then((data) => {
        if (active) setCases(data);
      })
      .catch(() => {
        if (active) setCases([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <div className="text-gray-600">Carregando kanban...</div>;
  }

  const grouped: Record<string, FrontendCase[]> = {};
  cases.forEach((item) => {
    const key = item.status ?? "awaiting_payment";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Kanban de casos</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((column) => (
          <div key={column.key} className="bg-gray-100 rounded-lg p-3 min-h-[300px]">
            <div className="text-sm font-semibold text-gray-700 mb-3">{column.title}</div>
            <div className="space-y-2">
              {(grouped[column.key] ?? []).map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/s/${slug}/casos/${caseItem.id}`}
                  className="block bg-white rounded-md p-3 shadow-sm hover:shadow transition"
                >
                  <div className="text-xs text-gray-500">Caso</div>
                  <div className="text-sm font-semibold text-gray-900">{caseItem.id}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {caseItem.worker?.name ?? "Trabalhador nao informado"}
                  </div>
                </Link>
              ))}
              {(grouped[column.key] ?? []).length === 0 && (
                <div className="text-xs text-gray-500">Sem casos</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

