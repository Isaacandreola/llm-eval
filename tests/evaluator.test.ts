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
