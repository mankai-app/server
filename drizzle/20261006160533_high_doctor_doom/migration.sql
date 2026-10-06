CREATE TABLE "sync_browsable_plugin" (
	"user_id" text,
	"source_id" text,
	"revision" bigint NOT NULL,
	"datetime" bigint NOT NULL,
	"deleted" boolean NOT NULL,
	"url" text,
	"type" text DEFAULT 'js',
	CONSTRAINT "sync_browsable_plugin_pkey" PRIMARY KEY("user_id","source_id")
);
--> statement-breakpoint
ALTER TABLE "sync_plugin" ADD COLUMN "type" text DEFAULT 'js';--> statement-breakpoint
CREATE INDEX "sync_browsable_plugin_revision_idx" ON "sync_browsable_plugin" ("user_id","revision");--> statement-breakpoint
ALTER TABLE "sync_browsable_plugin" ADD CONSTRAINT "sync_browsable_plugin_user_id_sync_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sync_account"("user_id") ON DELETE CASCADE;