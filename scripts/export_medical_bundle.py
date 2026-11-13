import json
import uuid
import os

NS = uuid.UUID("5b1e7a52-6f0e-4c1d-9d8a-2a7c0f6b9e11")

with open("data/parsed.json", "r", encoding="utf-8") as f:
    raw = json.load(f)

SUBJECTS = [
    {"id": 1, "slug": "biochimie", "name": "Biochimie", "name_ar": "الكيمياء الحيوية", "emoji": "🧪", "sort": 1},
    {"id": 2, "slug": "physiopathologie", "name": "Physiopathologie", "name_ar": "الفيزيولوجيا المرضية", "emoji": "🫀", "sort": 2},
    {"id": 3, "slug": "semiologie", "name": "Sémiologie", "name_ar": "علم الأعراض", "emoji": "🩺", "sort": 3},
    {"id": 4, "slug": "psychologie", "name": "Psychologie Médicale", "name_ar": "علم النفس الطبي", "emoji": "🧠", "sort": 4},
    {"id": 5, "slug": "radiologie", "name": "Radiologie", "name_ar": "الأشعة", "emoji": "🩻", "sort": 5},
    {"id": 6, "slug": "physiologie", "name": "Physiologie", "name_ar": "الفيزيولوجيا", "emoji": "⚡", "sort": 6},
    {"id": 7, "slug": "immunologie", "name": "Immunologie", "name_ar": "المناعة", "emoji": "🛡️", "sort": 7},
    {"id": 8, "slug": "anapath", "name": "Anatomopathologie (Anapath)", "name_ar": "التشريح المرضي", "emoji": "🔬", "sort": 8},
]

subj_slug_to_id = {s["slug"]: s["id"] for s in SUBJECTS}

courses_out = []
questions_by_id = {}
questions_by_course = {}
questions_by_exam = {}
keys_by_id = {}

sort_counter = {}
for c in raw.get("courses", []):
    s_slug = c.get("subject", "semiologie")
    s_id = subj_slug_to_id.get(s_slug, 3)
    sort_counter[s_slug] = sort_counter.get(s_slug, 0) + 1
    src_file = c.get("source_file", "")
    title = c.get("title", "")
    cid = str(uuid.uuid5(NS, f"course|{src_file}|{s_slug}|{title}"))
    q_list = []
    for i, q in enumerate(c.get("questions", []), 1):
        num = q.get("num", i)
        qid = str(uuid.uuid5(NS, f"q|{cid}|{i}|{num}"))
        opts = q.get("options", [])
        q_obj = {
            "id": qid,
            "pos": i,
            "case_text": q.get("case"),
            "stem": q.get("stem", "Question"),
            "options": opts,
            "source_file": q.get("source_file", src_file),
            "source_page": q.get("page", 1),
            "source_year": q.get("year"),
            "needs_review": bool(q.get("flags")),
            "exam_id": None,
            "course_id": cid,
            "subject_id": s_id
        }
        q_list.append(q_obj)
        questions_by_id[qid] = q_obj
        keys_by_id[qid] = {
            "correct": q.get("answer") or ["A"],
            "explanation": q.get("explanation") or "",
            "note": None
        }
    questions_by_course[cid] = q_list
    courses_out.append({
        "id": cid,
        "subject_id": s_id,
        "title": title,
        "sort": sort_counter[s_slug],
        "source_file": src_file,
        "n": len(q_list)
    })

exams_out = []
for j, e in enumerate(raw.get("exams", []), 1):
    e_title = e.get("title", "")
    e_year = e.get("year", 2024)
    eid = str(uuid.uuid5(NS, f"exam|{e_title}|{e_year}"))
    q_list = []
    for i, q in enumerate(e.get("questions", []), 1):
        num = q.get("num", i)
        qid = str(uuid.uuid5(NS, f"q|{eid}|{i}|{num}"))
        opts = q.get("options", [])
        q_obj = {
            "id": qid,
            "pos": i,
            "case_text": q.get("case"),
            "stem": q.get("stem", "Question"),
            "options": opts,
            "source_file": q.get("source_file", "CopyWall-Pdf_UEI_01.pdf"),
            "source_page": q.get("page", 1),
            "source_year": str(e_year),
            "needs_review": bool(q.get("flags")),
            "exam_id": eid,
            "course_id": None,
            "subject_id": 1
        }
        q_list.append(q_obj)
        questions_by_id[qid] = q_obj
        keys_by_id[qid] = {
            "correct": q.get("answer") or ["A"],
            "explanation": q.get("explanation") or "",
            "note": None
        }
    questions_by_exam[eid] = q_list
    unit_str = f"Unité-0{e.get('unit', 1)}"
    exams_out.append({
        "id": eid,
        "title": f"{unit_str} — {e_year}",
        "unit": unit_str,
        "year": e_year,
        "source_file": "CopyWall-Pdf_UEI_01.pdf",
        "sort": j,
        "n": len(q_list),
        "exam_subjects": [{"subject_id": sid} for sid in [1, 2, 3, 4, 5, 6, 7, 8]]
    })

os.makedirs("src/data", exist_ok=True)
payload = {
    "subjects": SUBJECTS,
    "courses": courses_out,
    "exams": exams_out,
    "questions": questions_by_id,
    "questions_by_course": questions_by_course,
    "questions_by_exam": questions_by_exam,
    "keys": keys_by_id
}

with open("src/data/medicalData.json", "w", encoding="utf-8") as out_f:
    json.dump(payload, out_f, ensure_ascii=False, indent=2)

print("Export completed successfully:")
print("Subjects:", len(SUBJECTS))
print("Courses:", len(courses_out))
print("Exams:", len(exams_out))
print("Indexed questions:", len(questions_by_id))
print("Indexed keys:", len(keys_by_id))
