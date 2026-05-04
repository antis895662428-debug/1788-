import { db, profilesTable, adminsTable, reviewsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const MAIN_ADMIN_USERNAME = "domlk";

export async function isMainAdmin(username?: string): Promise<boolean> {
  return username === MAIN_ADMIN_USERNAME;
}

export async function isAdmin(telegramId: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.telegramId, telegramId))
    .limit(1);
  return rows.length > 0;
}

export async function getAdminRole(telegramId: number): Promise<string | null> {
  const rows = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.telegramId, telegramId))
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function addAdmin(telegramId: number, username: string | undefined, role: "admin" | "moderator" = "moderator") {
  await db.insert(adminsTable).values({ telegramId, username, role }).onConflictDoUpdate({
    target: adminsTable.telegramId,
    set: { username, role },
  });
}

export async function removeAdmin(telegramId: number) {
  await db.delete(adminsTable).where(eq(adminsTable.telegramId, telegramId));
}

export async function listAdmins() {
  return db.select().from(adminsTable).orderBy(adminsTable.addedAt);
}

export async function addProfile(name: string, photoUrl: string) {
  const rows = await db.insert(profilesTable).values({ name, photoUrl }).returning();
  return rows[0];
}

export async function removeProfile(id: number) {
  await db.delete(profilesTable).where(eq(profilesTable.id, id));
}

export async function listProfiles() {
  return db.select().from(profilesTable).orderBy(profilesTable.id);
}

export async function getProfile(id: number) {
  const rows = await db.select().from(profilesTable).where(eq(profilesTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getProfileStats(profileId: number) {
  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.profileId, profileId));

  const count = reviews.length;
  const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { count, avg: Math.round(avg * 10) / 10 };
}

export async function getUserReview(profileId: number, userId: number) {
  const rows = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.profileId, profileId), eq(reviewsTable.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertReview(profileId: number, userId: number, rating: number, comment?: string) {
  const existing = await getUserReview(profileId, userId);
  if (existing) {
    await db
      .update(reviewsTable)
      .set({ rating, comment: comment ?? null, commentDeleted: 0, updatedAt: new Date() })
      .where(and(eq(reviewsTable.profileId, profileId), eq(reviewsTable.userId, userId)));
  } else {
    await db.insert(reviewsTable).values({ profileId, userId, rating, comment: comment ?? null });
  }
}

export async function getProfileReviews(profileId: number) {
  return db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.profileId, profileId))
    .orderBy(desc(reviewsTable.createdAt));
}

export async function getRecentReviews(limit = 20) {
  return db
    .select({ review: reviewsTable, profile: profilesTable })
    .from(reviewsTable)
    .leftJoin(profilesTable, eq(reviewsTable.profileId, profilesTable.id))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(limit);
}

export async function deleteReviewComment(reviewId: number) {
  await db
    .update(reviewsTable)
    .set({ comment: null, commentDeleted: 1 })
    .where(eq(reviewsTable.id, reviewId));
}

export async function deleteReviewFully(reviewId: number) {
  await db.delete(reviewsTable).where(eq(reviewsTable.id, reviewId));
}
