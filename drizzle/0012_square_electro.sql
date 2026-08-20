CREATE TABLE `discovery_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`source` varchar(80) NOT NULL DEFAULT 'hn_algolia',
	`query` varchar(240) NOT NULL DEFAULT 'mobile apps indie games developer tools',
	`enabled` int NOT NULL DEFAULT 1,
	`scheduleCronTaskUid` varchar(65),
	`lastFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discovery_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `discovery_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `discovery_signals` ADD `sourceKey` varchar(180);--> statement-breakpoint
ALTER TABLE `discovery_signals` ADD `sourceUrl` varchar(1000);