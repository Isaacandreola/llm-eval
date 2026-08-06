import type { Case, Intent, Prediction } from "./types";
import { INTENTS } from "./types";
import type { Classifier } from "./classifier";

/**
 * Métricas por classe.
 *
 * `recall`    — dos casos DESTA classe, quantos foram acertados. Responde
 *               "o que eu deixei passar?".
 * `precision` — das vezes que previ ESTA classe, quantas estavam certas.
 *               Responde "quando eu digo isso, dá pra confiar?".
 * `f1`        — média harmônica das duas. Existe porque cada uma sozinha é
 *               trivial de enganar: um classificador que responde sempre
 *               "suporte" tem recall 1,0 em suporte e é inútil. A média
 *               harmônica pune o desequilíbrio, a aritmética não.
 */
export interface ClassMetric {
  total: number;
  correct: number;
  /** Quantas vezes o classificador PREVIU esta classe (denominador da precision). */
  predicted: number;
  recall: number;
  precision: number;
  f1: number;
}

export interface Report {
  classifier: string;
  predictions: Prediction[];
  total: number;
  correct: number;
  accuracy: number;
  perClass: Record<Intent, ClassMetric>;
  /**
   * Média simples do F1 das classes — cada classe pesa igual, independente de
   * quantos casos tem. É a métrica honesta quando o dataset é desbalanceado:
   * accuracy alta com uma classe morta passa despercebida, aqui não.
   */
  macroF1: number;
  /** Matriz de confusão: chave "esperado>previsto" → contagem. */
  confusion: Record<string, number>;
  failures: Prediction[];
}

/** Média harmônica. Zero quando ambos são zero — e não NaN, que quebraria o gate. */
function harmonica(precision: number, recall: number): number {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
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
      const asPredicted = predictions.filter((p) => p.predicted === intent);
      const correct = ofClass.filter((p) => p.correct).length;

      // Sem casos da classe, recall é indefinido — vira 0 em vez de NaN, senão o
      // macro-F1 inteiro contamina e o gate para de funcionar em silêncio.
      const recall = ofClass.length ? correct / ofClass.length : 0;
      const precision = asPredicted.length ? correct / asPredicted.length : 0;

      return [
        intent,
        {
          total: ofClass.length,
          correct,
          predicted: asPredicted.length,
          recall,
          precision,
          f1: harmonica(precision, recall),
        },
      ];
    }),
  ) as Record<Intent, ClassMetric>;

  const macroF1 = INTENTS.reduce((soma, i) => soma + perClass[i].f1, 0) / INTENTS.length;

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
    macroF1,
    confusion,
    failures: predictions.filter((p) => !p.correct),
  };
}
