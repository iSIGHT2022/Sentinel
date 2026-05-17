"use client";
import { Users, Bell, Zap, Wifi, WifiOff } from "lucide-react";
import clsx from "clsx";

interface StatBarProps {
  total_residents: number;
  open_alerts: number;
  events_last_hour: number;
  wsConnected: boolean;
}

export default function StatBar({ total_residents, open_alerts, events_last_hour, wsConnected }: StatBarProps) {
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <Stat icon={<Users size={14} />} label="Total Residents" value={total_residents} />
      <Stat icon={<Bell size={14} />} label="Active Alerts" value={open_alerts} danger={open_alerts > 0} />
      <Stat icon={<Zap size={14} />} label="Events / Hour" value={events_last_hour} />

      <div className="ml-auto flex items-center gap-3">
        <div className={clsx(
          "flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all duration-500",
          wsConnected
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.4)]"
            : "bg-slate-500/10 text-slate-500 border-slate-500/20"
        )}>
          <div className={clsx("w-1.5 h-1.5 rounded-full", wsConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
          {wsConnected ? "Live Connection" : "Reconnecting"}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, danger }: {
  icon: React.ReactNode; label: string; value: number; danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 bg-white/40 border border-white/60 px-5 py-2 rounded-2xl shadow-sm transition-all hover:bg-white/60 group">
      <div className={clsx(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-white shadow-inner transition-transform group-hover:scale-110",
        danger ? "bg-red-500 text-white" : "bg-[#9b6dff]/10 text-[#9b6dff]"
      )}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">{label}</span>
        <span className={`text-base font-black tabular-nums leading-none ${danger ? "text-red-600" : "text-slate-800"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}


