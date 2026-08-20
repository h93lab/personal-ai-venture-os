ALTER TABLE `users` ADD `pinHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `authVersion` int DEFAULT 0 NOT NULL;