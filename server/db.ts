import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, urlChecks, batchJobs, screenshots, InsertURLCheck, InsertBatchJob, InsertScreenshot } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// URL Check queries
export async function createURLCheck(check: InsertURLCheck) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(urlChecks).values(check);
  // Fetch the inserted record to get the ID
  const inserted = await db.select().from(urlChecks).where(eq(urlChecks.normalizedUrl, check.normalizedUrl)).orderBy(desc(urlChecks.createdAt)).limit(1);
  return inserted[0];
}

export async function getUserURLChecks(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(urlChecks).where(eq(urlChecks.userId, userId)).orderBy(desc(urlChecks.createdAt)).limit(limit);
}

export async function getURLCheckById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(urlChecks).where(eq(urlChecks.id, id)).limit(1);
  return result[0];
}

// Batch Job queries
export async function createBatchJob(job: InsertBatchJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(batchJobs).values(job);
}

export async function getBatchJobByJobId(jobId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(batchJobs).where(eq(batchJobs.jobId, jobId)).limit(1);
  return result[0];
}

export async function updateBatchJob(jobId: string, updates: Partial<InsertBatchJob>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(batchJobs).set(updates).where(eq(batchJobs.jobId, jobId));
}

export async function getUserBatchJobs(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(batchJobs).where(eq(batchJobs.userId, userId)).orderBy(desc(batchJobs.createdAt)).limit(limit);
}

// Screenshot queries
export async function createScreenshot(screenshot: InsertScreenshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(screenshots).values(screenshot);
}

export async function getScreenshotsByURLCheckId(urlCheckId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(screenshots).where(eq(screenshots.urlCheckId, urlCheckId));
}

// TODO: add feature queries here as your schema grows.
