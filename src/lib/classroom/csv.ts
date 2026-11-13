import { studentsOf } from "./stats";
import type { AdminData } from "./types";

/**
 * Esporta una classe in CSV pronto per Excel in italiano:
 * separatore ";", BOM UTF-8 per gli accenti, una colonna per consegna.
 */
export function classCsv(data: AdminData, classId: string): string {
  const cls = data.classes.find((c) => c.id === classId);
  const assignments = data.assignments
    .filter((a) => a.class_id === classId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const header = ["Nome", "Email", "Ultimo accesso", ...assignments.map((a) => a.title)];
  const rows: string[][] = [];
  for (const uid of studentsOf(data, classId)) {
    const u = data.users.find((x) => x.id === uid);
    const cells = [
      u?.display_name ?? "",
      u?.email ?? "",
      u?.last_seen_at ? new Date(u.last_seen_at).toLocaleString("it-IT") : "mai",
    ];
    for (const a of assignments) {
      const sub = data.submissions.find((s) => s.assignment_id === a.id && s.user_id === uid);
      const rep = data.reports[`${a.id}:${uid}`];
      if (!sub) cells.push("non consegnato");
      else if (!rep || rep.total === 0) cells.push("consegnato");
      else cells.push(`${rep.passed}/${rep.total}${rep.passed === rep.total ? " completato" : ""}`);
    }
    rows.push(cells);
  }
  rows.sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? ""));
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [header, ...rows].map((r) => r.map(esc).join(";"));
  return `\uFEFF${cls ? `Classe;${esc(cls.name)}\n` : ""}${lines.join("\n")}\n`;
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
