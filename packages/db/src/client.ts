import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var fieldosPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.fieldosPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL
    }),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.fieldosPrisma = prisma;
}
