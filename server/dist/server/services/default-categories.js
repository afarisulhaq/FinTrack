import { DEFAULT_CATEGORIES } from "../../src/lib/default-categories.js";
import { randomUUID } from "node:crypto";
export const CATEGORY_DEFAULTS_VERSION = 1;
export async function applyCategoryDefaults(client, userId) {
    await client.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE', userId);
    const user = await client.user.findUnique({
        where: { id: userId },
        select: { categoryDefaultsVersion: true },
    });
    if (!user || user.categoryDefaultsVersion >= CATEGORY_DEFAULTS_VERSION)
        return;
    const children = [];
    for (const type of ["expense", "income"]) {
        for (const [sortOrder, preset] of DEFAULT_CATEGORIES[type].entries()) {
            const category = await client.category.upsert({
                where: { userId_type_name: { userId, type, name: preset.name } },
                update: {},
                create: {
                    userId,
                    type,
                    name: preset.name,
                    icon: preset.icon,
                    color: preset.color,
                    sortOrder,
                    isSystem: true,
                },
            });
            for (const [sortOrder, sub] of preset.subcategories.entries()) {
                children.push({
                    userId,
                    categoryId: category.id,
                    name: sub.name,
                    icon: sub.icon,
                    color: preset.color,
                    sortOrder,
                    isSystem: true,
                });
            }
        }
    }
    await client.subCategory.createMany({ data: children, skipDuplicates: true });
    await client.user.update({
        where: { id: userId },
        data: { categoryDefaultsVersion: CATEGORY_DEFAULTS_VERSION },
    });
}
export async function ensureCategoryDefaults(prisma, userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { categoryDefaultsVersion: true },
    });
    if (!user || user.categoryDefaultsVersion >= CATEGORY_DEFAULTS_VERSION)
        return;
    await prisma.$transaction((client) => applyCategoryDefaults(client, userId), {
        timeout: 30000,
    });
}
const initializedMemoryUsers = new Set();
export function ensureMemoryCategoryDefaults(userId, categories, subCategories) {
    if (initializedMemoryUsers.has(userId))
        return;
    const now = new Date().toISOString();
    for (const type of ["expense", "income"]) {
        for (const [sortOrder, preset] of DEFAULT_CATEGORIES[type].entries()) {
            let category = categories.find((row) => row.userId === userId &&
                row.type === type &&
                row.name === preset.name);
            if (!category) {
                category = {
                    id: randomUUID(),
                    userId,
                    type,
                    name: preset.name,
                    icon: preset.icon,
                    color: preset.color,
                    sortOrder,
                    isSystem: true,
                    subCategories: [],
                    createdAt: now,
                    updatedAt: now,
                };
                categories.push(category);
            }
            for (const [sortOrder, sub] of preset.subcategories.entries()) {
                const existing = subCategories.find((row) => row.userId === userId &&
                    row.categoryId === category.id &&
                    row.name === sub.name);
                if (existing)
                    continue;
                const child = {
                    id: randomUUID(),
                    userId,
                    categoryId: category.id,
                    name: sub.name,
                    icon: sub.icon,
                    color: preset.color,
                    sortOrder,
                    isSystem: true,
                    createdAt: now,
                    updatedAt: now,
                };
                subCategories.push(child);
                category.subCategories.push(child);
            }
        }
    }
    initializedMemoryUsers.add(userId);
}
