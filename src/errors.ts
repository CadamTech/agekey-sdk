import type { AgeKeyErrorCode } from "./types";

export class AgeKeyError extends Error {
  readonly code: AgeKeyErrorCode;
  readonly docsUrl?: string;

  constructor(
    code: AgeKeyErrorCode,
    message: string,
    options?: { docsUrl?: string; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "AgeKeyError";
    this.code = code;
    this.docsUrl = options?.docsUrl;

    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class StateMismatchError extends AgeKeyError {
  constructor(message?: string) {
    super(
      "state_mismatch",
      message ||
        "State parameter mismatch. The callback state doesn't match the original request. " +
          "This could indicate a CSRF attack or an expired session.",
      { docsUrl: "https://docs.agekey.org/troubleshooting#state-mismatch" }
    );
    this.name = "StateMismatchError";
  }
}

export class NonceMismatchError extends AgeKeyError {
  constructor(message?: string) {
    super(
      "nonce_mismatch",
      message ||
        "Nonce mismatch. The ID token nonce doesn't match the original request. " +
          "This could indicate a replay attack.",
      { docsUrl: "https://docs.agekey.org/troubleshooting#nonce-mismatch" }
    );
    this.name = "NonceMismatchError";
  }
}

export class AccessDeniedError extends AgeKeyError {
  readonly errorDescription?: string;

  constructor(errorDescription?: string) {
    super(
      "access_denied",
      errorDescription ||
        "User denied the age verification request or closed the dialog.",
      { docsUrl: "https://docs.agekey.org/guides/handling-denials" }
    );
    this.name = "AccessDeniedError";
    this.errorDescription = errorDescription;
  }
}

export class InvalidTokenError extends AgeKeyError {
  constructor(message?: string) {
    super(
      "invalid_token",
      message || "Invalid or malformed ID token received.",
      { docsUrl: "https://docs.agekey.org/guides/jwt-validation" }
    );
    this.name = "InvalidTokenError";
  }
}

export class InvalidRequestError extends AgeKeyError {
  constructor(message: string) {
    super("invalid_request", message, {
      docsUrl: "https://docs.agekey.org/api-reference",
    });
    this.name = "InvalidRequestError";
  }
}

export class UnauthorizedClientError extends AgeKeyError {
  constructor(message?: string) {
    super(
      "unauthorized_client",
      message ||
        "Client is not authorized to perform this request. Check your credentials.",
      { docsUrl: "https://docs.agekey.org/troubleshooting#unauthorized-client" }
    );
    this.name = "UnauthorizedClientError";
  }
}

export class ServerError extends AgeKeyError {
  constructor(message?: string) {
    super(
      "server_error",
      message || "AgeKey server error. Please try again later.",
      { docsUrl: "https://docs.agekey.org/troubleshooting#server-errors" }
    );
    this.name = "ServerError";
  }
}

export class NetworkError extends AgeKeyError {
  constructor(message?: string, cause?: unknown) {
    super("network_error", message || "Network error during API request.", {
      cause,
    });
    this.name = "NetworkError";
  }
}

export function mapOidcError(
  error: string,
  errorDescription?: string
): AgeKeyError {
  const message = errorDescription || `OIDC error: ${error}`;

  switch (error) {
    case "access_denied":
      return new AccessDeniedError(errorDescription);
    case "invalid_request":
      return new InvalidRequestError(message);
    case "unauthorized_client":
      return new UnauthorizedClientError(message);
    case "server_error":
      return new ServerError(message);
    case "temporarily_unavailable":
      return new ServerError("Service temporarily unavailable. " + message);
    default:
      return new AgeKeyError("invalid_request" as AgeKeyErrorCode, message);
  }
}
