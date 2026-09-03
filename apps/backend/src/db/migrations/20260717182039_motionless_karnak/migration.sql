CREATE TABLE "request_log" (
	"id" text PRIMARY KEY,
	"ts" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"route_path" text,
	"status" integer NOT NULL,
	"duration_ms" real NOT NULL,
	"client_ip" text,
	"user_agent" text,
	"referer" text,
	"origin" text,
	"content_length" integer,
	"user_id" text,
	"session_id" text,
	"query" jsonb,
	"error" jsonb,
	"extra" jsonb
);
--> statement-breakpoint
CREATE INDEX "request_log_ts_idx" ON "request_log" ("ts");--> statement-breakpoint
CREATE INDEX "request_log_user_id_idx" ON "request_log" ("user_id");--> statement-breakpoint
CREATE INDEX "request_log_request_id_idx" ON "request_log" ("request_id");--> statement-breakpoint
CREATE INDEX "request_log_status_ts_idx" ON "request_log" ("status","ts");