CREATE TABLE `browser_fingerprints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checkId` int NOT NULL,
	`userAgent` text,
	`platform` varchar(100),
	`languages` text,
	`webGLVendor` varchar(255),
	`webGLRenderer` varchar(255),
	`canvasFingerprint` varchar(64),
	`screenResolution` varchar(50),
	`timezone` varchar(50),
	`plugins` text,
	`isBotLikely` int DEFAULT 0,
	`botIndicators` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `browser_fingerprints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cluster_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checkId` int NOT NULL,
	`clusterId` int NOT NULL,
	`similarityScore` int,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cluster_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phishing_clusters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clusterId` varchar(64) NOT NULL,
	`clusterName` varchar(255),
	`domStructureHash` varchar(64) NOT NULL,
	`formCount` int,
	`inputTypes` text,
	`externalScripts` text,
	`cssClassPatterns` text,
	`similarity` int,
	`memberCount` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `phishing_clusters_id` PRIMARY KEY(`id`),
	CONSTRAINT `phishing_clusters_clusterId_unique` UNIQUE(`clusterId`)
);
