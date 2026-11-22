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

## Convenciones de pull request y protección de main

- Usa un título como `feat(CLP-5): registrar solicitudes` y una rama como `CLP-5-hu-01-registrar-solicitud`. Para cambios de producto, actualiza la ficha .mc de esa misma clave. Los cambios de infraestructura pueden usar un título como `ci: actualizar comprobaciones`.
- En las reglas de `main`, exige un pull request y las comprobaciones **Pruebas y compilación**, **Gitleaks** y **Análisis estático**. Configura GitHub Actions como origen de las comprobaciones y aplica las reglas a quienes puedan hacer merge.
- En **Settings → General → Pull Requests**, activa **Automatically delete head branches**. GitHub borra la rama remota de origen tras el merge si sus reglas lo permiten. [Borrado automático en GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches)

## Despliegue continuo en Azure

El workflow vuelve a ejecutar los controles tras cada push a `main` y despliega solo cuando `AZURE_DEPLOY_ENABLED` vale `true`. Configura esta variable a nivel de repositorio. En el environment `production`, configura `AZURE_FRONTEND_APP_NAME`, `AZURE_BACKEND_APP_NAME`, `AZURE_FRONTEND_URL` y `AZURE_BACKEND_URL` como variables. Registra `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` y `AZURE_SUBSCRIPTION_ID` como secretos. La identidad federada de Entra debe confiar en el environment `production` de este repositorio y poder desplegar ambas aplicaciones. [OIDC para App Service](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)

Prepara dos App Services Linux con Node.js 22 y `WEBSITE_RUN_FROM_PACKAGE=1`. Usa `node backend/src/server.mjs` como comando de inicio del backend, con `HOST=0.0.0.0`, `APP_ORIGIN` igual al origen HTTPS del frontend y `DATABASE_FILE=/home/data/mercaorden.sqlite` para una demostración de una instancia. Para el frontend, usa `node node_modules/next/dist/bin/next start frontend --hostname 0.0.0.0`. El workflow entrega el ZIP compilado y verifica el portal y `/api/health`. PostgreSQL y Key Vault forman parte de la migración del almacenamiento.

[EP-04](epicas/CLP-4/CLP-4.mc) publica los resultados JUnit de CI y configura Dependabot para npm. Los PR de automatización pasan pruebas y revisión de dependencias. La configuración de Azure y su migración siguen pendientes.

[Azure Pipelines](../azure-pipelines.yml) define una ejecución manual de CI con Node.js 22. Ejecuta la suite sintética, publica JUnit y comprueba la compilación, el portal y la API local del agente. El pipeline requiere un agente disponible en la organización.

## Demo en Azure for Students desde GitHub Actions

El workflow manual [Desplegar demo de Azure](../.github/workflows/azure-demo.yml) usa [Bicep](../infra/azure/demo.bicep) para crear un plan App Service Linux **F1** y una aplicación en un grupo dedicado. Publica Next.js y Express en el mismo dominio HTTPS. El portal usa `/` y la API usa `/api`. La demo usa SQLite en memoria. Las cuentas, sesiones y registros se pierden cuando se reinicia el proceso. Usa únicamente datos sintéticos.

### Configuración inicial desde los portales

1. En **Azure Portal → Grupos de recursos**, crea un grupo dedicado, por ejemplo `rg-mercaorden-demo`. Elige una región permitida por tu suscripción y con App Service Linux F1 disponible. Si la validación devuelve una restricción de política o cuota, revisa el detalle en Azure y elige una región permitida con F1. [Errores de política de Azure](https://learn.microsoft.com/en-us/azure/azure-resource-manager/troubleshooting/error-policy-requestdisallowedbypolicy)
2. En GitHub, abre **Settings → Environments** y crea `azure-demo`. Limita **Deployment branches** a `main`. Crea las variables del entorno `AZURE_DEMO_RESOURCE_GROUP` con el nombre del grupo y `AZURE_DEMO_LOCATION` con el identificador de la región indicada en el paso anterior.
3. En Azure, crea una identidad administrada asignada por el usuario o usa una aplicación de Microsoft Entra autorizada. Agrega una credencial federada de GitHub Actions para `Raykersez/PC2_ANDRE_CHUMBIRAICO_MARTINEZ_PFC3`, tipo **Environment**, nombre `azure-demo`. Su sujeto es `repo:Raykersez/PC2_ANDRE_CHUMBIRAICO_MARTINEZ_PFC3:environment:azure-demo` y la audiencia es `api://AzureADTokenExchange`. Asigna **Contributor** a esa identidad solo en el grupo de la demo. La suscripción debe tener registrado `Microsoft.Web`. Si Azure bloquea la creación de la identidad, la asignación de roles o el registro del proveedor, esos pasos requieren intervención de quien tenga esos permisos. [Autenticación federada de Azure](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
4. En el entorno `azure-demo` de GitHub, guarda como secretos `AZURE_CLIENT_ID` (ID de cliente de la identidad), `AZURE_TENANT_ID` (ID del directorio) y `AZURE_SUBSCRIPTION_ID` (ID de la suscripción). La autenticación usa OIDC.

### Ejecutar y verificar

Con el workflow integrado en `main`, abre **Actions → Desplegar demo de Azure → Run workflow** y elige `main`. El runner instala dependencias, prueba y compila la aplicación. Luego valida y despliega la plantilla de forma incremental y publica el ZIP. PowerShell local no es requerido. La ejecución comprueba que la página inicial contiene «MercaOrden» y que `/api/health` devuelve `status: ok` antes de mostrar el enlace en el resumen. Para dejar evidencia de una revisión manual, registra la ejecución y prueba un registro con datos sintéticos en esa URL.
