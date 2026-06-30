import { createLogger } from "@fieldos/shared";

import { apiEnv } from "./env.js";
import { buildServer } from "./server.js";

const logger = createLogger("fieldos-api");
const server = buildServer();

async function start() {
  await server.listen({ host: "0.0.0.0", port: apiEnv.PORT });
}

async function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, "shutting down api");
  await server.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    shutdown(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ error }, "api shutdown failed");
        process.exit(1);
      });
  });
}

start().catch((error: unknown) => {
  logger.error({ error }, "api startup failed");
  process.exit(1);
});
