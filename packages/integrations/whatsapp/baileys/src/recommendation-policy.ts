import type {
  Recommendation,
  RecommendationImpact,
  RecommendationType,
  WhatsAppRecommendationSetting
} from "@fieldos/db";

const highImpactActions = new Set([
  "COMPLETE_MILESTONE",
  "START_MILESTONE",
  "UPDATE_MILESTONE",
  "SEND_WHATSAPP_MESSAGE_DRAFT"
]);
const lowImpactActions = new Set(["MARK_PROGRESS_REVIEWED", "REVIEW_EVIDENCE"]);
const sensitivePattern =
  /personnel|disciplin|performance concern|safety investigation|commercial|pricing|variation|confidential|security|account credential/i;

export function recommendationImpact(
  action: Recommendation["proposedActionType"]
): RecommendationImpact {
  if (highImpactActions.has(action)) return "HIGH_IMPACT";
  if (lowImpactActions.has(action)) return "LOW_IMPACT";
  return "STANDARD";
}

export function isSensitiveRecommendation(
  recommendation: Pick<Recommendation, "description" | "reason" | "title" | "type">
): boolean {
  return sensitivePattern.test(
    `${recommendation.title} ${recommendation.description} ${recommendation.reason}`
  );
}

export function recommendationExpiresAt(
  priority: Recommendation["priority"],
  now = new Date()
): Date {
  const hours = priority === "URGENT" ? 24 : priority === "HIGH" ? 48 : 72;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export function settingAllowsRecommendation(
  setting: Pick<
    WhatsAppRecommendationSetting,
    "allowedRecommendationTypes" | "enabled" | "sendUrgentOnly"
  >,
  recommendation: Pick<Recommendation, "priority" | "type">
): boolean {
  if (!setting.enabled || (setting.sendUrgentOnly && recommendation.priority !== "URGENT")) {
    return false;
  }

  const allowed = Array.isArray(setting.allowedRecommendationTypes)
    ? setting.allowedRecommendationTypes.filter(
        (value): value is RecommendationType => typeof value === "string"
      )
    : [];
  return allowed.includes(recommendation.type);
}

export function isWithinQuietHours(
  setting: Pick<WhatsAppRecommendationSetting, "quietHoursEnd" | "quietHoursStart" | "timezone">,
  now = new Date()
): boolean {
  if (!setting.quietHoursStart || !setting.quietHoursEnd) return false;

  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: setting.timezone
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const current = hour * 60 + minute;
  const start = parseTime(setting.quietHoursStart);
  const end = parseTime(setting.quietHoursEnd);

  if (start === null || end === null || start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}
