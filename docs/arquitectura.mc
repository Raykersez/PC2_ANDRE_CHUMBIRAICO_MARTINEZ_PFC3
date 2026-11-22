# Arquitectura de MercaOrden

El repositorio usa npm workspaces y Node.js 22.13 o posterior. El frontend está en Next.js y React con componentes TSX. La API se implementa en JavaScript ESM con Express y persiste en SQLite mediante `node:sqlite`.

```mermaid
flowchart LR
  U["Comerciante o personal autorizado"] --> W["Next.js / React"]
  W -->|"/api, rewrite del mismo origen"| A["API Express"]
  A -->|Consulta o escritura| D[("SQLite local")]
```

- [Portal](../frontend/app/portal.tsx) gestiona sesión, formulario y consulta. [Next.js](../frontend/next.config.mjs) reenvía `/api/*` al host configurado en `BACKEND_URL`.
- [API](../backend/src/app.mjs) valida sesión, rol, formulario y adjuntos. Solo el comerciante inicia un expediente. La descarga queda reservada al titular y al personal autorizado.
- [Persistencia](../backend/src/store.mjs) administra cuentas, sesiones, solicitudes y adjuntos. Un índice único parcial protege la unicidad de solicitudes activas por documento normalizado. La solicitud y sus adjuntos se escriben en una transacción.
- [Flujo CLP-5](epicas/CLP-1/CLP-5.mc) documenta endpoints y evidencia. [DevOps](devops.mc) registra el alcance del entorno actual y el destino previsto.

- La [landing pública](../frontend/app/page.tsx) presenta el sistema. [Empadronamiento](../frontend/app/empadronamiento/page.tsx) aloja CLP-5. Ambas rutas comparten tema, marca y estilos Material Design 3.
- POST /api/contact valida correo, motivo y mensaje y guarda cada envío aceptado en contact_messages. La recepción se identifica con una referencia MC. La revisión se realiza desde SQLite con acceso administrativo. [CLP-25](epicas/CLP-1/CLP-25.mc)
