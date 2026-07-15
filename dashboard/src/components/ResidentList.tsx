"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, User } from "lucide-react";
import clsx from "clsx";
import { Resident } from "@/types";
import { MOCK_RESIDENTS, MOCK_RESIDENT_STATUS } from "@/lib/mockData";
import ResidentPanel from "./ResidentPanel";

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-amber-400",
};

export default function ResidentList() {
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<Resident | null>(null);
  const dropdownRef             = useRef<HTMLDivElement>(null);

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
    setSelected(resident);
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Residents</h2>
          <p className="text-xs text-slate-400 mt-0.5">Select a name to view individual tracking</p>
        </div>
      </div>

      {/* Dropdown trigger */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            "w-full flex items-center justify-between gap-3 bg-white border rounded-2xl px-4 py-3.5 shadow-sm transition-all",
            open ? "border-[#0f1f3d]/30 ring-2 ring-[#0f1f3d]/10" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <User size={13} className="text-slate-400" />
            </div>
            <span className="text-sm text-slate-500">
              Select resident…
            </span>
          </div>
          <ChevronDown
            size={16}
            className={clsx("text-slate-400 shrink-0 transition-transform duration-200", open && "rotate-180")}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
            {/* Search inside dropdown */}
            <div className="px-3 pt-3 pb-2 border-b border-slate-100">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name or room…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50
                             focus:outline-none focus:ring-2 focus:ring-[#0f1f3d]/20 focus:border-[#0f1f3d]/30
                             placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* Resident name list */}
            <ul className="max-h-72 overflow-y-auto py-1.5">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-slate-400 italic">No residents found.</li>
              ) : (
                filtered.map((r) => {
                  const status = MOCK_RESIDENT_STATUS[r.id];
                  const sev    = status?.alert_severity;
                  const initials = r.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                      >
                        {/* Avatar */}
                        <div className={clsx(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
                          sev === "critical" ? "bg-red-500" :
                          sev === "high"     ? "bg-orange-400" :
                          sev === "medium"   ? "bg-amber-400" : "bg-[#0f1f3d]"
                        )}>
                          {initials}
                        </div>

                        {/* Name + room */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 leading-tight">{r.name}</p>
                          <p className="text-xs text-slate-400">Room {r.room_number} · {r.age}y</p>
                        </div>

                        {/* Alert indicator */}
                        {sev && SEVERITY_DOT[sev] && (
                          <span className={clsx("w-2 h-2 rounded-full shrink-0", SEVERITY_DOT[sev])} />
                        )}

                        {/* Current activity */}
                        {status && (
                          <span className="text-base leading-none shrink-0">{status.activity_icon}</span>
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

      {/* Resident detail panel */}
      {selected && (
        <ResidentPanel resident={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
