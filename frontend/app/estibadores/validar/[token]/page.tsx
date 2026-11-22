import type { Metadata } from 'next';
import { Brand } from '../../../components';
import { CredentialValidation } from '../../../credential-validation';

export const metadata: Metadata = {
  title: 'Validación de credencial de estibaje | MercaOrden',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function ValidarCredencial({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <header className="top-bar">
        <div className="shell top-content"><a href="/" aria-label="Inicio de MercaOrden"><Brand /></a></div>
      </header>
      <main className="shell">
        <section className="intro"><h1>Validar credencial de estibaje</h1></section>
        <CredentialValidation token={token} />
      </main>
    </>
  );
}
