import type { Case, Intent, Prediction } from "./types";
import { INTENTS } from "./types";
import type { Classifier } from "./classifier";

/** Métricas por classe. `recall` = dos casos desta classe, quantos foram acertados. */
export interface ClassMetric {
  total: number;
  correct: number;
  recall: number;
}

export interface Report {
  classifier: string;
  predictions: Prediction[];
  total: number;
  correct: number;
  accuracy: number;
  perClass: Record<Intent, ClassMetric>;
  /** Matriz de confusão: chave "esperado>previsto" → contagem. */
  confusion: Record<string, number>;
  failures: Prediction[];
}

/**
 * Roda o classificador contra todos os casos e agrega as métricas.
 *
 * "Accuracy" sozinha engana quando as classes são desbalanceadas — por isso o
 * relatório também traz recall por classe e a matriz de confusão. Um
 * classificador pode ter 80% de accuracy e mesmo assim ser inútil para uma
 * classe específica; só o recorte por classe revela isso.
 */
export async function evaluate(classifier: Classifier, cases: Case[]): Promise<Report> {
  const predictions: Prediction[] = [];
  for (const c of cases) {
    const predicted = await classifier.classify(c.text);
    predictions.push({ case: c, predicted, correct: predicted === c.expected });
  }

  const perClass = Object.fromEntries(
    INTENTS.map((intent): [Intent, ClassMetric] => {
      const ofClass = predictions.filter((p) => p.case.expected === intent);
      const correct = ofClass.filter((p) => p.correct).length;
      return [
        intent,
        { total: ofClass.length, correct, recall: ofClass.length ? correct / ofClass.length : 0 },
      ];
    }),
  ) as Record<Intent, ClassMetric>;

  const confusion: Record<string, number> = {};
  for (const p of predictions) {
    if (p.correct) continue;
    const key = `${p.case.expected}>${p.predicted}`;
    confusion[key] = (confusion[key] ?? 0) + 1;
  }

  const correct = predictions.filter((p) => p.correct).length;

  return {
    classifier: classifier.name,
    predictions,
    total: predictions.length,
    correct,
    accuracy: predictions.length ? correct / predictions.length : 0,
    perClass,
    confusion,
    failures: predictions.filter((p) => !p.correct),
  };
}
