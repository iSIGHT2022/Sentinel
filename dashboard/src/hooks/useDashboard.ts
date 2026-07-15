"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardSummary, Category } from "@/types";
import { MOCK_SUMMARY, MOCK_ALERTS, MOCK_EVENTS } from "@/lib/mockData";

const API = process.env.NEXT_PUBLIC_API_URL;

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary>(MOCK_SUMMARY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/dashboard/summary`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) setSummary(await res.json());
    } catch {
      // keep mock data when backend unreachable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { summary, loading, refresh };
}

export function useCategoryData(category: Category | null) {
  const [events, setEvents] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLoading(true);

    // Start with mock data instantly
    setEvents(MOCK_EVENTS[category] ?? []);
    setAlerts(MOCK_ALERTS[category] ?? []);

    // Try live API in background
    Promise.all([
      fetch(`${API}/events?category=${category}&hours=24&limit=50`, { signal: AbortSignal.timeout(3000) })
        .then((r) => r.json()).catch(() => null),
      fetch(`${API}/alerts?category=${category}&resolved=false&limit=30`, { signal: AbortSignal.timeout(3000) })
        .then((r) => r.json()).catch(() => null),
    ]).then(([ev, al]) => {
      if (Array.isArray(ev)) setEvents(ev);
      if (Array.isArray(al)) setAlerts(al);
    }).finally(() => setLoading(false));
  }, [category]);

  return { events, alerts, loading };
}
