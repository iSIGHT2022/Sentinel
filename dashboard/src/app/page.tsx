"use client";
import { useState, useCallback } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { useWebSocket } from "@/hooks/useWebSocket";
import CategoryTile from "@/components/CategoryTile";
import CategoryPanel from "@/components/CategoryPanel";
import StatBar from "@/components/StatBar";
import LiveAlertBanner from "@/components/LiveAlertBanner";
import ResidentList from "@/components/ResidentList";
import { Category, WSMessage, TileSummary, Alert, CATEGORY_META } from "@/types";

export default function Home() {
  const { summary, refresh } = useDashboard();
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [liveAlert, setLiveAlert]           = useState<Alert | null>(null);

  const onWsMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "new_event" && msg.alert) {
      if (msg.alert.severity === "critical" || msg.alert.severity === "high") {
        setLiveAlert(msg.alert as Alert);
      }
      refresh();
    }
    if (msg.type === "alert_acknowledged" || msg.type === "alert_resolved") refresh();
  }, [refresh]);

  const wsConnected = useWebSocket(onWsMessage);

  const TILE_ORDER: Category[] = [
    "emergency", "activity", "bathroom", "dining", "behaviour", "social", "room",
  ];

  const tileMap = Object.fromEntries(
    (summary?.tiles ?? []).map((t) => [t.category, t])
  ) as Record<Category, TileSummary>;

  const defaultTile = (cat: Category): TileSummary => ({
    category: cat, active_alerts: 0, critical_count: 0,
    high_count: 0, last_alert_time: null, last_event_time: null,
  });

  return (
    <div className="space-y-6">

      {/* ── Stats bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3.5 shadow-sm">
        {summary
          ? <StatBar
              total_residents={summary.stats.total_residents}
              open_alerts={summary.stats.open_alerts}
              events_last_hour={summary.stats.events_last_hour}
              wsConnected={wsConnected}
            />
          : <div className="h-5 bg-slate-100 rounded-full animate-pulse w-56" />
        }
      </div>

      {/* ── Critical alert strip ── */}
      {summary?.critical_alerts && summary.critical_alerts.length > 0 && (
        <div className="space-y-2">
          {summary.critical_alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm"
            >
              {/* Severity dot */}
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                a.severity === "critical" ? "bg-red-500" : "bg-orange-400"
              }`} />
              <span className="text-base shrink-0 leading-none">
                {CATEGORY_META[a.category as Category]?.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{a.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {a.zone.replace(/_/g, " ")} · {a.severity}
                </p>
              </div>
              <button
                onClick={() => setActiveCategory(a.category as Category)}
                className="shrink-0 text-xs font-medium text-[#0f1f3d] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Monitoring tiles ── */}
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Monitoring Categories
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {TILE_ORDER.map((cat) => (
            <CategoryTile
              key={cat}
              tile={tileMap[cat] ?? defaultTile(cat)}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* ── Residents ── */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-5 shadow-sm">
        <ResidentList />
      </div>

      {/* Category panel */}
      {activeCategory && (
        <CategoryPanel category={activeCategory} onClose={() => setActiveCategory(null)} />
      )}

      {/* Live alert toast */}
      <LiveAlertBanner alert={liveAlert} />
    </div>
  );
}
