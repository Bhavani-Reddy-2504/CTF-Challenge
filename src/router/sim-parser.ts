import { APPROVED_SIM_NAMESPACES, ROUTE_LIMITS, SimNamespace, SimRoute } from './sim-route.js';
import { InvalidSimRouteError, UnsupportedSimNamespaceError } from './sim-errors.js';

// Strict segment grammar: lowercase alphanumeric with optional internal hyphens
const SEGMENT_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// Detection of illegal control chars, null bytes, whitespace
const ILLEGAL_CHARS_REGEX = /[\x00-\x20\x7F]/;

/**
 * Pure, deterministic parser for sim:// symbolic URIs.
 * Performs zero network, DNS, or filesystem operations.
 *
 * @throws {InvalidSimRouteError} on syntax, grammar, traversal, or limit violations
 * @throws {UnsupportedSimNamespaceError} when namespace is not in the approved closed set
 */
export function parseSimRoute(rawInput: unknown): SimRoute {
  // 1. Input type assertion
  if (typeof rawInput !== 'string') {
    throw new InvalidSimRouteError('Route input must be a string.');
  }

  // 2. Bound checks
  if (rawInput.length > ROUTE_LIMITS.MAX_URI_LENGTH) {
    throw new InvalidSimRouteError(
      `Route length (${rawInput.length}) exceeds maximum limit of ${ROUTE_LIMITS.MAX_URI_LENGTH} characters.`
    );
  }

  if (rawInput.length < 8) {
    throw new InvalidSimRouteError('Route string is too short to be a valid sim:// URI.');
  }

  // 3. Absolute ban on null bytes, control characters, and whitespace
  if (ILLEGAL_CHARS_REGEX.test(rawInput)) {
    throw new InvalidSimRouteError('Route contains prohibited whitespace, control characters, or null bytes.');
  }

  // 4. Ban on percent encoding, backslashes, queries, fragments, and userinfo delimiters
  if (rawInput.includes('%')) {
    throw new InvalidSimRouteError('Percent encoding is strictly forbidden.');
  }
  if (rawInput.includes('\\')) {
    throw new InvalidSimRouteError('Backslashes are strictly forbidden.');
  }
  if (rawInput.includes('?')) {
    throw new InvalidSimRouteError('Query strings are not permitted in sim:// routes.');
  }
  if (rawInput.includes('#')) {
    throw new InvalidSimRouteError('Fragment identifiers are not permitted in sim:// routes.');
  }
  if (rawInput.includes('@')) {
    throw new InvalidSimRouteError('Userinfo / authority delimiters are strictly forbidden.');
  }

  // 5. Scheme verification: must strictly begin with 'sim://' (case-sensitive)
  if (!rawInput.startsWith('sim://')) {
    throw new InvalidSimRouteError('Invalid scheme: URI must begin strictly with "sim://".');
  }

  // 6. Namespace and path division
  const afterScheme = rawInput.substring(6); // Skip 'sim://'
  const firstSlashIdx = afterScheme.indexOf('/');

  if (firstSlashIdx === -1) {
    throw new InvalidSimRouteError('Route must include a resource path following the namespace.');
  }

  const namespaceStr = afterScheme.substring(0, firstSlashIdx);
  const pathStr = afterScheme.substring(firstSlashIdx + 1);

  // 7. Namespace validation
  if (namespaceStr.length === 0) {
    throw new InvalidSimRouteError('Namespace cannot be empty.');
  }

  if (namespaceStr.length > ROUTE_LIMITS.MAX_NAMESPACE_LENGTH) {
    throw new InvalidSimRouteError(
      `Namespace length (${namespaceStr.length}) exceeds limit of ${ROUTE_LIMITS.MAX_NAMESPACE_LENGTH}.`
    );
  }

  // Prevent authority confusion (ports, IPs, DNS domains)
  if (namespaceStr.includes(':')) {
    throw new InvalidSimRouteError('Port specification is forbidden in symbolic namespaces.');
  }
  if (namespaceStr.includes('.')) {
    throw new InvalidSimRouteError('DNS domain syntax or IP addresses are forbidden in symbolic namespaces.');
  }

  // Enforce closed approved namespace set (case-sensitive)
  if (!APPROVED_SIM_NAMESPACES.has(namespaceStr as SimNamespace)) {
    throw new UnsupportedSimNamespaceError(
      `Namespace '${namespaceStr}' is not an approved symbolic namespace.`
    );
  }

  // 8. Resource path validation
  if (pathStr.length === 0) {
    throw new InvalidSimRouteError('Resource path cannot be empty.');
  }

  if (pathStr.endsWith('/')) {
    throw new InvalidSimRouteError('Trailing slashes are not permitted in resource paths.');
  }

  if (pathStr.includes('//')) {
    throw new InvalidSimRouteError('Consecutive forward slashes are not permitted.');
  }

  const rawSegments = pathStr.split('/');

  if (rawSegments.length > ROUTE_LIMITS.MAX_SEGMENTS) {
    throw new InvalidSimRouteError(
      `Path segment count (${rawSegments.length}) exceeds maximum limit of ${ROUTE_LIMITS.MAX_SEGMENTS}.`
    );
  }

  // 9. Path segment validation
  for (const segment of rawSegments) {
    if (segment.length === 0) {
      throw new InvalidSimRouteError('Empty path segments are not permitted.');
    }

    if (segment.length > ROUTE_LIMITS.MAX_SEGMENT_LENGTH) {
      throw new InvalidSimRouteError(
        `Segment length (${segment.length}) exceeds maximum limit of ${ROUTE_LIMITS.MAX_SEGMENT_LENGTH}.`
      );
    }

    if (segment === '.' || segment === '..') {
      throw new InvalidSimRouteError('Path traversal elements are strictly prohibited.');
    }

    if (!SEGMENT_REGEX.test(segment)) {
      throw new InvalidSimRouteError(
        `Segment '${segment}' contains illegal characters. Only lowercase alphanumeric and internal hyphens are allowed.`
      );
    }
  }

  // 10. Construct immutable, canonical SimRoute
  return new SimRoute(namespaceStr as SimNamespace, rawSegments);
}
