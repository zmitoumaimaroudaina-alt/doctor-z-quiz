"""Deterministic parser: source transcripts -> structured JSON.
Never rewrites text. Flags anything ambiguous with needs_review + reason."""
import re, json, glob, os, sys

D = os.path.join(os.path.dirname(__file__), "transcripts")
SRC = {
    "immuno": "imunno.pdf",
    "c1": "tahsin_cardio_3eme_partie_1_compressed.pdf",
    "c2": "tahsin_cardio_3eme_partie_2_1.pdf",
    "copywall": "CopyWall-Pdf_UEI_01.pdf",
    "anapath": "Tahsin_série_Anapath.pdf.pdf",
}
ROMAN = r"(?:X{0,3})(?:IX|IV|V?I{0,3})"
LESSON_RE = re.compile(rf"^\s*({ROMAN}|\d+)\s*[>►➢➤‣▻➔▷)\}}\-]*\s+(.+)$")
SUBJECT_HEAD = {
    "sémiologie": "semiologie", "la physiopathologie": "physiopathologie", "biochimie": "biochimie",
    "radiologie": "radiologie", "psychologie médical": "psychologie", "immunologie": "immunologie",
}
Q_RE = re.compile(r"^\s*(\d{1,3})\s*([/.)\-])\s*(.*)$")
OPT_RE = re.compile(r"^\s*[-•]?\s*\(?([A-Ea-e])\s*[.):=\-]\s*(.*)$")
OPT_PAREN_RE = re.compile(r"^\s*([A-E])\s*(\([\d,+\s]+\).*)$")
ANS_RE = re.compile(r"^\s*R\s*[:.]?\s*[:.]?\s*([A-Ea-e][A-Ea-e\s,+\-–.et]*)\s*$")
YEAR_RE = re.compile(r"\((?:[^)]*?)(20\d\d)\)")


def lines_of(name):
    out = []
    for f in sorted(glob.glob(os.path.join(D, f"{name}-*.txt"))):
        page = int(re.search(r"-(\d+)\.txt$", f).group(1))
        for ln in open(f, encoding="utf-8").read().splitlines():
            if ln.strip():
                out.append((page, ln.rstrip()))
    return out


def split_combo(line):
    """'A : 1+2 B : 1+3' -> [('A','1+2'),('B','1+3')] when several letters on one line."""
    parts = re.findall(r"(?:^|\s)([A-E])\s*[:=]\s*([^A-E]+?)(?=\s+[A-E]\s*[:=]|$)", line.strip())
    if len(parts) >= 2:
        return [(k, v.strip()) for k, v in parts]
    parts = re.findall(r"(?:^|\s)([A-E])\s*(\([\d,+\s]+\))", line.strip())
    if len(parts) >= 2:
        return parts
    return None


def new_q(num, stem, page, case):
    return {"num": num, "stem": stem.strip(), "props": [], "options": [], "answer": None,
            "answer_raw": None, "page": page, "case": case, "explanation": None, "flags": []}


def parse_answer(raw):
    letters = sorted(set(c.upper() for c in re.findall(r"[A-Ea-e]", re.sub(r"\bet\b", "", raw))))
    return letters


def finish(q):
    if q is None:
        return None
    m = YEAR_RE.search(q["stem"])
    q["year"] = m.group(1) if m else None
    if q["props"]:
        q["stem"] = q["stem"] + "\n" + "\n".join(f"{n}. {t}" for n, t in q["props"])
    keys = [o["key"] for o in q["options"]]
    if len(q["options"]) < 2:
        q["flags"].append("options manquantes ou illisibles")
    if len(set(keys)) != len(keys):
        q["flags"].append("options en double")
    if not q["answer"]:
        q["flags"].append("réponse officielle absente")
    elif any(a not in keys for a in q["answer"]):
        q["flags"].append("réponse officielle hors options")
    if "[?]" in q["stem"] or any("[?]" in o["text"] for o in q["options"]):
        q["flags"].append("texte illisible dans la source")
    return q


def parse_stream(lines, mode):
    """mode: 'course' (Tahsin) or 'exam' (CopyWall). Returns list of groups."""
    groups, group, q, case = [], None, None, None
    last_heading_idx, idx, pending_comment = -10, 0, False
    grid_for = None
    for idx, (page, ln) in enumerate(lines):
        s = ln.strip()
        if s.startswith("## "):
            h = s[3:].strip()
            low = h.lower()
            if mode == "exam":
                m = re.search(r"(Unit[ée]-?\s*0?(\d))\b.*?(20\d\d)", h, re.I)
                if h.upper().startswith("CT") and m:
                    if q and group: group["questions"].append(finish(q)); q = None
                    grid_for = (m.group(2), m.group(3))
                    continue
                if low.startswith("examen") and m:
                    if q and group: group["questions"].append(finish(q)); q = None
                    grid_for = None
                    group = {"kind": "exam", "title": h.replace("Examen ", "", 1).strip(), "unit": m.group(2),
                             "year": int(m.group(3)), "questions": [], "grid": {}, "page": page}
                    groups.append(group); case = None
                continue
            # course mode
            if low.startswith("cas clinique") or low.startswith("cas clinique"):
                if q: group["questions"].append(finish(q)); q = None
                case = h; continue
            if low.startswith("commentaire"):
                pending_comment = True; continue
            if low in SUBJECT_HEAD:
                if q and group: group["questions"].append(finish(q)); q = None
                cur_subject = SUBJECT_HEAD[low]
                group = {"kind": "course", "subject": cur_subject, "title": None, "questions": [], "page": page, "flags": []}
                groups.append(group); case = None; last_heading_idx = idx
                if cur_subject == "psychologie":
                    group["title"] = h
                    group["flags"].append("aucun titre de cours dans la source: titre de section utilisé")
                continue
            if low == "les cas cliniques":
                if q and group: group["questions"].append(finish(q)); q = None
                group = {"kind": "course", "subject": "semiologie", "title": h, "questions": [], "page": page,
                         "flags": ["section 'LES CAS CLINIQUES' sans matière explicite: rangée en Sémiologie, à vérifier"]}
                groups.append(group); case = None; last_heading_idx = idx; continue
            m = LESSON_RE.match(h)
            title = m.group(2).strip() if m and m.group(1) else h
            if group and group["kind"] == "course" and last_heading_idx == idx - 1 and group["title"] and not group["questions"] and not q:
                group["title"] = (group["title"] + " " + h).strip()  # wrapped title continuation
                last_heading_idx = idx; continue
            if q and group: group["questions"].append(finish(q)); q = None
            subj = group["subject"] if group else None
            group = {"kind": "course", "subject": subj, "title": title, "questions": [], "page": page, "flags": []}
            groups.append(group); case = None; last_heading_idx = idx
            continue
        if group is None:
            continue
        # answer grid lines
        gm = re.match(r"^Q\s*(\d+)\s*=\s*(.*)$", s)
        if gm and mode == "exam":
            if grid_for:
                for g in groups:
                    if g["kind"] == "exam" and g["unit"] == grid_for[0] and g["year"] == int(grid_for[1]):
                        g["grid"][int(gm.group(1))] = gm.group(2).strip()
            continue
        if s.startswith("CAS:"):
            if q: group["questions"].append(finish(q)); q = None
            case = s[4:].strip(); pending_comment = False; continue
        am = ANS_RE.match(s)
        if am and q:
            q["answer_raw"] = s
            q["answer"] = parse_answer(am.group(1))
            pending_comment = False
            continue
        if pending_comment:
            target = q or (group["questions"][-1] if group["questions"] else None)
            if target:
                target["explanation"] = ((target["explanation"] or "") + "\n" + s).strip()
            continue
        combo = split_combo(s)
        if combo and q:
            for k, v in combo:
                q["options"].append({"key": k, "text": v})
            continue
        qm = Q_RE.match(s)
        if qm:
            n = int(qm.group(1))
            is_prop = q is not None and not q["options"] and q["answer"] is None and n == len(q["props"]) + 1 and not (mode == "exam" and n == q["num"] + 1 and qm.group(2) != "/" and len(q["props"]) == 0 and False)
            if is_prop:
                q["props"].append((n, qm.group(3).strip())); continue
            if q: group["questions"].append(finish(q))
            q = new_q(n, qm.group(3), page, case)
            continue
        om = OPT_RE.match(s) or OPT_PAREN_RE.match(s)
        if om and q and (q["answer"] is None or mode == "exam"):
            q["options"].append({"key": om.group(1).upper(), "text": om.group(2).strip()}); continue
        # continuation text
        if q:
            if q["options"]:
                q["options"][-1]["text"] += " " + s
            elif q["props"]:
                n, t = q["props"][-1]; q["props"][-1] = (n, t + " " + s)
            else:
                q["stem"] += " " + s
        elif case is not None:
            case += "\n" + s
    if q and group:
        group["questions"].append(finish(q))
    return groups


def main():
    out = {"courses": [], "exams": []}
    course_sources = [("c1+c2", lines_of("c1") + [(p + 1000, l) for p, l in lines_of("c2")]),
                      ("immuno", lines_of("immuno")), ("anapath", lines_of("anapath"))]
    for key, lines in course_sources:
        groups = parse_stream(lines, "course")
        for g in groups:
            if key == "anapath": g["subject"] = "anapath"
            if key == "immuno": g["subject"] = "immunologie"
            if not g["questions"]:
                continue  # table of contents / empty headings
            for qq in g["questions"]:
                p = qq["page"]
                qq["source_file"] = SRC["c2"] if p >= 1000 else (SRC["c1"] if key == "c1+c2" else SRC[key])
                qq["page"] = p - 1000 if p >= 1000 else p
            g["source_file"] = g["questions"][0]["source_file"]
            if not g["subject"]:
                g["flags"].append("matière introuvable"); g["subject"] = "physiopathologie"
            out["courses"].append(g)
    for g in parse_stream(lines_of("copywall"), "exam"):
        for qq in g["questions"]:
            qq["source_file"] = SRC["copywall"]
            raw = g["grid"].get(qq["num"])
            if raw is None:
                qq["flags"] = [f for f in qq["flags"] if f != "réponse officielle absente"] + ["réponse absente de la grille corrigé type"]
                qq["answer"] = []
            else:
                letters = sorted(set(c for c in raw.upper() if c in "ABCDE"))
                qq["answer_raw"] = raw; qq["answer"] = letters
                qq["flags"] = [f for f in qq["flags"] if f not in ("réponse officielle absente", "réponse officielle hors options")]
                keys = [o["key"] for o in qq["options"]]
                if not letters: qq["flags"].append("réponse illisible dans la grille")
                elif any(a not in keys for a in letters): qq["flags"].append("réponse officielle hors options")
        nums = [qq["num"] for qq in g["questions"]]
        if nums != list(range(1, len(nums) + 1)):
            g.setdefault("flags", []).append("numérotation non continue")
        del g["grid"]
        out["exams"].append(g)
    json.dump(out, open(os.path.join(os.path.dirname(__file__), "parsed.json"), "w"), ensure_ascii=False, indent=1)
    for c in out["courses"]:
        fl = sum(1 for q in c["questions"] if q["flags"])
        print(f"C {c['subject']:16} {len(c['questions']):4} flagged={fl:3} {c['title'][:60]}")
    for e in out["exams"]:
        fl = sum(1 for q in e["questions"] if q["flags"])
        print(f"E {e['title'][:60]:60} {len(e['questions'])} flagged={fl} {e.get('flags')}")


main()
