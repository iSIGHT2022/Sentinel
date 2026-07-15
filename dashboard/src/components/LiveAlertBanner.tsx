"use client";
import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Alert, CATEGORY_META } from "@/types";

export default function LiveAlertBanner({ alert }: { alert: Alert | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!alert) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 9000);
    return () => clearTimeout(t);
  }, [alert]);

  if (!visible || !alert) return null;

  const meta = CATEGORY_META[alert.category];
  const isCritical = alert.severity === "critical";

  return (
    <div className={`
      fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md
      flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border slide-up
      ${isCritical
        ? "bg-red-600 border-red-700 text-white"
        : "bg-orange-500 border-orange-600 text-white"}
    `}>
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
        <AlertTriangle size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-0.5">
          {meta.icon} {alert.severity} · {alert.zone.replace(/_/g, " ")}
        </p>
        <p className="text-sm font-medium leading-snug">{alert.message}</p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors mt-0.5"
      >
        <X size={13} />
      </button>
    </div>
  );
}
