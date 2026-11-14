import { getClientAuthToken } from "./authToken";
import type { Option } from "./queries";

export interface QuestionOverride {
  stem?: string;
  case_text?: string | null;
  options?: Option[];
  needs_review?: boolean;
  review_reason?: string | null;
  updated_at?: string;
}

export interface KeyOverride {
  correct?: string[];
  explanation?: string | null;
  note?: string | null;
  updated_at?: string;
}

export interface OverridesStore {
  questions: Record<string, QuestionOverride>;
  keys: Record<string, KeyOverride>;
}

const STORAGE_KEY = "doctorz_question_overrides_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getOverridesStore(): OverridesStore {
  if (!isBrowser()) return { questions: {}, keys: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { questions: {}, keys: {} };
    const parsed = JSON.parse(raw) as Partial<OverridesStore>;
    return {
      questions: parsed.questions ?? {},
      keys: parsed.keys ?? {},
    };
  } catch {
    return { questions: {}, keys: {} };
  }
}

function saveOverridesStore(store: OverridesStore): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota errors
  }
}

export function getQuestionOverride(questionId: string): QuestionOverride | undefined {
  return getOverridesStore().questions[questionId];
}

export function getKeyOverride(questionId: string): KeyOverride | undefined {
  return getOverridesStore().keys[questionId];
}

export function saveManualQuestionCorrection(
  questionId: string,
  questionPatch: QuestionOverride,
  keyPatch: KeyOverride,
): void {
  const store = getOverridesStore();
  const now = new Date().toISOString();
  store.questions[questionId] = {
    ...(store.questions[questionId] ?? {}),
    ...questionPatch,
    updated_at: now,
  };
  store.keys[questionId] = {
    ...(store.keys[questionId] ?? {}),
    ...keyPatch,
    updated_at: now,
  };
  saveOverridesStore(store);
}

export function clearManualQuestionCorrection(questionId: string): void {
  const store = getOverridesStore();
  delete store.questions[questionId];
  delete store.keys[questionId];
  saveOverridesStore(store);
}

let syncStarted = false;

export async function syncOverridesFromServer(force = false): Promise<OverridesStore> {
  if (!isBrowser()) return { questions: {}, keys: {} };
  if (syncStarted && !force) return getOverridesStore();
  syncStarted = true;
  try {
    const res = await fetch("/api/question-overrides", { cache: "no-store" });
    if (!res.ok) return getOverridesStore();
    const remote = (await res.json()) as Partial<OverridesStore>;
    const local = getOverridesStore();
    const merged: OverridesStore = {
      questions: { ...local.questions },
      keys: { ...local.keys },
    };

    for (const [qid, rq] of Object.entries(remote.questions ?? {})) {
      const lq = merged.questions[qid];
      if (!lq || (rq.updated_at && (!lq.updated_at || rq.updated_at > lq.updated_at))) {
        merged.questions[qid] = rq;
      }
    }
    for (const [qid, rk] of Object.entries(remote.keys ?? {})) {
      const lk = merged.keys[qid];
      if (!lk || (rk.updated_at && (!lk.updated_at || rk.updated_at > lk.updated_at))) {
        merged.keys[qid] = rk;
      }
    }
    saveOverridesStore(merged);
    return merged;
  } catch {
    return getOverridesStore();
  }
}

export async function syncSaveCorrectionToServer(
  questionId: string,
  questionPatch: QuestionOverride,
  keyPatch: KeyOverride,
): Promise<boolean> {
  try {
    const token = await getClientAuthToken();
    if (!token) return false;
    const res = await fetch("/api/question-overrides", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        questionId,
        question: questionPatch,
        key: keyPatch,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncDeleteCorrectionToServer(questionId: string): Promise<boolean> {
  try {
    const token = await getClientAuthToken();
    if (!token) return false;
    const res = await fetch(
      `/api/question-overrides?questionId=${encodeURIComponent(questionId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
