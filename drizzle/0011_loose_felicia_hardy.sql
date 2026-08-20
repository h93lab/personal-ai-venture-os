CREATE TABLE `competitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(220) NOT NULL,
	`category` varchar(120) NOT NULL,
	`url` varchar(1000),
	`threatLevel` int NOT NULL DEFAULT 0,
	`lastSeenAt` timestamp,
	`notes` text,
	`status` varchar(80) NOT NULL DEFAULT 'watching',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitors_id` PRIMARY KEY(`id`)
);
