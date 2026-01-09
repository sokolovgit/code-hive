import { primaryUuid, timestamps } from '@code-hive/nestjs/database/drizzle';
import { Uuid } from '@code-hive/nestjs/utils';
import { pgTable, varchar } from 'drizzle-orm/pg-core';

export type UserId = Uuid<'users'>;

export const users = pgTable('users', {
  id: primaryUuid<UserId>(),
  email: varchar('email').notNull().unique(),

  ...timestamps,
});

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
