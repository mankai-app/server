CREATE TABLE "sync_account" (
	"user_id" text PRIMARY KEY,
	"revision" bigint DEFAULT 0 NOT NULL,
	"progress_clear_datetime" bigint,
	"progress_clear_revision" bigint
);
--> statement-breakpoint
CREATE TABLE "sync_library" (
	"user_id" text,
	"source_id" text,
	"revision" bigint NOT NULL,
	"datetime" bigint NOT NULL,
	"deleted" boolean NOT NULL,
	"manga_id" text,
	"updates" boolean,
	"latest_chapter" jsonb,
	CONSTRAINT "sync_library_pkey" PRIMARY KEY("user_id","source_id","manga_id")
);
--> statement-breakpoint
CREATE TABLE "sync_plugin" (
	"user_id" text,
	"source_id" text,
	"revision" bigint NOT NULL,
	"datetime" bigint NOT NULL,
	"deleted" boolean NOT NULL,
	"url" text,
	CONSTRAINT "sync_plugin_pkey" PRIMARY KEY("user_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "sync_progress" (
	"user_id" text,
	"source_id" text,
	"revision" bigint NOT NULL,
	"datetime" bigint NOT NULL,
	"deleted" boolean NOT NULL,
	"manga_id" text,
	"chapter_id" text,
	"chapter_title" text,
	"page" bigint,
	CONSTRAINT "sync_progress_pkey" PRIMARY KEY("user_id","source_id","manga_id")
);
--> statement-breakpoint
CREATE INDEX "sync_library_revision_idx" ON "sync_library" ("user_id","revision");--> statement-breakpoint
CREATE INDEX "sync_plugin_revision_idx" ON "sync_plugin" ("user_id","revision");--> statement-breakpoint
CREATE INDEX "sync_progress_revision_idx" ON "sync_progress" ("user_id","revision");--> statement-breakpoint
ALTER TABLE "sync_account" ADD CONSTRAINT "sync_account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_library" ADD CONSTRAINT "sync_library_user_id_sync_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sync_account"("user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_plugin" ADD CONSTRAINT "sync_plugin_user_id_sync_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sync_account"("user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_progress" ADD CONSTRAINT "sync_progress_user_id_sync_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sync_account"("user_id") ON DELETE CASCADE;