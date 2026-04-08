CREATE TABLE `adversarial_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clusterId` int NOT NULL,
	`mutations` text NOT NULL,
	`undetectedCount` int DEFAULT 0,
	`totalTested` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adversarial_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `redirect_chains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`original_url` text NOT NULL,
	`final_url` text,
	`status_code` int,
	`redirect_count` int DEFAULT 0,
	`is_malicious` int DEFAULT 0,
	`detected_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `redirect_chains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `redirect_hops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chain_id` int NOT NULL,
	`hop_order` int NOT NULL,
	`from_url` text NOT NULL,
	`to_url` text,
	`status_code` int,
	`response_time_ms` int,
	`detected_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `redirect_hops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` varchar(512) NOT NULL,
	`eventType` varchar(50) NOT NULL,
	`threshold` int DEFAULT 5,
	`secret` varchar(256),
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `url_checks` ADD `utmData` text;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `referrer` text;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `deepfakeRisk` text;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `hasCameraRequest` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `hasMicrophoneRequest` int DEFAULT 0;