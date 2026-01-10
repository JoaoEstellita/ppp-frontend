"use client";

import { useEffect, useState } from "react";
import { getAdminPayments } from "@/src/services/api";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminPayments()
      .then((data) => setPayments(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Pagamentos</h2>
      <div className="bg-white rounded-lg shadow p-4 text-sm">
        {loading ? (
          <div className="text-gray-600">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {payments.map((item) => (
              <div key={item.id} className="flex justify-between border-b last:border-b-0 py-2">
                <div>
                  <div className="font-semibold">{item.id}</div>
                  <div className="text-xs text-gray-500">Org: {item.org_id}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {item.status} - R$ {Number(item.amount || 0).toFixed(2)}
                </div>
              </div>
            ))}
            {payments.length === 0 && (
              <div className="text-gray-500">Sem pagamentos recentes.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

