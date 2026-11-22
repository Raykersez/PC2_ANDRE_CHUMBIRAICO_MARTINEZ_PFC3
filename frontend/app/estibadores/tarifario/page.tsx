import type { Metadata } from 'next';
import { Brand } from '../../components';
import { ThemeSelect } from '../../theme-select';
import { StevedoreTariffs } from './tariffs';

export const metadata: Metadata = {
  title: 'Tarifario oficial de estibaje | MercaOrden',
  description: 'Consulta las tarifas de estibaje vigentes en soles y su unidad de cobro.',
};

export default function Tarifario() {
  return (
    <>
      <a className="skip" href="#tarifario">Ir al tarifario</a>
      <header className="top-bar">
        <div className="shell top-content">
          <a href="/" aria-label="Inicio de MercaOrden"><Brand /></a>
          <nav aria-label="Navegación principal">
            <a className="nav-link" href="/estibadores">Estibadores</a>
          </nav>
          <ThemeSelect />
        </div>
      </header>
      <main className="shell" id="tarifario" tabIndex={-1}>
        <section className="intro">
          <h1>Tarifario oficial de estibaje</h1>
          <p>Consulta el monto en soles y la unidad de cobro antes de solicitar un servicio.</p>
        </section>
        <StevedoreTariffs />
      </main>
    </>
  );
}
