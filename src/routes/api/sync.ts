import { createFileRoute } from "@tanstack/react-router";

import db from "#/lib/db.server.ts";
import { apiLogger } from "#/lib/logger.server.ts";
import { apiAuthMiddleware } from "#/middleware/auth.ts";
import { getJwtSecret } from "#/utils/jwt.server.ts";
import {
  syncRequestSchema,
  SyncError,
  SyncUnauthorizedError,
} from "#/utils/syncProtocol.ts";
import { createSyncStore } from "#/utils/sync.server.ts";

export const Route = createFileRoute("/api/sync")({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const parsed = syncRequestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid sync request" },
            { status: 400 },
          );
        }

        try {
          const store = createSyncStore(db, getJwtSecret());
          return Response.json(await store.sync(context.userId, parsed.data));
        } catch (error) {
          if (error instanceof SyncUnauthorizedError) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          if (error instanceof SyncError) {
            return Response.json({ error: error.message }, { status: 400 });
          }
          apiLogger.error({ err: error }, "failed to sync user state");
          return Response.json(
            { error: "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
