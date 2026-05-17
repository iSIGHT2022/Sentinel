"use client";
import { useEffect, useRef } from "react";
import { X, Clock, MapPin, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";
import { Category, CATEGORY_META, Alert, Event } from "@/types";
import { useCategoryData } from "@/hooks/useDashboard";
import { MOCK_RESIDENTS } from "@/lib/mockData";

// Build a mapping from reid_id (e.g. "R0004") to resident name
const REID_TO_NAME: Record<string, string> = {};
MOCK_RESIDENTS.forEach((r, i) => {
  // reid_id pattern: R0001 = r1, R0002 = r2, etc.
  const reidId = `R${String(i + 1).padStart(4, "0")}`;
  REID_TO_NAME[reidId] = r.name;
});

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/30 text-red-700",
  high: "bg-orange-500/10 border-orange-500/30 text-orange-700",
  medium: "bg-amber-500/10 border-amber-500/30 text-amber-700",
  low: "bg-[#9b6dff]/10 border-[#9b6dff]/30 text-[#9b6dff]",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-[#9b6dff]",
};

const API = process.env.NEXT_PUBLIC_API_URL;

function AlertRow({ alert, onAck }: { alert: Alert; onAck: () => void }) {
  return (
    <div className={clsx("flex items-start gap-4 px-4 py-4 rounded-2xl border transition-all hover:bg-white/40", SEVERITY_STYLE[alert.severity])}>
      <div className="relative mt-1.5 flex h-2 w-2 shrink-0">
        <span className={clsx("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", SEVERITY_DOT[alert.severity])} />
        <span className={clsx("relative inline-flex rounded-full h-2 w-2", SEVERITY_DOT[alert.severity])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">{alert.message}</p>
        <div className="flex items-center gap-4 mt-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
          <span className="flex items-center gap-1">
            <MapPin size={10} />{alert.zone.replace(/_/g, " ")}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />{format(new Date(alert.time), "HH:mm")}
          </span>
        </div>
      </div>
      {alert.acknowledged
        ? <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
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
            className="liquid-button-purple px-3 py-1 rounded-lg text-[9px] uppercase tracking-widest"
          >
            Ack
          </button>
        )
      }
    </div>
  );
}

function EventRow({ event }: { event: Event }) {
  const residentName = event.reid_id ? REID_TO_NAME[event.reid_id] ?? null : null;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/20 last:border-0 group">
      <span className="text-[10px] font-bold text-slate-400 w-10 shrink-0 tabular-nums">
        {format(new Date(event.time), "HH:mm")}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-slate-700 capitalize">
          {event.event_type.replace(/_/g, " ")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-white/40 px-2 py-0.5 rounded-md border border-white/60">
          {event.zone.replace(/_/g, " ")}
        </span>
        {residentName && (
          <span className="text-[10px] font-black text-[#9b6dff] truncate max-w-[100px]">
            {residentName}
          </span>
        )}
      </div>
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
      <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40" onClick={onClose} />

      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white/60 backdrop-blur-3xl z-50 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.05)] border-l border-white/60 animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center text-3xl shadow-inner border border-white/40">
              {meta.icon}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 leading-none">{meta.label}</h2>
              <p className="text-[10px] font-bold text-[#9b6dff] uppercase tracking-widest mt-1.5">
                {(alerts as Alert[]).filter(a => !a.acknowledged).length} Active Incidents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/40 hover:bg-white/60 text-slate-400 hover:text-slate-800 transition-all border border-white/60"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* Signals monitored */}
          <div className="px-8 py-6 bg-white/20">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-4">
              Integrated Signals
            </p>
            <div className="flex flex-wrap gap-2">
              {meta.subFeatures.map((f) => (
                <span
                  key={f}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white/60 text-slate-600 border border-white/80 shadow-sm uppercase tracking-tight"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <div className="w-6 h-6 border-2 border-[#9b6dff] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Hydrating data…</p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Active alerts */}
              {(alerts as Alert[]).length > 0 && (
                <section className="px-8 py-8">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-5">
                    Critical Snapshots
                  </p>
                  <div className="space-y-3">
                    {(alerts as Alert[]).map((a) => (
                      <AlertRow key={a.id} alert={a} onAck={() => { }} />
                    ))}
                  </div>
                </section>
              )}

              {/* Recent events */}
              <section className="px-8 py-8 bg-white/10">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">
                    24h Activity Log
                  </p>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent ml-4" />
                </div>
                {(events as Event[]).length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium italic mt-4 uppercase tracking-tight">Zero events detected in threshold</p>
                ) : (
                  <div className="space-y-1">
                    {(events as Event[]).map((e) => (
                      <EventRow key={e.id} event={e} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

