# DevOps y DevSecOps

| Fase | Flujo y evidencia |
| --- | --- |
| Desarrollo | Desde la raíz, usar Node.js >=22.13 y `npm ci`. Ejecutar `npm run dev:api` y `npm run dev:web` en terminales distintas. |
| Integración continua | En cada PR, [CI](../.github/workflows/ci.yml) instala dependencias del lockfile, verifica documentación, prueba el backend y compila el frontend. |
| Detección de secretos | Gitleaks analiza los commits entre la base y la cabeza del PR con salida redactada. El job debe figurar como comprobación requerida en las reglas de `main` para impedir un merge si falla. |
| Entrega y despliegue | Destino previsto según el [README raíz](../README.md): frontend y API en Azure App Service, PostgreSQL administrado y Key Vault. Quedan pendientes el adaptador PostgreSQL, la configuración de Azure y la evidencia de despliegue. |
| Operación | La API expone `GET /api/health`. Tras desplegar, verificar ese endpoint y realizar una prueba de empadronamiento con datos sintéticos. Registrar entorno, versión y resultado. |

Las plantillas [frontend](../frontend/.env.example) y [backend](../backend/.env.example) documentan las variables locales. La API conecta a SQLite por `DATABASE_FILE` y escucha por defecto en `127.0.0.1:3001`. El portal se abre en `http://localhost:3000`, que coincide con `APP_ORIGIN` por defecto.

Para CLP-5 se comprobó ejecución local. La ejecución de CI, las reglas de protección y el despliegue requieren evidencia de GitHub o del entorno correspondiente.
