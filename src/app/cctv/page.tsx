"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const API     = process.env.NEXT_PUBLIC_API_URL  || "http://localhost:8000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL   || "ws://localhost:8000";
const MJPEG   = "http://127.0.0.1:8081/mjpeg";

function playFallAlarm() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    for (let i = 0; i < 6; i++) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "square";
      const t = ctx.currentTime + i * 0.22;
      osc.frequency.setValueAtTime(i % 2 === 0 ? 960 : 700, t);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      osc.start(t); osc.stop(t + 0.20);
    }
  } catch {}
}

const EVT: Record<string, { icon: string; label: string; pill: string }> = {
  fall_detected:               { icon: "🚨", label: "FALL",          pill: "bg-red-600 text-white" },
  posture_standing:            { icon: "🚶", label: "Standing",      pill: "bg-green-600 text-white" },
  posture_sitting:             { icon: "🪑", label: "Sitting",       pill: "bg-blue-500 text-white" },
  posture_lying:               { icon: "🛌", label: "Lying",         pill: "bg-red-400 text-white" },
  posture_crouching:           { icon: "🤸", label: "Crouching",     pill: "bg-cyan-600 text-white" },
  posture_bending:             { icon: "🏃", label: "Bending",       pill: "bg-orange-500 text-white" },
  sleeping_detected:           { icon: "😴", label: "Sleeping",      pill: "bg-purple-600 text-white" },
  prolonged_inactivity:        { icon: "⏸️", label: "Inactive",      pill: "bg-yellow-500 text-white" },
  wandering_detected:          { icon: "🔄", label: "Wandering",     pill: "bg-orange-500 text-white" },
  bathroom_extended_stay:      { icon: "🚪", label: "Long Bathroom", pill: "bg-purple-700 text-white" },
  gait_abnormal:               { icon: "⚠️", label: "Gait",          pill: "bg-orange-600 text-white" },
  balance_instability:         { icon: "⚖️", label: "Balance",       pill: "bg-yellow-600 text-white" },
  tremor_detected:             { icon: "🫨", label: "Tremor",        pill: "bg-pink-500 text-white" },
  limping_detected:            { icon: "🦵", label: "Limping",       pill: "bg-pink-600 text-white" },
  yoga_warrior:                { icon: "🧘", label: "Warrior Pose",  pill: "bg-teal-600 text-white" },
  yoga_tree:                   { icon: "🌳", label: "Tree Pose",     pill: "bg-teal-500 text-white" },
  yoga_downward_dog:           { icon: "🧘", label: "Downward Dog",  pill: "bg-teal-600 text-white" },
  exercise_plank:              { icon: "💪", label: "Plank",         pill: "bg-indigo-600 text-white" },
  exercise_squat:              { icon: "🏋️", label: "Squat",         pill: "bg-indigo-500 text-white" },
  exercise_arms_raised:        { icon: "🙌", label: "Arms Raised",   pill: "bg-indigo-500 text-white" },
  exercise_arm_lateral_raise:  { icon: "💪", label: "Lateral Raise", pill: "bg-indigo-400 text-white" },
  exercise_seated_arm_raise:   { icon: "🪑", label: "Seated Ex.",    pill: "bg-indigo-400 text-white" },
};

const STAT_KEYS = [
  "fall_detected", "posture_standing", "posture_sitting", "posture_lying",
  "posture_crouching", "posture_bending", "sleeping_detected",
  "wandering_detected", "prolonged_inactivity", "gait_abnormal",
  "balance_instability", "tremor_detected", "limping_detected",
];

type LiveEvent = {
  id: string; time: string; event_type: string;
  zone: string; confidence: number; message: string;
};

export default function CctvPage() {
  const [events, setEvents]   = useState<LiveEvent[]>([]);
  const [stats, setStats]     = useState<Record<string, number>>({});
  const [wsOk, setWsOk]       = useState(false);
  const [camOnline, setCamOnline] = useState(false);

  // connect form
  const [ip, setIp]           = useState("192.168.1.4");
  const [port, setPort]       = useState("4747");
  const [status, setStatus]   = useState<"idle"|"connecting"|"ok"|"err">("idle");
  const [statusMsg, setStatusMsg] = useState("");

  // MJPEG stream via canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamOk, setStreamOk]   = useState(false);
  const [streamKey, setStreamKey] = useState(0);

  const wsRef = useRef<WebSocket|null>(null);

  // ── load saved IP from backend on mount ───────────────────────────────────
  useEffect(() => {
    fetch(`${API}/camera/status`).then(r => r.json()).then(d => {
      setCamOnline(d.online);
      if (d.source) {
        try {
          const u = new URL(d.source);
          setIp(u.hostname);
          setPort(u.port || "4747");
        } catch {}
      }
    }).catch(() => {});
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const addEvent = useCallback((evt: LiveEvent) => {
    setEvents(prev => [evt, ...prev].slice(0, 40));
    setStats(prev => ({ ...prev, [evt.event_type]: (prev[evt.event_type] || 0) + 1 }));
  }, []);

  const connectWs = useCallback(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/global`);
    ws.onopen  = () => setWsOk(true);
    ws.onclose = () => { setWsOk(false); setTimeout(connectWs, 3000); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "new_event" && msg.event) {
          addEvent(msg.event as LiveEvent);
          if (msg.event.event_type === "fall_detected") playFallAlarm();
        }
        if (msg.type === "camera_online")  { setCamOnline(true);  setStreamKey(Date.now()); }
        if (msg.type === "camera_offline") { setCamOnline(false); }
        if (msg.type === "server_ready")   { setCamOnline(msg.camera?.online ?? false); }
      } catch {}
    };
    wsRef.current = ws;
  }, [addEvent]);

  useEffect(() => {
    connectWs();
    const cats = ["emergency","activity","bathroom","behaviour","social"];
    Promise.all(cats.map(c =>
      fetch(`${API}/events?category=${c}&limit=10`).then(r => r.json()).catch(() => [])
    )).then(results => {
      const all = results.flat().sort((a: any, b: any) =>
        new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 40);
      setEvents(all);
    });
    return () => wsRef.current?.close();
  }, [connectWs]);

  // ── Canvas MJPEG reader ───────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    const ctrl = new AbortController();
    const canvas = canvasRef.current;

    async function pump() {
      try {
        const res = await fetch(MJPEG, { signal: ctrl.signal });
        if (!res.body) throw new Error("no body");
        const reader = res.body.getReader();
        let buf = new Uint8Array(0);

        while (!dead) {
          const { done, value } = await reader.read();
          if (done || dead) break;

          // append chunk
          const tmp = new Uint8Array(buf.length + value.length);
          tmp.set(buf); tmp.set(value, buf.length);
          buf = tmp;

          // extract every JPEG (FF D8 … FF D9) from buffer
          let s = -1;
          for (let i = 0; i < buf.length - 1; i++) {
            if (buf[i] === 0xFF && buf[i+1] === 0xD8) s = i;
            if (s >= 0 && buf[i] === 0xFF && buf[i+1] === 0xD9) {
              const jpeg = buf.slice(s, i + 2);
              buf = buf.slice(i + 2);
              const url = URL.createObjectURL(new Blob([jpeg], { type: "image/jpeg" }));
              const img = new Image();
              img.onload = () => {
                if (canvas) {
                  canvas.width  = img.naturalWidth  || 640;
                  canvas.height = img.naturalHeight || 480;
                  canvas.getContext("2d")?.drawImage(img, 0, 0);
                }
                URL.revokeObjectURL(url);
                if (!dead) setStreamOk(true);
              };
              img.onerror = () => URL.revokeObjectURL(url);
              img.src = url;
              s = -1; break; // one frame per chunk pass
            }
          }
          // prevent unbounded buffer growth
          if (buf.length > 500_000) buf = new Uint8Array(0);
        }
      } catch {
        if (!dead) {
          setStreamOk(false);
          setTimeout(() => setStreamKey(k => k + 1), 3000);
        }
      }
    }

    setStreamOk(false);
    pump();
    return () => { dead = true; ctrl.abort(); };
  }, [streamKey]);

  // ── Connect DroidCam ──────────────────────────────────────────────────────
  const handleConnect = async () => {
    const ipClean = ip.trim();
    if (!ipClean) { setStatus("err"); setStatusMsg("Enter an IP address"); return; }
    setStatus("connecting"); setStatusMsg("");
    const source = `http://${ipClean}:${port.trim()}/video`;
    try {
      const r = await fetch(`${API}/camera/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!r.ok) throw new Error("Backend error");
      setStatus("ok");
      setStatusMsg(`Connected → ${source}`);
      // give processor 4s to reconnect then reload canvas stream
      setTimeout(() => setStreamKey(k => k + 1), 4000);
    } catch {
      setStatus("err");
      setStatusMsg("Cannot reach backend — is the server running?");
    }
  };

  const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString(); } catch { return iso; } };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="glass-main p-6 md:p-10 min-h-[80vh] animate-in fade-in zoom-in-95 duration-700">
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-[3px]">SENTINEL</div>
            <div className="text-2xl font-black text-slate-800 mt-1">Live CCTV — Detection Feed</div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold border-2
              ${camOnline ? "bg-green-50 border-green-300 text-green-700" : "bg-red-50 border-red-300 text-red-700"}`}>
              <span className="relative flex h-3 w-3">
                {camOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${camOnline ? "bg-green-500" : "bg-red-500"}`} />
              </span>
              {camOnline ? "Camera Online" : "Camera Offline"}
            </div>
            <div className={`px-3 py-2 rounded-2xl text-xs font-bold border
              ${wsOk ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
              {wsOk ? "WS ●" : "WS ○"}
            </div>
            <a href="/" className="liquid-button-purple px-5 py-2 rounded-2xl text-[10px] uppercase tracking-widest">
              ← Dashboard
            </a>
          </div>
        </div>

        {/* ── DroidCam connect bar ── */}
        <div className="bg-white/60 backdrop-blur-xl border-2 border-white/80 rounded-[2rem] p-5 shadow-lg">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-[2px] mb-3">📱 Connect DroidCam</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone IP Address</label>
              <input
                value={ip}
                onChange={e => setIp(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleConnect()}
                placeholder="192.168.1.4"
                className="mt-1 w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-sm font-mono font-bold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
              />
            </div>
            <div className="w-24">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Port</label>
              <input
                value={port}
                onChange={e => setPort(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-sm font-mono focus:outline-none focus:border-purple-400"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={status === "connecting"}
              className="liquid-button-purple px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-60 h-[42px]"
            >
              {status === "connecting" ? "Connecting…" : "Connect"}
            </button>
            {statusMsg && (
              <div className={`text-xs font-bold px-3 py-2 rounded-xl
                ${status === "ok" ? "bg-green-50 text-green-700 border border-green-200"
                : status === "err" ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-slate-50 text-slate-600"}`}>
                {status === "ok" ? "✓ " : status === "err" ? "✗ " : ""}{statusMsg}
              </div>
            )}
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

          {/* Live stream */}
          <div className="xl:col-span-2 space-y-4">
            <div className="relative bg-black rounded-[2rem] overflow-hidden shadow-2xl border-2 border-white/20"
                 style={{ minHeight: 360 }}>
              <canvas
                ref={canvasRef}
                className="w-full block"
                style={{ minHeight: 360, background: "#000", display: streamOk ? "block" : "none" }}
              />
              {!streamOk && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60 bg-black" style={{ minHeight: 360 }}>
                  <div className="text-5xl animate-pulse">📷</div>
                  <div className="text-sm font-bold">Connecting to camera stream…</div>
                  <div className="text-xs opacity-60">retrying every 3 seconds</div>
                  <button
                    onClick={() => setStreamKey(k => k + 1)}
                    className="mt-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold border border-white/20 transition-all"
                  >
                    Retry now
                  </button>
                </div>
              )}
            </div>

            {/* Posture legend */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                ["🟢", "Standing"], ["🔵", "Sitting"], ["🔴", "Lying"],
                ["🩵", "Crouching"], ["🟠", "Bending"], ["🚨", "FALL!"],
              ].map(([icon, label]) => (
                <div key={label} className="bg-white/50 rounded-xl p-2 text-center border border-white/60">
                  <div className="text-sm font-bold">{icon}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">

            {/* Detection stats */}
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/70 rounded-[2rem] p-5 shadow-lg">
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-[2px] mb-3">📊 Detection Counts</div>
              <div className="space-y-1.5">
                {STAT_KEYS.map(key => {
                  const meta = EVT[key] || { icon: "•", label: key };
                  const count = stats[key] || 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-base w-6 text-center">{meta.icon}</span>
                      <span className="flex-1 text-xs font-bold text-slate-600">{meta.label}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-black min-w-[28px] text-center
                        ${count > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-400"}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ── Live events ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-4 px-1">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[3px]">Live Events</span>
            <div className="h-px flex-1 bg-white/40" />
            <span className="text-[10px] font-bold text-slate-400">{events.length} recent</span>
          </div>

          {events.length === 0 && (
            <div className="bg-white/30 rounded-[2rem] p-8 text-center text-sm text-slate-500 font-bold">
              Waiting for detections… Connect DroidCam and the events will appear here.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.slice(0, 30).map((e, i) => {
              const meta = EVT[e.event_type] || { icon: "📍", label: e.event_type, pill: "bg-slate-500 text-white" };
              const isFall = e.event_type === "fall_detected";
              return (
                <div key={e.id || i} className={`flex items-start gap-3 p-4 rounded-2xl border-2 shadow-md
                  ${isFall ? "bg-red-50/80 border-red-300 ring-2 ring-red-400 animate-pulse" : "bg-white/50 border-white/70"}`}>
                  <span className="text-2xl mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${meta.pill}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {Math.round((e.confidence || 0) * 100)}%
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-700 mt-1 truncate">
                      {e.message || meta.label}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex gap-2">
                      <span>{e.zone?.replace(/_/g, " ")}</span>
                      <span>·</span>
                      <span>{fmtTime(e.time)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
