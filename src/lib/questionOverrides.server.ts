import { promises as fs } from "node:fs";
import path from "node:path";
import type { KeyOverride, OverridesStore, QuestionOverride } from "./questionOverrides";

const DATA_DIR = path.join(process.cwd(), ".data");
const OVERRIDES_FILE = path.join(DATA_DIR, "question-overrides.json");

let memoryOverrides: OverridesStore | null = null;

export async function readServerOverrides(): Promise<OverridesStore> {
  if (memoryOverrides) return memoryOverrides;
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<OverridesStore>;
    memoryOverrides = {
      questions: parsed.questions ?? {},
      keys: parsed.keys ?? {},
    };
    return memoryOverrides;
  } catch {
    memoryOverrides = { questions: {}, keys: {} };
    return memoryOverrides;
  }
}

async function writeServerOverrides(store: OverridesStore): Promise<void> {
  memoryOverrides = store;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(OVERRIDES_FILE, JSON.stringify(store), "utf8");
  } catch {
    // ignore read-only FS errors
  }
}

export async function upsertServerOverride(
  questionId: string,
  questionPatch: QuestionOverride,
  keyPatch: KeyOverride,
): Promise<OverridesStore> {
  const store = await readServerOverrides();
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
  await writeServerOverrides(store);
  return store;
}

export async function deleteServerOverride(questionId: string): Promise<OverridesStore> {
  const store = await readServerOverrides();
  delete store.questions[questionId];
  delete store.keys[questionId];
  await writeServerOverrides(store);
  return store;
}
