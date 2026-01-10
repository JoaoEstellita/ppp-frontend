"use client";

import { useEffect, useState } from "react";
import { getAdminUsage } from "@/src/services/api";

export default function AdminUsagePage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminUsage()
      .then((data) => setEvents(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Uso</h2>
      <div className="bg-white rounded-lg shadow p-4 text-sm">
        {loading ? (
          <div className="text-gray-600">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex justify-between border-b last:border-b-0 py-2">
                <div>
                  <div className="font-semibold">{event.type}</div>
                  <div className="text-xs text-gray-500">Org: {event.org_id}</div>
                </div>
                <div className="text-xs text-gray-500">{event.created_at}</div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-gray-500">Sem eventos de uso.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

