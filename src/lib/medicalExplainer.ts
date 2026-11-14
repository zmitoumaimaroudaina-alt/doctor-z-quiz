import { getBundledKey, getBundledQuestion } from "./medicalData";
import { getKeyOverride, getQuestionOverride } from "./questionOverrides";
import type { Question } from "./queries";

function deduceClinicalContext(stem: string): string {
  const s = stem.toLowerCase();
  if (s.includes("glycolyse") || s.includes("insuline") || s.includes("glucagon") || s.includes("diab")) {
    return "Cette question évalue les voies métaboliques glucidiques fondamentales. L'activation des enzymes clés (phosphofructokinase, pyruvate kinase) est régulée par le rapport insuline/glucagon et la charge énergétique cellulaire (ATP/AMP).";
  }
  if (s.includes("infarctus") || s.includes("ecg") || s.includes("troponine") || s.includes("coronair")) {
    return "En cardiologie d'urgence, la cinétique enzymatique (troponine ultrasensible) et les anomalies électrocardiographiques (sus-décalage ST persistant) déterminent la stratification du risque et l'indication de revascularisation immédiate.";
  }
  if (s.includes("insuffisance cardiaque") || s.includes("nyha") || s.includes("bnp")) {
    return "Le syndrome d'insuffisance cardiaque associe des critères anamnestiques d'effort, des signes congestifs périphériques ou pulmonaires, et une élévation des peptides natriurétiques. Le blocage neuro-hormonal constitue le traitement de fond.";
  }
  if (s.includes("méningite") || s.includes("lcr") || s.includes("raideur de nuque")) {
    return "Toute suspicion de méningite aiguë fébrile impose une ponction lombaire sans délai après élimination des contre-indications cérébrales. La formule cytologique et biochimique du LCR guide l'antibiothérapie probabiliste d'urgence.";
  }
  if (s.includes("anémie") || s.includes("fer") || s.includes("ferritine") || s.includes("hémoglobine")) {
    return "L'analyse d'une anémie repose d'abord sur le VGM (microcytaire, normocytaire, macrocytaire) et le taux de réticulocytes (régénérative vs arégénérative). La carence martiale est la première cause d'anémie microcytaire arégénérative.";
  }
  if (s.includes("pneumonie") || s.includes("foyer") || s.includes("crépitant") || s.includes("thorax")) {
    return "En pneumologie, le syndrome de condensation pulmonaire parenchymateuse se traduit par l'association matité, augmentation des vibrations vocales et râles crépitants en foyer avec souffle tubaire central.";
  }
  if (s.includes("appendicite") || s.includes("douleur") || s.includes("fosse iliaque")) {
    return "Le diagnostic de l'appendicite aiguë repose sur la clinique (point de McBurney, signe de Blumberg, défense) confirmée par l'échographie ou le scanner abdominal avant toute décision chirurgicale.";
  }
  if (s.includes("pénicilline") || s.includes("antibiot") || s.includes("résistance")) {
    return "L'antibiothérapie rationnelle nécessite l'évaluation du spectre d'action, de la bactéricidie, de la diffusion tissulaire et du risque de sélection de mutants résistants.";
  }
  return "La question évalue les critères sémiologiques et diagnostiques formels enseignés dans les modules cliniques et précliniques de la Faculté de Médecine de Blida 1. Les propositions officielles reposent sur les recommandations nationales et internationales validées.";
}

export function generateClinicalExplanation(
  questionId: string,
  selected: string[],
  userPrompt?: string,
  customQ?: Question,
  customOfficial?: { correct: string[]; explanation: string; note: string | null }
): string {
  const baseQ = customQ || getBundledQuestion(questionId);
  const qOv = getQuestionOverride(questionId);
  const q = baseQ && qOv
    ? {
        ...baseQ,
        ...(qOv.stem !== undefined ? { stem: qOv.stem } : {}),
        ...(qOv.case_text !== undefined ? { case_text: qOv.case_text } : {}),
        ...(qOv.options !== undefined ? { options: qOv.options } : {}),
      }
    : baseQ;

  const baseKey = customOfficial || getBundledKey(questionId);
  const kOv = getKeyOverride(questionId);
  const key = kOv
    ? {
        correct: kOv.correct ?? baseKey.correct,
        explanation: kOv.explanation !== undefined ? (kOv.explanation ?? "") : baseKey.explanation,
        note: kOv.note !== undefined ? kOv.note : baseKey.note,
      }
    : baseKey;

  const officialAnswer = (key.correct || []).join(", ") || "غير محددة";
  const clinicalDeduction = q?.stem ? deduceClinicalContext(q.stem) : "";
  const officialExplanation =
    key.explanation && key.explanation.trim().length > 5
      ? key.explanation
      : clinicalDeduction;
  const note = key.note ? `\n📌 **Remarque de cours :** ${key.note}` : "";
  const stemPreview = q?.stem ? q.stem.trim() : `Question #${questionId}`;
  const options = (q?.options as { key: string; text: string }[] | undefined) ?? [];
  const correctOptionsText =
    options
      .filter((o) => key.correct.includes(o.key))
      .map((o) => `• **${o.key}**: ${o.text}`)
      .join("\n") || `Clé officielle : [${officialAnswer}]`;

  // Follow-up interaction
  if (userPrompt && userPrompt.trim().length > 0) {
    const p = userPrompt.toLowerCase();
    const wrongOptionsText = options
      .filter((o) => !key.correct.includes(o.key))
      .map((o) => `• **${o.key}**: ${o.text} → distracteur inexact par rapport à l'énoncé.`)
      .join("\n");

    if (p.includes("فخ") || p.includes("piège") || p.includes("piege") || p.includes("خطأ")) {
      return `🩺 **Dr Z-Bot — Analyse des pièges pour :** *"${stemPreview.slice(0, 120)}${stemPreview.length > 120 ? "…" : ""}"*

🎯 **Réponse officielle retenue : [${officialAnswer}]**
${correctOptionsText}

⚠️ **Propositions pièges (fausses) dans ce QCM :**
${wrongOptionsText || "Aucune autre option n'est retenue par le corrigé officiel."}

💡 **Explication :** ${officialExplanation}${note}`;
    }

    return `🩺 **Dr Z-Bot — Réponse à :** *"${userPrompt.trim()}"*

📌 **Question étudiée :** ${stemPreview.slice(0, 160)}${stemPreview.length > 160 ? "…" : ""}
🎯 **Réponse officielle : [${officialAnswer}]**
${correctOptionsText}

💡 **Analyse médicale :**
${officialExplanation}${note}`;
  }

  // Option-by-option detailed breakdown
  const optionsAnalysis = options
    .map((o) => {
      const isCorrect = key.correct.includes(o.key);
      const wasChosen = selected.includes(o.key);

      let status = isCorrect ? "✅ [PROPOSITION VRAIE]" : "❌ [PROPOSITION FAUSSE]";
      let comment = isCorrect
        ? `Confirmée par la clé officielle [${officialAnswer}] pour cette question.`
        : "Ne correspond pas aux critères exacts demandés dans l'énoncé.";

      if (wasChosen && isCorrect) {
        status += " 👈 (Bravo, ton choix est exact !)";
      } else if (wasChosen && !isCorrect) {
        status += " 👈 (Attention, tu as coché ce piège !)";
        comment = `Piège fréquent : "${o.text.slice(0, 80)}${o.text.length > 80 ? "…" : ""}" est inexacte ici.`;
      } else if (!wasChosen && isCorrect) {
        status += " ⚠️ (Tu as manqué cette bonne réponse !)";
      }

      return `• **Option ${o.key} : "${o.text}"**\n  ↳ ${status}\n  ↳ *${comment}*`;
    })
    .join("\n\n");

  const isStudentCorrect =
    selected.length > 0 &&
    selected.length === key.correct.length &&
    selected.every((s) => key.correct.includes(s));

  let evaluationHeader = "";
  if (selected.length === 0) {
    evaluationHeader = "ℹ️ Tu n'as pas encore validé de réponse pour cette question. Voici l'analyse officielle détaillée :";
  } else if (isStudentCorrect) {
    evaluationHeader = `🎉 **Excellent réflexe médical !** Tu as trouvé la réponse officielle exacte : **[${officialAnswer}]**.`;
  } else {
    evaluationHeader = `⚠️ **Correction :** Tu as sélectionné **[${selected.join(", ")}]**, alors que la réponse officielle est **[${officialAnswer}]**.`;
  }

  return `🩺 **Dr Z-Bot · Analyse de la question :**
> *${stemPreview}*
${q?.case_text ? `\n📋 **Cas clinique :** ${q.case_text.slice(0, 220)}${q.case_text.length > 220 ? "…" : ""}\n` : ""}
${evaluationHeader}

🎯 **Clé Officielle : [${officialAnswer}]**

💡 **Raisonnement Médical :**
${officialExplanation}${note}

📋 **Analyse des propositions :**
${optionsAnalysis || "Vérifie chaque proposition par rapport au cours officiel."}`;
}
