CREATE TABLE `ocr_analysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checkId` int NOT NULL,
	`userId` int NOT NULL,
	`extractedText` text NOT NULL,
	`detectedIndicators` text,
	`confidence` int NOT NULL,
	`language` varchar(10) NOT NULL,
	`processingTime` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ocr_analysis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `url_checks` ADD `ocrExtractedText` text;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `structuredMetadata` text;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `xmlData` text;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `ocrProcessedAt` timestamp;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `metadataProcessedAt` timestamp;--> statement-breakpoint
ALTER TABLE `url_checks` ADD `xmlProcessedAt` timestamp;