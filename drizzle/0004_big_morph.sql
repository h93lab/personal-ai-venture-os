CREATE TABLE `telegram_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`botToken` text NOT NULL,
	`chatId` varchar(120) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_connections_userId_unique` UNIQUE(`userId`)
);
