export type WhatsAppRecommendationCommand =
  | { type: "APPROVE" }
  | { type: "REJECT" }
  | { type: "DETAILS" }
  | { days: 1 | 3 | 7; type: "SNOOZE" }
  | { reference: string; type: "CONFIRM" }
  | { reference: string; type: "CANCEL" }
  | { reason: string; type: "REASON" }
  | { type: "JOIN" };

const recommendationReferencePattern = /^REC-[A-Z0-9]{4,16}$/;

export function parseWhatsAppRecommendationCommand(
  body: string | null | undefined
): WhatsAppRecommendationCommand | null {
  const raw = body?.trim();

  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/\s+/g, " ").toUpperCase();

  if (normalized === "APPROVE") return { type: "APPROVE" };
  if (/^APPROVE REC-[A-Z0-9]{4,16}$/.test(normalized)) return { type: "APPROVE" };
  if (normalized === "REJECT") return { type: "REJECT" };
  if (normalized === "DETAILS") return { type: "DETAILS" };
  if (normalized === "JOIN") return { type: "JOIN" };
  if (normalized === "SNOOZE 1 DAY") return { days: 1, type: "SNOOZE" };
  if (normalized === "SNOOZE 3 DAYS") return { days: 3, type: "SNOOZE" };
  if (normalized === "SNOOZE 1 WEEK") return { days: 7, type: "SNOOZE" };

  const confirmation = /^(CONFIRM|CANCEL) (REC-[A-Z0-9]{4,16})$/.exec(normalized);
  if (
    confirmation?.[1] &&
    confirmation[2] &&
    recommendationReferencePattern.test(confirmation[2])
  ) {
    return {
      reference: confirmation[2],
      type: confirmation[1] as "CANCEL" | "CONFIRM"
    };
  }

  const reason = /^REASON:\s*(.+)$/i.exec(raw)?.[1]?.trim();
  if (reason) {
    return { reason: reason.slice(0, 500), type: "REASON" };
  }

  return null;
}

export function recommendationReference(recommendationId: string): string {
  const safe = recommendationId
    .replace(/[^a-z0-9]/gi, "")
    .slice(-8)
    .toUpperCase();
  return `REC-${safe.padStart(4, "0")}`;
}
