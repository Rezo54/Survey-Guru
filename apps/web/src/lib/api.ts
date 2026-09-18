import { fieldApiOrigin, getFieldToken } from '../app/field/map/field-api';
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = await getFieldToken();
  const response = await fetch(fieldApiOrigin() + '/api/v1' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal ?? null, cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? 'The request could not be completed.');
  return result as T;
}
