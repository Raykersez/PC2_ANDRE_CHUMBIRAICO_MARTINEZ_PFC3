# CLP-5 · HU-01 · Registrar solicitud de empadronamiento

**En curso** al 21/11/2026 en Jira. Se verificó la copia de trabajo. La referencia local `origin/main` apuntaba al commit inicial. PR integrado a `main` pendiente de evidencia. [Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-5)

## Criterios y alcance

- El comerciante autenticado registra su identificación, rubro y documentos de sustento. El sistema devuelve un código único y el estado Pendiente de revisión.
- Si ya existe una solicitud activa para el documento normalizado, se conserva el expediente original. El titular recibe información para consultarlo y otra cuenta recibe instrucciones sin acceso al expediente.
- Se requieren dos adjuntos en PDF, JPEG o PNG de hasta 2 MB cada uno. El titular y el personal autorizado pueden descargarlos.

## Flujo

1. El [portal](../../../frontend/app/portal.tsx) envía el formulario multipart a `POST /api/applications`. [La API](../../../backend/src/app.mjs) devuelve `201` al crear o `409 ACTIVE_APPLICATION` si ya existe una solicitud activa.
2. El titular consulta sus solicitudes con `GET /api/applications`. Se puede consultar por código con `GET /api/applications/:code`.
3. `GET /api/applications/:code/attachments/:kind` comprueba autorización para servir `identity` o `support`.

## Evidencia y pendientes

[Resultados locales](../../evidencias/CLP-5.mc) · [Cobertura de pruebas](../../pruebas.mc) · [Controles de DevOps](../../devops.mc)

Implementación verificada localmente con pruebas de integración y una sesión de navegador con datos sintéticos. Quedan por registrar las comprobaciones del PR y el enlace al merge en `main`.
