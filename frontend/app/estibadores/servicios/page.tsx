import type { Metadata } from 'next';
import { Portal } from '../../portal';

export const metadata: Metadata = {
  title: 'Servicios de estibaje | MercaOrden',
  description: 'Solicita un servicio de estibaje o coordina su asignación con la tarifa oficial.',
};

export default function ServiciosDeEstibaje() {
  return <Portal service="stevedore-services" initialMode="login" />;
}
