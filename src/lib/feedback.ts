/** Tipi e helper per la bacheca bug / idee. */

export type FeedbackKind = "bug" | "idea";
export type FeedbackStatus = "open" | "done" | "wontfix";

export type FeedbackItem = {
  id: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  author_name: string;
  contact?: string;
  status: FeedbackStatus;
  created_at: string;
};

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  bug: "Bug",
  idea: "Idea",
};

export const LOCAL_FEEDBACK_KEY = "netlab-feedback-local";

export function loadLocalFeedback(): FeedbackItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as FeedbackItem[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveLocalFeedback(items: FeedbackItem[]) {
  try {
    localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(items.slice(0, 80)));
  } catch {
    /* quota */
  }
}
