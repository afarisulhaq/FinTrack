import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORIES } from "../../src/lib/default-categories.js";
import type { Category, SubCategory } from "../../src/lib/types.js";
import { randomUUID } from "node:crypto";

export const CATEGORY_DEFAULTS_VERSION = 1;

export async function applyCategoryDefaults(
  client: Prisma.TransactionClient,
  userId: string,
) {
  await client.$queryRawUnsafe(
    'SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE',
    userId,
  );
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { categoryDefaultsVersion: true },
  });
  if (!user || user.categoryDefaultsVersion >= CATEGORY_DEFAULTS_VERSION)
    return;
  const children: Prisma.SubCategoryCreateManyInput[] = [];
  for (const type of ["expense", "income"] as const) {
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

export async function ensureCategoryDefaults(
  prisma: PrismaClient,
  userId: string,
) {
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

const initializedMemoryUsers = new Set<string>();
type OwnedCategory = Category & { userId?: string };
type OwnedSubCategory = SubCategory & { userId?: string };

export function ensureMemoryCategoryDefaults(
  userId: string,
  categories: OwnedCategory[],
  subCategories: OwnedSubCategory[],
) {
  if (initializedMemoryUsers.has(userId)) return;
  const now = new Date().toISOString();
  for (const type of ["expense", "income"] as const) {
    for (const [sortOrder, preset] of DEFAULT_CATEGORIES[type].entries()) {
      let category = categories.find(
        (row) =>
          row.userId === userId &&
          row.type === type &&
          row.name === preset.name,
      );
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
        const existing = subCategories.find(
          (row) =>
            row.userId === userId &&
            row.categoryId === category.id &&
            row.name === sub.name,
        );
        if (existing) continue;
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
