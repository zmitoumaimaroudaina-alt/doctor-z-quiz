import { describe, expect, it } from "vitest";
import { ADHKAR_LIST, DHIKR_TARGET, MAX_HEARTS_CAP, type DhikrKey } from "@/lib/studentService";

/**
 * Mirrors the exact Firestore Rules Action E (isValidDhikrStep + isValidDhikrKeyStep)
 * so we can deterministically verify every step transition and edge case.
 */
function simulateFirestoreDhikrRule(
  existingDoc: {
    hearts?: number;
    dhikrCounts?: Record<string, number> | null;
  },
  incomingDoc: {
    hearts: number;
    dhikrCounts: Record<string, number>;
  },
): boolean {
  const validKeys = new Set<string>(ADHKAR_LIST.map((d) => d.key));
  const incomingKeys = Object.keys(incomingDoc.dhikrCounts);
  if (!incomingKeys.every((k) => validKeys.has(k))) return false;
  if (typeof incomingDoc.hearts !== "number" || incomingDoc.hearts < 0 || incomingDoc.hearts > 5) {
    return false;
  }

  const oldMap =
    existingDoc.dhikrCounts && typeof existingDoc.dhikrCounts === "object"
      ? existingDoc.dhikrCounts
      : {};
  const newMap = incomingDoc.dhikrCounts;

  const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
  const diffKeys = Array.from(allKeys).filter((k) => oldMap[k] !== newMap[k]);
  if (diffKeys.length !== 1) return false;

  const k = diffKeys[0]!;
  if (!validKeys.has(k)) return false;

  const prevVal = typeof oldMap[k] === "number" ? oldMap[k]! : 0;
  const nextVal = typeof newMap[k] === "number" ? newMap[k]! : 0;
  const prevHearts = typeof existingDoc.hearts === "number" ? existingDoc.hearts : 0;
  const nextHearts = incomingDoc.hearts;

  if (prevVal < 0 || prevVal > 9) return false;
  if (prevVal < 9) {
    return nextVal === prevVal + 1 && nextHearts === prevHearts;
  }
  return nextVal === 0 && prevHearts < MAX_HEARTS_CAP && nextHearts === prevHearts + 1;
}

function computeNextDhikrState(
  existingDoc: {
    hearts?: number;
    dhikrCounts?: Record<string, number> | null;
  },
  dhikrKey: DhikrKey,
) {
  const currentHearts =
    typeof existingDoc.hearts === "number" ? Math.max(0, Math.floor(existingDoc.hearts)) : 0;
  const rawExisting = existingDoc.dhikrCounts;
  const isExistingValidMap =
    rawExisting != null &&
    typeof rawExisting === "object" &&
    !Array.isArray(rawExisting) &&
    Object.keys(rawExisting).every((k) => ADHKAR_LIST.some((item) => item.key === k));

  const prevVal = isExistingValidMap
    ? Math.max(0, Math.min(9, Math.floor(Number(rawExisting[dhikrKey] ?? 0) || 0)))
    : 0;
  const completedTen = prevVal >= 9;
  const nextVal = completedTen ? 0 : prevVal + 1;
  const nextHearts = completedTen ? Math.min(MAX_HEARTS_CAP, currentHearts + 1) : currentHearts;

  const nextMap = isExistingValidMap
    ? { ...rawExisting, [dhikrKey]: nextVal }
    : { [dhikrKey]: nextVal };

  return {
    dhikrCounts: nextMap,
    hearts: nextHearts,
    completedTen,
    earnedHeart: completedTen && nextHearts > currentHearts,
  };
}

describe("Dhikr 10-step persistence & Firestore rule invariants", () => {
  it("steps cleanly from 0 -> 9 -> 0 and awards +1 heart for all 8 adhkar", () => {
    for (const item of ADHKAR_LIST) {
      let docState: { hearts: number; dhikrCounts: Record<string, number> | null } = {
        hearts: 2,
        dhikrCounts: {},
      };

      for (let tap = 1; tap <= DHIKR_TARGET; tap++) {
        const next = computeNextDhikrState(docState, item.key);
        expect(simulateFirestoreDhikrRule(docState, next)).toBe(true);
        docState = { hearts: next.hearts, dhikrCounts: next.dhikrCounts };
        if (tap < DHIKR_TARGET) {
          expect(next.dhikrCounts[item.key]).toBe(tap);
          expect(next.hearts).toBe(2);
          expect(next.earnedHeart).toBe(false);
        } else {
          expect(next.dhikrCounts[item.key]).toBe(0);
          expect(next.hearts).toBe(3);
          expect(next.earnedHeart).toBe(true);
        }
      }
    }
  });

  it("handles switching between multiple adhkar keys and null initial map", () => {
    let docState: { hearts: number; dhikrCounts: Record<string, number> | null } = {
      hearts: 0,
      dhikrCounts: null,
    };

    const s1 = computeNextDhikrState(docState, "d0");
    expect(simulateFirestoreDhikrRule(docState, s1)).toBe(true);
    docState = { hearts: s1.hearts, dhikrCounts: s1.dhikrCounts };

    const s2 = computeNextDhikrState(docState, "d7");
    expect(simulateFirestoreDhikrRule(docState, s2)).toBe(true);
    expect(s2.dhikrCounts).toEqual({ d0: 1, d7: 1 });
  });

  it("blocks invalid heart jumps or multi-key tampering", () => {
    const existing = { hearts: 2, dhikrCounts: { d0: 4 } };
    expect(
      simulateFirestoreDhikrRule(existing, {
        hearts: 3,
        dhikrCounts: { d0: 5 },
      }),
    ).toBe(false);
    expect(
      simulateFirestoreDhikrRule(existing, {
        hearts: 2,
        dhikrCounts: { d0: 5, d1: 1 },
      }),
    ).toBe(false);
  });
});
