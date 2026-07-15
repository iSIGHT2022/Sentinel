"use client";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Category, CATEGORY_META, TileSummary } from "@/types";

interface CategoryTileProps {
  tile: TileSummary;
  onClick: () => void;
}

const LEFT_BAR: Record<Category, string> = {
  emergency: "bg-red-500",
  activity:  "bg-blue-500",
  bathroom:  "bg-violet-500",
  dining:    "bg-amber-500",
  behaviour: "bg-yellow-600",
  social:    "bg-emerald-500",
  room:      "bg-slate-400",
};

export default function CategoryTile({ tile, onClick }: CategoryTileProps) {
  const meta = CATEGORY_META[tile.category];
  const hasCritical = tile.critical_count > 0;
  const hasAlerts   = tile.active_alerts > 0;

  return (
    <button
      onClick={onClick}
      className="group relative flex bg-white rounded-2xl border border-slate-200 overflow-hidden
                 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm
                 transition-all duration-200 text-left w-full"
    >
      {/* Left accent bar */}
      <div className={clsx("w-1 shrink-0 rounded-l-2xl", LEFT_BAR[tile.category])} />

      {/* Pulse dot for critical */}
      {hasCritical && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}

      <div className="flex-1 px-4 py-4 min-w-0">
        {/* Icon + label */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl leading-none">{meta.icon}</span>
          <span className="text-sm font-semibold text-slate-700">{meta.label}</span>
        </div>

        {/* Alert badges */}
        <div className="flex flex-wrap gap-1.5 mb-3 min-h-[22px]">
          {hasCritical && (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
              {tile.critical_count} critical
            </span>
          )}
          {tile.high_count > 0 && (
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-orange-100 text-orange-700">
              {tile.high_count} high
            </span>
          )}
          {tile.active_alerts - tile.critical_count - tile.high_count > 0 && (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              {tile.active_alerts - tile.critical_count - tile.high_count} other
            </span>
          )}
          {!hasAlerts && (
            <span className="text-xs text-slate-400">No active alerts</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {tile.last_event_time
              ? formatDistanceToNow(new Date(tile.last_event_time), { addSuffix: true })
              : "No recent events"}
          </span>
          <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
            {meta.subFeatures.length} signals →
          </span>
        </div>
      </div>
    </button>
  );
}
