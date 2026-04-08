CREATE TABLE `redirect_whitelist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_pattern` varchar(255) NOT NULL,
	`target_pattern` varchar(255),
	`allowed_hop_count` int DEFAULT 2,
	`reason` varchar(255),
	`is_active` int DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`created_by` varchar(100),
	CONSTRAINT `redirect_whitelist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trusted_redirect_pairs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_domain` varchar(255) NOT NULL,
	`to_domain` varchar(255) NOT NULL,
	`is_active` int DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trusted_redirect_pairs_id` PRIMARY KEY(`id`)
);
