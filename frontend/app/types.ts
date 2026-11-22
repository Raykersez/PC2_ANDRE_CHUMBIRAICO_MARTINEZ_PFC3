export type User = { id: string; email: string; role: 'merchant' | 'staff' | 'market_admin' };
export type Stall = { code: string; location: string };
export type Assignment = Stall & { assignedAt: string };
export type Application = {
  code: string;
  name: string;
  category: string;
  status: 'pending' | 'approved' | 'observed';
  createdAt: string;
  decision?: { reason: string | null; decidedAt: string; evaluatorId: string | null };
  assignment?: Assignment;
};
export type Fields = Record<string, string>;
