import { prisma } from "@fieldos/db";
import fastify from "fastify";

export function buildServer() {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  server.get("/", async () => ({
    service: "FieldOS API"
  }));

  server.get("/health", async () => ({
    status: "ok"
  }));

  server.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return server;
}
