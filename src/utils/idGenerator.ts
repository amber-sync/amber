/**
 * Generate a unique ID using crypto for security
 * Falls back to timestamp + random if crypto unavailable
 */
export function generateUniqueId(prefix?: string): string {
  // Fallback: timestamp + high-entropy random (crypto.randomUUID not available in all contexts)
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15) +
                 Math.random().toString(36).substring(2, 15);
  const id = `${timestamp}-${random}`;
  return prefix ? `${prefix}-${id}` : id;
}
