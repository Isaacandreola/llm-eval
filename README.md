# 📊 llm-eval

**Um mini eval harness para saídas de LLM — que falha o CI quando a qualidade cai.**

"Como você sabe que seu sistema de IA funciona?" é a pergunta que separa quem faz demo de quem
faz produção. Este projeto é uma resposta: um harness que roda um classificador de LLM contra um
conjunto rotulado, mede **accuracy, recall por classe e matriz de confusão**, e — o ponto —
**sai com erro se a qualidade cair abaixo de um limiar**, do mesmo jeito que um teste. É assim
que avaliação de IA entra num pipeline de CI e barra uma regressão antes de ir para produção.

```
Avaliação — keyword (heurístico)
────────────────────────────────────────────────────
Accuracy geral: 78.6%  (11/14)  ████████████████░░░░

Recall por classe:
  compra      75.0%  ███████████████░░░░░  3/4
  suporte     75.0%  ███████████████░░░░░  3/4
  parceria    75.0%  ███████████████░░░░░  3/4
  outro      100.0%  ████████████████████  2/2

Casos que falharam (3):
  ✗ "Vi que subiram o valor, não sei se vale continuar."
     esperado suporte, veio outro
  ...
```

*(saída real de `bun run eval` — roda sem chave de API)*

---

## Por que isto importa

Um harness só prova o que vale quando é capaz de **flagrar erro**. O conjunto de avaliação inclui
casos ambíguos de propósito — mensagens onde a intenção **não está na palavra óbvia**. O
classificador heurístico da demo acerta os casos fáceis e **erra exatamente esses três**. É o
harness fazendo seu trabalho: mostrar onde o sistema é frágil, com evidência, não com achismo.

**Accuracy sozinha engana.** Com classes desbalanceadas, um número alto pode esconder uma classe
que o modelo nunca acerta. Por isso o relatório traz **recall por classe** e a **matriz de
confusão** — o recorte que revela o problema que a média esconde.

---

## Uso como gate de CI

O harness sai com **código 1** quando a accuracy fica abaixo de `EVAL_THRESHOLD` (padrão 70%).
No [workflow de CI](.github/workflows/ci.yml), isso vira um portão: um prompt ou modelo que
regrida a qualidade **quebra o build**, igual a um teste unitário que falha.

```bash
bun install
bun run eval        # roda a avaliação e imprime o relatório (sem chave)
bun test            # testa a matemática das métricas de forma determinística
bun run typecheck   # TypeScript strict, zero erros
```

Para avaliar o **Claude de verdade** contra o mesmo conjunto, defina `ANTHROPIC_API_KEY`.

---

## Decisões de projeto

- **O classificador é plugável** ([`Classifier`](src/classifier.ts)): heurístico, Claude, ou o
  que for. O harness avalia a interface, não um modelo específico.
- **As métricas são testadas** ([`tests/evaluator.test.ts`](tests/evaluator.test.ts)) com um
  classificador de respostas fixas. As métricas são o produto deste projeto — elas mesmas
  precisam de teste, e não podem depender de um LLM para serem verificadas.
- **A saída do LLM é restringida** ao conjunto de categorias válidas; se o modelo foge do
  combinado, cai em `outro`. A saída de um LLM nunca é garantida — o código trata isso.

---

## Stack

TypeScript (strict) · Bun · `bun test` · GitHub Actions (com eval gate)

## Estrutura

```
src/
  types.ts        o domínio (Intent, Case, Prediction)
  classifier.ts   interface + heurístico + Claude
  dataset.ts      o conjunto rotulado, com casos ambíguos
  evaluator.ts    roda os casos e computa as métricas  ← o coração
  report.ts       formata o relatório de terminal
  index.ts        CLI + o gate de limiar
tests/            testes determinísticos das métricas
```

---

## Licença

MIT
