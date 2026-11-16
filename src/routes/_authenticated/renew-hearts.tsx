import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useMe } from "@/hooks/useMe";
import { renderHeartsVisual } from "@/lib/heartsStore";
import {
  ADHKAR_LIST,
  DHIKR_COOLDOWN_MS,
  DHIKR_TARGET,
  MAX_HEARTS_CAP,
  performDhikrStep,
  type DhikrKey,
} from "@/lib/studentService";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/renew-hearts")({
  head: () =>
    pageMetadata(
      "تجديد القلوب بالأذكار",
      "جدّد قلوب المحاولات عبر التسبيح والذكر للعودة إلى الاختبارات.",
    ),
  component: RenewHeartsPage,
});

function RenewHeartsPage() {
  const { data: me } = useMe();
  const nav = useNavigate();
  const [busyKey, setBusyKey] = useState<DhikrKey | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [celebrateHeart, setCelebrateHeart] = useState(false);
  const [completedFlashKey, setCompletedFlashKey] = useState<DhikrKey | null>(null);
  const [returnTo, setReturnTo] = useState<string>("/examens");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("returnTo");
      if (r && r.startsWith("/")) {
        setReturnTo(r);
      }
    }
  }, []);

  if (!me) {
    return (
      <AppShell>
        <div className="p-8 text-center font-semibold">جاري التحميل...</div>
      </AppShell>
    );
  }

  const currentHearts = me.isCreator ? MAX_HEARTS_CAP : Math.max(0, me.hearts);
  const isAtCap = !me.isCreator && currentHearts >= MAX_HEARTS_CAP;

  async function handleTasbih(key: DhikrKey) {
    if (!me) return;
    if (me.isCreator) {
      toast.info("حساب المصمم يملك قلوباً غير محدودة ❤️");
      return;
    }
    if (currentHearts >= MAX_HEARTS_CAP) {
      toast.info(`وصلت إلى الحد الأقصى للقلوب (${MAX_HEARTS_CAP}/${MAX_HEARTS_CAP}) ❤️`);
      return;
    }

    const now = Date.now();
    if (now < cooldownUntil) {
      toast.warning("⏳ انتظر نصف ثانية بين كل تسبيحة والأخرى");
      return;
    }

    setBusyKey(key);
    setCooldownUntil(now + DHIKR_COOLDOWN_MS);

    try {
      const res = await performDhikrStep(me.id, key);
      if (res.completedTen) {
        setCompletedFlashKey(key);
        setTimeout(() => setCompletedFlashKey(null), 900);
      }
      if (res.earnedHeart) {
        play("reward");
        setCelebrateHeart(true);
        toast.success("ما شاء الله! حصلت على +1 ❤️ جديد في رصيدك!");
        setTimeout(() => setCelebrateHeart(false), 1800);
      } else {
        play("click");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("MAX_HEARTS_REACHED")) {
        toast.info(`وصلت إلى الحد الأقصى (${MAX_HEARTS_CAP} قلوب)`);
      } else if (msg.includes("COOLDOWN_ACTIVE") || msg.includes("permission")) {
        toast.warning("⏳ تمهّل قليلاً (الحد الأدنى 0.5 ثانية بين التسبيحات)");
      } else {
        console.error("Failed to record dhikr step:", error);
        toast.error("تعذر تسجيل التسبيحة، تحقق من الاتصال.");
      }
    } finally {
      setTimeout(() => setBusyKey(null), 220);
    }
  }

  function handleBackToQuiz() {
    play("nav");
    nav({ to: returnTo as never });
  }

  return (
    <AppShell wide>
      <div dir="rtl">
        <PageTitle
          title="❤️ تجديد القلوب"
          ar="الذكر والطمأنينة"
          sub="سبّح الله واذكره — كل 10 تسبيحات من ذكر واحد تمنحك قلباً جديداً تلقائياً (بحد أقصى 5 قلوب)."
        />

        {/* Hearts Summary & Return Card */}
        <div
          className={`card-game mb-6 p-5 border-2 transition-all ${
            celebrateHeart
              ? "border-success bg-success/10 shadow-pop scale-[1.01]"
              : currentHearts <= 0
                ? "border-destructive/40 bg-destructive/5"
                : "border-primary/30 bg-primary/5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-muted-foreground">رصيد قلوبك الحالي</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl tracking-wider">
                  {renderHeartsVisual(me.hearts, me.isCreator)}
                </span>
                <span className="rounded-full bg-card border px-3 py-1 text-sm font-bold text-foreground">
                  {me.isCreator ? "∞" : `${currentHearts} / ${MAX_HEARTS_CAP}`}
                </span>
                {celebrateHeart && (
                  <span className="animate-bounce-big rounded-full bg-success px-3 py-1 text-xs font-bold text-success-foreground shadow-sm">
                    +1 ❤️ قلب جديد!
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isAtCap
                  ? `✅ رصيدك ممتلئ (${MAX_HEARTS_CAP}/${MAX_HEARTS_CAP} قلوب). يمكنك العودة للاختبار الآن!`
                  : currentHearts <= 0
                    ? "💔 نفدت قلوبك! أكمل 10 تسبيحات في أي ذكر أدناه للحصول على قلب."
                    : "💚 لديك رصيد قلوب كافٍ للعودة للاختبار، ويمكنك زيادتها حتى 5 قلوب."}
              </p>
            </div>

            {(currentHearts > 0 || me.isCreator) && (
              <button
                type="button"
                onClick={handleBackToQuiz}
                className="rounded-2xl bg-hero px-6 py-3 text-sm font-bold text-primary-foreground shadow-pop hover:brightness-105 active:scale-95 transition-all"
              >
                ⬅️ ارجع للاختبار
              </button>
            )}
          </div>
        </div>

        {/* 8 Adhkar Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADHKAR_LIST.map((item) => {
            const rawCount = Number(me.dhikrCounts?.[item.key] ?? 0);
            const displayCount = completedFlashKey === item.key ? DHIKR_TARGET : rawCount;
            const pct = Math.min(100, Math.round((displayCount / DHIKR_TARGET) * 100));
            const isFlashing = completedFlashKey === item.key;

            return (
              <div
                key={item.key}
                className={`card-game flex flex-col justify-between p-5 border transition-all ${
                  isFlashing
                    ? "border-success bg-success/10 ring-2 ring-success/40 animate-pop"
                    : "border-border/80 hover:shadow-pop"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{item.sub}</span>
                    <span className="font-mono font-bold text-primary">
                      {displayCount}/{DHIKR_TARGET}
                    </span>
                  </div>

                  <h2 className="ar font-display text-xl font-bold text-foreground leading-snug min-h-[3.2rem] flex items-center">
                    {item.text}
                  </h2>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isFlashing ? "bg-success" : "bg-hero"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busyKey !== null || isAtCap}
                  onClick={() => void handleTasbih(item.key)}
                  className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isFlashing
                    ? "✨ +1 ❤️ تم!"
                    : isAtCap
                      ? "الرصيد ممتلئ (5/5)"
                      : busyKey === item.key
                        ? "..."
                        : "سبّح"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          🛡️ لحماية النزاهة: يُحتسب كل تسبيح والحد الأقصى للقلوب مباشرة في قاعدة البيانات بفاصل لا
          يقل عن 0.5 ثانية بين النقرات.
        </p>
      </div>
    </AppShell>
  );
}
