import type { LabState } from "@/lib/network/types";
import type { Profile } from "@/lib/profile";

export type CheckKind = "ping-ok" | "ping-ko" | "http-ok" | "dhcp-ok";

/** Una verifica automatica di una consegna. */
export type AssignmentCheck = {
  kind: CheckKind;
  /** Nome del dispositivo da cui parte la prova (es. "PC0") */
  from: string;
  /** IP o nome di destinazione (ping/http); vuoto per dhcp-ok */
  target?: string;
  /** Testo libero mostrato all’allievo (facoltativo) */
  label?: string;
};

export type ClassRow = {
  id: string;
  name: string;
  join_code: string;
  created_by: string | null;
  created_at: string;
};

export type MemberRow = {
  class_id: string;
  user_id: string;
  member_role: "student" | "teacher";
  joined_at: string;
};

export type AssignmentRow = {
  id: string;
  class_id: string;
  title: string;
  description: string;
  checks: AssignmentCheck[];
  due_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type LabRow = {
  id: string;
  owner_id: string;
  name: string;
  data: LabState;
  assignment_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Lab senza i dati (per gli elenchi) */
export type LabMeta = Omit<LabRow, "data">;

export type SubmissionRow = {
  assignment_id: string;
  user_id: string;
  lab_id: string;
  submitted_at: string;
};

export type CheckResult = {
  check: AssignmentCheck;
  ok: boolean;
  detail: string;
  /** Categoria d’errore per le statistiche (solo se ok = false) */
  category?: string;
};

export type CheckReport = {
  results: CheckResult[];
  passed: number;
  total: number;
};

/** Dati che la pagina admin riceve dal server. */
export type AdminData = {
  me: { id: string; role: Profile["role"] };
  users: Profile[];
  classes: ClassRow[];
  members: MemberRow[];
  assignments: AssignmentRow[];
  submissions: SubmissionRow[];
  /** Esito delle verifiche, calcolato sul server: chiave `${assignmentId}:${userId}` */
  reports: Record<string, CheckReport>;
  /** Date di aggiornamento dei lab (per il grafico dell’attività) */
  labActivity: string[];
  /** Lab di ogni consegna: chiave `${assignmentId}:${userId}` → id del lab */
  submissionLabs: Record<string, string>;
  /** Quanti laboratori ha salvato ogni utente (owner_id → conteggio) */
  labCounts: Record<string, number>;
  hasServiceRole: boolean;
  /**
   * True se le tabelle classi/consegne non ci sono ancora: l’area utenti
   * resta disponibile, le altre schede mostrano il banner di migrazione.
   */
  missingSchema?: boolean;
};
