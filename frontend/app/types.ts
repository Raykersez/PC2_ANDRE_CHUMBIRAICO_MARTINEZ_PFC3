export type User = { id: string; email: string; role: 'merchant' | 'staff' };
export type Application = {
  code: string;
  name: string;
  category: string;
  status: 'pending' | 'approved' | 'observed';
  createdAt: string;
  decision?: { reason: string | null; decidedAt: string; evaluatorId: string | null };
};
export type Fields = Record<string, string>;
