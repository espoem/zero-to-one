// Dependency injection instead of module mocking (module 12 §4.4).
export interface Deps {
  now(): number;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  log(msg: string): void;
}

export async function refreshToken(
  deps: Deps,
  token: { value: string; expiresAt: number },
): Promise<{ value: string; expiresAt: number }> {
  if (token.expiresAt - deps.now() > 60_000) return token; // still valid for a minute
  const res = await deps.fetch('https://auth.example.com/token', { method: 'POST' });
  if (!res.ok)
    throw Object.assign(new Error('refresh failed'), { code: 'E_REFRESH', status: res.status });
  deps.log('token refreshed');
  return (await res.json()) as { value: string; expiresAt: number };
}
