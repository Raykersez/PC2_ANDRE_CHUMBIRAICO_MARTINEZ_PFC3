import type { Metadata } from 'next';
import { Portal } from '../portal';

export const metadata: Metadata = {
  title: 'Certificación de estibadores | MercaOrden',
  description: 'Presenta y consulta tu expediente para trabajar como estibador en el mercado mayorista.',
};

export default async function Estibadores({ searchParams }: { searchParams: Promise<{ acceso?: string }> }) {
  const { acceso } = await searchParams;
  return <Portal service="stevedores" initialMode={acceso === 'entrar' ? 'login' : 'signup'} />;
}
