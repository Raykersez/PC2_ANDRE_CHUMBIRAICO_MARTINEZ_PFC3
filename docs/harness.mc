# Harness engineering

El repositorio combina contexto versionado, retroalimentación local y controles de PR. [Harness engineering](https://openai.com/es-419/index/harness-engineering/) · [Bucle del agente de Codex](https://openai.com/es-419/index/unrolling-the-codex-agent-loop/) · [Ejemplos de walkinglabs](https://github.com/walkinglabs/learn-harness-engineering)

| Momento | Control |
| --- | --- |
| Antes de editar | Leer AGENTS.md, la ficha de Jira y los criterios. Revisar el árbol de trabajo y preservar cambios ajenos. |
| Durante el cambio | Hacer cambios acotados. Ante un fallo, revisar salida, corregir la causa y volver a ejecutar la comprobación. |
| Antes del PR | Ejecutar `node scripts/check-docs.mjs`, `npm test` y `npm run build`. Revisar `git diff` y registrar resultados. |
| En el PR | El verificador comprueba los enlaces locales de los archivos .mc y exige modificar una ficha de HU cuando cambian archivos del frontend, backend o dependencias raíz. Los jobs de CI también ejecutan pruebas, compilación y Gitleaks. |
| Al integrar | Verificar el estado del PR y registrar el enlace al merge. Las reglas de rama controlan qué comprobaciones impiden integrar. |
| Tras un fallo recurrente | Incorporar una prueba o comprobación específica y dejar constancia del caso en la HU correspondiente. |

Para reproducir el control del PR sobre commits existentes, ejecuta `node scripts/check-docs.mjs <base> <head>`. Sin referencias, se verifica el árbol de documentación local.
