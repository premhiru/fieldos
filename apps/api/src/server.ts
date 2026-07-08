import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { RedisWhatsAppQrStore, type WhatsAppQrStore } from "@fieldos/baileys-whatsapp/qr-store";
import {
  AUTH_COOKIE_NAME,
  hashPassword,
  loginSchema,
  sessionDurationSeconds,
  signSessionToken,
  signupSchema,
  verifyPassword,
  verifySessionToken
} from "@fieldos/auth";
import {
  AIConfigurationError,
  SearchAnswerGenerator,
  type SearchAnswerInput,
  type SearchAnswerResult
} from "@fieldos/ai";
import {
  ProjectIntelligenceService,
  weeklyReportToMarkdown,
  weeklyReportToPdfBuffer
} from "@fieldos/intelligence";
import {
  AttachmentService,
  ConversationService,
  createAttachmentSchema,
  createConversationSchema,
  createMessageSchema,
  listConversationsSchema,
  MessageService,
  MessagingServiceError
} from "@fieldos/messaging";
import fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { Redis } from "ioredis";
import { ZodError } from "zod";
import {
  createStorageProvider,
  LocalStorageProvider,
  StorageAccessError,
  type StorageProvider
} from "@fieldos/shared";

import { apiEnv } from "./env.js";
import { conflict, forbidden, HttpError, notFound, unauthorized } from "./http.js";
import {
  createPrismaRepository,
  type AppRepository,
  type ProjectReportRecord,
  type Role,
  type SafeUser
} from "./repository.js";
import {
  activateWhatsAppChatMappingSchema,
  adminOperationsQuerySchema,
  createOrganizationSchema,
  createProjectSchema,
  conversationParamsSchema,
  createWhatsAppAccountSchema,
  dashboardQuerySchema,
  evidenceParamsSchema,
  generateProjectReportSchema,
  mediaParamsSchema,
  mediaQuerySchema,
  messageParamsSchema,
  organizationParamsSchema,
  paginationQuerySchema,
  photoAnalysisParamsSchema,
  processingJobParamsSchema,
  projectParamsSchema,
  projectSearchAskSchema,
  reportFormatQuerySchema,
  actionItemParamsSchema,
  searchAskSchema,
  searchQuerySchema,
  updateWhatsAppChatMappingSchema,
  whatsappAccountParamsSchema,
  whatsappAccountsQuerySchema,
  whatsappChatMappingParamsSchema
} from "./schemas.js";

const writableRoles = new Set<Role>(["OWNER", "ADMIN"]);

export interface BuildServerOptions {
  qrStore?: WhatsAppQrStore;
  repository?: AppRepository;
  searchAnswerer?: {
    answer(input: SearchAnswerInput): Promise<SearchAnswerResult>;
  };
  storageProvider?: StorageProvider;
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: SafeUser;
  }
}

export function buildServer(options: BuildServerOptions = {}) {
  const repository = options.repository ?? createPrismaRepository();
  const conversationService = new ConversationService(repository);
  const messageService = new MessageService(repository);
  const attachmentService = new AttachmentService(repository);
  const searchAnswerer = options.searchAnswerer ?? new SearchAnswerGenerator();
  const projectIntelligenceService = new ProjectIntelligenceService();
  const storageProvider =
    options.storageProvider ??
    createStorageProvider({
      local: {
        rootPath: apiEnv.WHATSAPP_STORAGE_PATH,
        signingSecret: apiEnv.MEDIA_SIGNING_SECRET ?? apiEnv.JWT_SECRET
      },
      storage: apiEnv
    });
  const qrRedis = options.qrStore ? null : new Redis(apiEnv.REDIS_URL, { lazyConnect: true });
  const qrStore = options.qrStore ?? new RedisWhatsAppQrStore(qrRedis as Redis);
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  server.register(cookie);
  server.register(cors, {
    credentials: true,
    origin: apiEnv.CORS_ORIGIN
  });

  server.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_FAILED",
          message: "Validation failed."
        },
        requestId: request.id,
        issues: error.issues
      });
    }

    if (error instanceof MessagingServiceError) {
      return reply.status(error.code === "NOT_FOUND" ? 404 : 403).send({
        error: {
          code: error.code,
          message: error.message
        },
        requestId: request.id
      });
    }

    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: {
          code: statusCodeToErrorCode(error.statusCode),
          message: error.message
        },
        requestId: request.id
      });
    }

    server.log.error({ error, requestId: request.id }, "unhandled api error");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error."
      },
      requestId: request.id
    });
  });

  server.get("/", async () => ({
    service: "FieldOS API"
  }));

  server.get("/health", async () => ({
    status: "ok"
  }));

  server.get("/media/:token", async (request, reply) => {
    const params = mediaParamsSchema.parse(request.params);
    const query = mediaQuerySchema.parse(request.query);

    if (!(storageProvider instanceof LocalStorageProvider)) {
      throw notFound("Media provider does not support signed local URLs.");
    }

    try {
      const key = storageProvider.verifySignedToken({
        expires: query.expires,
        signature: query.signature,
        token: params.token
      });
      const data = await storageProvider.download(key);

      reply.header("content-type", inferContentType(key));
      reply.header("cache-control", "private, max-age=60");
      return reply.send(data);
    } catch (error) {
      if (error instanceof StorageAccessError) {
        throw forbidden(error.message);
      }

      throw notFound("Media not found.");
    }
  });

  server.post("/auth/signup", async (request, reply) => {
    const body = signupSchema.parse(request.body);
    const email = normalizeEmail(body.email);
    const existingUser = await repository.findUserByEmail(email);

    if (existingUser) {
      throw conflict("A user with this email already exists.");
    }

    const user = await repository.createUser({
      email,
      name: body.name.trim(),
      passwordHash: await hashPassword(body.password)
    });

    setAuthCookie(reply, user);

    return {
      user
    };
  });

  server.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await repository.findUserByEmail(normalizeEmail(body.email));

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password.");
    }

    const safeUser = toSafeUser(user);
    setAuthCookie(reply, safeUser);

    return {
      user: safeUser
    };
  });

  server.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE_NAME, getCookieBaseOptions());

    return {
      ok: true
    };
  });

  server.get("/auth/me", { preHandler: requireAuth }, async (request) => ({
    user: request.currentUser
  }));

  server.get("/organizations", { preHandler: requireAuth }, async (request) => ({
    organizations: await repository.listOrganizations(requireCurrentUser(request).id)
  }));

  server.post("/organizations", { preHandler: requireAuth }, async (request) => {
    const body = createOrganizationSchema.parse(request.body);
    const user = requireCurrentUser(request);

    return {
      organization: await repository.createOrganization({
        name: body.name,
        ownerUserId: user.id,
        slug: body.slug
      })
    };
  });

  server.get("/organizations/:organizationId", { preHandler: requireAuth }, async (request) => {
    const params = organizationParamsSchema.parse(request.params);
    const organization = await repository.getOrganizationForUser(
      requireCurrentUser(request).id,
      params.organizationId
    );

    if (!organization) {
      throw notFound("Organization not found.");
    }

    return {
      organization
    };
  });

  server.get("/dashboard", { preHandler: requireAuth }, async (request) => {
    const dashboard = await getDashboardForRequest(request);

    return {
      dashboard
    };
  });

  server.get("/dashboard/summary", { preHandler: requireAuth }, async (request) => {
    const dashboard = await getDashboardForRequest(request);

    return {
      summary: dashboard.summary
    };
  });

  server.get("/dashboard/projects", { preHandler: requireAuth }, async (request) => {
    const dashboard = await getDashboardForRequest(request);

    return {
      projects: dashboard.projects
    };
  });

  server.get("/dashboard/action-items", { preHandler: requireAuth }, async (request) => {
    const dashboard = await getDashboardForRequest(request);

    return {
      actionItems: dashboard.actionItems
    };
  });

  server.get("/dashboard/recent-activity", { preHandler: requireAuth }, async (request) => {
    const dashboard = await getDashboardForRequest(request);

    return {
      recentActivity: dashboard.recentActivity
    };
  });

  server.get("/dashboard/brief", { preHandler: requireAuth }, async (request) => {
    const dashboard = await getDashboardForRequest(request);

    return {
      brief: dashboard.brief
    };
  });

  server.get("/admin/operations", { preHandler: requireAuth }, async (request) => {
    const query = adminOperationsQuerySchema.parse(request.query);
    await requireAdminOrganizationMembership(requireCurrentUser(request).id, query.organizationId);

    return {
      operations: await repository.getAdminOperations(query.organizationId)
    };
  });

  server.get("/admin/jobs", { preHandler: requireAuth }, async (request) => {
    const query = adminOperationsQuerySchema.parse(request.query);
    await requireAdminOrganizationMembership(requireCurrentUser(request).id, query.organizationId);

    return {
      jobs: await repository.listProcessingJobs(query.organizationId)
    };
  });

  server.post("/admin/jobs/:id/retry", { preHandler: requireAuth }, async (request) => {
    const params = processingJobParamsSchema.parse(request.params);
    const job = await repository.getProcessingJob(params.id);

    if (!job) {
      throw notFound("Processing job not found.");
    }

    await requireAdminOrganizationMembership(requireCurrentUser(request).id, job.organizationId);

    return {
      job: await repository.retryProcessingJob(params.id)
    };
  });

  server.post("/admin/jobs/retry-failed", { preHandler: requireAuth }, async (request) => {
    const query = adminOperationsQuerySchema.parse(request.query);
    await requireAdminOrganizationMembership(requireCurrentUser(request).id, query.organizationId);

    return {
      retried: await repository.retryFailedProcessingJobs(query.organizationId)
    };
  });

  server.get("/admin/workers", { preHandler: requireAuth }, async (request) => {
    const query = adminOperationsQuerySchema.parse(request.query);
    await requireAdminOrganizationMembership(requireCurrentUser(request).id, query.organizationId);

    return {
      workers: await repository.listWorkerHeartbeats()
    };
  });

  server.get("/search", { preHandler: requireAuth }, async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const user = requireCurrentUser(request);
    await requireOrganizationMembership(user.id, query.organizationId);
    await validateMappingProject(user.id, query.organizationId, query.projectId ?? null);

    const results = await repository.searchDocuments({
      cursor: query.cursor ?? null,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      limit: query.limit,
      organizationId: query.organizationId,
      projectId: query.projectId ?? null,
      query: query.q,
      sourceType: query.type ?? null
    });

    return results;
  });

  server.post("/search/ask", { preHandler: requireAuth }, async (request) => {
    const body = searchAskSchema.parse(request.body);
    const user = requireCurrentUser(request);
    await requireOrganizationMembership(user.id, body.organizationId);
    await validateMappingProject(user.id, body.organizationId, body.projectId ?? null);

    return answerSearchQuestion({
      organizationId: body.organizationId,
      projectId: body.projectId ?? null,
      question: body.question
    });
  });

  server.get(
    "/organizations/:organizationId/projects",
    { preHandler: requireAuth },
    async (request) => {
      const params = organizationParamsSchema.parse(request.params);
      const user = requireCurrentUser(request);
      const membership = await repository.findMembership(user.id, params.organizationId);

      if (!membership) {
        throw notFound("Organization not found.");
      }

      return {
        projects: await repository.listProjects(user.id, params.organizationId)
      };
    }
  );

  server.post(
    "/organizations/:organizationId/projects",
    { preHandler: requireAuth },
    async (request) => {
      const params = organizationParamsSchema.parse(request.params);
      const body = createProjectSchema.parse(request.body);
      const user = requireCurrentUser(request);
      const membership = await repository.findMembership(user.id, params.organizationId);

      if (!membership) {
        throw notFound("Organization not found.");
      }

      if (!writableRoles.has(membership.role)) {
        throw forbidden();
      }

      return {
        project: await repository.createProject({
          code: body.code,
          name: body.name,
          organizationId: params.organizationId,
          status: body.status
        })
      };
    }
  );

  server.get("/projects/:projectId", { preHandler: requireAuth }, async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const project = await repository.findProjectForUser(
      requireCurrentUser(request).id,
      params.projectId
    );

    if (!project) {
      throw notFound("Project not found.");
    }

    return {
      project
    };
  });

  server.post("/projects/:projectId/search/ask", { preHandler: requireAuth }, async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = projectSearchAskSchema.parse(request.body);
    const project = await repository.findProjectForUser(
      requireCurrentUser(request).id,
      params.projectId
    );

    if (!project) {
      throw notFound("Project not found.");
    }

    return answerSearchQuestion({
      organizationId: project.organizationId,
      projectId: project.id,
      question: body.question
    });
  });

  server.get(
    "/projects/:projectId/ai-classifications",
    { preHandler: requireAuth },
    async (request) => {
      const params = projectParamsSchema.parse(request.params);
      const project = await repository.findProjectForUser(
        requireCurrentUser(request).id,
        params.projectId
      );

      if (!project) {
        throw notFound("Project not found.");
      }

      return {
        classifications: await repository.listProjectAIClassifications(params.projectId)
      };
    }
  );

  server.get("/projects/:projectId/action-items", { preHandler: requireAuth }, async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const project = await repository.findProjectForUser(
      requireCurrentUser(request).id,
      params.projectId
    );

    if (!project) {
      throw notFound("Project not found.");
    }

    return {
      actionItems: await repository.listProjectActionItems(params.projectId)
    };
  });

  server.get(
    "/projects/:projectId/photo-analysis",
    { preHandler: requireAuth },
    async (request) => {
      const params = projectParamsSchema.parse(request.params);
      const query = paginationQuerySchema.parse(request.query);
      const project = await repository.findProjectForUser(
        requireCurrentUser(request).id,
        params.projectId
      );

      if (!project) {
        throw notFound("Project not found.");
      }

      return repository.listProjectPhotoAnalyses({
        cursor: query.cursor ?? null,
        limit: query.limit,
        projectId: params.projectId
      });
    }
  );

  server.get("/projects/:projectId/intelligence", { preHandler: requireAuth }, async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const project = await requireProjectForRequest(request, params.projectId);
    const context = await repository.getProjectIntelligenceContext(project.id);

    if (!context) {
      throw notFound("Project intelligence context not found.");
    }

    const weeklyReport = projectIntelligenceService.generateWeeklyReport(context);
    const latestReport = await repository.getLatestProjectReport({
      projectId: project.id,
      type: "WEEKLY_PROGRESS"
    });

    return {
      intelligence: {
        dailySummary: projectIntelligenceService.generateDailySummary(context),
        morningBrief: projectIntelligenceService.generateMorningBrief(context),
        pendingDecisions: projectIntelligenceService.generatePendingDecisions(context),
        riskSummary: projectIntelligenceService.generateRiskSummary(context),
        weeklyReport
      },
      latestReport: latestReport ? await withReportSignedUrl(request, latestReport) : null
    };
  });

  server.get("/projects/:projectId/morning-brief", { preHandler: requireAuth }, async (request) => {
    const context = await getProjectIntelligenceContextForRequest(request);

    return {
      morningBrief: projectIntelligenceService.generateMorningBrief(context)
    };
  });

  server.get("/projects/:projectId/daily-summary", { preHandler: requireAuth }, async (request) => {
    const context = await getProjectIntelligenceContextForRequest(request);

    return {
      dailySummary: projectIntelligenceService.generateDailySummary(context)
    };
  });

  server.get("/projects/:projectId/risks", { preHandler: requireAuth }, async (request) => {
    const context = await getProjectIntelligenceContextForRequest(request);

    return {
      risks: projectIntelligenceService.generateRiskSummary(context)
    };
  });

  server.get(
    "/projects/:projectId/pending-decisions",
    { preHandler: requireAuth },
    async (request) => {
      const context = await getProjectIntelligenceContextForRequest(request);

      return {
        pendingDecisions: projectIntelligenceService.generatePendingDecisions(context)
      };
    }
  );

  server.get(
    "/projects/:projectId/weekly-report",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = reportFormatQuerySchema.parse(request.query);
      const context = await getProjectIntelligenceContextForRequest(request);
      const weeklyReport = projectIntelligenceService.generateWeeklyReport(context);

      if (query.format === "markdown") {
        reply.header("content-type", "text/markdown; charset=utf-8");
        return reply.send(weeklyReportToMarkdown(weeklyReport));
      }

      if (query.format === "pdf") {
        reply.header("content-type", "application/pdf");
        reply.header(
          "content-disposition",
          `attachment; filename="${context.project.code.toLowerCase()}-weekly-report.pdf"`
        );
        return reply.send(weeklyReportToPdfBuffer(weeklyReport));
      }

      const latestReport = await repository.getLatestProjectReport({
        projectId: context.project.id,
        type: "WEEKLY_PROGRESS"
      });

      return {
        latestReport: latestReport ? await withReportSignedUrl(request, latestReport) : null,
        weeklyReport
      };
    }
  );

  server.post(
    "/projects/:projectId/reports/generate",
    { preHandler: requireAuth },
    async (request) => {
      const params = projectParamsSchema.parse(request.params);
      const body = generateProjectReportSchema.parse(request.body ?? {});
      const project = await requireProjectForRequest(request, params.projectId);

      return {
        report: await repository.queueProjectReport({
          projectId: project.id,
          type: body.type
        })
      };
    }
  );

  server.get("/conversations", { preHandler: requireAuth }, async (request) => {
    const query = listConversationsSchema.parse(request.query);
    const user = requireCurrentUser(request);

    return {
      conversations: await conversationService.listConversations(user.id, query)
    };
  });

  server.post("/conversations", { preHandler: requireAuth }, async (request) => {
    const body = createConversationSchema.parse(request.body);
    const user = requireCurrentUser(request);

    return {
      conversation: await conversationService.createConversation(user.id, body)
    };
  });

  server.get("/conversations/:id", { preHandler: requireAuth }, async (request) => {
    const params = conversationParamsSchema.parse(request.params);
    const user = requireCurrentUser(request);

    return {
      conversation: await conversationService.getConversation(user.id, params.id)
    };
  });

  server.get("/conversations/:id/messages", { preHandler: requireAuth }, async (request) => {
    const params = conversationParamsSchema.parse(request.params);
    const user = requireCurrentUser(request);

    return {
      messages: await messageService.listMessages(user.id, params.id)
    };
  });

  server.post("/messages", { preHandler: requireAuth }, async (request) => {
    const body = createMessageSchema.parse(request.body);
    const user = requireCurrentUser(request);

    return {
      message: await messageService.sendMessage(user.id, body)
    };
  });

  server.post("/attachments", { preHandler: requireAuth }, async (request) => {
    const body = createAttachmentSchema.parse(request.body);
    const user = requireCurrentUser(request);

    return {
      attachment: await attachmentService.addAttachment(user.id, body)
    };
  });

  server.delete("/messages/:id", { preHandler: requireAuth }, async (request) => {
    const params = messageParamsSchema.parse(request.params);
    const user = requireCurrentUser(request);

    return messageService.deleteMessage(user.id, params.id);
  });

  server.get("/messages/:id/classification", { preHandler: requireAuth }, async (request) => {
    const params = messageParamsSchema.parse(request.params);
    const context = await repository.findMessageContext(params.id);

    if (!context) {
      throw notFound("Message not found.");
    }

    await requireOrganizationMembership(requireCurrentUser(request).id, context.organizationId);

    return {
      classification: await repository.getMessageClassification(params.id)
    };
  });

  server.get("/messages/:id/context", { preHandler: requireAuth }, async (request) => {
    const params = messageParamsSchema.parse(request.params);
    const messageContext = await repository.findMessageContext(params.id);

    if (!messageContext) {
      throw notFound("Message not found.");
    }

    await requireOrganizationMembership(
      requireCurrentUser(request).id,
      messageContext.organizationId
    );

    return {
      context: await repository.getMessageEvidenceContext(params.id)
    };
  });

  server.get("/messages/:id/evidence-summary", { preHandler: requireAuth }, async (request) => {
    const params = messageParamsSchema.parse(request.params);
    const messageContext = await repository.findMessageContext(params.id);

    if (!messageContext) {
      throw notFound("Message not found.");
    }

    await requireOrganizationMembership(
      requireCurrentUser(request).id,
      messageContext.organizationId
    );

    return {
      evidenceSummary: await repository.getMessageEvidenceSummary(params.id)
    };
  });

  server.get("/photo-analysis/:id", { preHandler: requireAuth }, async (request) => {
    const params = photoAnalysisParamsSchema.parse(request.params);
    const analysis = await repository.getPhotoAnalysis(params.id);

    if (!analysis) {
      throw notFound("Photo analysis not found.");
    }

    await requireOrganizationMembership(requireCurrentUser(request).id, analysis.organizationId);

    return {
      analysis
    };
  });

  server.get("/evidence/:id/photo-analysis", { preHandler: requireAuth }, async (request) => {
    const params = evidenceParamsSchema.parse(request.params);
    const analysis = await repository.getPhotoAnalysisByEvidenceId(params.id);

    if (!analysis) {
      throw notFound("Photo analysis not found.");
    }

    await requireOrganizationMembership(requireCurrentUser(request).id, analysis.organizationId);

    return {
      analysis
    };
  });

  server.get("/evidence/:id/view", { preHandler: requireAuth }, async (request) => {
    const params = evidenceParamsSchema.parse(request.params);
    const evidence = await repository.getEvidenceView(params.id);

    if (!evidence) {
      throw notFound("Evidence not found.");
    }

    await requireOrganizationMembership(requireCurrentUser(request).id, evidence.organizationId);
    const signedUrl = await storageProvider.getSignedUrl({
      baseUrl: getRequestBaseUrl(request),
      expiresInSeconds: apiEnv.SIGNED_URL_TTL_SECONDS,
      key: evidence.storageKey
    });
    const publicEvidence: Partial<typeof evidence> = { ...evidence };
    delete publicEvidence.storageKey;

    return {
      evidence: {
        ...publicEvidence,
        signedUrl
      }
    };
  });

  server.post("/messages/:id/classify", { preHandler: requireAuth }, async (request) => {
    const params = messageParamsSchema.parse(request.params);
    const context = await repository.findMessageContext(params.id);

    if (!context) {
      throw notFound("Message not found.");
    }

    await requireOrganizationMembership(requireCurrentUser(request).id, context.organizationId);

    return {
      classification: await repository.enqueueMessageClassification(params.id)
    };
  });

  server.post("/action-items/:id/accept", { preHandler: requireAuth }, async (request) => {
    const params = actionItemParamsSchema.parse(request.params);
    const user = requireCurrentUser(request);
    const actionItem = await requireActionItemAccess(user.id, params.id);

    return {
      actionItem: await repository.acceptActionItem({
        actionItemId: actionItem.id,
        userId: user.id
      })
    };
  });

  server.post("/action-items/:id/complete", { preHandler: requireAuth }, async (request) => {
    const params = actionItemParamsSchema.parse(request.params);
    const user = requireCurrentUser(request);
    const actionItem = await requireActionItemAccess(user.id, params.id);

    return {
      actionItem: await repository.completeActionItem({
        actionItemId: actionItem.id,
        userId: user.id
      })
    };
  });

  server.post("/action-items/:id/ignore", { preHandler: requireAuth }, async (request) => {
    const params = actionItemParamsSchema.parse(request.params);
    const user = requireCurrentUser(request);
    const actionItem = await requireActionItemAccess(user.id, params.id);

    return {
      actionItem: await repository.ignoreActionItem({
        actionItemId: actionItem.id,
        userId: user.id
      })
    };
  });

  server.get("/whatsapp/accounts", { preHandler: requireAuth }, async (request) => {
    const query = whatsappAccountsQuerySchema.parse(request.query);
    const user = requireCurrentUser(request);
    await requireOrganizationMembership(user.id, query.organizationId);

    return {
      accounts: await repository.listWhatsAppAccounts(query.organizationId)
    };
  });

  server.post("/whatsapp/accounts", { preHandler: requireAuth }, async (request) => {
    const body = createWhatsAppAccountSchema.parse(request.body);
    const user = requireCurrentUser(request);
    await requireWritableOrganizationRole(user.id, body.organizationId);

    return {
      account: await repository.createWhatsAppAccount(body)
    };
  });

  server.get("/whatsapp/accounts/:id", { preHandler: requireAuth }, async (request) => {
    const params = whatsappAccountParamsSchema.parse(request.params);
    const account = await requireWhatsAppAccountAccess(requireCurrentUser(request).id, params.id);

    return {
      account
    };
  });

  server.post("/whatsapp/accounts/:id/connect", { preHandler: requireAuth }, async (request) => {
    const params = whatsappAccountParamsSchema.parse(request.params);
    const account = await requireWhatsAppAccountAccess(requireCurrentUser(request).id, params.id);
    await requireWritableOrganizationRole(requireCurrentUser(request).id, account.organizationId);

    return {
      account: await repository.rotateWhatsAppAccountSession(account.id)
    };
  });

  server.post("/whatsapp/accounts/:id/disconnect", { preHandler: requireAuth }, async (request) => {
    const params = whatsappAccountParamsSchema.parse(request.params);
    const account = await requireWhatsAppAccountAccess(requireCurrentUser(request).id, params.id);
    await requireWritableOrganizationRole(requireCurrentUser(request).id, account.organizationId);
    await qrStore.remove(account.id);

    return {
      account: await repository.updateWhatsAppAccountStatus(account.id, "DISCONNECTED")
    };
  });

  server.get("/whatsapp/accounts/:id/qr", { preHandler: requireAuth }, async (request) => {
    const params = whatsappAccountParamsSchema.parse(request.params);
    const account = await requireWhatsAppAccountAccess(requireCurrentUser(request).id, params.id);

    return {
      qr: await qrStore.get(account.id),
      status: account.status
    };
  });

  server.get("/whatsapp/accounts/:id/chats", { preHandler: requireAuth }, async (request) => {
    const params = whatsappAccountParamsSchema.parse(request.params);
    const account = await requireWhatsAppAccountAccess(requireCurrentUser(request).id, params.id);

    if (account.status !== "CONNECTED") {
      return {
        chats: []
      };
    }

    return {
      chats: await repository.listWhatsAppChatMappings(account.id)
    };
  });

  server.patch("/whatsapp/chat-mappings/:id", { preHandler: requireAuth }, async (request) => {
    const params = whatsappChatMappingParamsSchema.parse(request.params);
    const body = updateWhatsAppChatMappingSchema.parse(request.body);
    const user = requireCurrentUser(request);
    const mapping = await findWhatsAppChatMappingForUser(user.id, params.id);
    await requireWritableOrganizationRole(user.id, mapping.organizationId);

    await validateMappingProject(user.id, mapping.organizationId, body.projectId);

    return {
      chat: await repository.updateWhatsAppChatMapping({
        mappingId: params.id,
        projectId: body.projectId
      })
    };
  });

  server.post(
    "/whatsapp/chat-mappings/:id/activate",
    { preHandler: requireAuth },
    async (request) => {
      const params = whatsappChatMappingParamsSchema.parse(request.params);
      const body = activateWhatsAppChatMappingSchema.parse(request.body);
      const user = requireCurrentUser(request);
      const mapping = await findWhatsAppChatMappingForUser(user.id, params.id);
      await requireWritableOrganizationRole(user.id, mapping.organizationId);
      await validateMappingProject(user.id, mapping.organizationId, body.projectId);

      return {
        chat: await repository.activateWhatsAppChatMapping({
          activatedByUserId: user.id,
          mappingId: params.id,
          projectId: body.projectId
        })
      };
    }
  );

  server.post(
    "/whatsapp/chat-mappings/:id/ignore",
    { preHandler: requireAuth },
    async (request) => {
      const params = whatsappChatMappingParamsSchema.parse(request.params);
      const user = requireCurrentUser(request);
      const mapping = await findWhatsAppChatMappingForUser(user.id, params.id);
      await requireWritableOrganizationRole(user.id, mapping.organizationId);

      return {
        chat: await repository.ignoreWhatsAppChatMapping(params.id)
      };
    }
  );

  server.post(
    "/whatsapp/chat-mappings/:id/archive",
    { preHandler: requireAuth },
    async (request) => {
      const params = whatsappChatMappingParamsSchema.parse(request.params);
      const user = requireCurrentUser(request);
      const mapping = await findWhatsAppChatMappingForUser(user.id, params.id);
      await requireWritableOrganizationRole(user.id, mapping.organizationId);

      return {
        chat: await repository.archiveWhatsAppChatMapping(params.id)
      };
    }
  );

  server.addHook("onClose", async () => {
    if (qrRedis) {
      await qrRedis.quit();
    }

    await repository.disconnect();
  });

  async function requireAuth(request: FastifyRequest) {
    const token = request.cookies[AUTH_COOKIE_NAME];

    if (!token) {
      throw unauthorized();
    }

    try {
      const payload = verifySessionToken(token, apiEnv.JWT_SECRET);
      const user = await repository.findUserById(payload.sub);

      if (!user) {
        throw unauthorized();
      }

      request.currentUser = user;
    } catch {
      throw unauthorized();
    }
  }

  function setAuthCookie(reply: FastifyReply, user: SafeUser): void {
    reply.setCookie(AUTH_COOKIE_NAME, signSessionToken(user, apiEnv.JWT_SECRET), {
      ...getCookieBaseOptions(),
      maxAge: sessionDurationSeconds
    });
  }

  async function requireOrganizationMembership(userId: string, organizationId: string) {
    const membership = await repository.findMembership(userId, organizationId);

    if (!membership) {
      throw notFound("Organization not found.");
    }

    return membership;
  }

  async function requireWritableOrganizationRole(userId: string, organizationId: string) {
    const membership = await requireOrganizationMembership(userId, organizationId);

    if (!writableRoles.has(membership.role)) {
      throw forbidden();
    }

    return membership;
  }

  async function requireAdminOrganizationMembership(userId: string, organizationId: string) {
    const membership = await requireOrganizationMembership(userId, organizationId);

    if (!writableRoles.has(membership.role)) {
      throw forbidden("Only organization owners and admins can access operations health.");
    }

    return membership;
  }

  async function requireWhatsAppAccountAccess(userId: string, accountId: string) {
    const account = await repository.getWhatsAppAccount(accountId);

    if (!account) {
      throw notFound("WhatsApp account not found.");
    }

    await requireOrganizationMembership(userId, account.organizationId);
    return account;
  }

  async function findWhatsAppChatMappingForUser(userId: string, mappingId: string) {
    const mapping = await repository.getWhatsAppChatMapping(mappingId);

    if (!mapping) {
      throw notFound("WhatsApp chat mapping not found.");
    }

    await requireOrganizationMembership(userId, mapping.organizationId);
    return mapping;
  }

  async function requireActionItemAccess(userId: string, actionItemId: string) {
    const actionItem = await repository.getActionItem(actionItemId);

    if (!actionItem) {
      throw notFound("Action item not found.");
    }

    await requireOrganizationMembership(userId, actionItem.organizationId);
    return actionItem;
  }

  async function getDashboardForRequest(request: FastifyRequest) {
    const query = dashboardQuerySchema.parse(request.query);
    const user = requireCurrentUser(request);
    await requireOrganizationMembership(user.id, query.organizationId);

    return repository.getOperationsDashboard({
      organizationId: query.organizationId,
      userId: user.id
    });
  }

  async function requireProjectForRequest(request: FastifyRequest, projectId: string) {
    const project = await repository.findProjectForUser(requireCurrentUser(request).id, projectId);

    if (!project) {
      throw notFound("Project not found.");
    }

    return project;
  }

  async function getProjectIntelligenceContextForRequest(request: FastifyRequest) {
    const params = projectParamsSchema.parse(request.params);
    const project = await requireProjectForRequest(request, params.projectId);
    const context = await repository.getProjectIntelligenceContext(project.id);

    if (!context) {
      throw notFound("Project intelligence context not found.");
    }

    return context;
  }

  async function withReportSignedUrl(request: FastifyRequest, report: ProjectReportRecord) {
    return {
      ...report,
      pdfUrl: report.pdfStorageKey
        ? await storageProvider.getSignedUrl({
            baseUrl: getRequestBaseUrl(request),
            expiresInSeconds: apiEnv.SIGNED_URL_TTL_SECONDS,
            key: report.pdfStorageKey
          })
        : null
    };
  }

  async function answerSearchQuestion(input: {
    organizationId: string;
    projectId: string | null;
    question: string;
  }) {
    const search = await repository.searchDocuments({
      limit: 8,
      organizationId: input.organizationId,
      projectId: input.projectId,
      query: input.question,
      sourceType: null
    });

    if (search.results.length === 0) {
      return {
        answer: notEnoughInformationAnswer,
        confidence: "LOW",
        sources: []
      };
    }

    const sources = search.results.map((result) => ({
      occurredAt: result.occurredAt?.toISOString() ?? null,
      projectName: result.project?.name ?? null,
      snippet: result.snippet,
      sourceId: result.sourceId,
      sourceType: result.sourceType,
      title: result.title
    }));

    try {
      const answer = await searchAnswerer.answer({
        question: input.question,
        sources
      });
      const citedSourceIds = new Set(answer.sourceIds);
      const citedSources = sources.filter((source) => citedSourceIds.has(source.sourceId));

      return {
        answer: answer.answer,
        confidence: answer.confidence,
        sources: citedSources.length > 0 ? citedSources : sources
      };
    } catch (error) {
      if (!(error instanceof AIConfigurationError)) {
        server.log.warn({ error }, "search answer generation failed");
      }

      return {
        answer: buildDeterministicSearchAnswer(input.question, sources),
        confidence: "MEDIUM",
        sources
      };
    }
  }

  async function validateMappingProject(
    userId: string,
    organizationId: string,
    projectId: string | null
  ) {
    if (!projectId) {
      return;
    }

    const project = await repository.findProjectForUser(userId, projectId);

    if (!project || project.organizationId !== organizationId) {
      throw notFound("Project not found.");
    }
  }

  return server;
}

const notEnoughInformationAnswer = "I could not find enough information in FieldOS to answer that.";

function getRequestBaseUrl(request: FastifyRequest): string {
  const forwardedProtocol = headerValue(request.headers["x-forwarded-proto"]);
  const forwardedHost = headerValue(request.headers["x-forwarded-host"]);
  const host = forwardedHost ?? request.headers.host ?? "localhost:3001";
  const protocol = forwardedProtocol ?? (apiEnv.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`;
}

function headerValue(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return null;
  }

  return rawValue.split(",")[0]?.trim() || null;
}

function inferContentType(key: string): string {
  const normalized = key.toLowerCase();

  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  if (normalized.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (normalized.endsWith(".ogg")) {
    return "audio/ogg";
  }

  if (normalized.endsWith(".mp3")) {
    return "audio/mpeg";
  }

  if (normalized.endsWith(".mp4")) {
    return "video/mp4";
  }

  return "application/octet-stream";
}

function buildDeterministicSearchAnswer(
  question: string,
  sources: Array<{
    occurredAt: string | null;
    projectName: string | null;
    snippet: string;
    sourceId: string;
    sourceType: string;
    title: string;
  }>
): string {
  const summary = sources
    .slice(0, 3)
    .map((source) => `${source.title}: ${source.snippet}`)
    .join(" ");

  return `I found ${sources.length} FieldOS source${sources.length === 1 ? "" : "s"} related to "${question}". ${summary}`;
}

function getCookieBaseOptions() {
  const isProduction = apiEnv.NODE_ENV === "production";

  return {
    httpOnly: true,
    path: "/",
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction
  };
}

function requireCurrentUser(request: FastifyRequest): SafeUser {
  if (!request.currentUser) {
    throw unauthorized();
  }

  return request.currentUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSafeUser(user: SafeUser): SafeUser {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    updatedAt: user.updatedAt
  };
}

function statusCodeToErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    default:
      return "ERROR";
  }
}
