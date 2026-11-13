import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PROFILE_COLUMNS, type Profile } from "@/lib/profile";
import { hasServiceRole } from "@/lib/supabase/admin";
import type { LabState } from "@/lib/network/types";
import { parseChecks, runChecks } from "./checks";
import type {
  AdminData,
  AssignmentRow,
  CheckReport,
  ClassRow,
  MemberRow,
  SubmissionRow,
} from "./types";

const ACTIVITY_DAYS = 14;

/**
 * Carica tutto ciò che serve alla pagina admin. Le regole di accesso del
 * database limitano già i dati: l’admin vede tutto, il docente le sue classi.
 * Le verifiche delle consegne si ricalcolano qui, sul lab consegnato, così
 * l’esito non dipende da ciò che il browser dell’allievo dichiara.
 */
export async function loadAdminData(
  supabase: SupabaseClient,
  me: { id: string; role: Profile["role"] },
): Promise<{ data?: AdminData; error?: string; missingSchema?: boolean }> {
  const since = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [users, classes, members, assignments, submissions, activity] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).order("created_at", { ascending: true }),
    supabase.from("classes").select("id,name,join_code,created_by,created_at").order("name"),
    supabase.from("class_members").select("class_id,user_id,member_role,joined_at"),
    supabase
      .from("assignments")
      .select("id,class_id,title,description,checks,due_at,created_by,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("submissions").select("assignment_id,user_id,lab_id,submitted_at"),
    supabase.from("labs").select("updated_at").gte("updated_at", since).limit(5000),
  ]);

  if (users.error) return { error: "Elenco utenti non disponibile." };
  const schemaError = [classes, members, assignments, submissions, activity].find((r) => r.error);
  if (schemaError) {
    // Tabelle mancanti: la seconda migrazione non è stata applicata
    return { missingSchema: true, error: schemaError.error?.message };
  }

  const assignmentRows: AssignmentRow[] = (assignments.data ?? []).map((a) => ({
    ...(a as AssignmentRow),
    checks: parseChecks((a as { checks: unknown }).checks),
  }));
  const subs = (submissions.data ?? []) as SubmissionRow[];

  // Lab consegnati → verifiche
  const reports: Record<string, CheckReport> = {};
  const submissionLabs: Record<string, string> = {};
  const labIds = [...new Set(subs.map((s) => s.lab_id))];
  const labData = new Map<string, LabState>();
  for (let i = 0; i < labIds.length; i += 100) {
    const chunk = labIds.slice(i, i + 100);
    const { data } = await supabase.from("labs").select("id,data").in("id", chunk);
    for (const row of data ?? []) labData.set(row.id as string, row.data as LabState);
  }
  for (const s of subs) {
    const key = `${s.assignment_id}:${s.user_id}`;
    submissionLabs[key] = s.lab_id;
    const a = assignmentRows.find((x) => x.id === s.assignment_id);
    const lab = labData.get(s.lab_id);
    if (!a || !lab || !Array.isArray(lab.devices)) continue;
    try {
      reports[key] = runChecks(lab, a.checks);
    } catch {
      reports[key] = {
        results: [],
        passed: 0,
        total: a.checks.length,
      };
    }
  }

  return {
    data: {
      me,
      users: (users.data ?? []) as Profile[],
      classes: (classes.data ?? []) as ClassRow[],
      members: (members.data ?? []) as MemberRow[],
      assignments: assignmentRows,
      submissions: subs,
      reports,
      submissionLabs,
      labActivity: (activity.data ?? []).map((r) => r.updated_at as string),
      hasServiceRole: hasServiceRole(),
    },
  };
}
