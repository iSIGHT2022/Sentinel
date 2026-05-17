"use client";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Category, CATEGORY_META, TileSummary } from "@/types";

interface CategoryTileProps {
  tile: TileSummary;
  onClick: () => void;
}

const GLOW_COLORS: Record<Category, string> = {
  emergency: "shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]",
  activity: "shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]",
  bathroom: "shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)]",
  dining: "shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]",
  behaviour: "shadow-[0_0_20px_-5px_rgba(202,138,4,0.3)]",
  social: "shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]",
  room: "shadow-[0_0_20px_-5px_rgba(148,163,184,0.3)]",
};

export default function CategoryTile({ tile, onClick }: CategoryTileProps) {
  const meta = CATEGORY_META[tile.category];
  const hasCritical = tile.critical_count > 0;
  const hasAlerts = tile.active_alerts > 0;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "group relative flex flex-col liquid-glass overflow-hidden",
        "hover:scale-[1.02] hover:bg-white/50 active:scale-[0.98] transition-all duration-300 text-left w-full",
        GLOW_COLORS[tile.category]
      )}
    >
      <div className="flex-1 p-5 min-w-0">
        {/* Header: Icon + Label */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-white/40 flex items-center justify-center text-2xl shadow-inner border border-white/40 group-hover:bg-white/60 transition-colors">
            {meta.icon}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">{meta.label}</p>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Monitoring</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2 mb-6 min-h-[24px]">
          {hasCritical && (
            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 uppercase tracking-wider">
              {tile.critical_count} critical
            </span>
          )}
          {tile.high_count > 0 && (
            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 uppercase tracking-wider">
              {tile.high_count} high
            </span>
          )}
          {!hasAlerts && (
            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-wider">
              All Clear
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/20 pt-4 mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Last Event</span>
            <span className="text-[11px] font-semibold text-slate-600">
              {tile.last_event_time
                ? formatDistanceToNow(new Date(tile.last_event_time), { addSuffix: true })
                : "No recent events"}
            </span>
          </div>
          <div className="flex -space-x-2">
            {[1, 2].map((i) => (
              <div key={i} className="w-5 h-5 rounded-full border border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                {i}
              </div>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

