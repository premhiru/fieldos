import { z } from "zod";

export const organizationParamsSchema = z.object({
  organizationId: z.string().min(1)
});

export const invitationParamsSchema = z.object({
  token: z.string().min(32).max(256)
});

export const organizationInvitationParamsSchema = z.object({
  invitationId: z.string().min(1),
  organizationId: z.string().min(1)
});

export const organizationMembershipParamsSchema = z.object({
  membershipId: z.string().min(1),
  organizationId: z.string().min(1)
});

const teamRoleSchema = z.enum(["ADMIN", "MEMBER", "VIEWER"]);

export const createTeamInvitationSchema = z.object({
  email: z.string().trim().email(),
  projectIds: z.array(z.string().trim().min(1)).max(100).default([]),
  role: teamRoleSchema
});

export const updateTeamMemberSchema = z.object({
  projectIds: z.array(z.string().trim().min(1)).max(100).default([]),
  role: teamRoleSchema
});

export const adminOperationsQuerySchema = z.object({
  organizationId: z.string().trim().min(1)
});

export const processingJobParamsSchema = z.object({
  id: z.string().min(1)
});

export const projectParamsSchema = z.object({
  projectId: z.string().min(1)
});

export const conversationParamsSchema = z.object({
  id: z.string().min(1)
});

export const messageParamsSchema = z.object({
  id: z.string().min(1)
});

export const actionItemParamsSchema = z.object({
  id: z.string().min(1)
});

export const recommendationParamsSchema = z.object({
  id: z.string().min(1)
});

export const whatsappDraftParamsSchema = z.object({
  id: z.string().min(1)
});

export const notificationParamsSchema = z.object({
  id: z.string().min(1)
});

export const searchSourceTypeSchema = z.enum([
  "PROJECT",
  "MESSAGE",
  "TIMELINE_EVENT",
  "ACTION_ITEM",
  "AI_CLASSIFICATION",
  "PHOTO_ANALYSIS",
  "PROJECT_REPORT"
]);

export const photoAnalysisParamsSchema = z.object({
  id: z.string().min(1)
});

export const evidenceParamsSchema = z.object({
  id: z.string().min(1)
});

export const mediaParamsSchema = z.object({
  token: z.string().min(1)
});

export const mediaQuerySchema = z.object({
  expires: z.coerce.number().int().positive(),
  signature: z.string().trim().min(1)
});

export const reportFormatQuerySchema = z.object({
  format: z.enum(["json", "markdown", "pdf"]).default("json")
});

export const generateProjectReportSchema = z.object({
  type: z.enum(["WEEKLY_PROGRESS"]).default("WEEKLY_PROGRESS")
});

export const paginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const searchQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
  q: z.string().trim().max(500).default(""),
  type: searchSourceTypeSchema.optional()
});

export const searchAskSchema = z.object({
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).nullable().optional(),
  question: z.string().trim().min(1).max(500)
});

export const projectSearchAskSchema = z.object({
  question: z.string().trim().min(1).max(500)
});

export const whatsappAccountParamsSchema = z.object({
  id: z.string().min(1)
});

export const whatsappChatMappingParamsSchema = z.object({
  id: z.string().min(1)
});

export const whatsappAccountsQuerySchema = z.object({
  organizationId: z.string().trim().min(1)
});

export const dashboardQuerySchema = z.object({
  organizationId: z.string().trim().min(1)
});

export const recommendationsQuerySchema = z.object({
  organizationId: z.string().trim().min(1),
  status: z.enum(["PENDING", "APPROVED", "DISMISSED", "COMPLETED", "FAILED"]).optional()
});

export const dismissRecommendationSchema = z.object({
  dismissReason: z.string().trim().max(500).nullable().optional()
});

export const whatsappDraftsQuerySchema = z.object({
  organizationId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional()
});

export const updateWhatsAppDraftSchema = z.object({
  messageBody: z.string().trim().min(1).max(4000)
});

export const notificationsQuerySchema = z.object({
  organizationId: z.string().trim().min(1)
});

export const feedbackSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  organizationId: z.string().trim().min(1),
  page: z.string().trim().max(500).optional(),
  type: z.enum(["BUG", "FEATURE", "GENERAL"])
});

export const createWhatsAppAccountSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  organizationId: z.string().trim().min(1)
});

export const updateWhatsAppChatMappingSchema = z.object({
  projectId: z.string().trim().min(1).nullable()
});

export const activateWhatsAppChatMappingSchema = z.object({
  projectId: z.string().trim().min(1).nullable()
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.")
});

export const createProjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers, and hyphens."),
  name: z.string().trim().min(1).max(160),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).default("ACTIVE")
});
