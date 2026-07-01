import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
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
import { ZodError } from "zod";

import { apiEnv } from "./env.js";
import { conflict, forbidden, HttpError, notFound, unauthorized } from "./http.js";
import {
  createPrismaRepository,
  type AppRepository,
  type Role,
  type SafeUser
} from "./repository.js";
import {
  createOrganizationSchema,
  createProjectSchema,
  conversationParamsSchema,
  messageParamsSchema,
  organizationParamsSchema,
  projectParamsSchema
} from "./schemas.js";

const writableRoles = new Set<Role>(["OWNER", "ADMIN"]);

export interface BuildServerOptions {
  repository?: AppRepository;
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

  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Validation failed.",
        issues: error.issues
      });
    }

    if (error instanceof MessagingServiceError) {
      return reply.status(error.code === "NOT_FOUND" ? 404 : 403).send({
        error: error.message
      });
    }

    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: error.message
      });
    }

    server.log.error({ error }, "unhandled api error");
    return reply.status(500).send({
      error: "Internal server error."
    });
  });

  server.get("/", async () => ({
    service: "FieldOS API"
  }));

  server.get("/health", async () => ({
    status: "ok"
  }));

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

  server.addHook("onClose", async () => {
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

  return server;
}

function getCookieBaseOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: apiEnv.NODE_ENV === "production"
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
