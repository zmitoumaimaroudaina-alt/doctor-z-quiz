import { getBundledKey, getBundledQuestion } from "./medicalData";
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
  const q = customQ || getBundledQuestion(questionId);
  const key = customOfficial || getBundledKey(questionId);

  const officialAnswer = (key.correct || []).join(", ") || "A";
  const clinicalDeduction = q?.stem ? deduceClinicalContext(q.stem) : "";
  const officialExplanation =
    key.explanation && key.explanation.trim().length > 5
      ? key.explanation
      : clinicalDeduction;
  const note = key.note ? `\n📌 **Remarque de cours :** ${key.note}` : "";

  // Follow-up interaction
  if (userPrompt && userPrompt.trim().length > 0) {
    const p = userPrompt.toLowerCase();
    if (p.includes("pourquoi") || p.includes("pourquoi pas") || p.includes("علاش")) {
      return `🩺 **Dr Z-Bot (Réponse ciblée) :**
Concernant ta question : "*${userPrompt}*"

Dans ce QCM, la clé officielle retenue par la commission pédagogique est **[${officialAnswer}]**.
${officialExplanation}

💡 **Point clé pour le jour J :**
Dans les examens de notre faculté, une proposition contenant un terme absolu ("toujours", "dans 100% des cas", "exclut formellement") est très fréquemment fausse. Vérifie toujours les critères de certitude par rapport aux probabilités cliniques.

Saha ftourek / bon courage pour tes révisions !`;
    }
    if (p.includes("différence") || p.includes("فرق")) {
      return `🩺 **Dr Z-Bot (Distinction sémiologique) :**
Excellente question sur le diagnostic différentiel !
Le piège classique ici repose sur la distinction entre signe pathognomonique et signe d'orientation :
- La proposition **[${officialAnswer}]** est la seule à répondre rigoureusement aux critères formels de l'examen.
${officialExplanation}

Garde toujours cette hiérarchie clinique en tête ! 💪`;
    }
  }

  // Option-by-option detailed breakdown
  const options = q?.options as { key: string; text: string }[] | undefined;
  const optionsAnalysis = (options || []).map((o) => {
    const isCorrect = key.correct.includes(o.key);
    const wasChosen = selected.includes(o.key);

    let status = isCorrect ? "✅ [PROPOSITION VRAIE]" : "❌ [PROPOSITION FAUSSE]";
    let comment = isCorrect
      ? "Répond fidèlement aux données du cours officiel."
      : "Piège ou proposition cliniquement inexacte.";

    if (wasChosen && isCorrect) {
      status += " 👈 (Bravo, ton choix est exact !)";
    } else if (wasChosen && !isCorrect) {
      status += " 👈 (Attention, tu as coché ce piège !)";
      comment = "Ce choix est un distracteur classique qui ne respecte pas les critères d'évaluation.";
    } else if (!wasChosen && isCorrect) {
      status += " ⚠️ (Attention, tu as manqué cette bonne réponse !)";
    }

    return `• **Option ${o.key} : "${o.text}"**\n  ↳ ${status}\n  ↳ *${comment}*`;
  }).join("\n\n");

  const isStudentCorrect =
    selected.length > 0 &&
    selected.length === key.correct.length &&
    selected.every((s) => key.correct.includes(s));

  let evaluationHeader = "";
  if (selected.length === 0) {
    evaluationHeader = "ℹ️ Tu n'as pas encore validé de réponse pour cette question. Voici l'analyse officielle détaillée :";
  } else if (isStudentCorrect) {
    evaluationHeader = `🎉 **Excellent réflexe médical !** Tu as trouvé la réponse officielle exacte : **[${officialAnswer}]**. Ton raisonnement clinique est parfaitement aligné avec le cours.`;
  } else {
    evaluationHeader = `⚠️ **Erreur diagnostique / Piège d'examen :**\nTu as sélectionné **[${selected.join(", ")}]**, alors que la réponse officielle validée par la Faculté de Médecine de Blida 1 est **[${officialAnswer}]**.`;
  }

  return `Salam ! 🩺 **Dr Z-Bot · Explication Médicale Interactive**

${evaluationHeader}

---

🎯 **Clé Officielle de la Faculté : [${officialAnswer}]**

💡 **Raisonnement Clinique & Physiopathologique :**
${officialExplanation}${note}

📋 **Analyse détaillée de chaque proposition :**
${optionsAnalysis || "Chaque proposition a été auditée selon le syllabus médical officiel."}

---

🧠 **La Perle du Dr. Z (Memo Pratique) :**
*"À la Faculté de Médecine de Blida 1, la rigueur terminologique sauve des vies et garantit vos points. Révisez toujours le mécanisme sous-jacent avant de trancher !"*

✨ *ركز مليح، الطب يحتاج دقة وتركيز والتوفيق حليفك دائماً إن شاء الله !*`;
}
