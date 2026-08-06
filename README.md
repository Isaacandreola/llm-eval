# 📊 llm-eval

**Um mini eval harness para saídas de LLM — que falha o CI quando a qualidade cai.**

"Como você sabe que seu sistema de IA funciona?" é a pergunta que separa quem faz demo de quem
faz produção. Este projeto é uma resposta: um harness que roda um classificador de LLM contra um
conjunto rotulado, mede **accuracy, precision/recall/F1 por classe, macro-F1 e matriz de
confusão**, e — o ponto — **sai com erro se a qualidade cair abaixo de um limiar**, do mesmo jeito
que um teste. É assim que avaliação de IA entra num pipeline de CI e barra uma regressão antes de
ir para produção.

```
Avaliação — keyword (heurístico)
────────────────────────────────────────────────────
Accuracy geral: 78.6%  (11/14)  ████████████████░░░░
Macro-F1:       78.6%  (cada classe pesa igual)  ████████████████░░░░

  classe       prec  recall      F1   acertos / casos
  compra     100.0%   75.0%   85.7%   3/4
  suporte    100.0%   75.0%   85.7%   3/4
  parceria   100.0%   75.0%   85.7%   3/4
  outro       40.0%  100.0%   57.1%   2/2  ← previu 5×, existem 2

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

**E recall sozinho também engana.** Um classificador que responde `suporte` para tudo tem recall
**100%** em suporte — e é inútil. Por isso entrou **precision**: das vezes que ele previu esta
classe, quantas estavam certas. O **F1** é a média harmônica das duas, escolhida porque a
harmônica pune o desequilíbrio e a aritmética não: 100% de recall com 33% de precision dá F1 de
50%, não de 66%.

**Isso achou um problema aqui mesmo, na primeira execução.** Repare no `outro` da saída acima:
recall 100%, precision **40%**, previsto **5 vezes quando só existem 2 casos**. É a *classe-imã* —
o balde de fallback que absorve o que as outras três não pegaram. Com o relatório antigo, só de
recall, ela era a única classe com nota perfeita. Era a pior.

---

## Uso como gate de CI

O harness sai com **código 1** quando qualquer um dos dois limiares reprova:

| Variável | Padrão | O que protege |
|---|---|---|
| `EVAL_THRESHOLD` | 70% | accuracy geral |
| `EVAL_F1_THRESHOLD` | 60% | **macro-F1** — média do F1 das classes, cada uma pesando igual |

O segundo é o que realmente segura. Num dataset com 80% dos casos em `suporte`, um classificador
que **nunca** acerta `parceria` ainda passa no limiar de accuracy — 80% é maior que 70%. No
macro-F1 a classe morta puxa a média para baixo e o build quebra. Esse caso exato é um
[teste](tests/evaluator.test.ts), não uma afirmação de README.

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
