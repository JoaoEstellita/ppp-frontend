"use client";

import { useEffect, useState } from "react";
import { API_HEALTH_URL } from "@/src/services/api";

const SHOW_MESSAGE_DELAY_MS = 3000;

export function ServerWarmupBanner() {
  const [showLoading, setShowLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => setShowLoading(true), SHOW_MESSAGE_DELAY_MS);

    const wakeBackend = async () => {
      try {
        const res = await fetch(API_HEALTH_URL, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        setErrorMessage(null);
      } catch {
        if (controller.signal.aborted) return;
        setErrorMessage("Nao foi possivel conectar ao servidor. Tente novamente em alguns instantes.");
      } finally {
        clearTimeout(timer);
        setShowLoading(false);
      }
    };

    wakeBackend();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  if (!showLoading && !errorMessage) {
    return null;
  }

  const isError = Boolean(errorMessage);
  const message = isError ? errorMessage : "Carregando servidor...";

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center">
      <div
        className={`m-3 rounded-md px-4 py-2 text-sm shadow ${
          isError ? "bg-red-600 text-white" : "bg-sky-600 text-white"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
