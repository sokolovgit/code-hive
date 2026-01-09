import { Module } from '@nestjs/common';

import { UsersStorage } from './abstracts';
import { UsersRepository } from './users-repository';
import { UsersService } from './users-service';

@Module({
  providers: [
    {
      provide: UsersStorage,
      useClass: UsersRepository,
    },
    UsersService,
  ],
  exports: [UsersService],
})
export class UsersServiceModule {}
