# Errors Module

Comprehensive custom error classes for structured error handling across HTTP, RPC, and WebSocket contexts.

## How It Works Across Contexts

### Example: Service Used by Both HTTP and RPC

When you throw a `BusinessError` (or any `BaseError`) in a service that's used by both HTTP controllers and RPC handlers, the `ExceptionLoggingFilter` automatically adapts the error response based on the context:

```typescript
import { Injectable } from '@nestjs/common';
import { BusinessError } from '@code-hive/nestjs/errors';

@Injectable()
export class PaymentService {
  async processPayment(amount: number, accountId: string) {
    if (amount <= 0) {
      // This same error works for both HTTP and RPC!
      throw new BusinessError('Invalid payment amount', 'INVALID_AMOUNT', {
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
    // If BusinessError is thrown here:
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
    // If BusinessError is thrown here:
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

- ✅ **HTTP context**: Includes `statusCode: 400` (from BusinessError default)
- ✅ **RPC context**: Excludes `statusCode` (not relevant for RPC)
- ✅ **Same error class**: Works seamlessly in both contexts
- ✅ **Consistent metadata**: Same error information in both contexts

## Error Flow

### HTTP Flow

1. **Service throws error** → `BusinessError` with `statusCode: 400`
2. **ExceptionLoggingFilter catches it** → Detects HTTP context
3. **Uses `getClientSafeError()`** → Includes statusCode for HTTP response
4. **Logs using `toJSON()`** → Full error details for logging
5. **Returns HTTP response** → JSON with statusCode

### RPC Flow

1. **Service throws error** → `BusinessError` with `statusCode: 400`
2. **ExceptionLoggingFilter catches it** → Detects RPC context
3. **Uses `getRpcError()`** → Excludes statusCode (not needed for RPC)
4. **Logs using `toJSON()`** → Full error details for logging
5. **Returns RPC error** → JSON without statusCode

## Error Types and Context Behavior

| Error Type      | HTTP Status   | RPC Format                  | Notes                               |
| --------------- | ------------- | --------------------------- | ----------------------------------- |
| `BusinessError` | 400 (default) | `{code, message, metadata}` | Works in both contexts              |
| `HttpError`     | Custom        | `{code, message, metadata}` | Designed for HTTP, works in RPC too |
| `RpcError`      | N/A           | `{code, message, metadata}` | Has `rpcCode` property              |
| `DataError`     | 400 (default) | `{code, message, metadata}` | Includes `field` property           |
| `AuthError`     | 401 (default) | `{code, message, metadata}` | Security-focused                    |
| `ExternalError` | 502 (default) | `{code, message, metadata}` | Not exposed to clients by default   |

## Best Practices

### 1. Use Appropriate Error Types

```typescript
// ✅ Good - Business logic error
if (balance < amount) {
  throw new BusinessError('Insufficient funds', 'INSUFFICIENT_FUNDS', {
    metadata: { balance, amount },
  });
}

// ✅ Good - Data validation error
if (!email.includes('@')) {
  throw new DataError('Invalid email', 'INVALID_EMAIL', {
    field: 'email',
    metadata: { value: email },
  });
}
```

### 2. Include Relevant Metadata

```typescript
// ✅ Good - Rich context
throw new BusinessError('Order limit exceeded', 'ORDER_LIMIT_EXCEEDED', {
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
throw new BusinessError('Item out of stock', 'OUT_OF_STOCK', {
  loggable: false, // Expected error, no need to log
  exposeToClient: true,
});
```

### 4. Don't Expose Internal Errors

```typescript
// ✅ Good - Hide internal details
throw new ExternalError('Payment gateway failed', 'PAYMENT_GATEWAY_ERROR', {
  serviceName: 'stripe',
  originalError: gatewayError,
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
  name: "BusinessError",
  code: "INVALID_AMOUNT",
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
