# Evidencia de CLP-25

| Comando | Resultado local |
| --- | --- |
| node scripts/check-docs.mjs | Enlaces locales válidos. |
| npm test | 8 pruebas aprobadas. Incluye CLP-5 y contacto público con datos sintéticos. |
| npm run build | Compilación de Next.js y chequeo de TypeScript correctos. |
| HTTP sin cookies | La landing y la ruta de ingreso respondieron 200. El HTML inicial contiene el propósito y el enlace al trámite. |

## Guía de verificación de usabilidad

Ejecuta npm run dev:api y npm run dev:web. Abre http://localhost:3000 en una ventana privada. Repite la navegación con teclado en 390 px y 1440 px. Usa exclusivamente cuentas example.invalid y mensajes ficticios.

| Heurística | Dónde y cómo verificar |
| --- | --- |
| Visibilidad del estado | En Contáctanos, envía una consulta sintética. El formulario indica el envío y muestra la referencia tras una respuesta 201. En el portal, el panel indica la comprobación de sesión y el envío de credenciales. |
| Correspondencia con el mundo real | Lee la misión, los tres pasos del trámite y las etiquetas de contacto. Comprueba la referencia a identificación, sustento y expediente. |
| Control y libertad | Usa Tab y Enter en Cerrar anuncio. El foco pasa al botón de empadronamiento. Prueba Limpiar en contacto y Volver al inicio desde el formulario de acceso. |
| Consistencia y estándares | Cambia entre Claro y Oscuro y abre el trámite. Comprueba que la preferencia se conserva y que los botones, superficies y estados comparten estilos. |
| Prevención de errores | Intenta registrar una contraseña corta y enviar un correo inválido. En contacto, verifica el mensaje de longitud y que los controles se desactivan durante el envío. La prueba automatizada cubre la validación y el límite del servidor. |
| Reconocimiento | Comprueba los accesos visibles, los requisitos del trámite y las opciones predeterminadas de Motivo. |
| Flexibilidad y eficiencia | Usa el enlace de salto, los enlaces directos de la barra y el botón principal. Comprueba que quedan visibles los controles en el ancho móvil. |
| Diseño estético y minimalista | Revisa la jerarquía entre el titular, el botón principal, Acerca de nosotros y el formulario. Comprueba que la marca se lee en ambos temas. |
| Recuperación de errores | Intenta iniciar sesión con credenciales sintéticas inválidas y verifica el mensaje. En DevTools, bloquea temporalmente /api/contact y comprueba que el formulario conserva los datos y permite reintentar. |
| Ayuda y documentación | Abre Solicitar ayuda para recuperar el acceso. El formulario selecciona Acceso a mi cuenta y explica qué datos aportar. |

La verificación interactiva de escritorio, móvil y teclado queda pendiente. El navegador integrado no pudo conectarse al servidor local y Chrome no estaba disponible mediante el control de navegador.
