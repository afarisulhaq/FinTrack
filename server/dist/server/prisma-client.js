import { PrismaClient } from "@prisma/client";
const createPrismaClient = () => new PrismaClient({
    log: process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
});
const globalForPrisma = globalThis;
export const db = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = db;
export function isDatabaseConfigured() {
    return Boolean(process.env.DATABASE_URL);
}
export async function canUseDatabase() {
    if (!isDatabaseConfigured())
        return false;
    try {
        await db.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        console.warn("PostgreSQL unavailable, using in-memory fallback:", error instanceof Error ? error.message : error);
        return false;
    }
}
