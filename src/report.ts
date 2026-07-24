import type { Report } from "./evaluator";
import { INTENTS } from "./types";

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

function bar(ratio: number, width = 20): string {
  const filled = Math.round(ratio * width);
  return "█".repeat(filled) + c.dim("░".repeat(width - filled));
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Formata um Report como um relatório de terminal legível. */
export function formatReport(r: Report): string {
  const lines: string[] = [];
  const rule = "─".repeat(52);

  lines.push("");
  lines.push(c.bold(`Avaliação — ${r.classifier}`));
  lines.push(rule);
  lines.push(`Accuracy geral: ${c.bold(pct(r.accuracy))}  (${r.correct}/${r.total})  ${bar(r.accuracy)}`);
  lines.push("");
  lines.push("Recall por classe:");
  for (const intent of INTENTS) {
    const m = r.perClass[intent];
    const color = m.recall === 1 ? c.green : m.recall >= 0.5 ? (s: string) => s : c.red;
    lines.push(`  ${intent.padEnd(10)} ${color(pct(m.recall).padStart(6))}  ${bar(m.recall)}  ${c.dim(`${m.correct}/${m.total}`)}`);
  }

  if (Object.keys(r.confusion).length) {
    lines.push("");
    lines.push("Confusões (esperado → previsto):");
    for (const [key, count] of Object.entries(r.confusion).sort((a, b) => b[1] - a[1])) {
      const [exp, pred] = key.split(">");
      lines.push(`  ${c.dim(exp!)} → ${c.red(pred!)}  ${c.dim(`×${count}`)}`);
    }
  }

  if (r.failures.length) {
    lines.push("");
    lines.push(`Casos que falharam (${r.failures.length}):`);
    for (const f of r.failures) {
      lines.push(`  ${c.red("✗")} "${f.case.text}"`);
      lines.push(`     esperado ${c.green(f.case.expected)}, veio ${c.red(f.predicted)}`);
    }
  }

  lines.push(rule);
  return lines.join("\n");
}
