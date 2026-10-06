import { z } from "zod";

export const SYNC_PAGE_SIZE = 100;
export const SYNC_MAX_MUTATIONS = 1000;

// Absolute URI syntax matches the reference sync protocol (RFC 3986).
const uriPattern =
  /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;

const id = z.string().min(1).max(512);
const pluginKey = z.strictObject({ sourceId: id });
const pluginPayload = z.strictObject({
  url: z.string().max(16384).regex(uriPattern),
  type: z.string().max(64),
});
const mangaKey = z.strictObject({ sourceId: id, mangaId: id });
const common = {
  operationId: z.string().min(1).max(128),
  datetime: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
};

export const latestChapterSchema = z.strictObject({
  id,
  title: z.string().max(1024).optional(),
  locked: z.boolean().optional(),
});
export type LatestChapter = z.infer<typeof latestChapterSchema>;

export const mutationSchema = z.union([
  z.strictObject({
    ...common,
    type: z.literal("plugin"),
    action: z.literal("upsert"),
    key: pluginKey,
    payload: pluginPayload,
  }),
  z.strictObject({
    ...common,
    type: z.literal("browsableplugin"),
    action: z.literal("upsert"),
    key: pluginKey,
    payload: pluginPayload,
  }),
  z.strictObject({
    ...common,
    type: z.literal("library"),
    action: z.literal("upsert"),
    key: mangaKey,
    payload: z.strictObject({
      updates: z.boolean(),
      latestChapter: latestChapterSchema,
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal("progress"),
    action: z.literal("upsert"),
    key: mangaKey,
    payload: z.strictObject({
      chapterId: id,
      chapterTitle: z.string().max(1024).nullable(),
      page: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal("plugin"),
    action: z.literal("delete"),
    key: pluginKey,
  }),
  z.strictObject({
    ...common,
    type: z.literal("browsableplugin"),
    action: z.literal("delete"),
    key: pluginKey,
  }),
  z.strictObject({
    ...common,
    type: z.enum(["library", "progress"]),
    action: z.literal("delete"),
    key: mangaKey,
  }),
  z.strictObject({
    ...common,
    type: z.literal("progress"),
    action: z.literal("clear"),
  }),
]);

export type Mutation = z.infer<typeof mutationSchema>;
type State<T> = T extends unknown ? Omit<T, "operationId"> : never;
export type Change = State<Mutation> & { revision: string };
export type Result = {
  operationId: string | null;
  status: "applied" | "ignored" | "invalid";
  revision?: string;
  current?: Change;
};
export type Target =
  | { type: "plugin" | "browsableplugin"; key: { sourceId: string } }
  | {
      type: "library" | "progress";
      key: { sourceId: string; mangaId: string };
    };

export const syncRequestSchema = z.strictObject({
  cursor: z.string().max(2048).nullable(),
  limit: z.number().int().min(1).max(SYNC_PAGE_SIZE).optional(),
  // Validate each mutation separately so invalid entries do not reject the batch.
  mutations: z.array(z.unknown()).max(SYNC_MAX_MUTATIONS),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;
export type SyncResponse = {
  results: Result[];
  changes: Change[];
  nextCursor: string;
  hasMore: boolean;
};

export class SyncError extends Error {}
export class SyncUnauthorizedError extends Error {}
