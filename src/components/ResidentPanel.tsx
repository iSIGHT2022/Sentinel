"use client";
import { useEffect, useRef } from "react";
import { X, MapPin, Phone, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { Resident, ResidentStatus, Event, Alert } from "@/types";
import {
  MOCK_RESIDENT_TIMELINE,
  MOCK_RESIDENT_STATUS,
  MOCK_DAY_STATS,
  MOCK_ALERTS,
} from "@/lib/mockData";

const ZONE_LABEL: Record<string, string> = {
  corridors_hallways: "Corridors",
  dining_hall: "Dining Hall",
  common_room_lounge: "Common Room",
  garden_outdoor: "Garden",
  activity_therapy_room: "Activity Room",
  nurse_station: "Nurse Station",
  bathroom_entry: "Bathroom",
  stairwells_elevators: "Stairwell",
};

const EVENT_ICON: Record<string, string> = {
  fall_detected: "🚨", slow_collapse: "🚨", person_on_floor: "🚨",
  choking_gesture: "🚨", crowd_emergency: "🚨",
  gait_abnormal: "🚶", tremor_detected: "🤲", limping_detected: "🦿",
  balance_instability: "⚖️", repetitive_pacing: "↔️", poor_posture: "🪑",
  bathroom_entry: "🚪", bathroom_exit: "🚪", bathroom_duration_alert: "⏰",
  bathroom_night_visit: "🌙",
  meal_present: "🍽️", meal_skipped: "❌", eating_gesture: "🥄",
  social_interaction: "👥", social_seating: "👥", prolonged_inactivity: "💤",
  wandering_detected: "🧭", confusion_mapping: "🔄", disorientation: "❓",
  room_entry_inferred: "🏠", in_room_inferred: "🏠",
  activity_therapy_room: "🏥",
};

const CAT_DOT: Record<string, string> = {
  emergency: "bg-red-500",
  activity: "bg-blue-500",
  bathroom: "bg-violet-500",
  dining: "bg-amber-500",
  behaviour: "bg-yellow-500",
  social: "bg-emerald-500",
  room: "bg-slate-400",
};

function Stat({ label, value, warn, sub }: { label: string; value: string | number; warn?: boolean; sub?: string }) {
  return (
    <div className={clsx(
      "rounded-2xl px-3 py-3 text-center border-2 transition-all hover:scale-[1.05]",
      warn ? "bg-red-500/10 border-red-500/30 shadow-[0_4px_15px_-5px_rgba(239,68,68,0.2)]" : "bg-white/40 border-white/60 shadow-sm"
    )}>
      <p className={clsx("text-lg font-black tabular-nums leading-none mb-1", warn ? "text-red-500" : "text-slate-800")}>
        {value}
      </p>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{label}</p>
      {sub && <p className="text-[9px] font-bold text-[#b794f4] uppercase tracking-tighter mt-1">{sub}</p>}
    </div>
  );
}

export default function ResidentPanel({ resident, onClose }: { resident: Resident; onClose: () => void }) {
  const status: ResidentStatus | undefined = MOCK_RESIDENT_STATUS[resident.id];
  const timeline: Event[] = MOCK_RESIDENT_TIMELINE[resident.id] ?? [];
  const stats = MOCK_DAY_STATS[resident.id];
  const sev = status?.alert_severity;

  const residentAlerts: Alert[] = Object.values(MOCK_ALERTS)
    .flat()
    .filter((a) => a.resident_id === resident.id && !a.acknowledged);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const initials = resident.name.split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <>
      <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40" onClick={onClose} />

      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white/60 backdrop-blur-3xl z-50 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.05)] border-l border-white/60 animate-in slide-in-from-right duration-300"
      >
        {/* ── Header ── */}
        <div className="px-8 py-6 border-b border-white/40">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={clsx(
                "w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black text-white shrink-0 shadow-lg",
                sev === "critical" ? "bg-red-500" :
                  sev === "high" ? "bg-orange-500" :
                    sev === "medium" ? "bg-amber-500" : "bg-slate-800"
              )}>
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 leading-none">{resident.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                  Room {resident.room_number} · Age {resident.age}
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

          {resident.medical_notes && (
            <div className="mt-5 text-[11px] font-medium text-slate-500 bg-[#9b6dff]/5 rounded-2xl px-4 py-3 border border-[#9b6dff]/10 leading-relaxed italic">
              “{resident.medical_notes}”
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* ── Right Now ── */}
          {status && (
            <div className="px-8 py-8 border-b border-white/40">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-5">Live Monitoring</p>
              <div className="flex items-center gap-4 bg-white/40 rounded-[2rem] px-5 py-5 border-2 border-white/60 shadow-sm relative overflow-hidden group">
                {/* Glow effect */}
                <div className={clsx(
                  "absolute inset-0 opacity-10 blur-2xl -z-10 transition-colors",
                  sev === "critical" ? "bg-red-500" : "bg-[#9b6dff]"
                )} />

                <div className="w-14 h-14 rounded-3xl bg-white/60 flex items-center justify-center text-4xl shadow-inner border border-white shrink-0 group-hover:scale-110 transition-transform">
                  {status.activity_icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    "text-base font-black leading-tight",
                    sev === "critical" ? "text-red-600" :
                      sev === "high" ? "text-orange-600" : "text-slate-800"
                  )}>
                    {status.current_activity}
                  </p>
                  {status.last_seen_zone && (
                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 mt-2 uppercase tracking-wide">
                      <MapPin size={10} className="text-[#b794f4]" />
                      {ZONE_LABEL[status.last_seen_zone]}
                      {status.last_seen_time && (
                        <span className="text-slate-300">· {formatDistanceToNow(new Date(status.last_seen_time), { addSuffix: true })}</span>
                      )}
                    </p>
                  )}
                </div>
                {sev && (
                  <div className="relative flex h-3 w-3 shrink-0 mr-1">
                    <span className={clsx("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", sev === "critical" ? "bg-red-400" : "bg-orange-400")} />
                    <span className={clsx("relative inline-flex rounded-full h-3 w-3", sev === "critical" ? "bg-red-500" : "bg-orange-500")} />
                  </div>
                )}
              </div>
              {status.in_room_inferred && (
                <p className="text-[9px] font-bold text-slate-400 italic mt-3 ml-1 uppercase tracking-tight opacity-60">
                  Inferred State — Community Zone Capture
                </p>
              )}
            </div>
          )}

          {/* ── Today's stats ── */}
          {stats && (
            <div className="px-8 py-8 border-b border-white/40 bg-white/20">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-5">Activity Summary</p>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <Stat label="Meals" value={`${stats.meals_attended}/${stats.meals_total}`} warn={stats.meals_attended < stats.meals_total} />
                <Stat label="Toilet" value={stats.bathroom_visits} sub={stats.night_bathroom_visits ? `${stats.night_bathroom_visits} Night` : undefined} />
                <Stat label="Therapy" value={stats.activity_room_visits} sub="Sessions" />
                <Stat label="Social" value={stats.social_interactions} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Common Area Usage" value={`${stats.common_area_minutes} m`} />
                <Stat label="Incident Triggers" value={stats.alerts_today} warn={stats.alerts_today > 0} />
              </div>
            </div>
          )}

          {/* ── Timeline ── */}
          <div className="px-8 py-8">
            <div className="flex items-center justify-between mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">
                Activity Log
              </p>
              <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent ml-4" />
            </div>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold uppercase tracking-tight italic">Null timeline — No events captured</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-white/40" />
                <div className="space-y-1">
                  {timeline.map((ev) => (
                    <div key={ev.id} className="flex gap-5 relative">
                      <div className={clsx(
                        "mt-[9px] w-4 h-4 rounded-full border-4 border-white shrink-0 z-10 shadow-sm",
                        CAT_DOT[ev.category] ?? "bg-slate-300"
                      )} />
                      <div className="flex-1 pb-6 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xl leading-none shrink-0 filter drop-shadow-sm">
                            {EVENT_ICON[ev.event_type] ?? "·"}
                          </span>
                          <span className="text-sm font-bold text-slate-800 flex-1 capitalize">
                            {ev.event_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] font-black text-slate-300 tabular-nums uppercase">
                            {format(new Date(ev.time), "HH:mm")}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 ml-8">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/40 px-2 py-0.5 rounded-lg border border-white/60">
                            {ZONE_LABEL[ev.zone] ?? ev.zone}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Emergency contacts ── */}
          {resident.emergency_contacts.length > 0 && (
            <div className="px-8 pb-10 pt-8 border-t border-white/40 bg-white/20">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] mb-6">
                Authorized Contacts
              </p>
              <div className="grid grid-cols-1 gap-4">
                {resident.emergency_contacts.map((c) => (
                  <div key={c.phone} className="flex items-center gap-4 bg-white/40 rounded-2xl p-4 border border-white/60 group hover:bg-white/60 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-[#9b6dff]/10 flex items-center justify-center shrink-0 border border-[#9b6dff]/20">
                      <Phone size={14} className="text-[#9b6dff]" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {c.name} <span className="font-bold text-[#b794f4] text-[10px] uppercase ml-2 tracking-widest">{c.relation}</span>
                      </p>
                      <p className="text-[11px] font-bold text-slate-400 mt-1 tracking-wider">{c.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

