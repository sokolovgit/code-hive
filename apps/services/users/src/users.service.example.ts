/**
 * Example service showing how to use modules from @code-hive/nestjs
 *
 * This file demonstrates:
 * - Using LoggerService for logging
 * - Throwing custom errors (BusinessError, DataError, etc.)
 * - How errors work in both HTTP and RPC contexts
 */
import { BusinessError, DataError, HttpError } from '@code-hive/nestjs/errors';
import { LoggerService } from '@code-hive/nestjs/logger';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(private readonly logger: LoggerService) {
    // Logger automatically detects context (service name, method name, request ID, user ID)
    // No manual setup needed!
  }

  /**
   * Example: Using logger with automatic context detection
   */
  async findUser(id: string) {
    // Automatically includes: requestId, userId, service: "UsersService", method: "findUser"
    this.logger.info('Finding user', { userId: id });

    if (!id) {
      throw new DataError('User ID is required', 'USER_ID_REQUIRED', {
        field: 'id',
        metadata: { provided: id },
      });
    }

    try {
      // Simulate database lookup
      const user = await this.simulateDbLookup(id);

      if (!user) {
        // This error works in both HTTP and RPC contexts!
        throw new HttpError('User not found', 404, {
          code: 'USER_NOT_FOUND',
          metadata: { userId: id },
        });
      }

      this.logger.info('User found', { userId: id, found: true });
      return user;
    } catch (error) {
      // Error logging automatically includes full context
      this.logger.error(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Example: Business logic error
   */
  async createUser(email: string, age: number) {
    this.logger.info('Creating user', { email, age });

    // Data validation error
    if (!email || !email.includes('@')) {
      throw new DataError('Invalid email format', 'INVALID_EMAIL', {
        field: 'email',
        metadata: { value: email },
      });
    }

    if (age < 18) {
      // Business rule violation
      throw new BusinessError('User must be at least 18 years old', 'AGE_RESTRICTION', {
        metadata: { age, minimumAge: 18 },
      });
    }

    // Check if user already exists (business logic)
    const existingUser = await this.simulateDbLookup(email);
    if (existingUser) {
      throw new BusinessError('User already exists', 'USER_ALREADY_EXISTS', {
        loggable: false, // Expected error, don't log
        exposeToClient: true,
        metadata: { email },
      });
    }

    this.logger.info('User created successfully', { email, age });
    return { id: '123', email, age };
  }

  /**
   * Example: Using logger with different log levels
   */
  async updateUser(id: string, data: { email?: string; age?: number }) {
    this.logger.info('Updating user', { userId: id, data });

    if (!id) {
      throw new DataError('User ID is required', 'USER_ID_REQUIRED', {
        field: 'id',
      });
    }

    // Validate email if provided
    if (data.email && !data.email.includes('@')) {
      throw new DataError('Invalid email format', 'INVALID_EMAIL', {
        field: 'email',
        metadata: { value: data.email },
      });
    }

    // Business rule: age restriction
    if (data.age !== undefined && data.age < 18) {
      throw new BusinessError('User must be at least 18 years old', 'AGE_RESTRICTION', {
        metadata: { age: data.age, minimumAge: 18 },
      });
    }

    this.logger.info('User updated', { userId: id, updatedFields: Object.keys(data) });
    return { id, ...data };
  }

  /**
   * Example: Error that works in both HTTP and RPC contexts
   *
   * When called from HTTP controller:
   * - Returns HTTP 400 with statusCode in response
   *
   * When called from RPC handler:
   * - Returns error without statusCode (RPC doesn't need it)
   */
  async processPayment(userId: string, amount: number) {
    this.logger.info('Processing payment', { userId, amount });

    if (amount <= 0) {
      // This same error works for both HTTP and RPC!
      throw new BusinessError('Invalid payment amount', 'INVALID_AMOUNT', {
        metadata: { amount, userId },
      });
    }

    // Simulate payment processing
    const balance = await this.getUserBalance(userId);
    if (balance < amount) {
      throw new BusinessError('Insufficient funds', 'INSUFFICIENT_FUNDS', {
        metadata: { userId, balance, amount, required: amount },
      });
    }

    this.logger.info('Payment processed', { userId, amount });
    return { success: true, newBalance: balance - amount };
  }

  // Helper methods (simulated)
  private async simulateDbLookup(id: string): Promise<{ id: string; email: string } | null> {
    // Simulate database lookup
    return id === '123' ? { id: '123', email: 'user@example.com' } : null;
  }

  private async getUserBalance(userId: string): Promise<number> {
    // Simulate balance lookup
    this.logger.debug(`Getting balance for user ${userId}`);
    return 100;
  }
}
