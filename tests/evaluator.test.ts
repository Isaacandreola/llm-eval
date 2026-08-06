import { test, expect } from "bun:test";
import { evaluate } from "../src/evaluator";
import { KeywordClassifier } from "../src/classifier";
import type { Case, Intent } from "../src/types";
import type { Classifier } from "../src/classifier";

// Um classificador de teste que devolve respostas fixas, para verificar a
// MATEMÁTICA das métricas de forma determinística — sem depender de heurística
// nem de LLM. As métricas são o produto do harness; elas mesmas precisam de teste.
class FixedClassifier implements Classifier {
  readonly name = "fixed";
  constructor(private readonly answers: Intent[]) {}
  private i = 0;
  async classify(): Promise<Intent> {
    return this.answers[this.i++]!;
  }
}

test("calcula accuracy corretamente", async () => {
  const cases: Case[] = [
    { text: "a", expected: "compra" },
    { text: "b", expected: "suporte" },
    { text: "c", expected: "parceria" },
    { text: "d", expected: "outro" },
  ];
  // 3 de 4 certos (erra o último).
  const clf = new FixedClassifier(["compra", "suporte", "parceria", "compra"]);
  const r = await evaluate(clf, cases);

  expect(r.total).toBe(4);
  expect(r.correct).toBe(3);
  expect(r.accuracy).toBe(0.75);
  expect(r.failures).toHaveLength(1);
  expect(r.failures[0]?.case.expected).toBe("outro");
});

test("recall por classe isola o desempenho de cada categoria", async () => {
  const cases: Case[] = [
    { text: "a", expected: "suporte" },
    { text: "b", expected: "suporte" },
    { text: "c", expected: "compra" },
  ];
  // acerta os dois de suporte, erra o de compra
  const clf = new FixedClassifier(["suporte", "suporte", "suporte"]);
  const r = await evaluate(clf, cases);

  expect(r.perClass.suporte.recall).toBe(1); // 2/2
  expect(r.perClass.compra.recall).toBe(0); // 0/1
});

test("precision separa 'não deixei passar' de 'dá pra confiar'", async () => {
  const cases: Case[] = [
    { text: "a", expected: "suporte" },
    { text: "b", expected: "compra" },
    { text: "c", expected: "parceria" },
  ];
  // Responde "suporte" para tudo: pega o único caso de suporte que existe,
  // e chuta suporte nos outros dois.
  const clf = new FixedClassifier(["suporte", "suporte", "suporte"]);
  const r = await evaluate(clf, cases);

  // Recall PERFEITO em suporte — não deixou passar nenhum.
  expect(r.perClass.suporte.recall).toBe(1);
  // Mas previu suporte 3 vezes e só uma estava certa.
  expect(r.perClass.suporte.predicted).toBe(3);
  expect(r.perClass.suporte.precision).toBeCloseTo(1 / 3, 10);
  // F1 revela o que o recall escondeu.
  expect(r.perClass.suporte.f1).toBeCloseTo(0.5, 10);
});

test("macro-F1 derruba o classificador degenerado que a accuracy aprovaria", async () => {
  // Dataset desbalanceado de propósito: 8 de suporte, 1 de compra, 1 de parceria.
  const cases: Case[] = [
    ...Array.from({ length: 8 }, (_, i) => ({ text: `s${i}`, expected: "suporte" as const })),
    { text: "c", expected: "compra" },
    { text: "p", expected: "parceria" },
  ];
  const clf = new FixedClassifier(Array(10).fill("suporte") as Intent[]);
  const r = await evaluate(clf, cases);

  // Este é o ponto do teste: 80% de accuracy passaria num gate de 70%.
  expect(r.accuracy).toBe(0.8);
  // E o classificador não sabe fazer NADA além de repetir uma palavra.
  expect(r.perClass.compra.f1).toBe(0);
  expect(r.perClass.parceria.f1).toBe(0);
  // O macro-F1 é o que o reprova: ~0.22, muito abaixo de qualquer limiar útil.
  expect(r.macroF1).toBeLessThan(0.3);
});

test("classe sem casos vira zero, não NaN — senão contamina o macro-F1", async () => {
  const cases: Case[] = [{ text: "a", expected: "compra" }];
  const r = await evaluate(new FixedClassifier(["compra"]), cases);

  expect(r.perClass.parceria.total).toBe(0);
  expect(Number.isNaN(r.perClass.parceria.f1)).toBe(false);
  expect(r.perClass.parceria.f1).toBe(0);
  expect(Number.isNaN(r.macroF1)).toBe(false);
});

test("registra a matriz de confusão", async () => {
  const cases: Case[] = [{ text: "a", expected: "compra" }];
  const clf = new FixedClassifier(["suporte"]); // confundiu compra com suporte
  const r = await evaluate(clf, cases);

  expect(r.confusion["compra>suporte"]).toBe(1);
});

test("o classificador heurístico acerta os casos óbvios", async () => {
  const cases: Case[] = [
    { text: "quanto custa o plano?", expected: "compra" },
    { text: "deu erro no login", expected: "suporte" },
    { text: "queremos uma parceria de revenda", expected: "parceria" },
  ];
  const r = await evaluate(new KeywordClassifier(), cases);
  expect(r.accuracy).toBe(1);
});
