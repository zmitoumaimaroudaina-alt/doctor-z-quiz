# Doctor Z Quiz (Android — Kotlin & Jetpack Compose)

**Doctor Z Quiz** is a modern, high-quality medical QCM gaming application designed specifically for medical students at **Université Saad Dahleb - Blida 1 | Faculté de Médecine**.

The project has been rewritten from its original web version into a native **Android application** using **Kotlin**, **Jetpack Compose**, and modern **Material Design 3 (M3)** architecture.

---

## 🩺 Core Features & Architecture

### 1. 8 Official Medical Subjects
Exact curriculum subjects from the Faculty of Medicine of Blida:
1. **Biochimie**
2. **Physiopathologie**
3. **Sémiologie**
4. **Psychologie Médicale**
5. **Radiologie**
6. **Physiologie**
7. **Immunologie**
8. **Anatomopathologie (Anapath)**

### 2. Dual QCM Practice & Exam Modes
- **QCM Examens (Matière → Année → Examen):**
  - Real exam sessions (2021–2024 sessions).
  - 30-minute authoritative countdown timer with auto-submit.
  - Heart system: **2 attempts per exam (❤️❤️)**. When both attempts are used, that specific exam is locked for 24 hours.
  - Side Live Avatar reacting to answers with live cosmetic moods:
    - Correct: Happiness 😊
    - Consecutive correct: High happiness 🔥
    - Incorrect: Sadness 😕
    - Consecutive wrong: Annoyance 😤
- **QCM par Cours (Matière → Cours → QCM):**
  - 73 official course segments auto-parsed from curriculum documents.
  - Immediate answer verification with clinical explanations and source notes.

### 3. Wrong-Answer Memory System (أخطائي السابقة)
- Questions answered incorrectly receive the persistent badge: ❌ **“خطأ سابق”**.
- When subsequently answered correctly: ✅ **“تم تصحيح الخطأ”**.
- Targeted feedback: ⚠️ **“ركز! راجع درسك مليح.”** with source citation notes.
- **Expliquer avec l’IA:** In-app AI guidance explaining clinical concepts without altering official university answer keys.

### 4. Interactive 2D Avatar Creator & Live Reactions
- Custom vector canvas avatar supporting:
  - Gender (Homme / Femme)
  - 6 realistic skin pigments
  - Hairstyles & hair colors
  - Hijab styles (Classique, Sport, Turban, Long drapé) and hijab color palettes
  - Authentic outfits (Blouse médicale, Hoodie, Jellaba, Pyjama de bloc, Veste, Scrubs bordeaux, Pull vert, Abaya, Kamis)
  - Beards, moustaches, glasses, and stethoscopes
  - Cosmetic pet companions: 🐱 Chat, 🐶 Chien, 🐰 Lapin, 🐹 Hamster, 🦊 Renard, 🕷️ Araignée
  - Custom leaderboard speech bubbles

### 5. Leaderboard & Tomato Throwing System (🍅)
- Real-time ranking based on best score with fastest completion time as tie-breaker.
- **Top 5 Player Privilege:** Only Top 5 players can throw tomatoes at other players.
- Strict anti-abuse rules: no self-targeting, 10-minute cooldown.
- Target receives a 24-hour visual tomato splatter effect.
- 100% cosmetic: tomatoes never alter academic scores, hearts, or rankings.

### 6. Progression & Creator Permissions
- Level progression, XP, coins, streaks (🔥), and daily missions.
- **Creator Account (`doctorzmit@gmail.com`):**
  - Unlimited hearts (∞)
  - Unlimited tomatoes (∞)
  - No exam lockouts
  - Question management and answer verification

### 7. Educational Resources
- **Doctor Z YouTube:** [youtube.com/@doctorz-i2007](https://youtube.com/@doctorz-i2007?si=nZg18vbKQGGshfbu)
- **Med Support Telegram:** [t.me/+ubEdEFjoMtllYZcE8](https://t.me/+ubEdEFjoMtllYZcE8)
- **Med Support YouTube:** [youtube.com/@medisuppor1](https://youtube.com/@medisuppor1?si=YL2jAcqpSdClp0ep)

---

## 🛠️ Tech Stack & Android Directory Structure

- **Language:** Kotlin 2.1.0
- **UI Framework:** Jetpack Compose with Material 3 (M3)
- **Architecture:** Clean MVVM (Model-View-ViewModel + Repository)
- **Data Layer:** Local asset caching (`questions.json`) with StateFlow reactive state management
- **Platform Sync:** Synced `metadata.json` with `strings.xml` and custom adaptive launcher icon

```
app/
├── src/main/
│   ├── AndroidManifest.xml
│   ├── assets/
│   │   └── questions.json                # Complete Blida 1 Faculty questions database
│   ├── java/com/example/doctorzquiz/
│   │   ├── DoctorZApplication.kt
│   │   ├── MainActivity.kt               # Central navigation and edge-to-edge flow
│   │   ├── data/
│   │   │   ├── model/Models.kt           # Domain models, enums & game calculations
│   │   │   └── repository/QuizRepository.kt # Business logic, hearts, tomatoes, missions
│   │   └── ui/
│   │       ├── components/
│   │       │   ├── AvatarView.kt         # Custom Canvas 2D vector avatar engine
│   │       │   ├── QuestionCard.kt       # Multi-state QCM card with badges
│   │       │   └── AppBars.kt            # Edge-to-edge top bar & navigation bar
│   │       ├── screens/
│   │       │   ├── HomeScreen.kt
│   │       │   ├── ExamsScreen.kt
│   │       │   ├── ExamPlayScreen.kt
│   │       │   ├── AttemptResultScreen.kt
│   │       │   ├── CoursesScreen.kt
│   │       │   ├── CoursePracticeScreen.kt
│   │       │   ├── MistakesScreen.kt
│   │       │   ├── LeaderboardScreen.kt
│   │       │   ├── MissionsScreen.kt
│   │       │   ├── ProfileScreen.kt
│   │       │   ├── SettingsScreen.kt
│   │       │   └── AdminScreen.kt
│   │       └── theme/
│   │           ├── Color.kt
│   │           └── Theme.kt
│   └── res/
│       ├── drawable/                     # Launcher icons & foreground vector layers
│       ├── mipmap-*/                     # Generated adaptive & round launcher icons
│       └── values/
│           ├── strings.xml
│           ├── colors.xml
│           └── themes.xml
├── build.gradle.kts
build.gradle.kts
settings.gradle.kts
metadata.json
gradle/
└── libs.versions.toml
```
