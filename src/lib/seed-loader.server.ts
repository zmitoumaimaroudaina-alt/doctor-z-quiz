import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface SeedSubject {
  id: number;
  slug: string;
  name: string;
  name_ar: string | null;
  emoji: string | null;
  sort: number;
}

export interface SeedCourse {
  id: string;
  subject_id: number;
  title: string;
  sort: number;
  source_file: string;
}

export interface SeedExam {
  id: string;
  title: string;
  unit: string | null;
  year: number;
  source_file: string;
  sort: number;
}

export interface SeedExamSubject {
  exam_id: string;
  subject_id: number;
}

export interface SeedQuestion {
  id: string;
  exam_id: string | null;
  course_id: string | null;
  subject_id: number | null;
  pos: number;
  case_text: string | null;
  stem: string;
  options: { key: string; text: string }[];
  source_file: string;
  source_page: number | null;
  source_year: string | null;
  needs_review: boolean;
  review_reason: string | null;
  created_at: string;
}

export interface SeedQuestionKey {
  question_id: string;
  correct: string[];
  explanation: string | null;
  note: string | null;
}

export interface SeedData {
  subjects: SeedSubject[];
  courses: SeedCourse[];
  exams: SeedExam[];
  exam_subjects: SeedExamSubject[];
  questions: SeedQuestion[];
  question_keys: SeedQuestionKey[];
}

const NS_BYTES = Buffer.from("5b1e7a526f0e4c1d9d8a2a7c0f6b9e11", "hex");

function uuidv5(name: string): string {
  const hash = createHash("sha1").update(NS_BYTES).update(name, "utf8").digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x50;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const SUBJECTS: SeedSubject[] = [
  { id: 1, slug: "biochimie", name: "Biochimie", name_ar: "الكيمياء الحيوية", emoji: "🧪", sort: 1 },
  {
    id: 2,
    slug: "physiopathologie",
    name: "Physiopathologie",
    name_ar: "الفيزيولوجيا المرضية",
    emoji: "🫀",
    sort: 2,
  },
  { id: 3, slug: "semiologie", name: "Sémiologie", name_ar: "علم الأعراض", emoji: "🩺", sort: 3 },
  {
    id: 4,
    slug: "psychologie",
    name: "Psychologie Médicale",
    name_ar: "علم النفس الطبي",
    emoji: "🧠",
    sort: 4,
  },
  { id: 5, slug: "radiologie", name: "Radiologie", name_ar: "الأشعة", emoji: "🩻", sort: 5 },
  { id: 6, slug: "physiologie", name: "Physiologie", name_ar: "الفيزيولوجيا", emoji: "⚡", sort: 6 },
  { id: 7, slug: "immunologie", name: "Immunologie", name_ar: "المناعة", emoji: "🛡️", sort: 7 },
  {
    id: 8,
    slug: "anapath",
    name: "Anatomopathologie (Anapath)",
    name_ar: "التشريح المرضي",
    emoji: "🔬",
    sort: 8,
  },
];

const EXAM_SUBJECT_SLUGS = [
  "biochimie",
  "physiopathologie",
  "semiologie",
  "psychologie",
  "radiologie",
  "physiologie",
];

interface RawQuestion {
  num: number;
  stem: string;
  options: { key: string; text: string }[];
  answer?: string[];
  page?: number | null;
  case?: string | null;
  explanation?: string | null;
  flags?: string[];
  year?: string | number | null;
  source_file: string;
}

interface RawCourse {
  subject: string;
  title: string;
  source_file?: string;
  flags?: string[];
  questions: RawQuestion[];
}

interface RawExam {
  title: string;
  unit: string;
  year: number;
  questions: RawQuestion[];
}

let cachedSeed: SeedData | null = null;

export async function loadSeedData(): Promise<SeedData> {
  if (cachedSeed) return cachedSeed;

  const subjectBySlug = new Map(SUBJECTS.map((s) => [s.slug, s.id]));
  const courses: SeedCourse[] = [];
  const exams: SeedExam[] = [];
  const exam_subjects: SeedExamSubject[] = [];
  const questions: SeedQuestion[] = [];
  const question_keys: SeedQuestionKey[] = [];
  const seenCourseIds = new Set<string>();
  const seenExamIds = new Set<string>();
  const seenQuestionIds = new Set<string>();
  const now = new Date().toISOString();

  try {
    const rawText = await readFile(join(process.cwd(), "data/parsed.json"), "utf8");
    const parsed = JSON.parse(rawText) as { courses?: RawCourse[]; exams?: RawExam[] };
    const sortBySubject = new Map<string, number>();

    for (const c of parsed.courses ?? []) {
      const subjectId = subjectBySlug.get(c.subject);
      if (!subjectId) continue;
      const sourceFile = c.source_file ?? c.questions[0]?.source_file ?? "source.pdf";
      const nextSort = (sortBySubject.get(c.subject) ?? 0) + 1;
      sortBySubject.set(c.subject, nextSort);
      const cid = uuidv5(`course|${sourceFile}|${c.subject}|${c.title}`);
      if (!seenCourseIds.has(cid)) {
        seenCourseIds.add(cid);
        courses.push({
          id: cid,
          subject_id: subjectId,
          title: c.title,
          sort: nextSort,
          source_file: sourceFile,
        });
      }
      c.questions.forEach((q, idx) => {
        const pos = idx + 1;
        const qid = uuidv5(`q|${cid}|${pos}|${q.num}`);
        if (seenQuestionIds.has(qid)) return;
        seenQuestionIds.add(qid);
        const flags = [...(q.flags ?? []), ...(c.flags ?? [])];
        questions.push({
          id: qid,
          exam_id: null,
          course_id: cid,
          subject_id: subjectId,
          pos,
          case_text: q.case ?? null,
          stem: q.stem,
          options: q.options ?? [],
          source_file: q.source_file ?? sourceFile,
          source_page: q.page ?? null,
          source_year: q.year != null ? String(q.year) : null,
          needs_review: flags.length > 0,
          review_reason: flags.length > 0 ? flags.join("; ") : null,
          created_at: now,
        });
        question_keys.push({
          question_id: qid,
          correct: q.answer ?? [],
          explanation: q.explanation ?? null,
          note: null,
        });
      });
    }

    (parsed.exams ?? []).forEach((e, idx) => {
      const eid = uuidv5(`exam|${e.title}|${e.year}`);
      if (!seenExamIds.has(eid)) {
        seenExamIds.add(eid);
        exams.push({
          id: eid,
          title: `Unité-0${e.unit} — ${e.year}`,
          unit: `Unité-0${e.unit}`,
          year: e.year,
          source_file: "CopyWall-Pdf_UEI_01.pdf",
          sort: idx + 1,
        });
        for (const slug of EXAM_SUBJECT_SLUGS) {
          const sid = subjectBySlug.get(slug);
          if (sid) exam_subjects.push({ exam_id: eid, subject_id: sid });
        }
      }
      e.questions.forEach((q, qIdx) => {
        const pos = qIdx + 1;
        const qid = uuidv5(`q|${eid}|${pos}|${q.num}`);
        if (seenQuestionIds.has(qid)) return;
        seenQuestionIds.add(qid);
        const flags = q.flags ?? [];
        questions.push({
          id: qid,
          exam_id: eid,
          course_id: null,
          subject_id: null,
          pos,
          case_text: q.case ?? null,
          stem: q.stem,
          options: q.options ?? [],
          source_file: q.source_file ?? "CopyWall-Pdf_UEI_01.pdf",
          source_page: q.page ?? null,
          source_year: q.year != null ? String(q.year) : null,
          needs_review: flags.length > 0,
          review_reason: flags.length > 0 ? flags.join("; ") : null,
          created_at: now,
        });
        question_keys.push({
          question_id: qid,
          correct: q.answer ?? [],
          explanation: q.explanation ?? null,
          note: null,
        });
      });
    });
  } catch (err) {
    console.warn("[SeedLoader] Could not read data/parsed.json:", err);
  }

  cachedSeed = { subjects: SUBJECTS, courses, exams, exam_subjects, questions, question_keys };
  return cachedSeed;
}
