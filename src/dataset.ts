import type { Case } from "./types";

/**
 * O conjunto de avaliação (o "gabarito"). Casos rotulados à mão, incluindo
 * alguns ambíguos de propósito — mensagens onde a intenção não está nas
 * palavras óbvias. São esses que separam um classificador bom de um frágil, e
 * é onde o heurístico da demo vai tropeçar.
 */
export const dataset: Case[] = [
  { text: "Quero comprar 200 unidades, qual o preço para atacado?", expected: "compra" },
  { text: "Gostaria de um orçamento para o plano anual.", expected: "compra" },
  { text: "Como faço para assinar? Quanto custa por mês?", expected: "compra" },
  { text: "O sistema travou e não consigo emitir nota.", expected: "suporte" },
  { text: "Estou com um problema no login, dá erro toda vez.", expected: "suporte" },
  { text: "O pedido não chegou e o cliente está reclamando.", expected: "suporte" },
  { text: "Temos interesse em uma parceria de revenda.", expected: "parceria" },
  { text: "Podemos integrar a API de vocês no nosso produto?", expected: "parceria" },
  { text: "Buscamos um acordo white-label para nossa base.", expected: "parceria" },
  { text: "Só passando para agradecer o atendimento de ontem.", expected: "outro" },
  { text: "Vocês ficam abertos no feriado?", expected: "outro" },

  // Ambíguos — a intenção não está na palavra óbvia:
  { text: "Vi que subiram o valor, não sei se vale continuar.", expected: "suporte" }, // sem "problema/erro"
  { text: "Meu concorrente usa vocês e recomendou muito.", expected: "compra" }, // interesse, sem "comprar/preço"
  { text: "Trabalho numa agência e atendo vários clientes do setor.", expected: "parceria" }, // sem "parceria"
];
