const windows = new Map<string, { startedAt: number; count: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): boolean {
  const current = windows.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    windows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function resetRateLimitsForTests() {
  windows.clear();
}
