import { DashboardSummary, Alert, Event, Category, Resident, ResidentStatus } from "@/types";

export const MOCK_SUMMARY: DashboardSummary = {
  stats: { total_residents: 12, open_alerts: 7, events_last_hour: 43 },
  tiles: [
    { category: "emergency", active_alerts: 2, critical_count: 1, high_count: 1, last_alert_time: new Date(Date.now() - 4 * 60000).toISOString(), last_event_time: new Date(Date.now() - 4 * 60000).toISOString() },
    { category: "activity",  active_alerts: 3, critical_count: 0, high_count: 1, last_alert_time: new Date(Date.now() - 12 * 60000).toISOString(), last_event_time: new Date(Date.now() - 8 * 60000).toISOString() },
    { category: "bathroom",  active_alerts: 1, critical_count: 0, high_count: 1, last_alert_time: new Date(Date.now() - 22 * 60000).toISOString(), last_event_time: new Date(Date.now() - 22 * 60000).toISOString() },
    { category: "dining",    active_alerts: 1, critical_count: 0, high_count: 0, last_alert_time: new Date(Date.now() - 45 * 60000).toISOString(), last_event_time: new Date(Date.now() - 30 * 60000).toISOString() },
    { category: "behaviour", active_alerts: 2, critical_count: 0, high_count: 1, last_alert_time: new Date(Date.now() - 18 * 60000).toISOString(), last_event_time: new Date(Date.now() - 15 * 60000).toISOString() },
    { category: "social",    active_alerts: 0, critical_count: 0, high_count: 0, last_alert_time: null, last_event_time: new Date(Date.now() - 90 * 60000).toISOString() },
    { category: "room",      active_alerts: 0, critical_count: 0, high_count: 0, last_alert_time: null, last_event_time: new Date(Date.now() - 60 * 60000).toISOString() },
  ],
  critical_alerts: [
    { id: "a1", time: new Date(Date.now() - 4 * 60000).toISOString(), severity: "critical", alert_type: "fall_detected", category: "emergency", zone: "corridors_hallways", message: "Margaret D. has fallen in Corridors & Hallways. Immediate response required.", acknowledged: false, resident_id: "r1", metadata: {} },
    { id: "a2", time: new Date(Date.now() - 22 * 60000).toISOString(), severity: "high", alert_type: "bathroom_duration_alert", category: "bathroom", zone: "bathroom_entry", message: "George T. has been in the bathroom for 27 minutes.", acknowledged: false, resident_id: "r4", metadata: { duration_minutes: 27.3 } },
    { id: "a3", time: new Date(Date.now() - 12 * 60000).toISOString(), severity: "high", alert_type: "gait_abnormal", category: "activity", zone: "corridors_hallways", message: "Robert H. is showing abnormal shuffling gait in Corridors.", acknowledged: true, resident_id: "r3", metadata: {} },
  ],
};

// ── Residents ─────────────────────────────────────────────────────────────────

export const MOCK_RESIDENTS: Resident[] = [
  { id: "r1",  name: "Margaret Davies",  age: 82, room_number: "101", medical_notes: "Parkinson's — monitored for gait and falls", emergency_contacts: [{ name: "Susan Davies", phone: "+44 7700 900001", relation: "Daughter" }] },
  { id: "r2",  name: "William Patel",    age: 77, room_number: "102", medical_notes: "Mild cognitive impairment", emergency_contacts: [{ name: "Anil Patel", phone: "+44 7700 900002", relation: "Son" }] },
  { id: "r3",  name: "Robert Hughes",   age: 79, room_number: "103", medical_notes: "Hip replacement — physiotherapy ongoing", emergency_contacts: [{ name: "Claire Hughes", phone: "+44 7700 900003", relation: "Wife" }] },
  { id: "r4",  name: "George Thompson", age: 85, room_number: "104", medical_notes: "Diabetes, monitored for fatigue", emergency_contacts: [{ name: "Mark Thompson", phone: "+44 7700 900004", relation: "Son" }] },
  { id: "r5",  name: "Eleanor Patel",   age: 74, room_number: "105", medical_notes: "Anxiety, social withdrawal history", emergency_contacts: [{ name: "Priya Patel", phone: "+44 7700 900005", relation: "Daughter" }] },
  { id: "r6",  name: "Dorothy Singh",   age: 81, room_number: "106", medical_notes: "Reduced appetite — meal monitoring priority", emergency_contacts: [{ name: "Raj Singh", phone: "+44 7700 900006", relation: "Son" }] },
  { id: "r7",  name: "Harold Wilson",   age: 88, room_number: "107", medical_notes: "Dementia — wandering risk", emergency_contacts: [{ name: "Jane Wilson", phone: "+44 7700 900007", relation: "Daughter" }] },
  { id: "r8",  name: "Beatrice Martin", age: 76, room_number: "108", medical_notes: "Post-stroke, physiotherapy", emergency_contacts: [{ name: "Tom Martin", phone: "+44 7700 900008", relation: "Husband" }] },
  { id: "r9",  name: "Arthur Brown",    age: 83, room_number: "109", medical_notes: "Heart condition — activity monitored", emergency_contacts: [{ name: "Lucy Brown", phone: "+44 7700 900009", relation: "Daughter" }] },
  { id: "r10", name: "Florence Lee",    age: 71, room_number: "110", medical_notes: "Generally independent", emergency_contacts: [{ name: "David Lee", phone: "+44 7700 900010", relation: "Son" }] },
  { id: "r11", name: "Stanley Cooper",  age: 90, room_number: "111", medical_notes: "COPD — breathlessness monitoring", emergency_contacts: [{ name: "Ann Cooper", phone: "+44 7700 900011", relation: "Wife" }] },
  { id: "r12", name: "Edith Clarke",    age: 78, room_number: "112", medical_notes: "Osteoporosis — fall risk", emergency_contacts: [{ name: "Paul Clarke", phone: "+44 7700 900012", relation: "Son" }] },
];

// ── Resident current status ────────────────────────────────────────────────────

export const MOCK_RESIDENT_STATUS: Record<string, ResidentStatus> = {
  r1:  { resident_id: "r1",  last_seen_zone: "corridors_hallways",    last_seen_time: new Date(Date.now() - 4 * 60000).toISOString(),   current_activity: "Fall detected — needs assistance", activity_icon: "🚨", in_room_inferred: false, active_alert_count: 1, alert_severity: "critical" },
  r2:  { resident_id: "r2",  last_seen_zone: "common_room_lounge",    last_seen_time: new Date(Date.now() - 15 * 60000).toISOString(),  current_activity: "Sitting in Common Room",           activity_icon: "🛋️", in_room_inferred: false, active_alert_count: 0, alert_severity: null },
  r3:  { resident_id: "r3",  last_seen_zone: "corridors_hallways",    last_seen_time: new Date(Date.now() - 12 * 60000).toISOString(),  current_activity: "Walking — gait concern flagged",   activity_icon: "⚠️", in_room_inferred: false, active_alert_count: 1, alert_severity: "high" },
  r4:  { resident_id: "r4",  last_seen_zone: "bathroom_entry",        last_seen_time: new Date(Date.now() - 22 * 60000).toISOString(),  current_activity: "In bathroom (27 min — overdue)",   activity_icon: "🚪", in_room_inferred: false, active_alert_count: 1, alert_severity: "high" },
  r5:  { resident_id: "r5",  last_seen_zone: "garden_outdoor",        last_seen_time: new Date(Date.now() - 30 * 60000).toISOString(),  current_activity: "Sitting in Garden",                activity_icon: "🌿", in_room_inferred: false, active_alert_count: 0, alert_severity: null },
  r6:  { resident_id: "r6",  last_seen_zone: "dining_hall",           last_seen_time: new Date(Date.now() - 45 * 60000).toISOString(),  current_activity: "Missed lunch — not seen in dining", activity_icon: "🍽️", in_room_inferred: false, active_alert_count: 1, alert_severity: "medium" },
  r7:  { resident_id: "r7",  last_seen_zone: "corridors_hallways",    last_seen_time: new Date(Date.now() - 18 * 60000).toISOString(),  current_activity: "Wandering in corridors",            activity_icon: "🧠", in_room_inferred: false, active_alert_count: 1, alert_severity: "high" },
  r8:  { resident_id: "r8",  last_seen_zone: "activity_therapy_room", last_seen_time: new Date(Date.now() - 10 * 60000).toISOString(),  current_activity: "Physiotherapy session",             activity_icon: "🏥", in_room_inferred: false, active_alert_count: 0, alert_severity: null },
  r9:  { resident_id: "r9",  last_seen_zone: "corridors_hallways",    last_seen_time: new Date(Date.now() - 60 * 60000).toISOString(),  current_activity: "In room (inferred)",                activity_icon: "🏠", in_room_inferred: true,  active_alert_count: 0, alert_severity: null },
  r10: { resident_id: "r10", last_seen_zone: "common_room_lounge",    last_seen_time: new Date(Date.now() - 5 * 60000).toISOString(),   current_activity: "Socialising in Common Room",        activity_icon: "👥", in_room_inferred: false, active_alert_count: 0, alert_severity: null },
  r11: { resident_id: "r11", last_seen_zone: "corridors_hallways",    last_seen_time: new Date(Date.now() - 55 * 60000).toISOString(),  current_activity: "In room (inferred)",                activity_icon: "🏠", in_room_inferred: true,  active_alert_count: 0, alert_severity: null },
  r12: { resident_id: "r12", last_seen_zone: "dining_hall",           last_seen_time: new Date(Date.now() - 8 * 60000).toISOString(),   current_activity: "Having breakfast in Dining Hall",   activity_icon: "🍽️", in_room_inferred: false, active_alert_count: 0, alert_severity: null },
};

// ── Per-resident event timeline ────────────────────────────────────────────────

export const MOCK_RESIDENT_TIMELINE: Record<string, Event[]> = {
  r1: [
    { id: "e_r1_1", time: new Date(Date.now() - 4 * 60000).toISOString(),    event_type: "fall_detected",      category: "emergency", zone: "corridors_hallways",    confidence: 0.91, reid_id: "R0004", metadata: { aspect_ratio: 2.1 }, clip_url: null },
    { id: "e_r1_2", time: new Date(Date.now() - 18 * 60000).toISOString(),   event_type: "gait_abnormal",      category: "activity",  zone: "corridors_hallways",    confidence: 0.84, reid_id: "R0004", metadata: { pattern: "shuffling" }, clip_url: null },
    { id: "e_r1_3", time: new Date(Date.now() - 40 * 60000).toISOString(),   event_type: "balance_instability", category: "activity", zone: "corridors_hallways",    confidence: 0.72, reid_id: "R0004", metadata: {}, clip_url: null },
    { id: "e_r1_4", time: new Date(Date.now() - 90 * 60000).toISOString(),   event_type: "meal_present",       category: "dining",    zone: "dining_hall",           confidence: 0.97, reid_id: "R0004", metadata: {}, clip_url: null },
    { id: "e_r1_5", time: new Date(Date.now() - 95 * 60000).toISOString(),   event_type: "eating_gesture",     category: "dining",    zone: "dining_hall",           confidence: 0.71, reid_id: "R0004", metadata: {}, clip_url: null },
    { id: "e_r1_6", time: new Date(Date.now() - 3 * 3600000).toISOString(),  event_type: "bathroom_entry",     category: "bathroom",  zone: "bathroom_entry",        confidence: 0.95, reid_id: "R0004", metadata: {}, clip_url: null },
    { id: "e_r1_7", time: new Date(Date.now() - 3 * 3600000 + 8 * 60000).toISOString(), event_type: "bathroom_exit", category: "bathroom", zone: "bathroom_entry", confidence: 0.95, reid_id: "R0004", metadata: {}, clip_url: null },
    { id: "e_r1_8", time: new Date(Date.now() - 5 * 3600000).toISOString(),  event_type: "social_interaction", category: "social",    zone: "common_room_lounge",    confidence: 0.65, reid_id: "R0004", metadata: {}, clip_url: null },
  ],
  r3: [
    { id: "e_r3_1", time: new Date(Date.now() - 12 * 60000).toISOString(),   event_type: "gait_abnormal",      category: "activity",  zone: "corridors_hallways",    confidence: 0.84, reid_id: "R0003", metadata: { pattern: "shuffling", mean_speed_px: 1.1 }, clip_url: null },
    { id: "e_r3_2", time: new Date(Date.now() - 20 * 60000).toISOString(),   event_type: "limping_detected",   category: "activity",  zone: "corridors_hallways",    confidence: 0.71, reid_id: "R0003", metadata: { asymmetry_ratio: 0.31 }, clip_url: null },
    { id: "e_r3_3", time: new Date(Date.now() - 65 * 60000).toISOString(),   event_type: "activity_therapy_room", category: "activity", zone: "activity_therapy_room", confidence: 0.98, reid_id: "R0003", metadata: {}, clip_url: null },
    { id: "e_r3_4", time: new Date(Date.now() - 90 * 60000).toISOString(),   event_type: "meal_present",       category: "dining",    zone: "dining_hall",           confidence: 0.97, reid_id: "R0003", metadata: {}, clip_url: null },
    { id: "e_r3_5", time: new Date(Date.now() - 4 * 3600000).toISOString(),  event_type: "bathroom_entry",     category: "bathroom",  zone: "bathroom_entry",        confidence: 0.95, reid_id: "R0003", metadata: {}, clip_url: null },
  ],
  r4: [
    { id: "e_r4_1", time: new Date(Date.now() - 22 * 60000).toISOString(),   event_type: "bathroom_duration_alert", category: "bathroom", zone: "bathroom_entry",   confidence: 0.90, reid_id: "R0012", metadata: { duration_minutes: 27.3 }, clip_url: null },
    { id: "e_r4_2", time: new Date(Date.now() - 22 * 60000).toISOString(),   event_type: "bathroom_entry",     category: "bathroom",  zone: "bathroom_entry",        confidence: 0.95, reid_id: "R0012", metadata: {}, clip_url: null },
    { id: "e_r4_3", time: new Date(Date.now() - 90 * 60000).toISOString(),   event_type: "meal_present",       category: "dining",    zone: "dining_hall",           confidence: 0.97, reid_id: "R0012", metadata: {}, clip_url: null },
    { id: "e_r4_4", time: new Date(Date.now() - 3 * 3600000).toISOString(),  event_type: "bathroom_entry",     category: "bathroom",  zone: "bathroom_entry",        confidence: 0.95, reid_id: "R0012", metadata: {}, clip_url: null },
    { id: "e_r4_5", time: new Date(Date.now() - 3 * 3600000 + 10 * 60000).toISOString(), event_type: "bathroom_exit", category: "bathroom", zone: "bathroom_entry", confidence: 0.95, reid_id: "R0012", metadata: {}, clip_url: null },
    { id: "e_r4_6", time: new Date(Date.now() - 5 * 3600000).toISOString(),  event_type: "bathroom_night_visit", category: "bathroom", zone: "bathroom_entry",      confidence: 0.92, reid_id: "R0012", metadata: {}, clip_url: null },
  ],
  r7: [
    { id: "e_r7_1", time: new Date(Date.now() - 18 * 60000).toISOString(),   event_type: "wandering_detected", category: "behaviour", zone: "corridors_hallways",    confidence: 0.87, reid_id: "R0007", metadata: { path_efficiency_ratio: 4.2 }, clip_url: null },
    { id: "e_r7_2", time: new Date(Date.now() - 30 * 60000).toISOString(),   event_type: "confusion_mapping",  category: "behaviour", zone: "common_room_lounge",    confidence: 0.75, reid_id: "R0007", metadata: { visits_in_window: 4 }, clip_url: null },
    { id: "e_r7_3", time: new Date(Date.now() - 55 * 60000).toISOString(),   event_type: "disorientation",     category: "behaviour", zone: "corridors_hallways",    confidence: 0.70, reid_id: "R0007", metadata: {}, clip_url: null },
    { id: "e_r7_4", time: new Date(Date.now() - 90 * 60000).toISOString(),   event_type: "meal_present",       category: "dining",    zone: "dining_hall",           confidence: 0.97, reid_id: "R0007", metadata: {}, clip_url: null },
    { id: "e_r7_5", time: new Date(Date.now() - 2 * 3600000).toISOString(),  event_type: "repetitive_pacing",  category: "activity",  zone: "corridors_hallways",    confidence: 0.80, reid_id: "R0007", metadata: { reversals: 7 }, clip_url: null },
  ],
};

// Generate generic timeline for residents without specific data
function genericTimeline(rId: string, reidId: string): Event[] {
  return [
    { id: `${rId}_t1`, time: new Date(Date.now() - 15 * 60000).toISOString(),  event_type: "social_interaction", category: "social",   zone: "common_room_lounge", confidence: 0.65, reid_id: reidId, metadata: {}, clip_url: null },
    { id: `${rId}_t2`, time: new Date(Date.now() - 90 * 60000).toISOString(),  event_type: "meal_present",       category: "dining",   zone: "dining_hall",        confidence: 0.97, reid_id: reidId, metadata: {}, clip_url: null },
    { id: `${rId}_t3`, time: new Date(Date.now() - 95 * 60000).toISOString(),  event_type: "eating_gesture",     category: "dining",   zone: "dining_hall",        confidence: 0.70, reid_id: reidId, metadata: {}, clip_url: null },
    { id: `${rId}_t4`, time: new Date(Date.now() - 3 * 3600000).toISOString(), event_type: "bathroom_entry",     category: "bathroom", zone: "bathroom_entry",     confidence: 0.95, reid_id: reidId, metadata: {}, clip_url: null },
    { id: `${rId}_t5`, time: new Date(Date.now() - 3 * 3600000 + 7 * 60000).toISOString(), event_type: "bathroom_exit", category: "bathroom", zone: "bathroom_entry", confidence: 0.95, reid_id: reidId, metadata: {}, clip_url: null },
    { id: `${rId}_t6`, time: new Date(Date.now() - 5 * 3600000).toISOString(), event_type: "room_entry_inferred", category: "room",   zone: "corridors_hallways", confidence: 0.70, reid_id: reidId, metadata: {}, clip_url: null },
  ];
}

const REID_MAP: Record<string, string> = { r2: "R0002", r5: "R0005", r6: "R0006", r8: "R0008", r9: "R0009", r10: "R0010", r11: "R0011", r12: "R0012" };
for (const [rId, reid] of Object.entries(REID_MAP)) {
  if (!MOCK_RESIDENT_TIMELINE[rId]) MOCK_RESIDENT_TIMELINE[rId] = genericTimeline(rId, reid);
}

// ── Daily stats per resident ───────────────────────────────────────────────────

export interface ResidentDayStats {
  meals_attended: number;
  meals_total: number;
  bathroom_visits: number;
  night_bathroom_visits: number;
  activity_room_visits: number;
  common_area_minutes: number;
  social_interactions: number;
  alerts_today: number;
}

export const MOCK_DAY_STATS: Record<string, ResidentDayStats> = {
  r1:  { meals_attended: 1, meals_total: 3, bathroom_visits: 3, night_bathroom_visits: 0, activity_room_visits: 0, common_area_minutes: 45,  social_interactions: 2, alerts_today: 3 },
  r2:  { meals_attended: 2, meals_total: 3, bathroom_visits: 4, night_bathroom_visits: 1, activity_room_visits: 1, common_area_minutes: 120, social_interactions: 5, alerts_today: 0 },
  r3:  { meals_attended: 2, meals_total: 3, bathroom_visits: 3, night_bathroom_visits: 0, activity_room_visits: 1, common_area_minutes: 95,  social_interactions: 3, alerts_today: 2 },
  r4:  { meals_attended: 2, meals_total: 3, bathroom_visits: 5, night_bathroom_visits: 1, activity_room_visits: 0, common_area_minutes: 60,  social_interactions: 1, alerts_today: 1 },
  r5:  { meals_attended: 2, meals_total: 3, bathroom_visits: 2, night_bathroom_visits: 0, activity_room_visits: 0, common_area_minutes: 80,  social_interactions: 0, alerts_today: 0 },
  r6:  { meals_attended: 0, meals_total: 3, bathroom_visits: 2, night_bathroom_visits: 0, activity_room_visits: 0, common_area_minutes: 20,  social_interactions: 0, alerts_today: 1 },
  r7:  { meals_attended: 1, meals_total: 3, bathroom_visits: 4, night_bathroom_visits: 0, activity_room_visits: 0, common_area_minutes: 110, social_interactions: 1, alerts_today: 3 },
  r8:  { meals_attended: 2, meals_total: 3, bathroom_visits: 3, night_bathroom_visits: 0, activity_room_visits: 1, common_area_minutes: 100, social_interactions: 4, alerts_today: 0 },
  r9:  { meals_attended: 2, meals_total: 3, bathroom_visits: 2, night_bathroom_visits: 0, activity_room_visits: 0, common_area_minutes: 30,  social_interactions: 1, alerts_today: 0 },
  r10: { meals_attended: 3, meals_total: 3, bathroom_visits: 3, night_bathroom_visits: 0, activity_room_visits: 1, common_area_minutes: 150, social_interactions: 7, alerts_today: 0 },
  r11: { meals_attended: 2, meals_total: 3, bathroom_visits: 3, night_bathroom_visits: 1, activity_room_visits: 0, common_area_minutes: 40,  social_interactions: 2, alerts_today: 0 },
  r12: { meals_attended: 2, meals_total: 3, bathroom_visits: 2, night_bathroom_visits: 0, activity_room_visits: 0, common_area_minutes: 70,  social_interactions: 3, alerts_today: 0 },
};

// ── Category alert/event data (unchanged) ─────────────────────────────────────

export const MOCK_ALERTS: Record<Category, Alert[]> = {
  emergency: [
    { id: "a1", time: new Date(Date.now() - 4 * 60000).toISOString(), severity: "critical", alert_type: "fall_detected", category: "emergency", zone: "corridors_hallways", message: "Margaret Davies has fallen in Corridors & Hallways. Immediate response required.", acknowledged: false, resident_id: "r1", metadata: { aspect_ratio: 2.1 } },
    { id: "a4", time: new Date(Date.now() - 35 * 60000).toISOString(), severity: "high", alert_type: "crowd_emergency", category: "emergency", zone: "dining_hall", message: "Crowd forming around a resident in Dining Hall.", acknowledged: true, resident_id: null, metadata: { persons_nearby: 5 } },
  ],
  activity: [
    { id: "a2b", time: new Date(Date.now() - 8 * 60000).toISOString(), severity: "high", alert_type: "gait_abnormal", category: "activity", zone: "corridors_hallways", message: "Robert Hughes is showing abnormal shuffling gait in Corridors.", acknowledged: false, resident_id: "r3", metadata: { pattern: "shuffling", mean_speed_px: 1.1 } },
    { id: "a5", time: new Date(Date.now() - 20 * 60000).toISOString(), severity: "medium", alert_type: "balance_instability", category: "activity", zone: "corridors_hallways", message: "Margaret Davies is showing lateral balance instability.", acknowledged: false, resident_id: "r1", metadata: { lateral_sway_px: 14.2 } },
    { id: "a6", time: new Date(Date.now() - 55 * 60000).toISOString(), severity: "medium", alert_type: "tremor_detected", category: "activity", zone: "corridors_hallways", message: "Stanley Cooper is showing wrist tremor while walking.", acknowledged: true, resident_id: "r11", metadata: { wrist_oscillation_std: 6.8 } },
  ],
  bathroom: [
    { id: "a3", time: new Date(Date.now() - 22 * 60000).toISOString(), severity: "high", alert_type: "bathroom_duration_alert", category: "bathroom", zone: "bathroom_entry", message: "George Thompson has been in the bathroom for 27.3 minutes.", acknowledged: false, resident_id: "r4", metadata: { duration_minutes: 27.3 } },
  ],
  dining: [
    { id: "a7", time: new Date(Date.now() - 45 * 60000).toISOString(), severity: "medium", alert_type: "meal_skipped", category: "dining", zone: "dining_hall", message: "Dorothy Singh was not present at the dining hall during lunch.", acknowledged: false, resident_id: "r6", metadata: {} },
  ],
  behaviour: [
    { id: "a8", time: new Date(Date.now() - 18 * 60000).toISOString(), severity: "high", alert_type: "wandering_detected", category: "behaviour", zone: "corridors_hallways", message: "Harold Wilson is wandering in Corridors & Hallways.", acknowledged: false, resident_id: "r7", metadata: { path_efficiency_ratio: 4.2 } },
    { id: "a9", time: new Date(Date.now() - 30 * 60000).toISOString(), severity: "medium", alert_type: "confusion_mapping", category: "behaviour", zone: "common_room_lounge", message: "Harold Wilson has visited the Common Room 4 times in the past 10 minutes.", acknowledged: false, resident_id: "r7", metadata: { visits_in_window: 4 } },
  ],
  social: [],
  room: [],
};

export const MOCK_EVENTS: Record<Category, Event[]> = {
  emergency: [
    { id: "e1", time: new Date(Date.now() - 4 * 60000).toISOString(), event_type: "fall_detected", category: "emergency", zone: "corridors_hallways", confidence: 0.91, reid_id: "R0004", metadata: {}, clip_url: null },
    { id: "e2", time: new Date(Date.now() - 35 * 60000).toISOString(), event_type: "crowd_emergency", category: "emergency", zone: "dining_hall", confidence: 0.82, reid_id: "R0007", metadata: {}, clip_url: null },
    { id: "e3", time: new Date(Date.now() - 2 * 3600000).toISOString(), event_type: "slow_collapse", category: "emergency", zone: "activity_therapy_room", confidence: 0.76, reid_id: "R0011", metadata: {}, clip_url: null },
  ],
  activity: [
    { id: "e4", time: new Date(Date.now() - 8 * 60000).toISOString(), event_type: "gait_abnormal", category: "activity", zone: "corridors_hallways", confidence: 0.84, reid_id: "R0003", metadata: { pattern: "shuffling" }, clip_url: null },
    { id: "e5", time: new Date(Date.now() - 20 * 60000).toISOString(), event_type: "balance_instability", category: "activity", zone: "corridors_hallways", confidence: 0.72, reid_id: "R0009", metadata: {}, clip_url: null },
    { id: "e6", time: new Date(Date.now() - 40 * 60000).toISOString(), event_type: "poor_posture", category: "activity", zone: "common_room_lounge", confidence: 0.68, reid_id: "R0002", metadata: { spine_angle_deg: 38.5 }, clip_url: null },
    { id: "e7", time: new Date(Date.now() - 55 * 60000).toISOString(), event_type: "tremor_detected", category: "activity", zone: "corridors_hallways", confidence: 0.79, reid_id: "R0005", metadata: {}, clip_url: null },
    { id: "e8", time: new Date(Date.now() - 80 * 60000).toISOString(), event_type: "limping_detected", category: "activity", zone: "corridors_hallways", confidence: 0.71, reid_id: "R0013", metadata: { asymmetry_ratio: 0.31 }, clip_url: null },
    { id: "e9", time: new Date(Date.now() - 100 * 60000).toISOString(), event_type: "repetitive_pacing", category: "activity", zone: "corridors_hallways", confidence: 0.80, reid_id: "R0006", metadata: { reversals: 7 }, clip_url: null },
  ],
  bathroom: [
    { id: "e10", time: new Date(Date.now() - 22 * 60000).toISOString(), event_type: "bathroom_duration_alert", category: "bathroom", zone: "bathroom_entry", confidence: 0.90, reid_id: "R0012", metadata: { duration_minutes: 27.3 }, clip_url: null },
    { id: "e11", time: new Date(Date.now() - 3 * 3600000).toISOString(), event_type: "bathroom_entry", category: "bathroom", zone: "bathroom_entry", confidence: 0.95, reid_id: "R0008", metadata: {}, clip_url: null },
    { id: "e12", time: new Date(Date.now() - 5 * 3600000).toISOString(), event_type: "bathroom_night_visit", category: "bathroom", zone: "bathroom_entry", confidence: 0.92, reid_id: "R0001", metadata: {}, clip_url: null },
  ],
  dining: [
    { id: "e13", time: new Date(Date.now() - 45 * 60000).toISOString(), event_type: "meal_skipped", category: "dining", zone: "dining_hall", confidence: 0.95, reid_id: "R0006", metadata: {}, clip_url: null },
    { id: "e14", time: new Date(Date.now() - 90 * 60000).toISOString(), event_type: "eating_gesture", category: "dining", zone: "dining_hall", confidence: 0.72, reid_id: "R0014", metadata: {}, clip_url: null },
    { id: "e15", time: new Date(Date.now() - 95 * 60000).toISOString(), event_type: "meal_present", category: "dining", zone: "dining_hall", confidence: 0.98, reid_id: "R0002", metadata: {}, clip_url: null },
    { id: "e16", time: new Date(Date.now() - 100 * 60000).toISOString(), event_type: "social_seating", category: "dining", zone: "dining_hall", confidence: 0.65, reid_id: "R0003", metadata: {}, clip_url: null },
  ],
  behaviour: [
    { id: "e17", time: new Date(Date.now() - 18 * 60000).toISOString(), event_type: "wandering_detected", category: "behaviour", zone: "corridors_hallways", confidence: 0.87, reid_id: "R0007", metadata: { path_efficiency_ratio: 4.2 }, clip_url: null },
    { id: "e18", time: new Date(Date.now() - 30 * 60000).toISOString(), event_type: "confusion_mapping", category: "behaviour", zone: "common_room_lounge", confidence: 0.75, reid_id: "R0008", metadata: { visits_in_window: 4 }, clip_url: null },
    { id: "e19", time: new Date(Date.now() - 70 * 60000).toISOString(), event_type: "prolonged_dwell", category: "behaviour", zone: "corridors_hallways", confidence: 0.80, reid_id: "R0010", metadata: { dwell_seconds: 145 }, clip_url: null },
  ],
  social: [
    { id: "e20", time: new Date(Date.now() - 90 * 60000).toISOString(), event_type: "social_interaction", category: "social", zone: "common_room_lounge", confidence: 0.65, reid_id: "R0002", metadata: {}, clip_url: null },
    { id: "e21", time: new Date(Date.now() - 110 * 60000).toISOString(), event_type: "prolonged_inactivity", category: "social", zone: "garden_outdoor", confidence: 0.75, reid_id: "R0015", metadata: { inactive_minutes: 18 }, clip_url: null },
  ],
  room: [
    { id: "e22", time: new Date(Date.now() - 60 * 60000).toISOString(), event_type: "room_entry_inferred", category: "room", zone: "corridors_hallways", confidence: 0.70, reid_id: "R0001", metadata: { minutes_unseen: 6.2 }, clip_url: null },
    { id: "e23", time: new Date(Date.now() - 3 * 3600000).toISOString(), event_type: "in_room_inferred", category: "room", zone: "corridors_hallways", confidence: 0.70, reid_id: "R0009", metadata: {}, clip_url: null },
  ],
};
