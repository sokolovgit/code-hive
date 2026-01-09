import { Inject, Injectable } from '@nestjs/common';
import { UserId, UserInsert } from '@users-service/users/domain/schemas';

import { UsersStorage } from '../abstracts';

@Injectable()
export class UsersService {
  constructor(@Inject(UsersStorage) private readonly usersStorage: UsersStorage) {
    console.log('UsersService constructor');
    console.log('usersStorage', this.usersStorage);
  }

  async findAll() {
    console.log('findAll service');
    return this.usersStorage.findAll();
  }

  async findOne(id: UserId) {
    return this.usersStorage.findOne(id);
  }

  async create(user: UserInsert) {
    return this.usersStorage.create(user);
  }

  async update(id: UserId, user: UserInsert) {
    return this.usersStorage.update(id, user);
  }

  async delete(id: UserId) {
    return this.usersStorage.delete(id);
  }
}
