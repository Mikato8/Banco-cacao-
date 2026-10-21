const TOKEN_KEY = 'banco-cacao-token';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SELLER' | 'CLIENT';
  cacaoBalance: number;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  cacaoPrice: number;
  stock: number;
  seller?: { id: string; name: string } | null;
};

export type LedgerEntry = {
  id: string;
  type: string;
  amountCacao: number;
  amountMxn?: number | null;
  note?: string | null;
  createdAt: string;
  fromUser?: { name: string; email: string } | null;
  toUser?: { name: string; email: string } | null;
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : 'Error de red';
    throw new Error(msg);
  }
  return data as T;
}
