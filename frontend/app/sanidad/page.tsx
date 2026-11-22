import type { Metadata } from 'next';
import { Portal } from '../portal';

export const metadata: Metadata = {
  title: 'Fiscalización sanitaria | MercaOrden',
  description: 'Inspecciones y seguimiento sanitario para los puestos del mercado mayorista.',
};

export default function Sanidad() {
  return <Portal service="sanitary" initialMode="login" />;
}
