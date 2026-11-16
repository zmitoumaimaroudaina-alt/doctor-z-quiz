import { useMe } from "@/hooks/useMe";
import { consumeStudentHeart, INITIAL_HEARTS, MAX_HEARTS_CAP } from "./studentService";

export const MAX_BASE_HEARTS = INITIAL_HEARTS;
export const MAX_HEARTS = MAX_HEARTS_CAP;

export type HeartStatus = {
  hearts: number;
  maxBase: number;
  maxCap: number;
  unlimited: boolean;
  secondsToNext: number;
  canPlay: boolean;
};

export function resolveHeartKey(email?: string | null, userId?: string | null): string {
  if (userId) return userId;
  if (email) return email.trim().toLowerCase();
  return "default-student";
}

export function buildHeartStatus(heartsValue?: number | null, isCreator = false): HeartStatus {
  if (isCreator) {
    return {
      hearts: 999,
      maxBase: MAX_BASE_HEARTS,
      maxCap: MAX_HEARTS,
      unlimited: true,
      secondsToNext: 0,
      canPlay: true,
    };
  }
  const hearts =
    typeof heartsValue === "number" && Number.isFinite(heartsValue)
      ? Math.max(0, Math.floor(heartsValue))
      : MAX_BASE_HEARTS;

  return {
    hearts,
    maxBase: MAX_BASE_HEARTS,
    maxCap: MAX_HEARTS,
    unlimited: false,
    secondsToNext: 0,
    canPlay: hearts > 0,
  };
}

export async function consumeHeart(
  uid: string,
  isCreator = false,
): Promise<{ ok: boolean; status: HeartStatus }> {
  if (isCreator) {
    return { ok: true, status: buildHeartStatus(999, true) };
  }
  const res = await consumeStudentHeart(uid, false);
  return {
    ok: res.ok,
    status: buildHeartStatus(res.hearts, false),
  };
}

export function formatHeartCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export function renderHeartsVisual(hearts: number, unlimited = false): string {
  if (unlimited) return "∞ ❤️";
  if (hearts <= 0) return "🤍🤍";
  if (hearts <= MAX_BASE_HEARTS) {
    return "❤️".repeat(hearts) + "🤍".repeat(MAX_BASE_HEARTS - hearts);
  }
  return `${"❤️".repeat(Math.min(hearts, MAX_HEARTS))}${hearts > MAX_HEARTS ? ` +${hearts - MAX_HEARTS}` : ""}`;
}

export function useHearts(
  _email?: string | null,
  _userId?: string | null,
  isCreatorArg?: boolean,
): HeartStatus {
  const { data: me } = useMe();
  const isCreator = isCreatorArg ?? !!me?.isCreator;
  return buildHeartStatus(me?.hearts, isCreator);
}
