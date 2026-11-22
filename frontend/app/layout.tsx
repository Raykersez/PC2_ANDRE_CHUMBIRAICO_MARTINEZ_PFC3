import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Empadronamiento | MercaOrden',
  description: 'Registra y consulta tu solicitud de empadronamiento para comerciar en el mercado mayorista.',
  openGraph: {
    title: 'Empadronamiento | MercaOrden',
    description: 'Inicia tu formalización y consulta el estado de tu expediente digital.',
    locale: 'es_PE',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-PE"><body>{children}</body></html>;
}
