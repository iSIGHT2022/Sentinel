"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Alert, CATEGORY_META } from "@/types";

function beep(frequency = 880, duration = 0.4, repeats = 3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    for (let i = 0; i < repeats; i++) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = "sine";
      const start = ctx.currentTime + i * (duration + 0.1);
      gain.gain.setValueAtTime(0.35, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    }
  } catch {}
}

export default function LiveAlertBanner({ alert }: { alert: Alert | null }) {
  const [visible, setVisible]       = useState(false);
  const [dismissed, setDismissed]   = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!alert || alert.id === dismissed) return;

    setVisible(true);

    const isCritical = alert.severity === "critical";

    if (isCritical) {
      // Critical: never auto-dismiss, play 3-beep alarm
      beep(880, 0.35, 3);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      // High/medium: play single beep, auto-dismiss after 15 s
      beep(660, 0.3, 1);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 15_000);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [alert, dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    if (alert) setDismissed(alert.id);
  };

  if (!visible || !alert) return null;

  const meta       = CATEGORY_META[alert.category];
  const isCritical = alert.severity === "critical";

  return (
    <div className={`
      fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]
      w-[calc(100%-2rem)] max-w-lg
      flex items-start gap-4 px-5 py-4
      rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.25)]
      border-2 backdrop-blur-2xl
      ${isCritical
        ? "bg-red-600/95 border-red-400 shadow-[0_0_40px_rgba(239,68,68,0.6)] text-white"
        : "bg-[#9b6dff]/92 border-[#b794f4] shadow-[0_0_30px_rgba(155,109,255,0.5)] text-white"}
    `}>

      {/* Icon */}
      <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shrink-0 border border-white/30">
        {meta?.icon ?? "🔔"}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-[2px] opacity-80">
            {alert.severity}
          </span>
          <span className="opacity-50">·</span>
          <span className="text-[10px] font-bold opacity-80">
            {alert.zone.replace(/_/g, " ")}
          </span>
          {isCritical && (
            <span className="animate-pulse text-[10px] font-black bg-white/20 px-2 rounded-md">
              ⚠ ACTION REQUIRED
            </span>
          )}
        </div>
        <p className="text-sm font-bold leading-snug mt-1">{alert.message}</p>
      </div>

      {/* Acknowledge / dismiss */}
      <div className="flex flex-col gap-2 shrink-0">
        {isCritical ? (
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-xl bg-white text-red-700 text-[11px] font-black uppercase tracking-widest hover:bg-red-50 transition-all"
          >
            Acknowledge
          </button>
        ) : (
          <button
            onClick={handleDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-2xl hover:bg-white/20 transition-all border border-white/20"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
