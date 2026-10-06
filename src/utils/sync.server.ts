import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, lte, sql, type SQL } from "drizzle-orm";
import type db from "#/lib/db.server.ts";
import {
  user,
  syncAccount as accounts,
  syncPlugin as plugins,
  syncBrowsablePlugin as browsablePlugins,
  syncLibrary as library,
  syncProgress as progress,
} from "#/db/schema.ts";
import {
  mutationSchema,
  SYNC_PAGE_SIZE,
  SyncError,
  SyncUnauthorizedError,
  type Change,
  type Mutation,
  type Result,
  type SyncRequest,
  type SyncResponse,
  type Target,
} from "#/utils/syncProtocol.ts";

type Cursor = { account: string; after: number };

const targetKey = (target: Target) =>
  JSON.stringify([
    target.type,
    target.key.sourceId,
    "mangaId" in target.key ? target.key.mangaId : null,
  ]);

type Metadata = { revision: number; datetime: number };

const metadata = (row: Metadata) => ({
  revision: String(row.revision),
  datetime: row.datetime,
});

function pluginChange(
  row: typeof plugins.$inferSelect,
  type: "plugin" | "browsableplugin",
): Change {
  const base = {
    ...metadata(row),
    type,
    key: { sourceId: row.sourceId },
  };

  return row.deleted
    ? { ...base, action: "delete" }
    : {
        ...base,
        action: "upsert",
        payload: { url: row.url!, type: row.type! },
      };
}

function libraryChange(row: typeof library.$inferSelect): Change {
  const base = {
    ...metadata(row),
    type: "library" as const,
    key: { sourceId: row.sourceId, mangaId: row.mangaId },
  };

  return row.deleted
    ? { ...base, action: "delete" }
    : {
        ...base,
        action: "upsert",
        payload: { updates: row.updates!, latestChapter: row.latestChapter! },
      };
}

function progressChange(row: typeof progress.$inferSelect): Change {
  const base = {
    ...metadata(row),
    type: "progress" as const,
    key: { sourceId: row.sourceId, mangaId: row.mangaId },
  };

  return row.deleted
    ? { ...base, action: "delete" }
    : {
        ...base,
        action: "upsert",
        payload: {
          chapterId: row.chapterId!,
          chapterTitle: row.chapterTitle,
          page: row.page!,
        },
      };
}

function clearChange(state: typeof accounts.$inferSelect): Change | undefined {
  if (state.progressClearRevision === null) return;

  return {
    revision: String(state.progressClearRevision),
    datetime: state.progressClearDatetime!,
    type: "progress",
    action: "clear",
  };
}

export function createSyncStore(
  database: Pick<typeof db, "transaction">,
  secret: string,
) {
  // Signing ties the cursor to its account and prevents clients from changing the revision.
  const signature = (value: string) =>
    createHmac("sha256", secret).update(`cursor:${value}`).digest();

  const encodeCursor = (account: string, after: number) => {
    const value = Buffer.from(
      JSON.stringify({ account, after } satisfies Cursor),
    ).toString("base64url");

    return `${value}.${signature(value).toString("base64url")}`;
  };

  const decodeCursor = (token: string, account: string): Cursor => {
    try {
      const parts = token.split(".");
      const [value, mac] = parts;

      if (parts.length !== 2 || !value || !mac) throw new Error();

      const expected = signature(value);
      const actual = Buffer.from(mac, "base64url");

      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        throw new Error();

      const cursor = JSON.parse(Buffer.from(value, "base64url").toString());

      if (
        !cursor ||
        cursor.account !== account ||
        !Number.isSafeInteger(cursor.after) ||
        cursor.after < 0
      )
        throw new Error();

      return cursor;
    } catch {
      throw new SyncError("Invalid cursor, bootstrap with cursor: null");
    }
  };

  async function sync(
    account: string,
    request: SyncRequest,
  ): Promise<SyncResponse> {
    return database.transaction(async (tx) => {
      // Serialize syncs for this user, including the first write to an empty account.
      const [activeUser] = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, account), eq(user.isActive, true)))
        .for("update");
      if (!activeUser) throw new SyncUnauthorizedError("Unauthorized");
      const after =
        request.cursor === null
          ? 0
          : decodeCursor(request.cursor, account).after;

      // Clients send epoch milliseconds; validate the integer without altering it.
      const mutations = request.mutations.map(
        (input): Mutation | undefined => mutationSchema.safeParse(input).data,
      );

      const keys = {
        plugin: [] as string[],
        browsableplugin: [] as string[],
        library: [] as SQL[],
        progress: [] as SQL[],
      };

      for (const mutation of mutations) {
        if (!mutation || mutation.action === "clear") continue;

        if (mutation.type === "plugin" || mutation.type === "browsableplugin")
          keys[mutation.type].push(mutation.key.sourceId);
        else
          keys[mutation.type].push(
            sql`(${mutation.key.sourceId}, ${mutation.key.mangaId})`,
          );
      }

      // Match each source/manga pair together, rather than unrelated combinations of IDs.
      const matchKeys = (
        table: typeof library | typeof progress,
        pairs: SQL[],
      ) =>
        pairs.length
          ? sql`(${table.sourceId}, ${table.mangaId}) in (${sql.join(pairs, sql`, `)})`
          : sql`false`;

      // First read: account metadata and all mutation targets in one SQL statement.
      const loaded = await tx.query.syncAccount.findFirst({
        where: { account },
        with: {
          plugins: { where: { sourceId: { in: keys.plugin } } },
          browsablePlugins: {
            where: { sourceId: { in: keys.browsableplugin } },
          },
          library: {
            where: { RAW: (table) => matchKeys(table, keys.library) },
          },
          progress: {
            where: { RAW: (table) => matchKeys(table, keys.progress) },
          },
        },
      });

      const state: typeof accounts.$inferSelect = loaded ?? {
        account,
        revision: 0,
        progressClearDatetime: null,
        progressClearRevision: null,
      };

      if (after > state.revision)
        throw new SyncError("Invalid cursor, bootstrap with cursor: null");

      // This map lives only for this sync and tracks earlier writes in the same batch.
      const currentRows = new Map<string, Change>();

      for (const change of [
        ...(loaded?.plugins ?? []).map((row) => pluginChange(row, "plugin")),
        ...(loaded?.browsablePlugins ?? []).map((row) =>
          pluginChange(row, "browsableplugin"),
        ),
        ...(loaded?.library ?? []).map(libraryChange),
        ...(loaded?.progress ?? []).map(progressChange),
      ]) {
        if (change.action !== "clear")
          currentRows.set(targetKey(change), change);
      }

      const current = (target: Target): Change | undefined => {
        const row = currentRows.get(targetKey(target));
        const clear =
          target.type === "progress" ? clearChange(state) : undefined;

        // A clear also rejects late progress whose keys were absent when it ran.
        if (
          target.type === "progress" &&
          clear &&
          (!row || row.datetime <= clear.datetime)
        ) {
          return {
            revision: clear.revision,
            datetime: clear.datetime,
            type: "progress",
            action: "delete",
            key: target.key,
          };
        }

        return row;
      };

      const nextRevision = async () => {
        state.revision += 1;

        await tx
          .insert(accounts)
          .values({ account, revision: state.revision })
          .onConflictDoUpdate({
            target: accounts.account,
            set: { revision: state.revision },
          });

        return state.revision;
      };

      const applyMutation = async (
        input: unknown,
        index: number,
      ): Promise<Result> => {
        const operationId =
          input &&
          typeof input === "object" &&
          "operationId" in input &&
          typeof input.operationId === "string" &&
          input.operationId.length > 0 &&
          input.operationId.length <= 128
            ? input.operationId
            : null;

        const mutation = mutations[index];

        if (!mutation) return { operationId, status: "invalid" };

        const target: Target | undefined =
          mutation.action === "clear"
            ? undefined
            : ({ type: mutation.type, key: mutation.key } as Target);

        const existing = target ? current(target) : clearChange(state);
        // Newer datetimes win; ties favor deletes. Identical retries remain ignored.
        const wins =
          !existing ||
          mutation.datetime > existing.datetime ||
          (mutation.datetime === existing.datetime &&
            mutation.action === "delete" &&
            existing.action === "upsert");

        if (!wins)
          return {
            operationId,
            status: "ignored",
            revision: existing!.revision,
            ...(target ? { current: existing } : {}),
          };

        const revision = await nextRevision();

        if (mutation.action === "clear") {
          state.progressClearDatetime = mutation.datetime;
          state.progressClearRevision = revision;

          await tx
            .update(accounts)
            .set({
              progressClearDatetime: state.progressClearDatetime,
              progressClearRevision: state.progressClearRevision,
            })
            .where(eq(accounts.account, account));

          // The retained clear marker covers these keys, so old progress rows can be removed.
          await tx
            .delete(progress)
            .where(
              and(
                eq(progress.account, account),
                lte(progress.datetime, mutation.datetime),
              ),
            );
        } else {
          const base = {
            account,
            sourceId: mutation.key.sourceId,
            revision,
            datetime: mutation.datetime,
            deleted: mutation.action === "delete",
          };

          if (
            mutation.type === "plugin" ||
            mutation.type === "browsableplugin"
          ) {
            const table =
              mutation.type === "plugin" ? plugins : browsablePlugins;
            const row = {
              ...base,
              url: mutation.action === "upsert" ? mutation.payload.url : null,
              type: mutation.action === "upsert" ? mutation.payload.type : null,
            };

            await tx
              .insert(table)
              .values(row)
              .onConflictDoUpdate({
                target: [table.account, table.sourceId],
                set: row,
              });
          } else if (mutation.type === "library") {
            const row = {
              ...base,
              mangaId: mutation.key.mangaId,
              updates:
                mutation.action === "upsert" ? mutation.payload.updates : null,
              latestChapter:
                mutation.action === "upsert"
                  ? mutation.payload.latestChapter
                  : null,
            };

            await tx
              .insert(library)
              .values(row)
              .onConflictDoUpdate({
                target: [library.account, library.sourceId, library.mangaId],
                set: row,
              });
          } else {
            const row = {
              ...base,
              mangaId: mutation.key.mangaId,
              chapterId:
                mutation.action === "upsert"
                  ? mutation.payload.chapterId
                  : null,
              chapterTitle:
                mutation.action === "upsert"
                  ? mutation.payload.chapterTitle
                  : null,
              page: mutation.action === "upsert" ? mutation.payload.page : null,
            };

            await tx
              .insert(progress)
              .values(row)
              .onConflictDoUpdate({
                target: [progress.account, progress.sourceId, progress.mangaId],
                set: row,
              });
          }

          const { operationId: _operationId, ...change } = mutation;
          currentRows.set(targetKey(mutation), {
            ...change,
            revision: String(revision),
          });
        }

        return { operationId, status: "applied", revision: String(revision) };
      };

      const results: Result[] = [];
      for (const [index, input] of request.mutations.entries()) {
        results.push(await applyMutation(input, index));
      }

      const limit = request.limit ?? SYNC_PAGE_SIZE;

      // Second read: fetch current rows after uploads have been merged.
      // limit+1 per table is enough to find the next global page and detect hasMore.
      const pageState =
        state.revision === 0
          ? undefined
          : await tx.query.syncAccount.findFirst({
              columns: { account: true },
              where: { account },
              with: {
                plugins: {
                  where: { revision: { gt: after } },
                  orderBy: { revision: "asc" },
                  limit: limit + 1,
                },
                browsablePlugins: {
                  where: { revision: { gt: after } },
                  orderBy: { revision: "asc" },
                  limit: limit + 1,
                },
                library: {
                  where: { revision: { gt: after } },
                  orderBy: { revision: "asc" },
                  limit: limit + 1,
                },
                progress: {
                  where: { revision: { gt: after } },
                  orderBy: { revision: "asc" },
                  limit: limit + 1,
                },
              },
            });

      const pending = [
        ...(pageState?.plugins ?? []).map((row) => pluginChange(row, "plugin")),
        ...(pageState?.browsablePlugins ?? []).map((row) =>
          pluginChange(row, "browsableplugin"),
        ),
        ...(pageState?.library ?? []).map(libraryChange),
        ...(pageState?.progress ?? []).map(progressChange),
      ];

      const clear = clearChange(state);
      if (clear && Number(clear.revision) > after) pending.push(clear);

      pending.sort((a, b) => Number(a.revision) - Number(b.revision));
      const page = pending.slice(0, limit);

      return {
        results,
        changes: page,
        // Upload results never advance the cursor past rows that have not been delivered.
        nextCursor: encodeCursor(
          account,
          page.length
            ? Number(page[page.length - 1]!.revision)
            : state.revision,
        ),
        hasMore: pending.length > limit,
      };
    });
  }

  return { sync };
}
