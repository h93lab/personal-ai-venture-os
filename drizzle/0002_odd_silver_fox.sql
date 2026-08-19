CREATE TABLE `ai_provider_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(120) NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`apiKey` text NOT NULL,
	`selectedModel` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_provider_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_provider_settings_userId_unique` UNIQUE(`userId`)
);
