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
  corridors_hallways:    "Corridors",
  dining_hall:           "Dining Hall",
  common_room_lounge:    "Common Room",
  garden_outdoor:        "Garden",
  activity_therapy_room: "Activity Room",
  nurse_station:         "Nurse Station",
  bathroom_entry:        "Bathroom",
  stairwells_elevators:  "Stairwell",
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
  activity:  "bg-blue-500",
  bathroom:  "bg-violet-500",
  dining:    "bg-amber-500",
  behaviour: "bg-yellow-500",
  social:    "bg-emerald-500",
  room:      "bg-slate-400",
};

function Stat({ label, value, warn, sub }: { label: string; value: string | number; warn?: boolean; sub?: string }) {
  return (
    <div className={clsx(
      "rounded-xl px-3 py-2.5 text-center border",
      warn ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
    )}>
      <p className={clsx("text-lg font-bold tabular-nums leading-tight", warn ? "text-red-600" : "text-slate-800")}>
        {value}
      </p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
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
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={onClose} />

      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full max-w-[460px] bg-white z-50 flex flex-col shadow-2xl panel-in"
      >
        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0",
                sev === "critical" ? "bg-red-500" :
                sev === "high"     ? "bg-orange-400" :
                sev === "medium"   ? "bg-amber-400" : "bg-[#0f1f3d]"
              )}>
                {initials}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800 leading-tight">{resident.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Room {resident.room_number} · Age {resident.age}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {resident.medical_notes && (
            <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 leading-relaxed">
              {resident.medical_notes}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Right Now ── */}
          {status && (
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Right Now</p>
              <div className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3.5 border border-slate-100">
                <span className="text-2xl leading-none shrink-0">{status.activity_icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    "text-sm font-semibold leading-snug",
                    sev === "critical" ? "text-red-700" :
                    sev === "high"     ? "text-orange-700" : "text-slate-800"
                  )}>
                    {status.current_activity}
                  </p>
                  {status.last_seen_zone && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin size={9} />
                      {ZONE_LABEL[status.last_seen_zone]}
                      {status.last_seen_time && (
                        <span>· {formatDistanceToNow(new Date(status.last_seen_time), { addSuffix: true })}</span>
                      )}
                    </p>
                  )}
                  {status.in_room_inferred && (
                    <p className="text-[10px] text-slate-400 italic mt-0.5">Inferred — no in-room camera</p>
                  )}
                </div>
                {sev && (
                  <span className={clsx(
                    "shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    sev === "critical" ? "bg-red-100 text-red-700" :
                    sev === "high"     ? "bg-orange-100 text-orange-700" :
                    "bg-amber-100 text-amber-700"
                  )}>
                    {sev}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Today's stats ── */}
          {stats && (
            <div className="px-6 py-5 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Today</p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <Stat label="Meals" value={`${stats.meals_attended}/${stats.meals_total}`} warn={stats.meals_attended < stats.meals_total} />
                <Stat label="Bathroom" value={stats.bathroom_visits} sub={stats.night_bathroom_visits ? `${stats.night_bathroom_visits} night` : undefined} />
                <Stat label="Activity" value={stats.activity_room_visits} sub="sessions" />
                <Stat label="Social" value={stats.social_interactions} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Common Area" value={`${stats.common_area_minutes} min`} />
                <Stat label="Alerts Today" value={stats.alerts_today} warn={stats.alerts_today > 0} />
              </div>
            </div>
          )}

          {/* ── Active alerts ── */}
          {residentAlerts.length > 0 && (
            <div className="px-6 py-5 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Active Alerts</p>
              <div className="space-y-2">
                {residentAlerts.map((a) => (
                  <div
                    key={a.id}
                    className={clsx(
                      "flex gap-2.5 px-3.5 py-3 rounded-xl border text-xs",
                      a.severity === "critical" ? "bg-red-50 border-red-200 text-red-800" :
                      a.severity === "high"     ? "bg-orange-50 border-orange-200 text-orange-800" :
                      "bg-amber-50 border-amber-200 text-amber-800"
                    )}
                  >
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium leading-snug">{a.message}</p>
                      <p className="opacity-60 mt-0.5">
                        {ZONE_LABEL[a.zone] ?? a.zone} · {format(new Date(a.time), "HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Timeline ── */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">
              Activity Timeline — today
            </p>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No events recorded today.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                <div className="space-y-0.5">
                  {timeline.map((ev) => (
                    <div key={ev.id} className="flex gap-4 relative">
                      <div className={clsx(
                        "mt-[7px] w-3.5 h-3.5 rounded-full border-2 border-white shrink-0 z-10",
                        CAT_DOT[ev.category] ?? "bg-slate-300"
                      )} />
                      <div className="flex-1 pb-4 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none shrink-0">
                            {EVENT_ICON[ev.event_type] ?? "·"}
                          </span>
                          <span className="text-sm text-slate-700 flex-1 capitalize">
                            {ev.event_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                            {format(new Date(ev.time), "HH:mm")}
                          </span>
                        </div>
                        <div className="flex gap-3 mt-0.5 ml-6">
                          <span className="text-[11px] text-slate-400">
                            {ZONE_LABEL[ev.zone] ?? ev.zone}
                          </span>
                          {Object.keys(ev.metadata).length > 0 && (
                            <span className="text-[11px] text-slate-400 italic truncate">
                              {Object.entries(ev.metadata)
                                .slice(0, 2)
                                .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                                .join(" · ")}
                            </span>
                          )}
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
            <div className="px-6 pb-6 border-t border-slate-100 pt-5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Emergency Contacts
              </p>
              {resident.emergency_contacts.map((c) => (
                <div key={c.phone} className="flex items-center gap-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Phone size={11} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {c.name} <span className="font-normal text-slate-400">· {c.relation}</span>
                    </p>
                    <p className="text-xs text-slate-400">{c.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
