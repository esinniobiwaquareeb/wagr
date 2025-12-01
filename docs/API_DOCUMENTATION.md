# API Documentation

This document provides comprehensive documentation for all API endpoints in the wagered.app platform.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://wagered.app`

## Authentication

Most endpoints require authentication via session cookie (`wagr_session`). The session is automatically managed by the application.

### Headers

All authenticated requests should include:
```
Cookie: wagr_session=<session_token>
```

## Response Format

All API responses follow a standard format:

```typescript
{
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
```

## Error Codes

See `lib/error-handler.ts` for complete list of error codes.

Common error codes:
- `UNAUTHORIZED` (401): Not authenticated
- `FORBIDDEN` (403): Insufficient permissions
- `VALIDATION_ERROR` (400): Invalid input
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMIT_EXCEEDED` (429): Too many requests

---

## Authentication Endpoints

### POST `/api/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "username"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username"
    }
  }
}
```

### POST `/api/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "rememberMe": false
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "is_admin": false
    }
  }
}
```

### POST `/api/auth/logout`

Logout current user.

**Response:** `200 OK`
```json
{
  "success": true
}
```

### GET `/api/auth/me`

Get current authenticated user.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "balance": 1000,
      "is_admin": false
    }
  }
}
```

---

## Wagers Endpoints

### GET `/api/wagers`

Get list of wagers with optional filters.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status (OPEN, CLOSED, RESOLVED)
- `category` (string): Filter by category
- `search` (string): Search query

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "wagers": [...],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### GET `/api/wagers/[id]`

Get a specific wager by ID.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "wager": {
      "id": "uuid",
      "title": "Wager Title",
      "description": "Description",
      "amount": 1000,
      "side_a": "Option A",
      "side_b": "Option B",
      "status": "OPEN",
      "deadline": "2024-01-01T00:00:00Z",
      "participants_count": 10
    }
  }
}
```

### POST `/api/wagers`

Create a new wager.

**Request Body:**
```json
{
  "title": "Wager Title",
  "description": "Description",
  "amount": 1000,
  "side_a": "Option A",
  "side_b": "Option B",
  "deadline": "2024-01-01T00:00:00Z",
  "category": "sports",
  "is_public": true
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "wager": { ... }
  }
}
```

### POST `/api/wagers/[id]/join`

Join a wager.

**Request Body:**
```json
{
  "side": "A",
  "amount": 500
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "entry": { ... }
  }
}
```

---

## Payment Endpoints

### POST `/api/payments/initialize`

Initialize a Paystack payment for deposit.

**Request Body:**
```json
{
  "amount": 1000,
  "email": "user@example.com",
  "userId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://paystack.com/...",
    "reference": "wagr_..."
  }
}
```

### GET `/api/payments/verify`

Verify a payment (called by Paystack redirect).

**Query Parameters:**
- `reference`: Payment reference

**Response:** Redirects to `/wallet` with success/error

### POST `/api/payments/withdraw`

Request a withdrawal.

**Request Body:**
```json
{
  "amount": 5000,
  "accountNumber": "1234567890",
  "bankCode": "058",
  "accountName": "John Doe"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "withdrawal": { ... }
  }
}
```

### POST `/api/payments/verify-account`

Verify bank account details.

**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "bankCode": "058"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accountName": "John Doe"
  }
}
```

---

## Wallet Endpoints

### GET `/api/wallet/balance`

Get current wallet balance.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "balance": 10000
  }
}
```

### GET `/api/wallet/transactions`

Get transaction history.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `type` (string): Filter by transaction type

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "transactions": [...],
    "meta": { ... }
  }
}
```

### POST `/api/wallet/transfer`

Transfer funds to another user.

**Request Body:**
```json
{
  "recipientUsername": "recipient",
  "amount": 1000
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "transaction": { ... }
  }
}
```

---

## Notifications Endpoints

### GET `/api/notifications`

Get user notifications.

**Query Parameters:**
- `unread` (boolean): Filter unread only
- `limit` (number): Items per page

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "unreadCount": 5
  }
}
```

### PATCH `/api/notifications/[id]`

Mark notification as read.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## Admin Endpoints

All admin endpoints require `is_admin: true` in user profile.

### GET `/api/admin/users`

Get all users (admin only).

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `search` (string): Search query

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "users": [...],
    "meta": { ... }
  }
}
```

### GET `/api/admin/wagers`

Get all wagers (admin only).

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "wagers": [...]
  }
}
```

### POST `/api/admin/wagers/[id]/resolve`

Resolve a wager (admin only).

**Request Body:**
```json
{
  "winningSide": "A"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "wager": { ... }
  }
}
```

---

## Rate Limiting

Most endpoints have rate limiting enabled:
- **Authentication endpoints**: 5 requests per minute
- **Payment endpoints**: 10 requests per minute
- **General endpoints**: 60 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (ISO 8601)

---

## Webhooks

### POST `/api/payments/webhook`

Paystack webhook endpoint for payment events.

**Headers:**
- `x-paystack-signature`: Webhook signature

**Events:**
- `charge.success`: Payment successful
- `charge.failed`: Payment failed

---

## Error Handling

All errors follow the standard response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "details": { ... }
  }
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

---

## Type Definitions

See `lib/types/api.ts` for complete TypeScript type definitions.

