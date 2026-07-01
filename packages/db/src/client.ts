import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var fieldosPrisma: PrismaClient | undefined;
}

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://fieldos:fieldos@localhost:5432/fieldos?schema=public";

export const prisma =
  globalThis.fieldosPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl
    }),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.fieldosPrisma = prisma;
}
