import { describe, expect, it } from "vitest";
import { EXAM_DURATION_SECONDS, examSecondsLeft } from "@/lib/game";

describe("Full exam duration", () => {
  const start = "2026-11-02T12:00:00Z";
  it("allows exactly one hour", () => {
    expect(EXAM_DURATION_SECONDS).toBe(3600);
    expect(examSecondsLeft(start, Date.parse(start))).toBe(3600);
    expect(examSecondsLeft(start, Date.parse("2026-11-02T12:30:00Z"))).toBe(1800);
    expect(examSecondsLeft(start, Date.parse("2026-11-02T13:00:00Z"))).toBe(0);
    expect(examSecondsLeft(start, Date.parse("2026-11-02T13:10:00Z"))).toBe(0);
  });
});