import type { Intent } from "./types";

/**
 * A fronteira do classificador. O harness avalia qualquer coisa que satisfaça
 * esta interface — um heurístico, um LLM, o que for. Mesmo princípio dos outros
 * projetos: o modelo é uma dependência plugável, não o produto.
 */
export interface Classifier {
  readonly name: string;
  classify(text: string): Promise<Intent>;
}

/**
 * Classificador heurístico (palavras-chave). Existe para o harness rodar sem
 * chave de API — e, de propósito, ele NÃO é perfeito. Um harness só prova o que
 * vale quando é capaz de flagrar erros; o relatório da demo mostra exatamente
 * onde este classificador erra.
 */
export class KeywordClassifier implements Classifier {
  readonly name = "keyword (heurístico)";

  async classify(text: string): Promise<Intent> {
    const t = text.toLowerCase();
    if (/parc|integr|revend|white.?label/.test(t)) return "parceria";
    if (/erro|problema|não funciona|bug|travou|reclama/.test(t)) return "suporte";
    if (/comprar|preço|orçamento|contratar|plano|assinar|quanto custa/.test(t)) return "compra";
    return "outro";
  }
}

/**
 * Classificador real usando Claude. Ativado quando ANTHROPIC_API_KEY existe.
 * Restringe a saída às categorias válidas — e cai em "outro" se o modelo fugir
 * do combinado, porque a saída de um LLM nunca é garantida.
 */
export class AnthropicClassifier implements Classifier {
  readonly name = "anthropic (claude)";

  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-sonnet-5",
  ) {}

  async classify(text: string): Promise<Intent> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 16,
        system:
          "Classifique a intenção da mensagem. Responda APENAS com uma palavra: " +
          "compra, suporte, parceria ou outro.",
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic API ${response.status}`);
    const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
    const raw = (data.content.find((b) => b.type === "text")?.text ?? "").trim().toLowerCase();

    return raw === "compra" || raw === "suporte" || raw === "parceria" ? raw : "outro";
  }
}
