ALTER TABLE `ai_tasks` ADD `lockToken` varchar(64);--> statement-breakpoint
ALTER TABLE `ai_tasks` ADD `lockExpiresAt` timestamp;