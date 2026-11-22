# MercaOrden

Portal de formalización para mercados mayoristas. Este incremento entrega [CLP-5 · Registrar solicitud de empadronamiento](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-5).

## Ejecutar localmente

Requiere Node.js 22.13 o posterior.

1. Ejecuta `npm install` desde la raíz.
2. En una terminal, ejecuta `npm run dev:api`.
3. En otra terminal, ejecuta `npm run dev:web` y abre [http://localhost:3000](http://localhost:3000).
4. Crea una cuenta de prueba y adjunta dos archivos sintéticos en PDF, JPG o PNG de hasta 2 MB cada uno.
5. Conserva el código. En **Mis solicitudes** puedes consultar el expediente. Si envías el mismo documento con espacios o guiones, se conserva el expediente original.

El backend guarda los datos y adjuntos en `backend/.data/mercaorden.sqlite`. Una cuenta nueva tiene rol de comerciante. Para probar el rol de personal autorizado, registra una segunda cuenta de prueba y ejecuta `npm run staff -- personal@example.invalid` desde la raíz. Recarga su sesión y consulta el expediente por código.

| Ruta | Contenido |
| --- | --- |
| `frontend/app/` | Página Next.js, formulario, sesión y estilos Material Design 3 |
| `backend/src/` | API Express, sesiones, validación y persistencia |
| `backend/test/` | Pruebas de integración con datos sintéticos |
| `.github/workflows/ci.yml` | Pruebas, compilación y Gitleaks por pull request |

## Validación

Ejecuta `npm test` y `npm run build`. Las pruebas cubren la creación y consulta del expediente, duplicados, envíos concurrentes, validación de adjuntos y acceso por rol.

Gitleaks devuelve un error si encuentra secretos. Para exigir el resultado antes de integrar a `main`, configura **Gitleaks** como comprobación obligatoria en las reglas de la rama. [Documentación de Gitleaks](https://github.com/gitleaks/gitleaks)

## Variables de entorno

| Entorno | Archivos y valores |
| --- | --- |
| Frontend local | Copia `frontend/.env.example` a `frontend/.env.local` si necesitas cambiar `BACKEND_URL`, la dirección de la API que usa Next.js. |
| Backend local | Copia `backend/.env.example` a `backend/.env` para cambiar `HOST`, `PORT`, `APP_ORIGIN` o `DATABASE_FILE`. |
| Azure | La migración requiere un adaptador PostgreSQL para Azure Database for PostgreSQL. Configura `BACKEND_URL` en el App Service de Next.js y `APP_ORIGIN` con su URL HTTPS en el App Service de Express. La cadena PostgreSQL se inyectará en el backend con una referencia de Key Vault. [Referencias de Key Vault en App Service](https://learn.microsoft.com/azure/app-service/app-service-key-vault-references) |

El flujo local funciona sin API keys. Mantén las credenciales de Azure en el backend y en Key Vault. Las variables `NEXT_PUBLIC_*` son visibles en el navegador. [Variables de entorno de Next.js](https://nextjs.org/docs/app/guides/environment-variables)

## Heurísticas en CLP-5

| Heurística | Aplicación en el flujo |
| --- | --- |
| Visibilidad del estado | La interfaz informa la carga de sesión, el envío y el estado del expediente. |
| Correspondencia con el mundo real | El formulario usa DNI, rubro comercial y sustento. |
| Control y libertad | El usuario puede cambiar de modo de acceso, cerrar su sesión y volver al formulario. |
| Consistencia y estándares | Campos, botones, superficies y temas comparten tokens Material Design 3. |
| Prevención de errores | El cliente limita formatos y tamaños. La API valida adjuntos, normaliza el documento y evita duplicados. |
| Reconocimiento antes que recuerdo | Los rubros están visibles en una lista y el expediente aparece en la cuenta. |
| Flexibilidad y eficiencia | Hay navegación por teclado, enlace de salto y una vista adaptable al móvil. |
| Diseño estético y minimalista | El formulario agrupa datos y adjuntos y muestra la acción principal. |
| Reconocer y recuperarse de errores | Los mensajes identifican qué corregir o cómo consultar el expediente existente. |
| Ayuda y documentación | La lista de requisitos indica qué preparar y qué archivos se aceptan. |
