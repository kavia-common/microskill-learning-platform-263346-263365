'use strict';

/**
 * Simple validators for payloads. These are intentionally lightweight and avoid extra deps.
 */

// PUBLIC_INTERFACE
function requireString(fieldName, value, minLen = 1) {
  /** Validate a string field with minimum length. */
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  if (value.trim().length < minLen) return `${fieldName} must be at least ${minLen} characters`;
  return null;
}

// PUBLIC_INTERFACE
function requireArrayOfStrings(fieldName, value, opts = {}) {
  /** Validate that a field is an array of non-empty strings. */
  const { allowEmpty = true, max = 64 } = opts;
  if (!Array.isArray(value)) return `${fieldName} must be an array`;
  if (!allowEmpty && value.length === 0) return `${fieldName} cannot be empty`;
  if (value.length > max) return `${fieldName} must have at most ${max} items`;
  for (const v of value) {
    if (typeof v !== 'string' || v.trim().length === 0) return `${fieldName} elements must be non-empty strings`;
  }
  return null;
}

// PUBLIC_INTERFACE
function collectErrors(checks) {
  /** Aggregate validator results into a list of errors. */
  return checks.filter(Boolean);
}

module.exports = {
  requireString,
  requireArrayOfStrings,
  collectErrors,
};
