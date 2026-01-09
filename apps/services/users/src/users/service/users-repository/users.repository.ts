import { DrizzleDatabase, InjectDrizzle } from '@code-hive/nestjs/database/drizzle';
import { Injectable } from '@nestjs/common';
import { schema } from '@users-service/db';
import { UserId, UserInsert, users, UserSelect } from '@users-service/users/domain/schemas';
import { eq } from 'drizzle-orm';

import { UsersStorage } from '../abstracts';

@Injectable()
export class UsersRepository extends UsersStorage {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase<typeof schema>) {
    super();
    console.log('UsersRepository constructor');
    console.log('UsersRepository db', this.db.constructor.name);
  }

  async findAll(): Promise<UserSelect[]> {
    console.log('findAll repository');
    const returnedUsers = await this.db.select().from(users);
    console.log('users', returnedUsers);
    return returnedUsers;
  }

  async findOne(id: UserId): Promise<UserSelect | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async create(user: UserInsert): Promise<UserSelect> {
    const [newUser] = await this.db.insert(users).values(user).returning();
    return newUser;
  }

  async update(id: UserId, user: UserInsert): Promise<UserSelect> {
    const [updatedUser] = await this.db.update(users).set(user).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async delete(id: UserId): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  private async getUserById(id: UserId): Promise<UserSelect> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }
}
