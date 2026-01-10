"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { BillingMonth, generateBillingMonths, getBillingMonths } from "@/src/services/api";

export default function AdminReportsPage() {
  const [months, setMonths] = useState<BillingMonth[]>([]);
  const [yearMonth, setYearMonth] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await getBillingMonths();
    setMonths(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleGenerate() {
    if (!yearMonth) return;
    await generateBillingMonths(yearMonth);
    await load();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Relatorios mensais</h2>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="text-sm text-gray-600">Gerar snapshot mensal</div>
        <div className="flex gap-3">
          <input
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            placeholder="YYYY-MM"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <Button onClick={handleGenerate}>Gerar</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 text-sm">
        {loading ? (
          <div className="text-gray-600">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {months.map((item) => (
              <div key={`${item.org_id}-${item.year_month}`} className="flex justify-between border-b last:border-b-0 py-2">
                <div>
                  <div className="font-semibold">{item.org_id}</div>
                  <div className="text-xs text-gray-500">{item.year_month}</div>
                </div>
                <div className="text-xs text-gray-500">
                  R$ {Number(item.gross_amount || 0).toFixed(2)} / Repasse R$ {Number(item.share_amount || 0).toFixed(2)}
                </div>
              </div>
            ))}
            {months.length === 0 && (
              <div className="text-gray-500">Nenhum relatorio gerado.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

