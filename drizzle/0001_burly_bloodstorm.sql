ALTER TABLE `github_connections` ADD `healthThreshold` int DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `github_connections` ADD `refreshMinutes` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `github_connections` ADD `scheduleCronTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `github_connections` ADD `lastStatusJson` text;--> statement-breakpoint
ALTER TABLE `github_connections` ADD `lastSyncedAt` timestamp;