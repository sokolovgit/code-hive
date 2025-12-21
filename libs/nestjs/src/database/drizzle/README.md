# Drizzle ORM Module

A comprehensive Drizzle ORM integration module for NestJS applications with PostgreSQL support, connection pooling, query logging, and request-scoped transactional support via `nestjs-cls`.

## Features

- ✅ **Type-safe database access** - Full TypeScript support with Drizzle ORM
- ✅ **Connection pooling** - Efficient PostgreSQL connection management
- ✅ **Query logging** - Automatic query logging integration with LoggerService
- ✅ **Request-scoped transactions** - Automatic transaction management using `@nestjs-cls/transactional`
- ✅ **Lifecycle management** - Automatic connection pool cleanup on module destroy
- ✅ **Schema utilities** - Pre-built utilities for UUIDs and timestamps
- ✅ **Async configuration** - Support for async module configuration with dependency injection

## Installation

The Drizzle module is part of `@code-hive/nestjs`. Required dependencies are already included:

- `drizzle-orm` - Drizzle ORM core
- `pg` - PostgreSQL client
- `nestjs-cls` - Continuation Local Storage for request context
- `@nestjs-cls/transactional` - Transactional plugin for CLS
- `@nestjs-cls/transactional-adapter-drizzle-orm` - Drizzle adapter for transactional support

## Basic Usage

### 1. Import and Configure the Drizzle Module

In your `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DrizzleModule, DrizzleClsModule } from '@code-hive/nestjs/database/drizzle';
import { LoggerModule } from '@code-hive/nestjs/logger';
import { ConfigModule, ConfigService } from '@code-hive/nestjs/config';

@Module({
  imports: [
    // Logger must be imported first (or at least before DrizzleClsModule)
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getLoggerOptions(),
    }),

    // Drizzle module with database connection
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: config.database.url,
        logQueries: config.environment === 'development',
        pool: {
          min: 2,
          max: 10,
        },
      }),
    }),

    // CLS module with transactional support (optional but recommended)
    DrizzleClsModule.forRoot(),
  ],
})
export class AppModule {}
```

### 2. Use Database in Your Services

```typescript
import { Injectable } from '@nestjs/common';
import { InjectDrizzle, DrizzleDatabase } from '@code-hive/nestjs/database/drizzle';
import { users } from './users.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase) {}

  async findAll() {
    return this.db.select().from(users);
  }

  async findOne(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async create(data: { name: string; email: string }) {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  async update(id: string, data: Partial<{ name: string; email: string }>) {
    const [user] = await this.db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async delete(id: string) {
    await this.db.delete(users).where(eq(users.id, id));
  }
}
```

## Schema Definition with Utilities

The module provides utilities for common patterns like UUIDs and timestamps:

```typescript
import { pgTable, text } from 'drizzle-orm/pg-core';
import { primaryUuid, timestamps } from '@code-hive/nestjs/database/drizzle';
import type { Uuid } from '@code-hive/nestjs/utils';

export type UserId = Uuid<'User'>;

export const users = pgTable('users', {
  id: primaryUuid<UserId>(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  ...timestamps, // Adds createdAt and updatedAt
});
```

### Available Utilities

- `primaryUuid<T>()` - Creates a primary key UUID column with default random generation
- `brandedUuid<T>(name: string)` - Creates a branded UUID column
- `timestamps` - Object with `createdAt` and `updatedAt` timestamp columns

## Transactional Support

The module integrates with `@nestjs-cls/transactional` to provide request-scoped transactions. This allows multiple database operations across different services to automatically share the same transaction without explicitly passing transaction objects.

### How Transactions Work

Transactions in this module work through **Continuation Local Storage (CLS)**, which maintains a transaction context throughout the entire request lifecycle. When you use the `@Transactional()` decorator:

1. A transaction is automatically started when the decorated method is called
2. All database operations within that method (and any methods it calls) use the same transaction
3. The transaction is automatically committed when the method completes successfully
4. If any error occurs, the transaction is automatically rolled back
5. The transaction context is stored in CLS, so it's automatically available to all services in the call chain

### Basic Transaction Usage

```typescript
import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { InjectDrizzle, DrizzleDatabase } from '@code-hive/nestjs/database/drizzle';
import { users, orders } from './schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class OrderService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase) {}

  // Simple transaction - all operations share the same transaction
  @Transactional()
  async createOrderWithUser(userData: any, orderData: any) {
    // All these operations are in the same transaction
    const [user] = await this.db.insert(users).values(userData).returning();
    const [order] = await this.db
      .insert(orders)
      .values({ ...orderData, userId: user.id })
      .returning();

    // If any operation fails, entire transaction rolls back
    return { user, order };
  }

  // Transaction with isolation level
  @Transactional({
    isolationLevel: 'read committed',
  })
  async transferFunds(fromId: string, toId: string, amount: number) {
    // Transaction automatically shared across all services
    await this.db
      .update(accounts)
      .set({ balance: sql`balance - ${amount}` })
      .where(eq(accounts.id, fromId));

    await this.db
      .update(accounts)
      .set({ balance: sql`balance + ${amount}` })
      .where(eq(accounts.id, toId));
  }
}
```

### Transaction Propagation Across Services

When using `@Transactional()`, the transaction context is automatically shared across all services in the same request. This means you don't need to pass transaction objects explicitly:

```typescript
@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase) {}

  // This method participates in the transaction if called from a @Transactional method
  async updateBalance(userId: string, amount: number) {
    // Automatically uses the transaction from the calling method
    await this.db
      .update(accounts)
      .set({ balance: sql`balance + ${amount}` })
      .where(eq(accounts.id, userId));
  }
}

@Injectable()
export class InventoryService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase) {}

  // This also participates in the transaction
  async reserveItem(itemId: string, quantity: number) {
    await this.db
      .update(inventory)
      .set({ reserved: sql`reserved + ${quantity}` })
      .where(eq(inventory.id, itemId));
  }
}

@Injectable()
export class OrderService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDatabase,
    private readonly usersService: UsersService,
    private readonly inventoryService: InventoryService
  ) {}

  @Transactional()
  async createOrder(orderData: any) {
    // All operations in these services share the same transaction
    const user = await this.usersService.updateBalance(userId, -amount);
    await this.inventoryService.reserveItem(itemId, quantity);
    const order = await this.db.insert(orders).values(orderData).returning();

    // If any operation fails, everything rolls back
    return order;
  }
}
```

### Transaction Isolation Levels

You can specify different isolation levels for transactions to control how concurrent transactions interact:

```typescript
@Injectable()
export class PaymentService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase) {}

  // Read Uncommitted - Lowest isolation, allows dirty reads
  @Transactional({
    isolationLevel: 'read uncommitted',
  })
  async quickRead() {
    // Fastest but least safe - may read uncommitted data
  }

  // Read Committed - Default in PostgreSQL, prevents dirty reads
  @Transactional({
    isolationLevel: 'read committed',
  })
  async standardOperation() {
    // Most common isolation level
    // Prevents reading uncommitted data from other transactions
  }

  // Repeatable Read - Prevents non-repeatable reads
  @Transactional({
    isolationLevel: 'repeatable read',
  })
  async consistentRead() {
    // Ensures that if you read a row twice, you get the same data
    // Prevents phantom reads in most cases
  }

  // Serializable - Highest isolation, prevents all anomalies
  @Transactional({
    isolationLevel: 'serializable',
  })
  async criticalOperation() {
    // Most strict - transactions execute as if they were serial
    // Best for critical financial operations
  }
}
```

**Isolation Level Comparison:**

| Level            | Dirty Reads  | Non-Repeatable Reads | Phantom Reads       | Performance |
| ---------------- | ------------ | -------------------- | ------------------- | ----------- |
| Read Uncommitted | ✅ Possible  | ✅ Possible          | ✅ Possible         | Fastest     |
| Read Committed   | ❌ Prevented | ✅ Possible          | ✅ Possible         | Fast        |
| Repeatable Read  | ❌ Prevented | ❌ Prevented         | ⚠️ Mostly Prevented | Medium      |
| Serializable     | ❌ Prevented | ❌ Prevented         | ❌ Prevented        | Slowest     |

### Nested Transactions (Savepoints)

When a `@Transactional()` method calls another `@Transactional()` method, the inner transaction creates a **savepoint** instead of a new transaction:

```typescript
@Injectable()
export class OrderService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDatabase,
    private readonly paymentService: PaymentService
  ) {}

  @Transactional()
  async createOrder(orderData: any) {
    // Outer transaction
    const order = await this.db.insert(orders).values(orderData).returning();

    try {
      // This creates a savepoint (nested transaction)
      await this.paymentService.processPayment(order.id, amount);
    } catch (error) {
      // If payment fails, only the payment operations roll back
      // The order creation remains committed
      this.logger.error('Payment failed, order created', { orderId: order.id });
      throw error;
    }

    return order;
  }
}

@Injectable()
export class PaymentService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase) {}

  @Transactional()
  async processPayment(orderId: string, amount: number) {
    // This runs in a savepoint (nested transaction)
    // If this fails, only these operations roll back
    await this.db.insert(payments).values({ orderId, amount });
    await this.db.update(accounts).set({ balance: sql`balance - ${amount}` });
  }
}
```

### Error Handling in Transactions

When an error occurs in a transaction, it's automatically rolled back. You can catch and handle errors:

```typescript
@Injectable()
export class OrderService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase) {}

  @Transactional()
  async createOrder(orderData: any) {
    try {
      const order = await this.db.insert(orders).values(orderData).returning();
      await this.processPayment(order.id);
      return order;
    } catch (error) {
      // Transaction is automatically rolled back
      // Log the error for debugging
      this.logger.error('Order creation failed', error);
      // Re-throw to let the caller know it failed
      throw error;
    }
  }
}
```

### When to Use Transactions

**Use transactions when:**

- ✅ Multiple database operations must succeed or fail together (atomicity)
- ✅ Operations span multiple services/tables
- ✅ Data consistency is critical (e.g., financial operations)
- ✅ You need to ensure referential integrity across multiple inserts/updates

**Don't use transactions for:**

- ❌ Simple single-table operations (unless you need rollback)
- ❌ Read-only operations (unless you need consistent reads)
- ❌ Long-running operations (they hold locks)
- ❌ Operations that don't need atomicity

### Transaction Best Practices

1. **Keep transactions short** - Long transactions hold locks and can cause deadlocks
2. **Use appropriate isolation levels** - Don't use `serializable` unless necessary
3. **Handle errors properly** - Always catch and handle transaction errors
4. **Avoid nested transactions for simple operations** - Only use when you need savepoint behavior
5. **Don't perform external API calls inside transactions** - They can cause long-running transactions
6. **Use transactions for write operations** - Read operations usually don't need transactions

### Example: E-Commerce Order Processing

Here's a complete example showing transaction usage in a real-world scenario:

```typescript
@Injectable()
export class OrderService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDatabase,
    private readonly inventoryService: InventoryService,
    private readonly paymentService: PaymentService,
    private readonly notificationService: NotificationService
  ) {}

  @Transactional({
    isolationLevel: 'read committed',
  })
  async processOrder(orderData: CreateOrderDto) {
    // Step 1: Reserve inventory (must succeed)
    await this.inventoryService.reserveItems(orderData.items);

    try {
      // Step 2: Process payment (critical - must succeed)
      const payment = await this.paymentService.chargeCustomer(
        orderData.customerId,
        orderData.total
      );

      // Step 3: Create order record
      const [order] = await this.db
        .insert(orders)
        .values({
          customerId: orderData.customerId,
          total: orderData.total,
          paymentId: payment.id,
          status: 'confirmed',
        })
        .returning();

      // Step 4: Create order items
      await this.db.insert(orderItems).values(
        orderData.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        }))
      );

      // Step 5: Update inventory (reduce stock)
      await this.inventoryService.reduceStock(orderData.items);

      // If we get here, everything succeeded - transaction commits automatically

      // External API call - do this AFTER transaction commits
      // (outside the transaction to avoid holding locks)
      await this.notificationService.sendOrderConfirmation(order.id);

      return order;
    } catch (error) {
      // If any step fails, entire transaction rolls back:
      // - Inventory reservation is released
      // - Payment is refunded (if charged)
      // - Order is not created
      // - Stock is not reduced

      this.logger.error('Order processing failed', { error, orderData });
      throw error;
    }
  }
}
```

### Performance Considerations

- **Transaction overhead**: Each transaction has overhead, so avoid unnecessary transactions
- **Lock duration**: Transactions hold locks until commit/rollback - keep them short
- **Connection pool**: Each active transaction uses a connection from the pool
- **Deadlocks**: Long transactions increase deadlock risk - use appropriate isolation levels
- **Read-only transactions**: Use `read only` mode when possible for better performance

```typescript
@Transactional({
  isolationLevel: 'read committed',
  readOnly: true, // Optimizes for read operations
})
async generateReport() {
  // Read-only transaction - faster and doesn't hold write locks
  return this.db.select().from(orders);
}
```

## Configuration Options

### DrizzleModuleOptions

```typescript
interface DrizzleModuleOptions {
  /**
   * PostgreSQL connection string or Pool configuration
   */
  connection: string | PoolConfig;

  /**
   * Custom schema for type-safe queries
   */
  schema?: Record<string, unknown>;

  /**
   * Enable query logging (uses LoggerService if available)
   * @default false
   */
  logQueries?: boolean;

  /**
   * Connection pool configuration
   */
  pool?: {
    min?: number; // @default 2
    max?: number; // @default 10
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };

  /**
   * Enable connection health checks
   * @default false
   */
  healthCheck?: boolean;

  /**
   * Retry configuration for connection failures
   */
  retry?: {
    maxRetries?: number;
    retryDelay?: number;
  };
}
```

### Example Configuration

```typescript
DrizzleModule.forRoot({
  connection: process.env.DATABASE_URL,
  logQueries: process.env.NODE_ENV === 'development',
  pool: {
    min: 2,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  schema: mySchema, // Optional: for type-safe queries
});
```

## Advanced Usage

### Custom Schema with Type Safety

```typescript
import { pgSchema } from 'drizzle-orm/pg-core';

const mySchema = pgSchema('my_schema', {
  users: usersTable,
  orders: ordersTable,
});

// In module configuration
DrizzleModule.forRoot({
  connection: process.env.DATABASE_URL,
  schema: mySchema,
});

// In service - now fully type-safe
@Injectable()
export class UsersService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDatabase<typeof mySchema>) {}

  async findUser(id: string) {
    // TypeScript knows about mySchema.users
    return this.db.select().from(mySchema.users).where(eq(mySchema.users.id, id));
  }
}
```

### Manual Transactions (Without CLS)

If you need manual transaction control:

```typescript
async transferFunds(fromId: string, toId: string, amount: number) {
  return this.db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({ balance: sql`balance - ${amount}` })
      .where(eq(accounts.id, fromId));

    await tx
      .update(accounts)
      .set({ balance: sql`balance + ${amount}` })
      .where(eq(accounts.id, toId));
  });
}
```

### Health Check

The module provides access to the connection pool for health checks:

```typescript
import { Inject } from '@nestjs/common';
import { DRIZZLE_POOL } from '@code-hive/nestjs/database/drizzle';
import { Pool } from 'pg';

@Injectable()
export class HealthService {
  constructor(@Inject(DRIZZLE_POOL) private readonly pool: Pool) {}

  async checkDatabase(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }
}
```

## Module Exports

The module exports the following:

- `DrizzleModule` - Main database module
- `DrizzleClsModule` - CLS module for transactional support
- `DrizzleDatabase` - Type for the database instance
- `DrizzleModuleOptions` - Configuration interface
- `InjectDrizzle` - Decorator for injecting database instance
- `DRIZZLE_DB` - Token for database instance
- `DRIZZLE_POOL` - Token for connection pool
- Utilities: `primaryUuid`, `brandedUuid`, `timestamps`

## Best Practices

1. **Always use DrizzleClsModule** - Enables request-scoped transactions and better context management
2. **Use @Transactional() decorator** - For operations that span multiple services
3. **Configure connection pool** - Set appropriate min/max connections based on your workload
4. **Enable query logging in development** - Helps with debugging and performance analysis
5. **Use schema utilities** - Leverage `primaryUuid` and `timestamps` for consistency
6. **Type your schemas** - Use TypeScript generics for full type safety

## Troubleshooting

### Connection Pool Errors

If you see "Connection pool exhausted" errors, increase the `max` pool size:

```typescript
pool: {
  max: 20, // Increase based on your concurrent request load
}
```

### Transaction Not Working

Ensure `DrizzleClsModule` is imported **after** `DrizzleModule`:

```typescript
@Module({
  imports: [
    DrizzleModule.forRootAsync({ ... }),
    DrizzleClsModule.forRoot(), // Must be after DrizzleModule
  ],
})
```

### Query Logging Not Appearing

Make sure `LoggerModule` is imported and `logQueries` is enabled:

```typescript
DrizzleModule.forRoot({
  connection: process.env.DATABASE_URL,
  logQueries: true, // Enable query logging
});
```

## Related Modules

- [Logger Module](../logger/README.md) - For query logging integration
- [Config Module](../config/README.md) - For configuration management
