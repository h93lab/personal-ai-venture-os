CREATE TABLE `ai_task_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('running','success','failed') NOT NULL DEFAULT 'running',
	`result` text,
	`error` text,
	`model` varchar(200),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_task_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`instructions` text NOT NULL,
	`cadence` enum('manual','daily','weekly') NOT NULL DEFAULT 'daily',
	`runTime` varchar(5) NOT NULL DEFAULT '08:00',
	`status` enum('active','paused') NOT NULL DEFAULT 'active',
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_tasks_id` PRIMARY KEY(`id`)
);
