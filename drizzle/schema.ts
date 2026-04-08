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
  utmData: text("utmData"), // JSON: {source, medium, campaign, term, content}
  referrer: text("referrer"),
  deepfakeRisk: text("deepfakeRisk"), // JSON: {isDeepfakeScam, confidence, reason}
  hasCameraRequest: int("hasCameraRequest").default(0), // 0 = false, 1 = true
  hasMicrophoneRequest: int("hasMicrophoneRequest").default(0), // 0 = false, 1 = true
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
// Browser Fingerprint table for bot evasion detection
export const browserFingerprints = mysqlTable('browser_fingerprints', {
  id: int('id').autoincrement().primaryKey(),
  checkId: int('checkId').notNull(),
  userAgent: text('userAgent'),
  platform: varchar('platform', { length: 100 }),
  languages: text('languages'), // JSON array
  webGLVendor: varchar('webGLVendor', { length: 255 }),
  webGLRenderer: varchar('webGLRenderer', { length: 255 }),
  canvasFingerprint: varchar('canvasFingerprint', { length: 64 }),
  screenResolution: varchar('screenResolution', { length: 50 }),
  timezone: varchar('timezone', { length: 50 }),
  plugins: text('plugins'), // JSON array
  isBotLikely: int('isBotLikely').default(0), // 0 = false, 1 = true
  botIndicators: text('botIndicators'), // JSON array of detected bot signals
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type BrowserFingerprint = typeof browserFingerprints.$inferSelect;
export type InsertBrowserFingerprint = typeof browserFingerprints.$inferInsert;

// Phishing Cluster table for campaign detection
export const phishingClusters = mysqlTable('phishing_clusters', {
  id: int('id').autoincrement().primaryKey(),
  clusterId: varchar('clusterId', { length: 64 }).notNull().unique(),
  clusterName: varchar('clusterName', { length: 255 }),
  domStructureHash: varchar('domStructureHash', { length: 64 }).notNull(),
  formCount: int('formCount'),
  inputTypes: text('inputTypes'), // JSON array
  externalScripts: text('externalScripts'), // JSON array of domains
  cssClassPatterns: text('cssClassPatterns'), // JSON array
  similarity: int('similarity'), // 0-100 similarity score
  memberCount: int('memberCount').default(1),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type PhishingCluster = typeof phishingClusters.$inferSelect;
export type InsertPhishingCluster = typeof phishingClusters.$inferInsert;

// Cluster membership table (many-to-many)
export const clusterMemberships = mysqlTable('cluster_memberships', {
  id: int('id').autoincrement().primaryKey(),
  checkId: int('checkId').notNull(),
  clusterId: int('clusterId').notNull(),
  similarityScore: int('similarityScore'), // 0-100
  addedAt: timestamp('addedAt').defaultNow().notNull(),
});

export type ClusterMembership = typeof clusterMemberships.$inferSelect;
export type InsertClusterMembership = typeof clusterMemberships.$inferInsert;

// Add fingerprint and cluster columns to urlChecks
// Note: These columns should be added via migration
export const urlChecksExtended = {
  browserFingerprintId: int('browserFingerprintId'),
  clusterId: int('clusterId'),
  fingerprintProcessedAt: timestamp('fingerprintProcessedAt'),
  clusterProcessedAt: timestamp('clusterProcessedAt'),
};

// Adversarial Test Results table for red-team analysis
export const adversarialTests = mysqlTable('adversarial_tests', {
  id: int('id').autoincrement().primaryKey(),
  clusterId: int('clusterId').notNull(),
  mutations: text('mutations').notNull(), // JSON array of mutation objects
  undetectedCount: int('undetectedCount').default(0),
  totalTested: int('totalTested').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type AdversarialTest = typeof adversarialTests.$inferSelect;
export type InsertAdversarialTest = typeof adversarialTests.$inferInsert;

// Webhooks table for notification configuration
export const webhooks = mysqlTable('webhooks', {
  id: int('id').autoincrement().primaryKey(),
  url: varchar('url', { length: 512 }).notNull(),
  eventType: varchar('eventType', { length: 50 }).notNull(), // 'campaign_detected', 'dangerous_url_detected'
  threshold: int('threshold').default(5),
  secret: varchar('secret', { length: 256 }),
  isActive: int('isActive').default(1), // 0 = false, 1 = true
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = typeof webhooks.$inferInsert;
