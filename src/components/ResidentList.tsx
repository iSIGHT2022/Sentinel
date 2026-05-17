"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, User } from "lucide-react";
import clsx from "clsx";
import { Resident } from "@/types";
import { MOCK_RESIDENTS, MOCK_RESIDENT_STATUS } from "@/lib/mockData";
import ResidentPanel from "./ResidentPanel";

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-amber-400",
};

export default function ResidentList({ selected, onSelect }: { selected: Resident | null, onSelect: (r: Resident | null) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = MOCK_RESIDENTS.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.room_number?.includes(search)
  );

  const handleSelect = (resident: Resident) => {
    onSelect(resident);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Residents</h2>
          <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tight">Select to view individual tracking</p>
        </div>
      </div>

      {/* Dropdown trigger */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            "w-full flex items-center justify-between gap-3 bg-white/40 border-2 rounded-2xl px-5 py-4 transition-all duration-300",
            open ? "border-[#9b6dff]/40 shadow-[0_0_20px_rgba(155,109,255,0.1)]" : "border-white/60 hover:border-[#9b6dff]/20"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center shrink-0 shadow-sm border border-white">
              <User size={14} className="text-[#9b6dff]" />
            </div>
            <span className="text-sm font-semibold text-slate-600">
              {selected ? selected.name : "Select resident…"}
            </span>
          </div>
          <ChevronDown
            size={18}
            className={clsx("text-slate-400 shrink-0 transition-transform duration-300", open && "rotate-180")}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-3 bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search inside dropdown */}
            <div className="px-4 pt-4 pb-3 border-b border-white/40 bg-white/20">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name or room…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl border border-white/60 bg-white/40
                             focus:outline-none focus:ring-2 focus:ring-[#9b6dff]/20 focus:border-[#9b6dff]/40
                             placeholder:text-slate-300 transition-all font-medium"
                />
              </div>
            </div>

            {/* Resident name list */}
            <ul className="max-h-96 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <li className="px-5 py-4 text-xs text-slate-400 italic">No residents found.</li>
              ) : (
                filtered.map((r) => {
                  const status = MOCK_RESIDENT_STATUS[r.id];
                  const sev = status?.alert_severity;
                  const initials = r.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#9b6dff]/5 transition-colors text-left"
                      >
                        {/* Avatar */}
                        <div className={clsx(
                          "w-9 h-9 rounded-2xl flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg",
                          sev === "critical" ? "bg-red-500" :
                            sev === "high" ? "bg-orange-500" :
                              sev === "medium" ? "bg-amber-500" : "bg-slate-800"
                        )}>
                          {initials}
                        </div>

                        {/* Name + room */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 leading-tight">{r.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Room {r.room_number} · {r.age} yrs</p>
                        </div>

                        {/* Alert indicator */}
                        {sev && SEVERITY_DOT[sev] && (
                          <div className="relative flex h-2 w-2 shrink-0">
                            <span className={clsx("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", SEVERITY_DOT[sev])} />
                            <span className={clsx("relative inline-flex rounded-full h-2 w-2", SEVERITY_DOT[sev])} />
                          </div>
                        )}

                        {/* Current activity */}
                        {status && (
                          <span className="text-xl leading-none shrink-0 filter drop-shadow-sm">{status.activity_icon}</span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


