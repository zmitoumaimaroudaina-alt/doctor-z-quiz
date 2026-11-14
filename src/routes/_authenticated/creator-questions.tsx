import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageTitle } from "@/components/AppShell";
import { CreatorQuestionEditor } from "@/components/CreatorQuestionEditor";
import { useMe } from "@/hooks/useMe";
import { pageMetadata } from "@/lib/metadata";

export const Route = createFileRoute("/_authenticated/creator-questions")({
  head: () =>
    pageMetadata(
      "Correction Manuelle Creator",
      "Page réservée au créateur pour rechercher les questions et corriger la réponse officielle manuellement.",
    ),
  component: CreatorQuestionsPage,
});

function CreatorQuestionsPage() {
  const { data: me } = useMe();
  if (!me) return null;
  if (!me.isCreator) {
    return (
      <AppShell>
        <div className="card-game p-6 text-center text-destructive font-semibold">
          Accès réservé exclusivement au Creator (doctorzmit@gmail.com).
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <PageTitle
        title="🛠️ Correction Manuelle des Questions"
        ar="صفحة المصمم: البحث وتصحيح الحل الرسمي يدوياً"
        sub="ابحث عن أي سؤال في الامتحانات أو الدروس وعدّل الإجابة الرسمية (A-E) أو نص السؤال والشرح مباشرة."
      />
      <CreatorQuestionEditor />
    </AppShell>
  );
}
