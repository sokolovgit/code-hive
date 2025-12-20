import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

export type Uuid<T = unknown> = string & { __brand: T };

export const isUuid = <T extends Uuid<unknown>>(value: string): value is T => {
  return z
    .uuid({
      version: 'v7',
    })
    .safeParse(value).success;
};

export function asUuid<T extends Uuid<unknown>>(value: string): T;
export function asUuid<T extends Uuid<unknown>>(value: string | null): T | null;
export function asUuid<T extends Uuid<unknown>>(value: string | undefined): T | undefined;

export function asUuid<T extends Uuid<unknown>>(
  value: string | null | undefined
): T | null | undefined {
  return value as T | null | undefined;
}

export const uuid = <T extends Uuid<unknown>>(): T => {
  return uuidv7() as T;
};
