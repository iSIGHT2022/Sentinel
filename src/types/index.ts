export type Category =
  | "emergency"
  | "activity"
  | "bathroom"
  | "dining"
  | "behaviour"
  | "social"
  | "room";

export interface TileSummary {
  category: Category;
  active_alerts: number;
  critical_count: number;
  high_count: number;
  last_alert_time: string | null;
  last_event_time: string | null;
}

export interface DashboardSummary {
  tiles: TileSummary[];
  critical_alerts: Alert[];
  stats: { total_residents: number; open_alerts: number; events_last_hour: number };
}

export interface Alert {
  id: string;
  time: string;
  severity: "low" | "medium" | "high" | "critical";
  alert_type: string;
  category: Category;
  zone: string;
  message: string;
  acknowledged: boolean;
  resident_id: string | null;
  metadata: Record<string, unknown>;
}

export interface Event {
  id: string;
  time: string;
  event_type: string;
  category: Category;
  zone: string;
  confidence: number;
  reid_id: string | null;
  metadata: Record<string, unknown>;
  clip_url: string | null;
}

export interface Resident {
  id: string;
  name: string;
  age: number | null;
  room_number: string | null;
  medical_notes: string | null;
  emergency_contacts: { name: string; phone: string; relation: string }[];
}

export interface ResidentStatus {
  resident_id: string;
  last_seen_zone: string | null;
  last_seen_time: string | null;
  current_activity: string;
  activity_icon: string;
  in_room_inferred: boolean;
  active_alert_count: number;
  alert_severity: "low" | "medium" | "high" | "critical" | null;
}

export interface WSMessage {
  type: "new_event" | "alert_acknowledged" | "alert_resolved";
  event?: Event;
  alert?: Alert;
  alert_id?: string;
}

// Human-readable labels per category
export const CATEGORY_META: Record<Category, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
  subFeatures: string[];
}> = {
  emergency: {
    label: "Emergency",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-300",
    icon: "🚨",
    subFeatures: [
      "Fall detection",
      "Slow collapse",
      "Person on floor — not rising",
      "Choking gesture (dining hall)",
      "Crowd emergency formation",
      "Zone boundary breach",
    ],
  },
  activity: {
    label: "Activity & Posture",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-300",
    icon: "🚶",
    subFeatures: [
      "Sitting / standing / walking classification",
      "Abnormal or shuffling gait",
      "Tremor & unsteady movement",
      "Limping / asymmetric stride",
      "Balance instability",
      "Repetitive pacing",
      "Poor posture / slouching",
      "Breathlessness proxy (frequent sit-downs)",
    ],
  },
  bathroom: {
    label: "Bathroom",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-300",
    icon: "🚪",
    subFeatures: [
      "Entry & exit timestamps (corridor camera)",
      "Abnormal dwell time alert",
      "Daily visit frequency",
      "Night-time bathroom visits",
    ],
  },
  dining: {
    label: "Dining & Meals",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-300",
    icon: "🍽️",
    subFeatures: [
      "Meal attendance detection",
      "Meal skip alert",
      "Meal duration (seated time)",
      "Early exit from dining hall",
      "Eating gesture (hand-to-mouth)",
      "Social seating patterns",
    ],
  },
  behaviour: {
    label: "Behaviour & Cognition",
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    icon: "🧠",
    subFeatures: [
      "Wandering detection",
      "Confusion mapping (repeated room visits)",
      "Disorientation (prolonged corridor standstill)",
      "Facility path deviation",
      "Wandering toward exit boundaries",
    ],
  },
  social: {
    label: "Social & Wellbeing",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-300",
    icon: "👥",
    subFeatures: [
      "Social isolation score",
      "Prolonged inactivity in common areas",
      "Crowd stress (backing away)",
      "Withdrawn / head-down posture",
      "Interaction initiation tracking",
      "Preferred gathering spots",
      "Activity room attendance",
    ],
  },
  room: {
    label: "Room Presence",
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-300",
    icon: "🏠",
    subFeatures: [
      "Last-seen location & timestamp",
      "In-room inferred status",
      "Room entry / exit time (corridor camera)",
      "Night room presence inference",
    ],
  },
};
