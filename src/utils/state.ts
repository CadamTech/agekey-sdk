import { DEFAULTS } from "../constants";

export function generateToken(length: number = DEFAULTS.tokenLength): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("Crypto API not available. Use a modern browser or Node.js 15+.");
}
