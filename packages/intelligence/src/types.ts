export type IntelligenceConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface IntelligenceSourceRef {
  id: string;
  label: string;
  type:
    | "ACTION_ITEM"
    | "AI_CLASSIFICATION"
    | "EVIDENCE"
    | "MESSAGE"
    | "PHOTO_ANALYSIS"
    | "TIMELINE_EVENT"
    | "MILESTONE";
  href?: string;
}

export interface IntelligenceBullet {
  text: string;
  sources: IntelligenceSourceRef[];
}

export interface IntelligenceRisk {
  confidence: IntelligenceConfidence;
  explanation: string;
  mitigation: string;
  sources: IntelligenceSourceRef[];
  title: string;
}

export interface PendingDecision {
  category:
    | "APPROVAL_REQUIRED"
    | "CLIENT_FOLLOW_UP"
    | "HIGH_PRIORITY_ACTION_ITEM"
    | "INSPECTION_REVIEW"
    | "SUPPLIER_FOLLOW_UP";
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  sources: IntelligenceSourceRef[];
  title: string;
}

export interface ProjectIntelligenceContext {
  actionItems: Array<{
    createdAt: Date;
    description: string | null;
    id: string;
    messageId: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status: "ACCEPTED" | "COMPLETED" | "CONVERTED" | "IGNORED" | "PENDING";
    title: string;
    type: "FOLLOW_UP" | "PROJECT_SUGGESTION";
    updatedAt: Date;
  }>;
  classifications: Array<{
    actionRequired: boolean;
    category: string | null;
    confidence: number | null;
    createdAt: Date;
    id: string;
    location: string | null;
    messageId: string;
    reasoningSummary: string | null;
    status: string;
    summary: string | null;
    updatedAt: Date;
  }>;
  evidence: Array<{
    createdAt: Date;
    filename: string;
    id: string;
    messageId: string;
    mimeType: string;
    transcript: string | null;
    transcriptionStatus: string;
  }>;
  events: Array<{
    description: string | null;
    eventType: string;
    id: string;
    occurredAt: Date;
    sourceId: string;
    sourceType: string;
    title: string;
  }>;
  milestones: Array<{
    dueDate: Date;
    id: string;
    status: string;
    title: string;
  }>;
  photoAnalyses: Array<{
    confidence: number;
    createdAt: Date;
    detectedObjects: string[];
    evidenceId: string;
    id: string;
    possibleIssues: string[];
    summary: string;
    tags: string[];
  }>;
  project: {
    code: string;
    id: string;
    name: string;
    status: string;
  };
  generatedAt: Date;
}

export interface MorningBrief {
  bullets: IntelligenceBullet[];
  generatedAt: Date;
  title: string;
}

export interface DailySummary {
  actionItemsCreated: IntelligenceBullet[];
  approvalsReceived: IntelligenceBullet[];
  evidenceReceived: IntelligenceBullet[];
  inspectionsRequested: IntelligenceBullet[];
  issuesRaised: IntelligenceBullet[];
  timelineHighlights: IntelligenceBullet[];
  title: string;
  workCompleted: IntelligenceBullet[];
}

export interface WeeklyReport {
  appendix: {
    recentActionItems: IntelligenceBullet[];
    recentDocuments: IntelligenceBullet[];
    recentPhotos: IntelligenceBullet[];
  };
  completedWork: IntelligenceBullet[];
  executiveSummary: IntelligenceBullet[];
  generatedAt: Date;
  openRisks: IntelligenceRisk[];
  outstandingDecisions: PendingDecision[];
  progressThisWeek: IntelligenceBullet[];
  project: ProjectIntelligenceContext["project"];
  recentEvidence: IntelligenceBullet[];
  title: string;
  upcomingWork: IntelligenceBullet[];
}
