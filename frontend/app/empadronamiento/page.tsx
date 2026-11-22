import type { Metadata } from 'next';
import { Portal } from '../portal';

export const metadata: Metadata = {
  title: 'Empadronamiento | MercaOrden',
  description: 'Registra y consulta tu solicitud de empadronamiento para comerciar en el mercado mayorista.',
};

export default async function Empadronamiento({
  searchParams,
}: {
  searchParams: Promise<{ acceso?: string }>;
}) {
  const { acceso } = await searchParams;
  return <Portal initialMode={acceso === 'entrar' ? 'login' : 'signup'} />;
}
