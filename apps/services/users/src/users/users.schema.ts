import { primaryUuid, timestamps } from '@code-hive/nestjs/database/drizzle';
import { pgTable, text, boolean } from 'drizzle-orm/pg-core';

import type { Uuid } from '@code-hive/nestjs/utils';

export type UserId = Uuid<'User'>;

export const users = pgTable('users', {
  id: primaryUuid<UserId>(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps, // Adds createdAt and updatedAt
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
