import { InjectDrizzle, DrizzleDatabase } from '@code-hive/nestjs/database/drizzle';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { users, User, NewUser, UserId } from './users.schema';

@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase) {}

  /**
   * Find all users
   */
  async findAll(): Promise<User[]> {
    const result = await this.db.select().from(users);
    return result as User[];
  }

  /**
   * Find a user by ID
   */
  async findOne(id: UserId): Promise<User> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  }

  /**
   * Create a new user
   */
  async create(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  /**
   * Update a user
   */
  async update(
    id: UserId,
    data: Partial<Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<User> {
    const [user] = await this.db.update(users).set(data).where(eq(users.id, id)).returning();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Delete a user
   */
  async delete(id: UserId): Promise<void> {
    const result = await this.db.delete(users).where(eq(users.id, id));

    if (result.rowCount === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Soft delete a user (deactivate)
   */
  async deactivate(id: UserId): Promise<User> {
    return this.update(id, { isActive: false });
  }

  /**
   * Activate a user
   */
  async activate(id: UserId): Promise<User> {
    return this.update(id, { isActive: true });
  }
}
