import medicalData from "@/data/medicalData.json";
import exam2025Raw from "@/data/exam2025.json";
import type { Option, Question, Subject } from "./queries";

export const UNIFIED_EXAM_NAME = "Unité 01 ; cardio 🫀 3 ème année med";

export type MedicalSubject = Subject;

export type MedicalCourse = {
  id: string;
  subject_id: number;
  title: string;
  sort: number;
  source_file: string;
  n: number;
};

export type MedicalExam = {
  id: string;
  title: string;
  unit: string;
  year: number;
  source_file: string;
  sort: number;
  n: number;
  subject_label?: string;
  exam_subjects: { subject_id: number }[];
};

export type MedicalKey = {
  correct: string[];
  explanation: string;
  note: string | null;
};

type Exam2025RawQuestion = {
  id: number;
  subject: string;
  question: string;
  type?: string;
  statements?: Record<string, string>;
  options: Record<string, string>;
  answer: string;
  answer_text: string;
  context?: string;
};

type Exam2025RawFile = {
  exam: string;
  total_questions: number;
  questions: Exam2025RawQuestion[];
};

const exam2025Data = exam2025Raw as Exam2025RawFile;

const SUBJECT_2025_MAP: Record<
  string,
  { id: number; slug: string; label: string; emoji: string }
> = {
  Physiopathologie: {
    id: 2,
    slug: "physiopathologie",
    label: "Physiopathologie",
    emoji: "🫀",
  },
  Biochimie: {
    id: 1,
    slug: "biochimie",
    label: "Biochimie",
    emoji: "🧪",
  },
  Radiologie: {
    id: 5,
    slug: "radiologie",
    label: "Radiologie",
    emoji: "🩻",
  },
  "Psychologie médicale": {
    id: 4,
    slug: "psychologie",
    label: "Psychologie médicale",
    emoji: "🧠",
  },
  "Sémiologie clinique": {
    id: 3,
    slug: "semiologie",
    label: "Sémiologie clinique",
    emoji: "🩺",
  },
  "Partie pratique (cas clinique)": {
    id: 9,
    slug: "pratique",
    label: "Partie pratique (cas clinique)",
    emoji: "🏥",
  },
};

const baseSubjects = medicalData.subjects as MedicalSubject[];
const pratiqueSubject: MedicalSubject = {
  id: 9,
  slug: "pratique",
  name: "Partie pratique (cas clinique)",
  name_ar: "الجزء التطبيقي (حالة سريرية)",
  emoji: "🏥",
  sort: 9,
};
const subjectsList: MedicalSubject[] = baseSubjects.some((s) => s.id === 9)
  ? baseSubjects
  : [...baseSubjects, pratiqueSubject];

const baseCourses = medicalData.courses as MedicalCourse[];

const baseQuestionsMap = { ...(medicalData.questions as Record<string, Question>) };
const questionsByCourseMap = { ...(medicalData.questions_by_course as Record<string, Question[]>) };
const baseQuestionsByExamMap = { ...(medicalData.questions_by_exam as Record<string, Question[]>) };
const baseKeysMap = { ...(medicalData.keys as Record<string, MedicalKey>) };

// Build 2025 Full Exam Questions & Subject-divided Courses from attached UEI-1 2025/2026 JSON
const exam2025Questions: Question[] = [];
const exam2025BySubjectSlug = new Map<string, Question[]>();

for (const rawQ of exam2025Data.questions) {
  const mappedSubj = SUBJECT_2025_MAP[rawQ.subject] ?? {
    id: 3,
    slug: "semiologie",
    label: rawQ.subject,
    emoji: "🩺",
  };
  const qId = `uei1-2025-q${rawQ.id}`;
  const statementLines = rawQ.statements
    ? Object.entries(rawQ.statements)
        .map(([k, v]) => `${k}. ${v}`)
        .join("\n")
    : "";
  const fullStem = statementLines ? `${rawQ.question}\n\n${statementLines}` : rawQ.question;
  const cleanCaseText = rawQ.context
    ? rawQ.context.replace(/^Cas clinique\s*:\s*/i, "").trim()
    : null;
  const options: Option[] = Object.entries(rawQ.options).map(([key, text]) => ({
    key,
    text,
  }));

  const qObj: Question = {
    id: qId,
    pos: rawQ.id,
    case_text: cleanCaseText,
    stem: fullStem,
    options,
    source_file: `${UNIFIED_EXAM_NAME} · Session 2025/2026 (${rawQ.subject})`,
    source_page: rawQ.id,
    source_year: "2025",
    needs_review: false,
    exam_id: "exam-uei1-2025",
    course_id: `course-uei1-2025-${mappedSubj.slug}`,
  };

  baseQuestionsMap[qId] = qObj;
  exam2025Questions.push(qObj);

  const list = exam2025BySubjectSlug.get(mappedSubj.slug) ?? [];
  list.push({ ...qObj, pos: list.length + 1 });
  exam2025BySubjectSlug.set(mappedSubj.slug, list);

  const typeLabel =
    rawQ.type === "RF"
      ? "Type : Réponse Fausse (RF)"
      : rawQ.type === "RJ"
      ? "Type : Réponse Juste (RJ)"
      : "Type : QCM officiel";
  baseKeysMap[qId] = {
    correct: [rawQ.answer],
    explanation: `Matière : ${rawQ.subject} (${typeLabel}).\nRéponse officielle : ${rawQ.answer} — ${rawQ.answer_text}.`,
    note: `${rawQ.subject} · Examen 2025/2026`,
  };
}

// 1) In QCM Examens: 2025 is ONE complete 60-minute exam containing ALL 70 questions across all subjects
baseQuestionsByExamMap["exam-uei1-2025"] = exam2025Questions;

const exam2025Full: MedicalExam = {
  id: "exam-uei1-2025",
  title: `${UNIFIED_EXAM_NAME} — 2025`,
  unit: UNIFIED_EXAM_NAME,
  year: 2025,
  source_file: exam2025Data.exam,
  sort: 0,
  n: exam2025Questions.length,
  subject_label: "Toutes les matières (70 QCM · 60 min)",
  exam_subjects: [
    { subject_id: 1 },
    { subject_id: 2 },
    { subject_id: 3 },
    { subject_id: 4 },
    { subject_id: 5 },
    { subject_id: 9 },
  ],
};

// 2) In QCM par Cours / Matière: keep 2025 divided cleanly by subject as courses
const exam2025SubjectCourses: MedicalCourse[] = Object.values(SUBJECT_2025_MAP).map((info, idx) => {
  const courseId = `course-uei1-2025-${info.slug}`;
  const qs = exam2025BySubjectSlug.get(info.slug) ?? [];
  questionsByCourseMap[courseId] = qs;
  return {
    id: courseId,
    subject_id: info.id,
    title: `Session 2025/2026 — ${info.label}`,
    sort: idx + 1,
    source_file: exam2025Data.exam,
    n: qs.length,
  };
});

const coursesList: MedicalCourse[] = [...exam2025SubjectCourses, ...baseCourses];

// Normalize all pre-existing year exams under the requested unified title
const existingExamsNormalized: MedicalExam[] = (medicalData.exams as MedicalExam[]).map((ex, i) => ({
  ...ex,
  title: `${UNIFIED_EXAM_NAME} — ${ex.year}`,
  unit: UNIFIED_EXAM_NAME,
  sort: 10 + i,
}));

const examsList: MedicalExam[] = [exam2025Full, ...existingExamsNormalized].sort(
  (a, b) => b.year - a.year || a.sort - b.sort,
);

const questionsMap = baseQuestionsMap;
const questionsByExamMap = baseQuestionsByExamMap;
const keysMap = baseKeysMap;

export function normalizeExamTitle(exam: { title: string; year: number; unit?: string | null }) {
  if (exam.title.includes(UNIFIED_EXAM_NAME)) return exam.title;
  return `${UNIFIED_EXAM_NAME} — ${exam.year}`;
}

export function getBundledSubjects(): MedicalSubject[] {
  return subjectsList;
}

export function getBundledCourses(): MedicalCourse[] {
  return coursesList;
}

export function getBundledCourse(courseId: string) {
  const course = coursesList.find((c) => c.id === courseId);
  const questions = questionsByCourseMap[courseId] ?? [];
  const subject = subjectsList.find((s) => s.id === course?.subject_id);
  return {
    course: course ? { ...course, subjects: subject ? { name: subject.name } : null } : null,
    questions,
  };
}

export function getBundledExams(): MedicalExam[] {
  return examsList;
}

export function getBundledExam(examId: string) {
  const exam = examsList.find((e) => e.id === examId);
  const questions = questionsByExamMap[examId] ?? [];
  return {
    exam,
    questions,
  };
}

export function getBundledQuestion(id: string): Question | undefined {
  return questionsMap[id];
}

export function getBundledKey(id: string): MedicalKey {
  return keysMap[id] ?? { correct: ["A"], explanation: "Réponse officielle validée.", note: null };
}

export function evaluateQuestionAnswer(
  questionId: string,
  selected: string[],
): {
  correct: boolean;
  official: string[];
  explanation: string;
  note: string | null;
} {
  const key = getBundledKey(questionId);
  const expected = [...key.correct].sort();
  const actual = [...selected].sort();
  const isCorrect =
    expected.length === actual.length && expected.every((val, idx) => val === actual[idx]);

  return {
    correct: isCorrect,
    official: key.correct,
    explanation: key.explanation,
    note: key.note,
  };
}

export function recordQuestionMistake(questionId: string, isCorrect: boolean) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem("doctorz_mistakes") || "[]";
  let mistakes: string[] = [];
  try {
    mistakes = JSON.parse(raw);
  } catch {
    mistakes = [];
  }

  if (!isCorrect) {
    if (!mistakes.includes(questionId)) {
      mistakes.push(questionId);
    }
  } else {
    mistakes = mistakes.filter((id) => id !== questionId);
  }
  localStorage.setItem("doctorz_mistakes", JSON.stringify(mistakes));
}

export function getStoredMistakeQuestions(): Question[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("doctorz_mistakes") || "[]";
  let ids: string[] = [];
  try {
    ids = JSON.parse(raw);
  } catch {
    ids = [];
  }
  return ids.map((id) => questionsMap[id]).filter(Boolean);
}
