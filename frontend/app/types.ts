export type User = { id: string; email: string; role: 'merchant' | 'staff' };
export type Application = { code: string; name: string; category: string; status: 'pending'; createdAt: string };
export type Fields = Record<string, string>;
