import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const urlChecks = mysqlTable("url_checks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  url: text("url").notNull(),
  normalizedUrl: text("normalizedUrl").notNull(),
  riskScore: int("riskScore").notNull(), // 0-100
  riskLevel: mysqlEnum("riskLevel", ["safe", "suspicious", "dangerous"]).notNull(),
  phishingReasons: text("phishingReasons"), // JSON array
  deepseekAnalysis: text("deepseekAnalysis"), // JSON response
  affiliateInfo: text("affiliateInfo"), // JSON
  screenshotUrl: text("screenshotUrl"),
  screenshotKey: text("screenshotKey"),
  ocrExtractedText: text("ocrExtractedText"),
  structuredMetadata: text("structuredMetadata"),
  xmlData: text("xmlData"),
  ocrProcessedAt: timestamp("ocrProcessedAt"),
  metadataProcessedAt: timestamp("metadataProcessedAt"),
  xmlProcessedAt: timestamp("xmlProcessedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type URLCheck = typeof urlChecks.$inferSelect;
export type InsertURLCheck = typeof urlChecks.$inferInsert;

export const batchJobs = mysqlTable("batch_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: varchar("jobId", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).notNull(),
  totalUrls: int("totalUrls").notNull(),
  processedUrls: int("processedUrls").default(0).notNull(),
  results: text("results"), // JSON array of URL check results
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type BatchJob = typeof batchJobs.$inferSelect;
export type InsertBatchJob = typeof batchJobs.$inferInsert;

export const screenshots = mysqlTable("screenshots", {
  id: int("id").autoincrement().primaryKey(),
  urlCheckId: int("urlCheckId").notNull(),
  s3Key: varchar("s3Key", { length: 255 }).notNull(),
  s3Url: text("s3Url").notNull(),
  captureTime: timestamp("captureTime").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type Screenshot = typeof screenshots.$inferSelect;
export type InsertScreenshot = typeof screenshots.$inferInsert;

// OCR Analysis table for storing extracted text and detected phishing indicators
export const ocrAnalysis = mysqlTable('ocr_analysis', {
  id: int('id').autoincrement().primaryKey(),
  checkId: int('checkId').notNull(),
  userId: int('userId').notNull(),
  extractedText: text('extractedText').notNull(),
  detectedIndicators: text('detectedIndicators'), // JSON array
  confidence: int('confidence').notNull(), // 0-100 scale
  language: varchar('language', { length: 10 }).notNull(),
  processingTime: int('processingTime').notNull(), // milliseconds
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type OCRAnalysis = typeof ocrAnalysis.$inferSelect;
export type InsertOCRAnalysis = typeof ocrAnalysis.$inferInsert;