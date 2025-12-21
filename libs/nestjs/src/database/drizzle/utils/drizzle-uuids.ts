import { Uuid } from '@code-hive/nestjs/utils';
import { uuid } from 'drizzle-orm/pg-core';

export const brandedUuid = <Brand extends Uuid<unknown>>(name: string) => uuid(name).$type<Brand>();

export const primaryUuid = <Brand extends Uuid<unknown>>() =>
  uuid().$type<Brand>().primaryKey().defaultRandom().notNull();
