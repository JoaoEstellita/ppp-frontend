"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [cardsPerPage, setCardsPerPage] = useState(8);
  const [columnPage, setColumnPage] = useState<Record<string, number>>({});

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

  const grouped = useMemo(() => {
    const map: Record<string, FrontendCase[]> = {};
    cases.forEach((item) => {
      const key = item.status ?? "awaiting_payment";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    });
    return map;
  }, [cases]);

  function getPageForColumn(columnKey: string): number {
    return columnPage[columnKey] ?? 1;
  }

  function setPageForColumn(columnKey: string, page: number) {
    setColumnPage((prev) => ({ ...prev, [columnKey]: page }));
  }

  if (loading) {
    return <div className="text-gray-600">Carregando kanban...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Kanban de casos</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Cards por coluna</span>
          <select
            value={cardsPerPage}
            onChange={(e) => setCardsPerPage(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-1"
          >
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={20}>20</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((column) => (
          <div key={column.key} className="bg-gray-100 rounded-lg p-3 min-h-[300px]">
            <div className="text-sm font-semibold text-gray-700 mb-3">{column.title}</div>
            {(() => {
              const items = grouped[column.key] ?? [];
              const totalPages = Math.max(1, Math.ceil(items.length / cardsPerPage));
              const currentPage = Math.min(getPageForColumn(column.key), totalPages);
              const start = (currentPage - 1) * cardsPerPage;
              const visible = items.slice(start, start + cardsPerPage);
              return (
                <>
                  <div className="space-y-2">
                    {visible.map((caseItem) => (
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
                    {visible.length === 0 && (
                      <div className="text-xs text-gray-500">Sem casos</div>
                    )}
                  </div>
                  {items.length > cardsPerPage && (
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        onClick={() => setPageForColumn(column.key, Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="text-xs px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <span className="text-[11px] text-gray-500">
                        {currentPage}/{totalPages}
                      </span>
                      <button
                        onClick={() => setPageForColumn(column.key, Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="text-xs px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
