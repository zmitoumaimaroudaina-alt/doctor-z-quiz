"""parsed.json -> idempotent SQL. Deterministic IDs + ON CONFLICT DO NOTHING:
re-running never duplicates and never overwrites Creator edits."""
import json, uuid, os

NS = uuid.UUID("5b1e7a52-6f0e-4c1d-9d8a-2a7c0f6b9e11")
data = json.load(open(os.path.join(os.path.dirname(__file__), "parsed.json")))


def lit(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def arr(xs):
    return "array[" + ",".join(lit(x) for x in xs) + "]::text[]" if xs else "'{}'::text[]"


out = ["begin;"]
EXAM_SUBJECTS = ["biochimie", "physiopathologie", "semiologie", "psychologie", "radiologie", "physiologie"]


def q_rows(q, pos, exam_id, course_id, subj_sql, key):
    qid = str(uuid.uuid5(NS, key))
    opts = json.dumps(q["options"], ensure_ascii=False)
    flags = q.get("flags") or []
    out.append(
        "insert into questions(id,exam_id,course_id,subject_id,pos,case_text,stem,options,source_file,source_page,source_year,needs_review,review_reason) values ("
        f"{lit(qid)},{lit(exam_id)},{lit(course_id)},{subj_sql},{pos},{lit(q.get('case'))},{lit(q['stem'])},{lit(opts)}::jsonb,{lit(q['source_file'])},{q['page']},{lit(q.get('year'))},{'true' if flags else 'false'},{lit('; '.join(flags) or None)}) on conflict (id) do nothing;")
    out.append(f"insert into question_keys(question_id,correct,explanation,note) values ({lit(qid)},{arr(q.get('answer') or [])},{lit(q.get('explanation'))},null) on conflict (question_id) do nothing;")


sort = {}
for c in data["courses"]:
    subj = f"(select id from subjects where slug={lit(c['subject'])})"
    sort[c["subject"]] = sort.get(c["subject"], 0) + 1
    cid = str(uuid.uuid5(NS, f"course|{c['source_file']}|{c['subject']}|{c['title']}"))
    out.append(f"insert into courses(id,subject_id,title,sort,source_file) values ({lit(cid)},{subj},{lit(c['title'])},{sort[c['subject']]},{lit(c['source_file'])}) on conflict do nothing;")
    for i, q in enumerate(c["questions"], 1):
        if c.get("flags"):
            q["flags"] = (q.get("flags") or []) + c["flags"]
        q_rows(q, i, None, cid, subj, f"q|{cid}|{i}|{q['num']}")

for j, e in enumerate(data["exams"], 1):
    eid = str(uuid.uuid5(NS, f"exam|{e['title']}|{e['year']}"))
    out.append(f"insert into exams(id,title,unit,year,source_file,sort) values ({lit(eid)},{lit('Unité-0'+e['unit']+' — '+str(e['year']))},{lit('Unité-0'+e['unit'])},{e['year']},'CopyWall-Pdf_UEI_01.pdf',{j}) on conflict do nothing;")
    for s in EXAM_SUBJECTS:
        out.append(f"insert into exam_subjects values ({lit(eid)},(select id from subjects where slug={lit(s)})) on conflict do nothing;")
    for i, q in enumerate(e["questions"], 1):
        q_rows(q, i, eid, None, "null", f"q|{eid}|{i}|{q['num']}")
out.append("commit;")
open("/tmp/import.sql", "w").write("\n".join(out))
print(len(out))
