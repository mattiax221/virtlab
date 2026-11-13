import { isRecentlySeen } from "@/lib/profile";
import type { AdminData, AssignmentRow } from "./types";

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export type ClassProgress = {
  classId: string;
  name: string;
  students: number;
  /** Consegne × allievi */
  expected: number;
  submitted: number;
  /** Consegne con tutte le verifiche superate */
  completed: number;
};

export type AssignmentProgress = {
  assignment: AssignmentRow;
  students: number;
  submitted: number;
  completed: number;
  overdue: boolean;
};

export function studentsOf(data: AdminData, classId: string): string[] {
  return data.members
    .filter((m) => m.class_id === classId && m.member_role === "student")
    .map((m) => m.user_id);
}

export function assignmentProgress(data: AdminData, a: AssignmentRow, now = Date.now()): AssignmentProgress {
  const students = studentsOf(data, a.class_id);
  let submitted = 0;
  let completed = 0;
  for (const uid of students) {
    const rep = data.reports[`${a.id}:${uid}`];
    if (!data.submissions.some((s) => s.assignment_id === a.id && s.user_id === uid)) continue;
    submitted += 1;
    if (rep && rep.total > 0 && rep.passed === rep.total) completed += 1;
  }
  return {
    assignment: a,
    students: students.length,
    submitted,
    completed,
    overdue: Boolean(a.due_at && Date.parse(a.due_at) < now),
  };
}

export function classProgress(data: AdminData): ClassProgress[] {
  return data.classes.map((c) => {
    const students = studentsOf(data, c.id).length;
    const list = data.assignments.filter((a) => a.class_id === c.id);
    let submitted = 0;
    let completed = 0;
    for (const a of list) {
      const p = assignmentProgress(data, a);
      submitted += p.submitted;
      completed += p.completed;
    }
    return {
      classId: c.id,
      name: c.name,
      students,
      expected: students * list.length,
      submitted,
      completed,
    };
  });
}

/** Errori più frequenti nelle verifiche non superate. */
export function topErrors(data: AdminData, limit = 6): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const rep of Object.values(data.reports)) {
    for (const r of rep.results) {
      if (r.ok || !r.category) continue;
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Lab salvati per giorno negli ultimi `days` giorni (dal più vecchio). */
export function activityByDay(data: AdminData, days = 14, now = Date.now()) {
  const today = startOfDay(now);
  const buckets = Array.from({ length: days }, (_, i) => ({
    day: today - (days - 1 - i) * DAY,
    count: 0,
  }));
  for (const iso of data.labActivity) {
    const t = startOfDay(Date.parse(iso));
    const b = buckets.find((x) => x.day === t);
    if (b) b.count += 1;
  }
  return buckets;
}

export function kpis(data: AdminData, now = Date.now()) {
  const students = new Set(
    data.members.filter((m) => m.member_role === "student").map((m) => m.user_id),
  );
  const activeToday = data.users.filter(
    (u) => u.last_seen_at && Date.parse(u.last_seen_at) >= startOfDay(now),
  ).length;
  const active7 = data.users.filter(
    (u) => u.last_seen_at && Date.parse(u.last_seen_at) >= now - 7 * DAY,
  ).length;
  const online = data.users.filter((u) => !u.banned && isRecentlySeen(u.last_seen_at, now)).length;
  const open = data.assignments.filter((a) => !a.due_at || Date.parse(a.due_at) >= now).length;
  let expected = 0;
  let completed = 0;
  for (const c of classProgress(data)) {
    expected += c.expected;
    completed += c.completed;
  }
  return {
    users: data.users.length,
    students: students.size,
    online,
    activeToday,
    active7,
    classes: data.classes.length,
    openAssignments: open,
    completion: expected > 0 ? Math.round((completed / expected) * 100) : null,
  };
}
