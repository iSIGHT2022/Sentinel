"use client";
import { useEffect, useRef } from "react";
import { X, Clock, MapPin, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";
import { Category, CATEGORY_META, Alert, Event } from "@/types";
import { useCategoryData } from "@/hooks/useDashboard";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-800",
  high:     "bg-orange-50 border-orange-200 text-orange-800",
  medium:   "bg-amber-50 border-amber-200 text-amber-800",
  low:      "bg-blue-50 border-blue-200 text-blue-800",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-amber-400",
  low:      "bg-blue-400",
};

const API = process.env.NEXT_PUBLIC_API_URL;

function AlertRow({ alert, onAck }: { alert: Alert; onAck: () => void }) {
  return (
    <div className={clsx("flex items-start gap-3 px-3.5 py-3 rounded-xl border", SEVERITY_STYLE[alert.severity])}>
      <span className={clsx("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", SEVERITY_DOT[alert.severity])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{alert.message}</p>
        <div className="flex items-center gap-3 mt-1 text-xs opacity-60">
          <span className="flex items-center gap-1">
            <MapPin size={9} />{alert.zone.replace(/_/g, " ")}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={9} />{format(new Date(alert.time), "HH:mm")}
          </span>
        </div>
      </div>
      {alert.acknowledged
        ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500 mt-0.5" />
        : (
          <button
            onClick={async () => {
              await fetch(`${API}/alerts/${alert.id}/acknowledge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ acknowledged_by: "staff" }),
              }).catch(() => null);
              onAck();
            }}
            className="shrink-0 text-xs font-medium underline underline-offset-2 opacity-50 hover:opacity-100 transition-opacity"
          >
            Ack
          </button>
        )
      }
    </div>
  );
}

function EventRow({ event }: { event: Event }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 w-10 shrink-0 tabular-nums">
        {format(new Date(event.time), "HH:mm")}
      </span>
      <span className="text-sm text-slate-700 flex-1 capitalize">
        {event.event_type.replace(/_/g, " ")}
      </span>
      <span className="text-xs text-slate-400 truncate max-w-[100px]">
        {event.zone.replace(/_/g, " ")}
      </span>
      <span className="text-xs text-slate-400 w-8 text-right tabular-nums">
        {(event.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}

interface CategoryPanelProps {
  category: Category;
  onClose: () => void;
}

export default function CategoryPanel({ category, onClose }: CategoryPanelProps) {
  const meta = CATEGORY_META[category];
  const { events, alerts, loading } = useCategoryData(category);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={onClose} />

      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white z-50 flex flex-col shadow-2xl panel-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">{meta.icon}</span>
            <div>
              <h2 className="text-base font-semibold text-slate-800">{meta.label}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {(alerts as Alert[]).filter(a => !a.acknowledged).length} unacknowledged
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Signals monitored */}
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
              Monitored signals
            </p>
            <div className="flex flex-wrap gap-1.5">
              {meta.subFeatures.map((f) => (
                <span
                  key={f}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              Loading…
            </div>
          ) : (
            <>
              {/* Active alerts */}
              {(alerts as Alert[]).length > 0 && (
                <section className="px-6 py-5 border-b border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
                    Active Alerts
                  </p>
                  <div className="space-y-2">
                    {(alerts as Alert[]).map((a) => (
                      <AlertRow key={a.id} alert={a} onAck={() => {}} />
                    ))}
                  </div>
                </section>
              )}

              {/* Recent events */}
              <section className="px-6 py-5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                  Recent Events — last 24 h
                </p>
                {(events as Event[]).length === 0 ? (
                  <p className="text-sm text-slate-400 italic mt-3">No events recorded.</p>
                ) : (
                  <div>
                    {(events as Event[]).map((e) => (
                      <EventRow key={e.id} event={e} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
