# @agekey/sdk

Official AgeKey SDK for age verification integration.

## Installation

```bash
npm i @agekey/sdk
# or
pnpm add @agekey/sdk
# or
yarn add @agekey/sdk
```

## Quick Start

### Use AgeKey: Verify Age

Check if a user meets age requirements.

```typescript
import { AgeKey } from '@agekey/sdk';

// Initialize the client
const agekey = new AgeKey({
  clientId: 'ak_test_xxxx',        // Your App ID
  redirectUri: 'https://myapp.com/callback',
});

// 1. Build authorization URL
const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
  ageThresholds: [13, 18, 21],     // Ages to verify
});

// Store state/nonce in session (needed to validate callback)
session.ageKeyState = state;
session.ageKeyNonce = nonce;

// Redirect user to AgeKey
window.location.href = url;
```

```typescript
// 2. Handle callback (on your /callback route)
import { AgeKey, AccessDeniedError } from '@agekey/sdk';

const agekey = new AgeKey({
  clientId: 'ak_test_xxxx',
  redirectUri: 'https://myapp.com/callback',
});

try {
  const result = agekey.useAgeKey.handleCallback(
    window.location.href,
    { state: session.ageKeyState, nonce: session.ageKeyNonce }
  );

  // Check age thresholds
  if (result.ageThresholds["18"]) {
    console.log("User is 18+");
  } else {
    console.log("User is under 18");
  }
} catch (error) {
  if (error instanceof AccessDeniedError) {
    console.log("User cancelled verification");
  }
}
```

### Create AgeKey: Store Age Verification

Store age verification signals for users (server-side only).

```typescript
import { AgeKey } from '@agekey/sdk';

// Initialize with client secret (server-side only!)
const agekey = new AgeKey({
  clientId: 'ak_test_xxxx',
  clientSecret: 'sk_test_xxxx',    // Required for Create flow
  redirectUri: 'https://myapp.com/callback',
});

// 1. Initiate Create AgeKey flow
const { authUrl, requestUri, expiresIn } = await agekey.createAgeKey.initiate({
  method: 'id_doc_scan',           // Verification method used
  age: { date_of_birth: '2000-01-15' },
  verifiedAt: new Date(),
  verificationId: 'txn_123456',    // Your unique transaction ID
});

// Redirect user to authUrl
res.redirect(authUrl);
```

```typescript
// 2. Handle callback
const result = agekey.createAgeKey.handleCallback(callbackUrl);

if (result.success) {
  console.log("AgeKey created successfully!");
} else {
  console.log("Error:", result.error);
}
```

## API Reference

### `AgeKey` Class

Main client class for all AgeKey operations.

```typescript
const agekey = new AgeKey({
  clientId: string,       // Required: Your App ID (ak_test_xxx or ak_live_xxx)
  clientSecret?: string,  // Optional: Your App Secret (server-side only)
  redirectUri: string,    // Required: Pre-registered callback URL
});
```

**Properties:**
- `agekey.useAgeKey` - Use AgeKey namespace
- `agekey.createAgeKey` - Create AgeKey namespace
- `agekey.isTestMode` - Whether using test credentials
- `agekey.clientId` - The client ID
- `agekey.redirectUri` - The redirect URI

### Use AgeKey Namespace

#### `getAuthorizationUrl(options)`

Build an authorization URL to redirect the user.

```typescript
const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
  ageThresholds: [18],           // Required: Ages to verify
  allowedMethods?: [...],        // Optional: Restrict verification methods
  verifiedAfter?: Date,          // Optional: Require recent verification
  enableCreate?: boolean,        // Optional: Allow creating AgeKey if none
});
```

#### `handleCallback(callbackUrl, validation)`

Validate the callback and extract age verification results.

```typescript
const result = agekey.useAgeKey.handleCallback(callbackUrl, { state, nonce });
// result.ageThresholds: { "18": true, "21": false }
// result.subject: "user_123" (optional)
// result.raw: { ... } (full JWT payload)
```

### Create AgeKey Namespace

#### `pushAuthorizationRequest(options)` (server-side)

Send a PAR request to initiate Create AgeKey flow.

```typescript
const { requestUri, expiresIn } = await agekey.createAgeKey.pushAuthorizationRequest({
  method: 'id_doc_scan',
  age: { date_of_birth: '2000-01-15' },
  verifiedAt: new Date(),
  verificationId: 'txn_123',
  attributes?: { ... },          // Optional: Method-specific attributes
  enableUpgrade?: boolean,       // Optional: Allow upgrading existing AgeKey
});
```

#### `getAuthorizationUrl(requestUri)`

Build authorization URL from PAR response.

```typescript
const url = agekey.createAgeKey.getAuthorizationUrl(requestUri);
```

#### `initiate(options)` (server-side)

Convenience method combining PAR + authorization URL.

```typescript
const { authUrl, requestUri, expiresIn } = await agekey.createAgeKey.initiate({
  method: 'id_doc_scan',
  age: { date_of_birth: '2000-01-15' },
  verifiedAt: new Date(),
  verificationId: 'txn_123',
});
```

## Error Handling

The SDK provides typed errors for common scenarios:

```typescript
import {
  AgeKeyError,           // Base error class
  StateMismatchError,    // CSRF protection triggered
  NonceMismatchError,    // Replay attack detected
  AccessDeniedError,     // User cancelled or denied
  InvalidTokenError,     // Malformed/expired token
  InvalidRequestError,   // Bad request parameters
  UnauthorizedClientError, // Invalid credentials
  ServerError,           // AgeKey server error
  NetworkError,          // Network connectivity issue
} from '@agekey/sdk';

try {
  const result = agekey.useAgeKey.handleCallback(url, { state, nonce });
} catch (error) {
  if (error instanceof AccessDeniedError) {
    // User cancelled - show friendly message
  } else if (error instanceof StateMismatchError) {
    // Possible CSRF - restart flow
  } else if (error instanceof AgeKeyError) {
    // Other AgeKey error
    console.log(error.code, error.message, error.docsUrl);
  }
}
```

## Environment Detection

The SDK automatically detects test vs live environment from your credentials:

- `ak_test_*` / `sk_test_*` → Test environment
- `ak_live_*` / `sk_live_*` → Live environment

```typescript
const agekey = new AgeKey({ clientId: 'ak_test_xxx', ... });
console.log(agekey.isTestMode); // true
```

## Verification Methods

Supported methods for Create AgeKey:

| Method | Description |
|--------|-------------|
| `id_doc_scan` | Government ID document scan |
| `payment_card_network` | Credit/debit card verification |
| `facial_age_estimation` | AI-based facial age estimation |
| `email_age_estimation` | Email-based age signals |
| `digital_credential` | Digital identity credentials |
| `national_id_number` | National ID number verification |

## Age Formats

When creating an AgeKey, specify age in one of these formats:

```typescript
// Exact date of birth
age: { date_of_birth: '2000-01-15' }

// Exact years
age: { years: 24 }

// At least N years (minimum age)
age: { at_least_years: 21 }
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  AgeKeyConfig,
  UseAgeKeyOptions,
  UseAgeKeyResult,
  CreateAgeKeyOptions,
  PARResult,
  VerificationMethod,
  AgeSpec,
} from '@agekey/sdk';
```

## Documentation

- [AgeKey Documentation](https://docs.agekey.org)
- [Quickstart Guide](https://docs.agekey.org/quickstart)
- [API Reference](https://docs.agekey.org/api-reference)
- [Troubleshooting](https://docs.agekey.org/troubleshooting)

## License

MIT
