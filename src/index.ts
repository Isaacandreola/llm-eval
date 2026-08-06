import { KeywordClassifier, AnthropicClassifier, type Classifier } from "./classifier";
import { dataset } from "./dataset";
import { evaluate } from "./evaluator";
import { formatReport } from "./report";

/** Limiar mínimo de accuracy. Abaixo disso, o processo sai com código 1. */
const THRESHOLD = Number(process.env.EVAL_THRESHOLD ?? "0.7");

/**
 * Limiar de macro-F1, o portão que realmente protege.
 *
 * Accuracy sozinha deixa passar o pior caso do mundo real: uma classe morta num
 * dataset desbalanceado. Com 70% dos casos em "suporte", um classificador que
 * nunca acerta "parceria" ainda passa no limiar de accuracy. No macro-F1, cada
 * classe pesa igual — a classe morta derruba a média e o build quebra.
 */
const F1_THRESHOLD = Number(process.env.EVAL_F1_THRESHOLD ?? "0.6");

function pickClassifier(): Classifier {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new AnthropicClassifier(key) : new KeywordClassifier();
}

async function main(): Promise<void> {
  const report = await evaluate(pickClassifier(), dataset);
  console.log(formatReport(report));

  // O ponto de um harness: virar um gate. Se a qualidade cai abaixo do limiar,
  // ele FALHA — como um teste. É assim que avaliação de IA entra num pipeline de
  // CI e para uma regressão antes de ir para produção.
  const reprovas: string[] = [];
  if (report.accuracy < THRESHOLD) {
    reprovas.push(
      `accuracy ${(report.accuracy * 100).toFixed(1)}% abaixo do limiar de ${(THRESHOLD * 100).toFixed(0)}%`,
    );
  }
  if (report.macroF1 < F1_THRESHOLD) {
    reprovas.push(
      `macro-F1 ${(report.macroF1 * 100).toFixed(1)}% abaixo do limiar de ${(F1_THRESHOLD * 100).toFixed(0)}%`,
    );
  }

  // Reporta TODAS as reprovações, não só a primeira: quem lê o log do CI deve
  // sair sabendo tudo que quebrou, não descobrir de uma em uma a cada rodada.
  if (reprovas.length) {
    for (const r of reprovas) console.error(`\n✗ ${r}`);
    process.exit(1);
  }
  console.log(
    `\n✓ accuracy ≥ ${(THRESHOLD * 100).toFixed(0)}% e macro-F1 ≥ ${(F1_THRESHOLD * 100).toFixed(0)}%`,
  );
}

main();
