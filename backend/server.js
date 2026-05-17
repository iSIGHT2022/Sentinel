const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8000;
const WS_PATH = "/ws/global";

const CATEGORY_LIST = ["emergency", "activity", "bathroom", "dining", "behaviour", "social", "room"];

const RESIDENTS = [
  { id: "r1",  name: "Margaret Davies",  room_number: "101" },
  { id: "r2",  name: "William Patel",    room_number: "102" },
  { id: "r3",  name: "Robert Hughes",    room_number: "103" },
  { id: "r4",  name: "George Thompson",  room_number: "104" },
  { id: "r5",  name: "Eleanor Patel",    room_number: "105" },
  { id: "r6",  name: "Dorothy Singh",    room_number: "106" },
  { id: "r7",  name: "Harold Wilson",    room_number: "107" },
  { id: "r8",  name: "Beatrice Martin",  room_number: "108" },
  { id: "r9",  name: "Arthur Brown",     room_number: "109" },
  { id: "r10", name: "Florence Lee",     room_number: "110" },
  { id: "r11", name: "Stanley Cooper",   room_number: "111" },
  { id: "r12", name: "Edith Clarke",     room_number: "112" },
];

const ZONES = [
  "corridors_hallways", "bathroom_entry", "dining_hall",
  "common_room_lounge", "activity_therapy_room", "garden_outdoor", "room_area",
];

// ── In-memory store ──────────────────────────────────────────────────────────
const EVENTS = Object.fromEntries(CATEGORY_LIST.map(c => [c, []]));
const ALERTS = Object.fromEntries(CATEGORY_LIST.map(c => [c, []]));

// Seed a few initial alerts so the dashboard isn't empty on first load
(function seed() {
  function e(et, cat, zone, reid, conf, msg) {
    return { id: createId("e"), time: now(), event_type: et, category: cat,
             zone, confidence: conf, reid_id: reid, metadata: {}, clip_url: null, message: msg };
  }
  function a(at, cat, zone, res_id, msg, sev) {
    return { id: createId("a"), time: now(), severity: sev, alert_type: at,
             category: cat, zone, message: msg, acknowledged: false,
             resident_id: res_id, metadata: {} };
  }
  EVENTS.emergency.push(e("fall_detected","emergency","corridors_hallways","R0004",0.92,"Fall detected in corridor"));
  EVENTS.activity.push( e("gait_abnormal","activity","corridors_hallways","R0003",0.84,"Abnormal gait detected"));
  EVENTS.bathroom.push( e("bathroom_extended_stay","bathroom","bathroom_entry","R0012",0.90,"Extended bathroom dwell time"));
  EVENTS.behaviour.push(e("wandering_detected","behaviour","corridors_hallways","R0007",0.87,"Wandering detected"));
  ALERTS.emergency.push(a("fall_detected","emergency","corridors_hallways","r1","Margaret Davies has fallen in corridors. Immediate assistance needed.","critical"));
  ALERTS.activity.push( a("gait_abnormal","activity","corridors_hallways","r3","Robert Hughes is showing an abnormal gait.","high"));
  ALERTS.bathroom.push( a("bathroom_extended_stay","bathroom","bathroom_entry","r4","George Thompson has been in the bathroom for over 25 minutes.","high"));
  ALERTS.behaviour.push(a("wandering_detected","behaviour","corridors_hallways","r7","Harold Wilson is wandering in corridors.","high"));
})();

// ── Camera state ─────────────────────────────────────────────────────────────
let cameraSource    = null;   // set by frontend or Python processor
let lastHeartbeat   = 0;
let cameraOnline    = false;

// Detect camera going offline (no heartbeat for 15 s)
setInterval(() => {
  if (lastHeartbeat > 0 && cameraOnline && Date.now() - lastHeartbeat > 15000) {
    cameraOnline = false;
    console.log("[CAM] Camera offline — no heartbeat for >15s");
    broadcast({ type: "camera_offline", source: cameraSource, time: now() });
  }
}, 5000);

// ── Helpers ──────────────────────────────────────────────────────────────────
function createId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(2).toString("hex")}`;
}
function now() { return new Date().toISOString(); }

function classifyCategory(event_type) {
  if (event_type.includes("bathroom"))                                    return "bathroom";
  if (event_type.includes("dining") || event_type.includes("meal"))      return "dining";
  if (event_type.includes("fall")   || event_type.includes("crowd"))     return "emergency";
  if (event_type.includes("wandering") || event_type.includes("confusion") ||
      event_type.includes("disorientation"))                              return "behaviour";
  if (event_type.includes("inactivity") || event_type.includes("social") ||
      event_type.includes("interaction"))                                 return "social";
  if (event_type.includes("room"))                                        return "room";
  return "activity";
}

function classifySeverity(event_type, confidence = 0) {
  if (event_type.includes("fall") || event_type.includes("collapse") ||
      event_type.includes("crowd"))                                       return "critical";
  if (event_type.includes("gait") || event_type.includes("wandering") ||
      event_type.includes("bathroom") || event_type.includes("sleeping") ||
      confidence >= 0.85)                                                 return "high";
  if (confidence >= 0.65)                                                 return "medium";
  return "low";
}

function createAlertFromEvent(event) {
  return {
    id:           createId("a"),
    time:         event.time || now(),
    severity:     classifySeverity(event.event_type, event.confidence),
    alert_type:   event.event_type,
    category:     event.category || classifyCategory(event.event_type),
    zone:         event.zone || "unknown_zone",
    message:      event.message || `Detected ${event.event_type.replace(/_/g," ")} in ${event.zone || "unknown"}`,
    acknowledged: false,
    resident_id:  event.resident_id || null,
    metadata:     event.metadata || {},
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => {
      const b = Buffer.concat(chunks).toString();
      if (!b) return resolve({});
      try { resolve(JSON.parse(b)); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function countEventsLastHour() {
  const cut = Date.now() - 3600_000;
  return CATEGORY_LIST.reduce((n, c) =>
    n + EVENTS[c].filter(e => new Date(e.time).getTime() >= cut).length, 0);
}

function buildSummary() {
  const allAlerts = CATEGORY_LIST.flatMap(c => ALERTS[c].filter(a => !a.resolved));
  return {
    stats: {
      total_residents: RESIDENTS.length,
      open_alerts:     allAlerts.length,
      events_last_hour: countEventsLastHour(),
    },
    tiles: CATEGORY_LIST.map(cat => {
      const active = ALERTS[cat].filter(a => !a.resolved);
      return {
        category:        cat,
        active_alerts:   active.length,
        critical_count:  active.filter(a => a.severity === "critical").length,
        high_count:      active.filter(a => a.severity === "high").length,
        last_alert_time: active.length ? active[active.length - 1].time : null,
        last_event_time: EVENTS[cat].length ? EVENTS[cat][EVENTS[cat].length - 1].time : null,
      };
    }),
    critical_alerts: allAlerts
      .filter(a => a.severity === "critical" || a.severity === "high")
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 10),
    camera: { online: cameraOnline, source: cameraSource },
  };
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") { sendJson(res, 204, {}); return; }

  // Dashboard summary
  if (req.method === "GET" && url.pathname === "/dashboard/summary") {
    sendJson(res, 200, buildSummary()); return;
  }

  // Events
  if (req.method === "GET" && url.pathname === "/events") {
    const cat   = url.searchParams.get("category");
    const limit = Number(url.searchParams.get("limit") || 50);
    if (!CATEGORY_LIST.includes(cat)) { sendJson(res, 200, []); return; }
    sendJson(res, 200, [...EVENTS[cat]].slice(-limit).reverse()); return;
  }

  // Alerts
  if (req.method === "GET" && url.pathname === "/alerts") {
    const cat  = url.searchParams.get("category");
    const resv = url.searchParams.get("resolved");
    const lim  = Number(url.searchParams.get("limit") || 30);
    if (!CATEGORY_LIST.includes(cat)) { sendJson(res, 200, []); return; }
    let list = ALERTS[cat];
    if (resv === "true")  list = list.filter(a =>  a.resolved);
    if (resv === "false") list = list.filter(a => !a.resolved);
    sendJson(res, 200, [...list].slice(-lim).reverse()); return;
  }

  // Residents
  if (req.method === "GET" && url.pathname === "/residents") {
    sendJson(res, 200, RESIDENTS); return;
  }

  // ── Ingest ────────────────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/ingest") {
    try {
      const body = await parseBody(req);
      const raw  = body.event || body;
      if (!raw || !raw.event_type) {
        sendJson(res, 400, { error: "Missing event_type" }); return;
      }
      const event = {
        id:          raw.id || createId("e"),
        time:        raw.time || now(),
        event_type:  raw.event_type,
        category:    raw.category || classifyCategory(raw.event_type),
        zone:        raw.zone || "unknown_zone",
        confidence:  Number(raw.confidence ?? 0.75),
        reid_id:     raw.reid_id || null,
        resident_id: raw.resident_id || null,
        metadata:    raw.metadata || {},
        clip_url:    raw.clip_url || null,
        message:     raw.message,
      };
      EVENTS[event.category] = EVENTS[event.category] || [];
      EVENTS[event.category].push(event);
      // Keep last 500 per category to avoid memory growth
      if (EVENTS[event.category].length > 500) EVENTS[event.category].shift();

      const alert = body.alert || createAlertFromEvent(event);
      ALERTS[alert.category] = ALERTS[alert.category] || [];
      ALERTS[alert.category].push(alert);
      if (ALERTS[alert.category].length > 200) ALERTS[alert.category].shift();

      const payload = { type: "new_event", event, alert };
      broadcast(payload);
      sendJson(res, 201, payload);
    } catch (err) {
      sendJson(res, 400, { error: "Invalid JSON", details: err.message });
    }
    return;
  }

  // ── Camera heartbeat (Python processor calls every 5 s) ──────────────────
  if (req.method === "POST" && url.pathname === "/camera/heartbeat") {
    const body = await parseBody(req).catch(() => ({}));
    lastHeartbeat = Date.now();
    if (body.source && !cameraSource) cameraSource = body.source;
    if (!cameraOnline) {
      cameraOnline = true;
      console.log(`[CAM] Camera online: ${cameraSource}`);
      broadcast({ type: "camera_online", source: cameraSource, time: now() });
    }
    sendJson(res, 200, { ok: true }); return;
  }

  // ── Camera config (Python polls to detect source change from UI) ──────────
  if (req.method === "GET" && url.pathname === "/camera/config") {
    sendJson(res, 200, { source: cameraSource }); return;
  }

  // ── Camera source (set from UI) ──────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/camera/source") {
    const body = await parseBody(req).catch(() => ({}));
    cameraSource = body.source || null;
    console.log(`[CAM] Source updated → ${cameraSource}`);
    broadcast({ type: "camera_source_changed", source: cameraSource, time: now() });
    sendJson(res, 200, { ok: true, source: cameraSource }); return;
  }

  // ── Camera status ────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/camera/status") {
    sendJson(res, 200, {
      online:  cameraOnline,
      source:  cameraSource,
      last_heartbeat: lastHeartbeat ? new Date(lastHeartbeat).toISOString() : null,
      seconds_since:  lastHeartbeat ? Math.round((Date.now() - lastHeartbeat) / 1000) : null,
    }); return;
  }

  sendJson(res, 404, { error: "Not found" });
});

// ── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", ws => {
  console.log("[WS] Client connected");
  // Send current camera status immediately on connect
  ws.send(JSON.stringify({ type: "server_ready", time: now(),
    camera: { online: cameraOnline, source: cameraSource } }));
  ws.on("message", msg => {
    if (msg.toString() === "ping")
      ws.send(JSON.stringify({ type: "pong", time: now() }));
  });
});

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach(c => { if (c.readyState === c.OPEN) c.send(payload); });
}

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  if (pathname === WS_PATH) {
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`[SERVER] Listening on http://localhost:${PORT}`);
  console.log(`[SERVER] WebSocket at ws://localhost:${PORT}${WS_PATH}`);
  if (process.env.ENABLE_DUMMY === "1") scheduleDummy();
  else console.log("[SERVER] Waiting for real CCTV input (set ENABLE_DUMMY=1 for mock events)");
});

// ── Dummy events (dev only) ───────────────────────────────────────────────────
function scheduleDummy() {
  const map = {
    emergency: ["fall_detected","crowd_emergency"],
    activity:  ["gait_abnormal","posture_sitting","posture_standing","balance_instability"],
    bathroom:  ["bathroom_extended_stay"],
    dining:    ["meal_skipped"],
    behaviour: ["wandering_detected"],
    social:    ["prolonged_inactivity"],
  };
  setInterval(() => {
    const cats = Object.keys(map);
    const cat  = cats[Math.floor(Math.random() * cats.length)];
    const evts = map[cat];
    const evt  = evts[Math.floor(Math.random() * evts.length)];
    const res  = RESIDENTS[Math.floor(Math.random() * RESIDENTS.length)];
    const json = JSON.stringify({ event: {
      event_type: evt, category: cat,
      zone: "corridors_hallways",
      confidence: +(0.7 + Math.random() * 0.25).toFixed(2),
      reid_id: `R${res.id.slice(1).padStart(4,"0")}`,
      resident_id: res.id,
      message: `${res.name}: ${evt.replace(/_/g," ")}`,
    }});
    const opt = {
      hostname:"127.0.0.1", port: PORT, path:"/ingest",
      method:"POST", headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(json)},
    };
    const r = http.request(opt); r.write(json); r.end();
  }, 18000);
}
