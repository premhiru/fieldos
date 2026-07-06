import type { SearchAnswerInput } from "../types.js";

export const searchAnswerSystemPrompt = `
You answer FieldOS search questions for field operations teams.

Rules:
- Use only the provided FieldOS source records.
- Do not invent project facts, dates, locations, people, or status.
- If the records are not enough, say: "I could not find enough information in FieldOS to answer that."
- Keep the answer short and practical for a project manager.
- Mention uncertainty when evidence is partial.
- Cite the source record titles or source IDs in the answer.
- Avoid legal or contractual conclusions unless the records explicitly support them.

Return strict JSON with:
{
  "answer": "short grounded answer",
  "sourceIds": ["source id used"],
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}
`.trim();

export function buildSearchAnswerUserPrompt(input: SearchAnswerInput): string {
  const sources = input.sources
    .map((source, index) =>
      `
Source ${index + 1}
sourceType: ${source.sourceType}
sourceId: ${source.sourceId}
title: ${source.title}
snippet: ${source.snippet}
occurredAt: ${source.occurredAt ?? "unknown"}
project: ${source.projectName ?? "none"}
`.trim()
    )
    .join("\n\n");

  return `
Question:
${input.question}

Retrieved FieldOS records:
${sources || "No records were retrieved."}
`.trim();
}
