/**
 * Asserts that a string does not exceed maximum allowable length.
 */
export function assertSafeLength(value: unknown, maxLength: number, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`Field '${fieldName}' must be a string.`);
  }
  if (value.length > maxLength) {
    throw new RangeError(`Field '${fieldName}' exceeds maximum allowed length of ${maxLength} characters.`);
  }
  return value;
}

/**
 * Asserts that an identifier matches safe alphanumeric/dash/underscore constraints.
 */
export function assertSafeIdentifier(value: unknown, maxLength: number, fieldName: string): string {
  const str = assertSafeLength(value, maxLength, fieldName);
  if (!/^[a-zA-Z0-9_-]+$/.test(str)) {
    throw new RangeError(`Field '${fieldName}' contains illegal characters. Only alphanumeric, hyphen, and underscore allowed.`);
  }
  return str;
}
