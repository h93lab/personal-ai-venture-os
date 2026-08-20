CREATE TABLE `competitor_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`source` varchar(80) NOT NULL DEFAULT 'github',
	`query` varchar(240) NOT NULL DEFAULT 'mobile apps indie games developer tools',
	`enabled` int NOT NULL DEFAULT 1,
	`refreshMinutes` int NOT NULL DEFAULT 1440,
	`scheduleCronTaskUid` varchar(65),
	`lastFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitor_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `competitor_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `competitors` ADD `sourceKey` varchar(180);--> statement-breakpoint
ALTER TABLE `competitors` ADD `source` varchar(80) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_settings` ADD `localHour` int DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_settings` ADD `localMinute` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_settings` ADD `timezone` varchar(80) DEFAULT 'Asia/Dubai' NOT NULL;