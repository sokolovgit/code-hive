import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';

import { UserId } from '../domain/schemas';
import { UsersService } from '../service/users-service';

import { CreateUserDto } from './dtos/create-user.dto';
import { UserDto } from './dtos/user.dto';

@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {
    console.log('UsersController constructor');
    console.log('usersService', this.usersService);
  }

  @Get()
  @ApiOkResponse({
    description: 'The list of users',
    type: () => [UserDto],
  })
  public async findAll() {
    console.log('findAll controller');
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'The user',
    type: () => UserDto,
  })
  async findOne(@Param('id') id: UserId) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'The user',
    type: () => UserDto,
  })
  @ApiBody({
    description: 'The user',
    type: () => CreateUserDto,
  })
  async create(@Body() user: CreateUserDto) {
    return this.usersService.create({
      email: user.email,
    });
  }
}
