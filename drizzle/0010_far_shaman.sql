CREATE TABLE `discovery_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`type` varchar(120) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`sourceCount` int NOT NULL DEFAULT 0,
	`description` text,
	`verificationDays` int NOT NULL DEFAULT 2,
	`status` varchar(80) NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discovery_signals_id` PRIMARY KEY(`id`)
);
