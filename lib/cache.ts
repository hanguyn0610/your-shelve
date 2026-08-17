interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Cache trong bộ nhớ của TỪNG instance (dùng Map, không phải cache dùng chung).
// Dữ liệu mất khi server restart, và mỗi instance sẽ tự cache riêng nếu chạy
// nhiều instance song song (không đồng bộ giữa các instance). Đủ dùng cho MVP
// một instance; khi scale ngang nhiều instance thì cần đổi sang cache dùng chung
// như Redis để tránh mỗi instance gọi lại nguồn dữ liệu gốc một cách độc lập.
const cache = new Map<string, CacheEntry<unknown>>();

export async function getOrSetCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const value = await fetcher();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}
