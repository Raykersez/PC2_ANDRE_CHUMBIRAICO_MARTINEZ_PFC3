import { Brand } from './components';
import { Announcement, ContactForm, LandingAccess } from './landing-controls';
import { ThemeSelect } from './theme-select';
import './landing.css';

const start = '/empadronamiento#tramite';

export default async function Home({ searchParams }: { searchParams: Promise<{ ayuda?: string }> }) {
  const { ayuda } = await searchParams;

  return (
    <div className="landing">
      <a className="skip" href="#contenido">Ir al contenido</a>
      <header className="top-bar">
        <div className="shell top-content">
          <a href="/" aria-label="Inicio de MercaOrden"><Brand /></a>
          <nav aria-label="Navegación principal">
            <a className="nav-link" href="#acerca">Acerca de nosotros</a>
            <a className="nav-link" href="#contacto">Contáctanos</a>
          </nav>
          <div className="header-actions">
            <ThemeSelect />
            <LandingAccess />
          </div>
        </div>
      </header>

      <main id="contenido" className="shell" tabIndex={-1}>
        <Announcement />

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="hero-copy">
            <p className="hero-label">Para comerciantes mayoristas</p>
            <h1 id="landing-title">Formaliza tu actividad comercial</h1>
            <p>Con MercaOrden puedes presentar tu solicitud de empadronamiento y consultar el estado de tu expediente en línea.</p>
            <a className="button filled" href={start}>Iniciar empadronamiento</a>
          </div>
          <aside className="hero-guide" aria-labelledby="guide-title">
            <h2 id="guide-title">Tu trámite, paso a paso</h2>
            <ol>
              <li><strong>Accede a tu cuenta</strong><span>Crea una cuenta o inicia sesión.</span></li>
              <li><strong>Presenta tu solicitud</strong><span>Completa tus datos y adjunta tu identificación y sustento.</span></li>
              <li><strong>Consulta tu expediente</strong><span>Guarda el código para seguir el estado de tu solicitud.</span></li>
            </ol>
          </aside>
        </section>

        <section className="landing-about" id="acerca" aria-labelledby="about-title">
          <div>
            <h2 id="about-title">Acerca de nosotros</h2>
            <p>MercaOrden busca facilitar la formalización en mercados mayoristas. Reúne la presentación de documentos y el seguimiento de la solicitud en un mismo portal.</p>
          </div>
          <dl className="landing-facts">
            <div><dt>Adjuntos requeridos</dt><dd>2 documentos</dd></div>
            <div><dt>Tamaño máximo</dt><dd>2 MB por archivo</dd></div>
          </dl>
        </section>

        <section className="landing-contact panel" id="contacto" aria-labelledby="contact-title">
          <div>
            <h2 id="contact-title">Contáctanos</h2>
            <p>Escríbenos si tienes una duda sobre el trámite o necesitas ayuda para acceder a tu cuenta. Evita incluir contraseñas o números de documento.</p>
          </div>
          <ContactForm recovery={ayuda === 'acceso'} />
        </section>
      </main>

      <footer className="shell footer">
        <a href="/" aria-label="Inicio de MercaOrden"><Brand /></a>
        <span>Formalización para mercados mayoristas</span>
      </footer>
    </div>
  );
}
