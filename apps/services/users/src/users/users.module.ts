import { Module } from '@nestjs/common';

import { UsersServiceModule } from './service/users.service-module';
import { UsersController } from './ui/users.controller';

@Module({
  imports: [UsersServiceModule],
  controllers: [UsersController],
})
export class UsersModule {}
