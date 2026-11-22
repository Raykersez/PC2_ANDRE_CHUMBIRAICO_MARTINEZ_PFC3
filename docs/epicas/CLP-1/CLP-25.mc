# CLP-25 · HU-21: Acceder a la landing page del sistema

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-25) · [CLP-5](CLP-5.mc) · [Evidencia](../../evidencias/CLP-25.mc)

| Criterio de Jira | Implementación |
| --- | --- |
| Página pública con el propósito del sistema | La ruta / explica qué es MercaOrden y cómo se tramita el empadronamiento. |
| Acceso visible a CLP-5 | El botón principal abre /empadronamiento#tramite. La barra superior enlaza al ingreso y al registro. |
| Uso en teléfono y computadora | La navegación se redistribuye y el contenido pasa a una columna en pantallas estrechas. Los enlaces y campos tienen etiquetas y foco visible. |

| Subtarea | Entrega |
| --- | --- |
| CLP-26 · Logo | Marca SVG compartida en navegación y pie. |
| CLP-27 · Navegación | Secciones, tema del sistema/claro/oscuro y accesos según sesión. |
| CLP-28 · Banner y anuncio | Botón de empadronamiento y aviso de documentos descartable durante la sesión de la pestaña. |
| CLP-29 · Acerca de nosotros | Misión de formalización y requisitos cuantificados. |
| CLP-30 · Contacto | Validación nativa y de servidor, límite de envíos, almacenamiento en SQLite y referencia de recepción. |
| CLP-31 · Login | Sesión existente de CLP-5, vista directa de ingreso y enlace de ayuda para recuperar el acceso. |
| CLP-32 · Usabilidad | Guía de comprobación en la evidencia. |
| CLP-33 · Signup | Alta de CLP-5 con validación de correo y contraseña y acceso al formulario. |

El equipo operador puede consultar las solicitudes de recuperación en la tabla contact_messages con acceso administrativo a SQLite. La referencia confirma almacenamiento. La atención requiere gestión por el operador.

Material Design 3 guía los [roles de color](https://m3.material.io/styles/color/the-color-system/) y la [jerarquía tipográfica](https://m3.material.io/styles/typography/applying-type).

## Estado

Implementación y comprobaciones automáticas locales. CI e integración a main pendientes de confirmación.
