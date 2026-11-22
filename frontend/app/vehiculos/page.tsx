import type { Metadata } from 'next';
import { Brand } from '../components';
import { ThemeSelect } from '../theme-select';
import { VehicleWorkspace } from './workspace';
import './logistics.css';

export const metadata: Metadata = {
  title: 'Turnos de carga y descarga | MercaOrden',
  description: 'Consulta las ventanas de atención para vehículos en el mercado mayorista.',
};

export default function Vehiculos() {
  return (
    <>
      <a className="skip" href="#turnos">Ir a los turnos</a>
      <header className="top-bar">
        <div className="shell top-content">
          <a href="/" aria-label="Inicio de MercaOrden"><Brand /></a>
          <ThemeSelect />
        </div>
      </header>
      <main className="shell" id="turnos" tabIndex={-1}>
        <section className="intro">
          <h1>Turnos de carga y descarga</h1>
          <p>Consulta las bahías y horarios disponibles para programar tu visita al mercado mayorista.</p>
        </section>
        <VehicleWorkspace />
      </main>
    </>
  );
}
