import { pageMetadata } from "@/lib/metadata";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useMe, type Me } from "@/hooks/useMe";
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

type PendingMap = Partial<Record<DhikrKey, number>>;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function RenewHeartsPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [pendingByKey, setPendingByKey] = useState<PendingMap>({});
  const [celebrateHeart, setCelebrateHeart] = useState(false);
  const [completedFlashKey, setCompletedFlashKey] = useState<DhikrKey | null>(null);
  const [pulseKey, setPulseKey] = useState<DhikrKey | null>(null);
  const [returnTo, setReturnTo] = useState<string>("/examens");

  const queueRef = useRef<DhikrKey[]>([]);
  const processingRef = useRef(false);
  const lastCommitAtRef = useRef<number>(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const pendingPotentialHearts = ADHKAR_LIST.reduce((acc, item) => {
    const confirmed = Math.max(0, Math.min(9, Number(me.dhikrCounts?.[item.key] ?? 0)));
    const pending = pendingByKey[item.key] ?? 0;
    return acc + Math.floor((confirmed + pending) / DHIKR_TARGET);
  }, 0);
  const optimisticHearts = Math.min(MAX_HEARTS_CAP, currentHearts + pendingPotentialHearts);

  function decrementPending(key: DhikrKey) {
    if (!mountedRef.current) return;
    setPendingByKey((prev) => {
      const cur = prev[key] ?? 0;
      if (cur <= 1) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: cur - 1 };
    });
  }

  async function processQueue(uid: string) {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      while (queueRef.current.length > 0 && mountedRef.current) {
        const nextKey = queueRef.current.shift();
        if (!nextKey) break;

        // Space consecutive Firestore transactions comfortably above the 50ms server rule
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const minGap = DHIKR_COOLDOWN_MS + 20;
        const sinceLast = now - lastCommitAtRef.current;
        if (lastCommitAtRef.current > 0 && sinceLast < minGap) {
          await sleep(minGap - sinceLast);
        }

        let succeeded = false;
        let lastErr: unknown = null;
        const retryDelays = [140, 260, 420];

        for (let attempt = 0; attempt <= retryDelays.length && !succeeded; attempt++) {
          try {
            const res = await performDhikrStep(uid, nextKey);
            lastCommitAtRef.current =
              typeof performance !== "undefined" ? performance.now() : Date.now();

            // Synchronously update React Query cache with the authoritative transaction result
            // BEFORE/WITH decrementPending so the displayed count NEVER drops backwards.
            qc.setQueryData<Me | null>(["me"], (prev) => {
              if (!prev || prev.id !== uid) return prev;
              return {
                ...prev,
                hearts: prev.isCreator ? prev.hearts : res.newHearts,
                dhikrCounts: {
                  ...prev.dhikrCounts,
                  [nextKey]: res.newCount,
                },
              };
            });
            decrementPending(nextKey);
            succeeded = true;

            if (res.completedTen && mountedRef.current) {
              setCompletedFlashKey(nextKey);
              setTimeout(() => {
                if (mountedRef.current) setCompletedFlashKey(null);
              }, 900);
            }
            if (res.earnedHeart && mountedRef.current) {
              play("reward");
              setCelebrateHeart(true);
              toast.success("ما شاء الله! حصلت على +1 ❤️ جديد في رصيدك!");
              setTimeout(() => {
                if (mountedRef.current) setCelebrateHeart(false);
              }, 1800);
            }
          } catch (err: unknown) {
            lastErr = err;
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("MAX_HEARTS_REACHED")) {
              queueRef.current = [];
              if (mountedRef.current) {
                setPendingByKey({});
                toast.info(`وصلت إلى الحد الأقصى (${MAX_HEARTS_CAP} قلوب) ❤️`);
              }
              succeeded = true;
              break;
            }
            if (msg.includes("STUDENT_NOT_FOUND")) {
              break;
            }
            const delay = retryDelays[attempt];
            if (delay !== undefined) {
              await sleep(delay);
            }
          }
        }

        if (!succeeded) {
          decrementPending(nextKey);
          console.error("Failed to record dhikr step:", lastErr);
          const rawMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
          let detail = rawMsg;
          try {
            const parsed = JSON.parse(rawMsg) as { error?: string };
            if (parsed.error) detail = parsed.error;
          } catch {
            // keep rawMsg
          }
          if (detail.includes("STUDENT_NOT_FOUND")) {
            queueRef.current = [];
            setPendingByKey({});
            toast.error("يرجى إعادة تسجيل الدخول لتفعيل ملفك.");
            break;
          } else if (detail.toLowerCase().includes("permission")) {
            toast.error("تعذر حفظ التسبيحة بسبب صلاحيات القاعدة. حدّث الصفحة وأعد المحاولة.");
          } else {
            toast.error("تعذر تسجيل التسبيحة: " + detail.slice(0, 80));
          }
        }
      }
    } finally {
      processingRef.current = false;
    }
  }

  function handleTasbih(key: DhikrKey) {
    if (!me) return;
    if (me.isCreator) {
      toast.info("حساب المصمم يملك قلوباً غير محدودة ❤️");
      return;
    }
    if (currentHearts >= MAX_HEARTS_CAP || optimisticHearts >= MAX_HEARTS_CAP) {
      toast.info(`وصلت إلى الحد الأقصى للقلوب (${MAX_HEARTS_CAP}/${MAX_HEARTS_CAP}) ❤️`);
      return;
    }

    if (queueRef.current.length >= 15) {
      return;
    }

    play("click");
    setPulseKey(key);
    setTimeout(() => {
      if (mountedRef.current) setPulseKey((cur) => (cur === key ? null : cur));
    }, 150);

    queueRef.current.push(key);
    setPendingByKey((prev) => ({
      ...prev,
      [key]: (prev[key] ?? 0) + 1,
    }));

    void processQueue(me.id);
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
            const confirmedCount = Math.max(
              0,
              Math.min(9, Number(me.dhikrCounts?.[item.key] ?? 0)),
            );
            const pendingCount = pendingByKey[item.key] ?? 0;
            const totalOptimistic = confirmedCount + pendingCount;
            const wrappedCount = totalOptimistic % DHIKR_TARGET;
            const justCompletedOptimistically = pendingCount > 0 && wrappedCount === 0;
            const displayCount =
              completedFlashKey === item.key || justCompletedOptimistically
                ? DHIKR_TARGET
                : wrappedCount;
            const pct = Math.min(100, Math.round((displayCount / DHIKR_TARGET) * 100));
            const isFlashing = completedFlashKey === item.key || justCompletedOptimistically;
            const isPulsing = pulseKey === item.key;

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
                      className={`h-full rounded-full transition-all duration-200 ${
                        isFlashing ? "bg-success" : "bg-hero"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isAtCap}
                  onClick={() => handleTasbih(item.key)}
                  className={`mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 ${
                    isPulsing ? "scale-95 brightness-110" : ""
                  }`}
                >
                  {isFlashing ? "✨ +1 ❤️ تم!" : isAtCap ? "الرصيد ممتلئ (5/5)" : "سبّح"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          🛡️ لحماية النزاهة: يُحتسب كل تسبيح والحد الأقصى للقلوب مباشرة في قاعدة البيانات بحماية
          تلقائية سريعة وسلسة.
        </p>
      </div>
    </AppShell>
  );
}
