export type ProjectHealthStatus = "UNKNOWN" | "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL";

export interface ProjectHealthInput {
  hasAttentionSignal?: boolean;
  hasSafetyIssue?: boolean;
  highPriorityActionItemCount: number;
  lastActivityAt: Date | null;
  now?: Date;
  openActionItemCount: number;
  overdueMilestoneCount: number;
  urgentActionItemCount: number;
}

export interface ProjectHealthAssessment {
  reason: string;
  status: ProjectHealthStatus;
}

const attentionAfterMs = 48 * 60 * 60 * 1000;
const criticalAfterMs = 5 * 24 * 60 * 60 * 1000;

export function assessProjectHealth(input: ProjectHealthInput): ProjectHealthAssessment {
  if (!input.lastActivityAt) {
    return {
      reason: "No field activity has been recorded yet.",
      status: "UNKNOWN"
    };
  }

  if (input.hasSafetyIssue) {
    return {
      reason: "A safety-related update requires immediate review.",
      status: "CRITICAL"
    };
  }

  if (input.urgentActionItemCount > 0) {
    return {
      reason: `${formatCount(input.urgentActionItemCount, "urgent action item")} ${verb(input.urgentActionItemCount, "requires", "require")} immediate attention.`,
      status: "CRITICAL"
    };
  }

  if (input.overdueMilestoneCount >= 2) {
    return {
      reason: `${formatCount(input.overdueMilestoneCount, "milestone")} ${verb(input.overdueMilestoneCount, "is", "are")} overdue.`,
      status: "CRITICAL"
    };
  }

  const now = input.now ?? new Date();
  const lastActivityAgeMs = now.getTime() - input.lastActivityAt.getTime();

  if (lastActivityAgeMs >= criticalAfterMs) {
    return {
      reason: "No meaningful project activity has been recorded for five days.",
      status: "CRITICAL"
    };
  }

  if (input.highPriorityActionItemCount > 0) {
    return {
      reason: `${formatCount(input.highPriorityActionItemCount, "high-priority action item")} ${verb(input.highPriorityActionItemCount, "needs", "need")} review.`,
      status: "NEEDS_ATTENTION"
    };
  }

  if (input.overdueMilestoneCount > 0) {
    return {
      reason: `${formatCount(input.overdueMilestoneCount, "milestone")} ${verb(input.overdueMilestoneCount, "is", "are")} overdue.`,
      status: "NEEDS_ATTENTION"
    };
  }

  if (input.hasAttentionSignal) {
    return {
      reason: "A recent field update needs review.",
      status: "NEEDS_ATTENTION"
    };
  }

  if (input.openActionItemCount > 0) {
    return {
      reason: `${formatCount(input.openActionItemCount, "open action item")} ${verb(input.openActionItemCount, "needs", "need")} follow-up.`,
      status: "NEEDS_ATTENTION"
    };
  }

  if (lastActivityAgeMs >= attentionAfterMs) {
    return {
      reason: "No meaningful project activity has been recorded for two days.",
      status: "NEEDS_ATTENTION"
    };
  }

  return {
    reason: "Recent activity shows no open high-priority concerns.",
    status: "HEALTHY"
  };
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function verb(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
