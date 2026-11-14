import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const RecordSchema = z.object({
  action: z.literal("record_challenge"),
  record: z.object({
    id: z.string(),
    userId: z.string(),
    email: z.string().nullable().optional(),
    displayName: z.string(),
    kind: z.enum(["exam", "course", "quiz"]),
    targetId: z.string(),
    targetTitle: z.string().optional(),
    score20: z.number(),
    durationSec: z.number(),
    correctCount: z.number(),
    totalCount: z.number(),
    createdAt: z.string(),
  }),
});

const ProfileSchema = z.object({
  action: z.literal("upsert_profile"),
  profile: z.object({
    user_id: z.string(),
    email: z.string().nullable().optional(),
    display_name: z.string(),
    avatar: z.object({
      gender: z.string(),
      skin: z.number(),
      eyes: z.number().optional(),
      hair: z.number().optional(),
      hairColor: z.number().optional(),
      hijab: z.number().optional(),
      outfit: z.number(),
      accessory: z.number(),
    }),
    pet: z.string().nullable().optional(),
    bubble: z.string().nullable().optional(),
    xp: z.number().optional(),
    isCreator: z.boolean().optional(),
  }),
});

const PostSchema = z.discriminatedUnion("action", [RecordSchema, ProfileSchema]);

export const Route = createFileRoute("/api/leaderboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getServerStandings } = await import("@/lib/leaderboard.server");
        const url = new URL(request.url);
        const examId = url.searchParams.get("examId")?.trim();
        const standings = await getServerStandings(examId || undefined);
        return Response.json(standings, {
          headers: { "Cache-Control": "no-store" },
        });
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = PostSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid request payload." }, { status: 400 });
        }

        const { recordServerChallenge, upsertServerProfile } =
          await import("@/lib/leaderboard.server");

        if (parsed.data.action === "record_challenge") {
          await recordServerChallenge(parsed.data.record);
        } else if (parsed.data.action === "upsert_profile") {
          await upsertServerProfile(parsed.data.profile);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
