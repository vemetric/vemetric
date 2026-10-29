import { SESSION_DURATION_MINUTES } from '@vemetric/common/session';
import { clickhouseDateToISO } from 'clickhouse';

export const SESSION_GAP_MS = SESSION_DURATION_MINUTES * 60 * 1000;

export const toMs = (timestamp: string) => Date.parse(clickhouseDateToISO(timestamp));

export interface PlanSession {
  id: string;
  // A session of the merged id; visits without one stay as they are.
  source: boolean;
  startedAt: number;
  endedAt: number;
}

export interface Visit {
  survivor: string;
  members: string[];
  startedAt: number;
  endedAt: number;
}

/**
 * Groups sessions of both ids into visits, as the hub would have split them had both ids been
 * one user from the start: sessions less than the session duration apart belong together. Each
 * visit that contains a session of the merged id is kept by its earliest session; every member
 * maps to it. The earliest session keeps its start, entry page and referrer; a session's start
 * never moves.
 */
export function planVisits(sessions: PlanSession[]): { visits: Visit[]; survivors: Map<string, string> } {
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : 1));
  const groups: PlanSession[][] = [];
  let groupEnd = -Infinity;
  for (const session of sorted) {
    const current = groups[groups.length - 1];
    if (current && session.startedAt - groupEnd < SESSION_GAP_MS) {
      current.push(session);
      groupEnd = Math.max(groupEnd, session.endedAt);
    } else {
      groups.push([session]);
      groupEnd = session.endedAt;
    }
  }

  const visits: Visit[] = [];
  const survivors = new Map<string, string>();
  for (const group of groups) {
    const visit: Visit = {
      survivor: group[0]!.id,
      members: group.map((session) => session.id),
      startedAt: group[0]!.startedAt,
      endedAt: Math.max(...group.map((session) => session.endedAt)),
    };
    visits.push(visit);
    if (group.some((session) => session.source)) {
      for (const member of visit.members) survivors.set(member, visit.survivor);
    }
  }
  return { visits, survivors };
}

/**
 * The visit an event without a known session belongs to: one within the session duration of the
 * event, the closest first (the window of the previous merge, applied per event).
 */
export function visitForTime(visits: Visit[], at: number): Visit | undefined {
  let best: { visit: Visit; distance: number } | undefined;
  for (const visit of visits) {
    if (at < visit.startedAt - SESSION_GAP_MS || at > visit.endedAt + SESSION_GAP_MS) continue;
    const distance = at < visit.startedAt ? visit.startedAt - at : at > visit.endedAt ? at - visit.endedAt : 0;
    if (!best || distance < best.distance) best = { visit, distance };
  }
  return best?.visit;
}

// Follows decisions made by successive merges (a survivor can later be merged into an earlier session).
export function resolveSession(decisions: ReadonlyMap<string, string>, sessionId: string) {
  let current = sessionId;
  for (let step = 0; step < 100; step++) {
    const next = decisions.get(current);
    if (next === undefined || next === current) return current;
    current = next;
  }
  throw new Error(`Session merge decisions form a cycle at ${sessionId}`);
}
