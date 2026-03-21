CREATE TABLE `batch_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL,
	`totalUrls` int NOT NULL,
	`processedUrls` int NOT NULL DEFAULT 0,
	`results` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `batch_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `batch_jobs_jobId_unique` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE TABLE `screenshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`urlCheckId` int NOT NULL,
	`s3Key` varchar(255) NOT NULL,
	`s3Url` text NOT NULL,
	`captureTime` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `screenshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `url_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`url` text NOT NULL,
	`normalizedUrl` text NOT NULL,
	`riskScore` int NOT NULL,
	`riskLevel` enum('safe','suspicious','dangerous') NOT NULL,
	`phishingReasons` text,
	`deepseekAnalysis` text,
	`affiliateInfo` text,
	`screenshotUrl` text,
	`screenshotKey` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `url_checks_id` PRIMARY KEY(`id`)
);
