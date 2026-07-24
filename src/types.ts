/** As categorias que o classificador tenta prever. Fechadas de propósito. */
export type Intent = "compra" | "suporte" | "parceria" | "outro";

export const INTENTS: readonly Intent[] = ["compra", "suporte", "parceria", "outro"];

/** Um caso rotulado: um texto e a resposta certa. É o "gabarito". */
export interface Case {
  text: string;
  expected: Intent;
}

/** O que o classificador previu para um caso, e se acertou. */
export interface Prediction {
  case: Case;
  predicted: Intent;
  correct: boolean;
}
