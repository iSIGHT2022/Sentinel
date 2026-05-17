"use client";
import { useState, useCallback } from "react";

const FEED_ICONS: Record<string, string> = {
  fall_detected: "🚨", sleeping_detected: "😴",
  posture_standing: "🚶", posture_sitting: "🪑",
  posture_lying: "🛌", posture_crouching: "🤸",
  posture_bending: "🏃", wandering_detected: "🔄",
  gait_abnormal: "⚠️", balance_instability: "⚖️",
  prolonged_inactivity: "⏸️", bathroom_extended_stay: "🚪",
  tremor_detected: "🫨", limping_detected: "🦵",
};
import { useDashboard } from "@/hooks/useDashboard";
import { useWebSocket } from "@/hooks/useWebSocket";
import CategoryTile from "@/components/CategoryTile";
import CategoryPanel from "@/components/CategoryPanel";
import StatBar from "@/components/StatBar";
import LiveAlertBanner from "@/components/LiveAlertBanner";
import ResidentList from "@/components/ResidentList";
import ResidentPanel from "@/components/ResidentPanel";
import { Category, WSMessage, TileSummary, Alert, CATEGORY_META, Resident } from "@/types";

type FeedItem = { id: string; type: string; zone: string; time: string };

export default function Home() {
  const { summary, refresh } = useDashboard();
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [liveAlert, setLiveAlert] = useState<Alert | null>(null);
  const [recentFeed, setRecentFeed] = useState<FeedItem[]>([]);

  const onWsMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "new_event") {
      if (msg.event) {
        const evt = msg.event;
        setRecentFeed(prev => [
          { id: evt.id, type: evt.event_type, zone: evt.zone, time: evt.time },
          ...prev,
        ].slice(0, 8));
      }
      if (msg.alert && (msg.alert.severity === "critical" || msg.alert.severity === "high")) {
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
    <>
      <div className="glass-main p-8 md:p-12 min-h-[80vh] animate-in fade-in zoom-in-95 duration-700">
        <div className="space-y-12">

          {/* ── Stats bar ── */}
          <div className="glass-sm px-8 py-5 rounded-[2.5rem]">
            {summary
              ? <StatBar
                total_residents={summary.stats.total_residents}
                open_alerts={summary.stats.open_alerts}
                events_last_hour={summary.stats.events_last_hour}
                wsConnected={wsConnected}
              />
              : <div className="h-6 bg-white/20 rounded-full animate-pulse w-64" />
            }
          </div>

          {/* ── Live detection feed ── */}
          {recentFeed.length > 0 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] shrink-0">
                Live
              </span>
              {recentFeed.map((e, i) => {
                const icon = FEED_ICONS[e.type] ?? "📍";
                const label = e.type.replace(/posture_/g, "").replace(/_detected|_/g, " ").trim();
                const isFall = e.type === "fall_detected";
                return (
                  <div
                    key={e.id || i}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-[10px] font-bold transition-all
                      ${isFall
                        ? "bg-red-100 border-red-400 text-red-700 animate-pulse"
                        : "bg-white/50 border-white/60 text-slate-600"}`}
                  >
                    <span>{icon}</span>
                    <span className="capitalize">{label}</span>
                    <span className="opacity-40 mx-0.5">·</span>
                    <span className="opacity-60 truncate max-w-[80px]">{e.zone.replace(/_/g, " ")}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <a
              href="/cctv"
              className="liquid-button-purple px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest"
            >
              Live CCTV
            </a>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 items-start">

            {/* Left Column: Monitoring & Alerts */}
            <div className="xl:col-span-2 space-y-12">

              {/* ── Critical alerts ── */}
              {summary?.critical_alerts && summary.critical_alerts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 px-2">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[3px]">
                      System Intercepts
                    </p>
                    <div className="h-px flex-1 bg-white/20" />
                  </div>
                  {summary.critical_alerts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-5 bg-white/40 backdrop-blur-2xl border-2 border-white/60 rounded-[2.5rem] px-6 py-5 shadow-xl group hover:bg-white/50 transition-all duration-300 transform hover:-translate-y-1"
                    >
                      <div className="relative flex h-5 w-5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)]" />
                      </div>
                      <div className="w-14 h-14 rounded-[1.5rem] bg-white/60 flex items-center justify-center text-3xl shadow-inner border border-white">
                        {CATEGORY_META[a.category as Category]?.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-black text-slate-800 truncate leading-tight">{a.message}</p>
                        <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-widest flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">{a.severity}</span>
                          <span>{a.zone.replace(/_/g, " ")}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveCategory(a.category as Category)}
                        className="liquid-button-purple px-8 py-3 rounded-2xl text-[10px] uppercase tracking-widest"
                      >
                        Protocol
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Monitoring tiles ── */}
              <div className="space-y-8">
                <div className="flex items-center justify-between px-2">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[3px]">
                    Sensor Matrices
                  </p>
                  <div className="h-px flex-1 bg-white/20 ml-8" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {TILE_ORDER.map((cat) => (
                    <CategoryTile
                      key={cat}
                      tile={tileMap[cat] ?? defaultTile(cat)}
                      onClick={() => setActiveCategory(cat)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Residents */}
            <div className="space-y-8">
              <div className="flex items-center gap-4 px-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[3px]">
                  Active Inhabitants
                </p>
                <div className="h-px flex-1 bg-white/20" />
              </div>
              <div className="liquid-glass p-0 shadow-2xl border-white/60 ring-1 ring-white/40">
                <ResidentList selected={selectedResident} onSelect={setSelectedResident} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Panels - outside glass-main to bypass transform constraints */}
      {activeCategory && (
        <CategoryPanel category={activeCategory} onClose={() => setActiveCategory(null)} />
      )}
      {selectedResident && (
        <ResidentPanel resident={selectedResident} onClose={() => setSelectedResident(null)} />
      )}
      <LiveAlertBanner alert={liveAlert} />
    </>
  );
}


