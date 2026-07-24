import { KeywordClassifier, AnthropicClassifier, type Classifier } from "./classifier";
import { dataset } from "./dataset";
import { evaluate } from "./evaluator";
import { formatReport } from "./report";

/** Limiar mínimo de accuracy. Abaixo disso, o processo sai com código 1. */
const THRESHOLD = Number(process.env.EVAL_THRESHOLD ?? "0.7");

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
  if (report.accuracy < THRESHOLD) {
    console.error(
      `\n✗ accuracy ${(report.accuracy * 100).toFixed(1)}% abaixo do limiar de ${(THRESHOLD * 100).toFixed(0)}%`,
    );
    process.exit(1);
  }
  console.log(`\n✓ acima do limiar de ${(THRESHOLD * 100).toFixed(0)}%`);
}

main();
