"use client";
import { Users, Bell, Zap, Wifi, WifiOff } from "lucide-react";

interface StatBarProps {
  total_residents: number;
  open_alerts: number;
  events_last_hour: number;
  wsConnected: boolean;
}

export default function StatBar({ total_residents, open_alerts, events_last_hour, wsConnected }: StatBarProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Stat icon={<Users size={13} />} label="Residents" value={total_residents} />
      <Divider />
      <Stat icon={<Bell size={13} />} label="Open Alerts" value={open_alerts} danger={open_alerts > 0} />
      <Divider />
      <Stat icon={<Zap size={13} />} label="Events / hr" value={events_last_hour} />

      <div className="ml-auto flex items-center gap-1.5 text-xs font-medium">
        {wsConnected ? (
          <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <Wifi size={11} /> Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
            <WifiOff size={11} /> Reconnecting
          </span>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-slate-200 mx-3" />;
}

function Stat({ icon, label, value, danger }: {
  icon: React.ReactNode; label: string; value: number; danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${danger ? "text-red-600" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}
