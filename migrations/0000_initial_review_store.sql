CREATE TABLE `finding` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text NOT NULL,
	`finding_id` text NOT NULL,
	`file` text NOT NULL,
	`line` integer,
	`tier` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`body_override_md` text,
	`disposition` text DEFAULT 'pending' NOT NULL,
	`resolution` text DEFAULT 'new' NOT NULL,
	`present` integer DEFAULT true NOT NULL,
	`first_seen_round` integer NOT NULL,
	`last_seen_round` integer NOT NULL,
	`posted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`target_id`) REFERENCES `target`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finding_target_finding` ON `finding` (`target_id`,`finding_id`);--> statement-breakpoint
CREATE INDEX `finding_target` ON `finding` (`target_id`);--> statement-breakpoint
CREATE TABLE `round` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text NOT NULL,
	`round` integer NOT NULL,
	`head_sha` text NOT NULL,
	`verdict` text NOT NULL,
	`summary_md` text DEFAULT '' NOT NULL,
	`counts_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`target_id`) REFERENCES `target`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_target_round` ON `round` (`target_id`,`round`);--> statement-breakpoint
CREATE TABLE `target` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`pr` integer NOT NULL,
	`project_id` text,
	`title` text,
	`author` text,
	`base_ref` text,
	`head_ref` text,
	`latest_round` integer DEFAULT 0 NOT NULL,
	`latest_verdict` text,
	`latest_summary_md` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `target_repo_pr` ON `target` (`repo`,`pr`);