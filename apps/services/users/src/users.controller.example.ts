/**
 * Example controller showing how to use errors in HTTP context
 */

import { Controller, Get, Post, Body, Param } from '@nestjs/common';

import { UsersService } from './users.service.example';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findUser(@Param('id') id: string) {
    // If BusinessError or any BaseError is thrown here:
    // - ExceptionLoggingFilter catches it
    // - Returns HTTP response with statusCode
    // - Logs error with full context
    return await this.usersService.findUser(id);
  }

  @Post()
  async createUser(@Body() dto: { email: string; age: number }) {
    // Errors thrown here will be automatically handled by ExceptionLoggingFilter
    // HTTP response will include statusCode from the error
    return await this.usersService.createUser(dto.email, dto.age);
  }

  @Post(':id/payment')
  async processPayment(@Param('id') userId: string, @Body() dto: { amount: number }) {
    // BusinessError thrown here will:
    // - Return HTTP 400 with statusCode in response
    // - Include error code, message, and metadata
    return await this.usersService.processPayment(userId, dto.amount);
  }
}
