import { UserId, UserSelect } from '@users-service/users/domain/schemas/users.schema';
import { UserInsert } from '@users-service/users/domain/schemas/users.schema';

export abstract class UsersStorage {
  abstract findAll(): Promise<UserSelect[]>;
  abstract findOne(id: UserId): Promise<UserSelect | null>;
  abstract create(user: UserInsert): Promise<UserSelect>;
  abstract update(id: UserId, user: UserInsert): Promise<UserSelect>;
  abstract delete(id: UserId): Promise<void>;
}
