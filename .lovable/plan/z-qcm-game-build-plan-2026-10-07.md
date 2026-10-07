# Z QCM GAME — Build Plan

## What I found in your files
| File | Type | Content |
|---|---|---|
| CopyWall-Pdf_UEI_01.pdf | QCM Examens | Real exams: Unité-01 2021, 2022, 2023 + Unité-03 2024 (answer grids at end of each exam). Mixed subjects inside each exam (Sémio, Physio, Biochimie, Radio, Psycho...) |
| tahsin_cardio partie 1 | QCM par Cours | Sémiologie (by lesson) then Physiopathologie |
| tahsin_cardio partie 2 | QCM par Cours | Physiopathologie (cont.), Biochimie, Radiologie, Psychologie médicale, + "Les cas cliniques" |
| imunno.pdf | QCM par Cours | Immunologie, 14 lessons (table of contents present) |
| Tahsin_série_Anapath.pdf | QCM par Cours | Anatomopathologie, ~21 lessons |

All PDFs are scanned images, so text comes from OCR.

## Issues I will flag, not guess
- **Avatar assets: none were uploaded.** Only PDFs arrived. The Avatar Creator needs your real asset files (body, heads, hair, hijab, outfits, etc.).
- **Physiologie**: no dedicated file found. Physiology questions exist only inside CopyWall exams.
- **Exam subject mapping**: CopyWall exams are per Unité, not per subject. I will file each exam under its Unité ("Unité-01 2022") and tag it to the subjects it covers, unless you prefer something else.
- **Anapath file has 61 pages.** My reader stops at 50, so pages 51–61 need a second pass (I will split the file).
- OCR errors and questions with unclear answers go to a **Creator review queue**. They are never auto-corrected.

## Phases
1. **Foundation**: Lovable Cloud, sign-up/login, display name, Creator role for doctorzmit@gmail.com (checked on the server), 8 subjects, design system (light blue/white, FR + AR).
2. **Import**: parse all 5 files into Subject → Course/Exam → Question → Options → Official answer, with source file + page traceability. Lesson titles become courses automatically, in file order. Review queue for unclear items.
3. **Play**: exam page (30-min timer, skip, go back, auto-submit). Hearts (2 per exam, 24h lock) enforced on the server. Results screen. Mes Erreurs. Wrong-answer memory with badges and "QCM أخطائي السابقة".
4. **Social**: real-time leaderboard per exam (best score, then fastest time), speech bubbles, tomatoes for Top 5 (cooldown, 24h splat, sounds).
5. **Progression**: XP, levels, coins, daily/weekly missions, streaks, pet unlocks. None of it touches academic score or rank.
6. **AI**: "Expliquer avec l'IA" with follow-up chat. The official answer is locked into the prompt and can never be overridden.
7. **Avatar**: creator with layered assets and live mood. **Blocked until you upload the asset files.**
8. **Creator panel**: edit questions, answers, notes, students, hearts, and review queue. Account deletion that removes the student from everything.
9. Sound effects (no music) with an ON/OFF toggle, resource links, settings.

## Technical notes
- Scoring, hearts, attempts, tomatoes and XP all run through server functions and database rules. The browser never gets the answer key before submitting.
- Supabase Realtime powers the leaderboard.
- Account deletion is a server-side admin action that cascades through all student tables.

Phases 1–3 come first, then the rest in order.
