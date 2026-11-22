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

- Las resoluciones de [CLP-6](epicas/CLP-1/CLP-6.mc) actualizan el expediente y conservan la primera decisión en SQLite dentro de la misma transacción.

- [CLP-7](epicas/CLP-1/CLP-7.mc) utiliza un catálogo de puestos. La existencia de una asignación determina la ocupación y SQLite protege la unicidad por puesto y comerciante.

- En [CLP-18](epicas/CLP-1/CLP-18.mc), el expediente del titular incluye el motivo de observación o los datos de su puesto. La API comprueba identidad y titularidad antes de leer ese detalle.
- [CLP-19](epicas/CLP-1/CLP-19.mc) vincula las operaciones a una asignación aprobada del comerciante y evita duplicados mediante una clave de envío única dentro de esa asignación.

- El [tarifario de estibaje](epicas/CLP-2/CLP-20.mc) almacena versiones con identificadores propios en SQLite. La consulta selecciona la última versión aplicable según la fecha local de Lima.
- [EP-03](epicas/CLP-3/CLP-3.mc) usa ventanas en hora de Lima y turnos con códigos opacos. SQLite verifica el cupo y la placa en transacciones y registra ingreso, cancelación y salida como eventos únicos. Las cancelaciones liberan capacidad sin borrar el historial.

- [CLP-11](epicas/CLP-2/CLP-11.mc) registra solicitudes de servicios y sus asignaciones. Verifica credenciales, franjas y tarifa dentro de una transacción, y conserva el monto y la versión al confirmar.

- [EP-04](epicas/CLP-4/CLP-4.mc) vincula inspecciones, hallazgos y reinspecciones al puesto. El módulo de residuos registra pesos en gramos y conserva la zona de cada entrega para los resúmenes de supervisión.
