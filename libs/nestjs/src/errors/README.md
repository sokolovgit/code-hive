# Errors Module

Single custom error class for structured error handling across HTTP, RPC, and WebSocket contexts.

## How It Works Across Contexts

### Example: Service Used by Both HTTP and RPC

When you throw a `BaseError` in a service that's used by both HTTP controllers and RPC handlers, the `ExceptionLoggingFilter` automatically adapts the error response based on the context:

```typescript
import { Injectable } from '@nestjs/common';
import { BaseError } from '@code-hive/nestjs/errors';

@Injectable()
export class PaymentService {
  async processPayment(amount: number, accountId: string) {
    if (amount <= 0) {
      // This same error works for both HTTP and RPC!
      throw new BaseError('Invalid payment amount', 'INVALID_AMOUNT', {
        metadata: { amount, accountId },
      });
    }

    // ... payment logic
  }
}
```

#### HTTP Context

When called from an HTTP controller:

```typescript
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(@Body() dto: CreatePaymentDto) {
    // If BaseError is thrown here:
    return await this.paymentService.processPayment(dto.amount, dto.accountId);
  }
}
```

**HTTP Response (400 Bad Request):**

```json
{
  "statusCode": 400,
  "code": "INVALID_AMOUNT",
  "message": "Invalid payment amount",
  "metadata": {
    "amount": 0,
    "accountId": "acc-123"
  }
}
```

#### RPC Context

When called from an RPC handler:

```typescript
@MessagePattern('process_payment')
export class PaymentRpcHandler {
  constructor(private readonly paymentService: PaymentService) {}

  async handle(data: { amount: number; accountId: string }) {
    // If BaseError is thrown here:
    return await this.paymentService.processPayment(data.amount, data.accountId);
  }
}
```

**RPC Error Response (no HTTP statusCode):**

```json
{
  "code": "INVALID_AMOUNT",
  "message": "Invalid payment amount",
  "metadata": {
    "amount": 0,
    "accountId": "acc-123"
  }
}
```

Notice that:

- ✅ **HTTP context**: Includes `statusCode` if you set it (e.g. 400)
- ✅ **RPC context**: Excludes `statusCode` (not relevant for RPC)
- ✅ **Same error class**: Works seamlessly in both contexts
- ✅ **Consistent metadata**: Same error information in both contexts

## Error Flow

### HTTP Flow

1. **Service throws error** → `BaseError` (optionally with `statusCode` for HTTP)
2. **ExceptionLoggingFilter catches it** → Detects HTTP context
3. **Uses `getClientSafeError()`** → Includes statusCode for HTTP response
4. **Logs using `toJSON()`** → Full error details for logging
5. **Returns HTTP response** → JSON with statusCode

### RPC Flow

1. **Service throws error** → `BaseError`
2. **ExceptionLoggingFilter catches it** → Detects RPC context
3. **Uses `getRpcError()`** → Excludes statusCode (not needed for RPC)
4. **Logs using `toJSON()`** → Full error details for logging
5. **Returns RPC error** → JSON without statusCode

## Transport Recognition (HTTP vs RPC vs WS)

`BaseError` includes a `transport` discriminator, which is **automatically detected** by the `ExceptionLoggingFilter` (based on Nest context).

- `'http' | 'rpc' | 'ws'` - set by the runtime when the error is handled
- `'unknown'` - default if the error hasn't been handled yet

## Best Practices

### 1. Use Appropriate Status Code When Needed

```typescript
import { BaseError } from '@code-hive/nestjs/errors';

// ✅ Good - business logic error (HTTP)
if (balance < amount) {
  throw new BaseError('Insufficient funds', 'INSUFFICIENT_FUNDS', {
    statusCode: 400,
    metadata: { balance, amount },
  });
}

// ✅ Good - data validation error
if (!email.includes('@')) {
  throw new BaseError('Invalid email', 'INVALID_EMAIL', {
    metadata: { field: 'email', value: email },
  });
}
```

### 2. Include Relevant Metadata

```typescript
// ✅ Good - Rich context
throw new BaseError('Order limit exceeded', 'ORDER_LIMIT_EXCEEDED', {
  metadata: {
    userId: user.id,
    currentOrders: 10,
    maxOrders: 5,
    limitType: 'premium',
  },
});
```

### 3. Control Logging for Expected Errors

```typescript
// ✅ Good - Don't log expected business errors
throw new BaseError('Item out of stock', 'OUT_OF_STOCK', {
  loggable: false, // Expected error, no need to log
  exposeToClient: true,
});
```

### 4. Don't Expose Internal Errors

```typescript
// ✅ Good - Hide internal details
throw new BaseError('Payment gateway failed', 'PAYMENT_GATEWAY_ERROR', {
  statusCode: 502,
  exposeToClient: false, // Don't expose to clients
  loggable: true, // But do log it
});
```

## Integration with Logger

All errors automatically integrate with the `ExceptionLoggingFilter`:

- **Automatic detection** - Custom errors are detected by type
- **Context-aware** - Different serialization for HTTP vs RPC
- **Respects flags** - Honors `loggable` and `exposeToClient`
- **Structured logging** - Uses `toJSON()` for consistent log format

## Error Serialization Methods

### `toJSON()` - For Logging

Returns full error details including stack trace:

```typescript
{
  name: "BaseError",
  code: "INVALID_AMOUNT",
  transport: "unknown",
  message: "Invalid payment amount",
  statusCode: 400,
  metadata: { amount: 0 },
  timestamp: "2024-01-15T10:30:45.123Z",
  stack: "..."
}
```

### `getClientSafeError()` - For HTTP Responses

Returns safe error for HTTP clients:

```typescript
{
  code: "INVALID_AMOUNT",
  message: "Invalid payment amount",
  statusCode: 400,
  metadata: { amount: 0 }
}
```

### `getRpcError()` - For RPC Responses

Returns error for RPC transport (no statusCode):

```typescript
{
  code: "INVALID_AMOUNT",
  message: "Invalid payment amount",
  metadata: { amount: 0 }
}
```
