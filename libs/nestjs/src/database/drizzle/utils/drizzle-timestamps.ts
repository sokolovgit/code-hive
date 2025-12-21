import { PgTimestampConfig, timestamp } from 'drizzle-orm/pg-core';

export const timestampConfig: PgTimestampConfig<'date'> = {
  mode: 'date',
  precision: 3,
  withTimezone: true,
};

export const timestamps = {
  createdAt: timestamp(timestampConfig).defaultNow().notNull(),

  updatedAt: timestamp(timestampConfig)
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};
