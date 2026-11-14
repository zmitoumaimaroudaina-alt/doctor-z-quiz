import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import type { AvatarConfig } from "@/components/Avatar";

export type StudentProfile = {
  uid: string;
  name: string;
  email: string;
  avatar: AvatarConfig | null;
  pet?: string | null;
  bubble?: string | null;
  score: number;
  xp: number;
  createdAt?: unknown;
  lastLogin?: unknown;
};

export async function ensureStudentOnLogin(
  uid: string,
  email: string,
  displayName?: string,
): Promise<boolean> {
  const docRef = doc(db, "students", uid);
  try {
    const snap = await getDoc(docRef);
    const resolvedName = displayName || email.split("@")[0] || "Étudiant";
    if (!snap.exists()) {
      let previousAvatar: AvatarConfig | null = null;
      let previousPet: string | null = null;
      let previousScore = 0;
      let previousXp = 0;

      if (typeof window !== "undefined") {
        try {
          const local = localStorage.getItem("doctorz_saved_profiles");
          if (local) {
            const parsed = JSON.parse(local);
            const p = parsed[email.toLowerCase()] || parsed[email];
            if (p) {
              if (p.avatar) previousAvatar = p.avatar;
              if (p.pet) previousPet = p.pet;
              if (p.xp) previousXp = Number(p.xp);
              if (p.score) previousScore = Number(p.score);
            }
          }
        } catch {
          // ignore
        }
      }

      await setDoc(
        docRef,
        {
          uid,
          name: resolvedName,
          email: email || "",
          avatar: previousAvatar,
          pet: previousPet,
          score: previousScore,
          xp: previousXp,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        },
        { merge: true },
      );
      return previousAvatar != null;
    } else {
      await setDoc(
        docRef,
        {
          lastLogin: serverTimestamp(),
        },
        { merge: true },
      );
      const data = snap.data() as StudentProfile;
      const hasAvatar = data && data.avatar != null && typeof data.avatar === "object";
      return hasAvatar;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/${uid}`);
    return false;
  }
}

export async function saveStudentAvatar(
  uid: string,
  avatar: AvatarConfig,
  pet: string | null,
  name: string,
) {
  const docRef = doc(db, "students", uid);
  try {
    await setDoc(
      docRef,
      {
        avatar,
        pet,
        name,
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/${uid}`);
    throw error;
  }
}

export async function addStudentScore(uid: string, addScore: number, addXp: number = 0) {
  const docRef = doc(db, "students", uid);
  try {
    await updateDoc(docRef, {
      score: increment(addScore),
      xp: increment(addXp || addScore * 10),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${uid}`);
  }
}

export const INITIAL_KNOWN_STUDENTS: Array<{
  uid: string;
  name: string;
  email: string;
  avatar: AvatarConfig;
  score: number;
  xp: number;
  pet?: string | null;
  bubble?: string | null;
}> = [
  {
    uid: "student-dr-z",
    name: "Doctor Z 👑",
    email: "doctorzmit@gmail.com",
    avatar: {
      gender: "m",
      skin: 1,
      eyes: 2,
      nose: 0,
      mouth: 2,
      hair: 9,
      hairColor: 0,
      hijab: 0,
      outfit: 0,
      accessory: 1,
      glasses: 1,
      beard: 1,
      moustache: 0,
    },
    score: 180,
    xp: 5000,
    pet: "lion",
    bubble: "Doctor Z ici! 🩺",
  },
  {
    uid: "student-aymen",
    name: "Aymen",
    email: "aymen@blida.dz",
    avatar: {
      gender: "m",
      skin: 1,
      eyes: 1,
      nose: 0,
      mouth: 0,
      hair: 4,
      hairColor: 1,
      hijab: 0,
      outfit: 1,
      accessory: 1,
      glasses: 0,
      beard: 0,
      moustache: 0,
    },
    score: 85,
    xp: 650,
    pet: "cat",
    bubble: "QCM master 🧠",
  },
  {
    uid: "student-notme",
    name: "not me",
    email: "notme@blida.dz",
    avatar: {
      gender: "m",
      skin: 2,
      eyes: 0,
      nose: 1,
      mouth: 1,
      hair: 2,
      hairColor: 0,
      hijab: 0,
      outfit: 2,
      accessory: 1,
      glasses: 1,
      beard: 0,
      moustache: 0,
    },
    score: 70,
    xp: 450,
    pet: "owl",
    bubble: "Wech, rani hna 😎",
  },
];

export async function seedKnownStudents() {
  for (const st of INITIAL_KNOWN_STUDENTS) {
    try {
      const docRef = doc(db, "students", st.uid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(
          docRef,
          {
            uid: st.uid,
            name: st.name,
            email: st.email,
            avatar: st.avatar,
            score: st.score,
            xp: st.xp,
            pet: st.pet || null,
            bubble: st.bubble || null,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          },
          { merge: true },
        );
      }
    } catch (err) {
      console.error("Failed to seed student:", st.name, err);
    }
  }
}
