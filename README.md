# Doctor Z Quiz

BUILD A COMPLETE WEB APP CALLED “Z QCM GAME”

For:

Université Saad Dahleb - Blida 1 | Faculté de Médecine



Create a premium, modern, responsive medical QCM game using Supabase for real authentication, database, persistence, security and leaderboard.



IMPORTANT:

The files/assets/questions I provide are the SOURCE OF TRUTH.

Never invent, rewrite, duplicate, reorder or guess source questions, options, official answers, explanations, notes or course names.

Course and question organization must follow the files I provide exactly.



━━━━━━━━━━━━━━━━━━

1. SUBJECTS

━━━━━━━━━━━━━━━━━━



Exactly 8 subjects:

1. Biochimie

2. Physiopathologie

3. Sémiologie

4. Psychologie Médicale

5. Radiologie

6. Physiologie

7. Immunologie

8. Anatomopathologie (Anapath)



━━━━━━━━━━━━━━━━━━

2. TWO QCM MODES

━━━━━━━━━━━━━━━━━━



📝 QCM EXAMENS

Matière → Année → Examen



Only real imported exams.

Show only years/exams that actually exist in the provided files.

Keep every exam independent.

Preserve exact questions, options and official answers.



📚 QCM PAR COURS

Matière → Cours → QCM



Courses and their order must follow the provided files.

Each QCM remains linked to its exact course.

Never mix course QCM with official exams.



━━━━━━━━━━━━━━━━━━

3. AUTHENTICATION + PROFILE

━━━━━━━━━━━━━━━━━━



Student:

Register/Login → choose display name → mandatory Avatar Creator.



Store user data securely in Supabase.



Avatar:

modern high-quality 2D cartoon, youthful and stylish, not childish and not realistic.



Customization:

gender, skin tone, eyes, nose, mouth/expression, hairstyles, hijab, jellaba/outfits, beard, moustache, glasses, accessories and pets.



IMPORTANT:

Use the actual avatar asset files I provide.

Organize assets according to their real files/categories.

Clothes, hair, hijab and accessories must be correctly aligned with the same avatar body/head.

They must look like ONE professionally designed character, NOT separate stickers layered incorrectly.

Respect correct front/back layer order, scale, proportions and anchor points.



━━━━━━━━━━━━━━━━━━

4. EXAM EXPERIENCE

━━━━━━━━━━━━━━━━━━



Each exam:

- 30-minute timer

- scrollable page

- answer questions in any order

- skip questions

- return to previous questions

- change answers

- auto-submit at 00:00



During the exam, display the student's Avatar on the side.



Avatar has LIVE MOOD:

Correct answer → happiness

Repeated correct answers → stronger happiness

Wrong answer → sadness/annoyance

Repeated wrong answers → stronger sadness/anger



Mood is cosmetic only and NEVER affects score, timer, hearts, attempts or ranking.



━━━━━━━━━━━━━━━━━━

5. HEARTS / ATTEMPTS

━━━━━━━━━━━━━━━━━━



Each exact Subject + Year Exam has:

❤️❤️ = 2 attempts



Every completed attempt consumes one heart.

After both attempts → lock that exact exam for 24 hours.

Other exams remain available.

Restore the configured attempts after the lock period.



Creator has unlimited hearts and no exam restrictions.



Enforce this server-side.



━━━━━━━━━━━━━━━━━━

6. RESULTS

━━━━━━━━━━━━━━━━━━



Show:

- Score /20

- Percentage

- Correct answers

- Wrong answers

- Unanswered

- Time used

- Attempt number

- Pass/Fail

- Best score

- Rank



Actions:

🔄 Refaire l’examen

❌ Voir mes erreurs



━━━━━━━━━━━━━━━━━━

7. MES ERREURS + AI

━━━━━━━━━━━━━━━━━━



Create ONE unified correction/error page.



Show only wrong and unanswered questions.



For every question:

- exact question

- exact options

- student's answer

- official answer

- official explanation if available

- source note if available



Button:

🤖 Expliquer avec l’IA



AI receives the exact question/options/student answer/official answer/source explanation.

AI may explain the concept but MUST NEVER modify or contradict the official answer.



Allow a small follow-up AI chat for that question.



━━━━━━━━━━━━━━━━━━

8. WRONG-ANSWER MEMORY

━━━━━━━━━━━━━━━━━━



When a student answers a question incorrectly:

❌ “خطأ سابق”



Persist this per student + exact question in Supabase.



When the same question appears again, show the badge.



If the student later answers correctly:

✅ “تم تصحيح الخطأ”



Keep the historical record.



Add:

📚 “QCM أخطائي السابقة”



This system must NOT affect score, rank, hearts, attempts, XP or coins.



After a wrong answer show:

⚠️ “ركز! راجع درسك مليح.”



Then:

📝 “ملاحظة: …”



The note must ONLY come from the provided source/course/explanation. Never invent one.



━━━━━━━━━━━━━━━━━━

9. LEADERBOARD

━━━━━━━━━━━━━━━━━━



Real-time Supabase leaderboard.



Separate leaderboard for each exact Subject + Year Exam.



Ranking:

1. Best score

2. Fastest time as tie-breaker



Display Top 5:

Avatar + Pet + Name + Score + Speech Bubble.



Speech bubbles can be predefined or custom with length/safety limits.



━━━━━━━━━━━━━━━━━━

10. TOMATO SYSTEM 🍅

━━━━━━━━━━━━━━━━━━



ONLY THE TOP 5 PLAYERS can throw tomatoes.



They can throw tomatoes at other players in the same leaderboard.

No self-targeting.



Anti-spam/cooldown required.



Tomatoes are purely social/cosmetic and NEVER affect:

score, rank, hearts, attempts, XP or coins.



Target receives a tomato-covered visual effect for 24 hours, then it disappears automatically.



Include throw/hit sound effects.



When Doctor Z throws a tomato:

“🍅 Doctor Z ضربك بالطماطم! شكون شريك؟ 😂”



━━━━━━━━━━━━━━━━━━

11. XP / LEVELS / COINS

━━━━━━━━━━━━━━━━━━



Add:

XP

Levels

Coins

Daily/Weekly Missions

Streak

Cosmetic unlocks

Pet unlocks



Rewards can come from completing QCM, reviewing mistakes, missions, streaks and achievements.



These progression systems must NEVER modify academic score/rank.



Pets:

🐱 Cat

🐶 Dog

🐰 Rabbit

🐹 Hamster

🦊 Fox

🕷️ Spider



Cosmetic only.



━━━━━━━━━━━━━━━━━━

12. SOUND

━━━━━━━━━━━━━━━━━━



NO MUSIC.



Use SOUND EFFECTS ONLY:

click, answer selection, answer change, navigation, timer warning, final minute, submit, correct, wrong, result reveal, personal best, rank change, level up, mission reward, unlock, tomato throw/hit and avatar reactions.



Add:

🔊 Sound ON/OFF



Remember the user's sound preference.



━━━━━━━━━━━━━━━━━━

13. ACCOUNT DELETION

━━━━━━━━━━━━━━━━━━



Add “Delete Account”.



When a student permanently deletes their account:

- completely remove/disable their account and associated student data securely

- remove them from all leaderboards

- remove their visible rank

- remove avatar/pet/profile from the game

- they must NOT remain as “Deleted User”

- they must disappear completely from the game



Do this securely server-side.



Never delete the Creator account through student deletion.



━━━━━━━━━━━━━━━━━━

14. CREATOR / OWNER

━━━━━━━━━━━━━━━━━━



Owner:

Doctor Z

Email:

doctorzmit@gmail.com



Protect Creator permissions server-side with Supabase/RLS.



Creator has:

∞ Hearts

∞ Tomatoes

∞ XP/Coins

All cosmetics/pets/features unlocked

No exam locks

No attempt restrictions



Creator can manage:

students, exams, courses, questions, options, official answers, explanations, notes, hearts, leaderboards, progression and cosmetics.



IMPORTANT:

The OWNER IS ALLOWED TO EDIT QUESTION ANSWERS.

Creator can modify the official answer/options when managing the question.

Students cannot.



━━━━━━━━━━━━━━━━━━

15. EDUCATIONAL RESOURCES

━━━━━━━━━━━━━━━━━━



Add educational resource buttons:



Doctor Z /  

→ use the official creator YouTube URL provided later.https://youtube.com/@doctorz-i2007?si=nZg18vbKQGGshfbu



Med Support:

Telegram:

https://t.me/+ubEdEFjoMtllYZcE8



YouTube:

https://youtube.com/@medisuppor1?si=YL2jAcqpSdClp0ep



━━━━━━━━━━━━━━━━━━

16. NAVIGATION

━━━━━━━━━━━━━━━━━━



Main navigation:

🏠 Home

📝 QCM Examens

📚 QCM par Cours

📚 QCM أخطائي السابقة

🏆 Leaderboard

🎯 Missions

👤 Profile

⚙️ Settings



Do NOT create a standalone “Clinical Cases” section.

Clinical cases that belong to an original exam remain inside that exam.



━━━━━━━━━━━━━━━━━━

17. DESIGN

━━━━━━━━━━━━━━━━━━



Premium medical gaming UI:

light blue + white

clean modern cards

high-quality 2D cartoon illustrations

smooth animations

mobile-first responsive design

youthful/cool but not childish

French + Arabic labels where appropriate



University branding:

Université Saad Dahleb - Blida 1

Faculté de Médecine



━━━━━━━━━━━━━━━━━━

18. DATA INTEGRITY + SECURITY

━━━━━━━━━━━━━━━━━━



Use Supabase database + authentication + RLS.



Never rely on frontend-only security.



Secure server-side validation for:

- Creator permissions

- exam attempts

- hearts

- scores

- leaderboard

- tomatoes

- XP/coins

- accountCOURSE AUTO-SEGMENTATION:



Some QCM files are NOT separated into individual lesson files.



For these files, automatically divide the questions into Courses according to the lesson title written at the beginning of each group of questions.



Example:

[Lesson Title: Hypersensibilité]

Q1

Q2

Q3

→ Course = Hypersensibilité



[Lesson Title: Auto-immunité]

Q4

Q5

Q6

→ Course = Auto-immunité



RULES:

- Detect the exact lesson title appearing before each group of questions.

- That title becomes the Course name.

- Assign all questions after that title to the same Course until the next lesson title.

- Keep the exact order found in the source file.

- Do not invent, rename, translate or modify the lesson titles.

- Do not mix questions belonging to different lessons.

- Each question must be linked to its detected Course and original source file.

- If a lesson title is clearly present, automatically create the Course without requiring Creator intervention.

- Only ask for Creator review if the title is genuinely unclear or impossible to determine.



This must work automatically for large files containing many lessons and questions. deletion



Every question must remain traceable to:

Subject → Exam Year OR Course → Source File.



Do not invent missing information.

If a source file is unclear or missing, flag it instead of guessing.



PRESERVE EXISTING VALID DATA WHEN UPDATING THE APP.

Do not duplicate exams, questions or users.



Build the complete functional application, not just a visual mockup.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a715bc63-a25d-4112-9554-19aa2b6ac9d2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
