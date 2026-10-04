let accessToken: (() => Promise<string | undefined>) | undefined;
export function setAccessTokenProvider(provider: () => Promise<string | undefined>) { accessToken = provider; }
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const token = await accessToken?.();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result as T;
}
