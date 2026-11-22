# Documentación de MercaOrden

| Documento | Contenido |
| --- | --- |
| [Arquitectura](arquitectura.mc) | Componentes, datos y flujo actual |
| [DevOps](devops.mc) | Entorno local, integración y despliegue previsto |
| [Pruebas](pruebas.mc) | Cobertura y verificaciones pendientes |
| [Harness engineering](harness.mc) | Contexto, controles y seguimiento por PR |
| [EP-01](epicas/CLP-1/README.mc) | Gestión y formalización de comerciantes |
| [EP-02](epicas/CLP-2/README.mc) | Control y certificación de estibadores |
| [EP-03](epicas/CLP-3/README.mc) | Ordenamiento logístico y control vehicular |
| [EP-04](epicas/CLP-4/README.mc) | Fiscalización sanitaria y gestión de residuos |

## Actualización por historia de usuario

1. Crea o actualiza `docs/epicas/<épica>/<HU>.mc` en el PR de la HU. Incluye Jira, alcance, criterios, evidencia, pendientes y estado de integración.
2. Actualiza el índice de la épica y los documentos de arquitectura, DevOps o pruebas cuando cambien. Enlaza los resultados seleccionados y el PR cuando exista.
3. Al verificar la integración, registra el enlace al PR integrado a `main` y, si corresponde, sus comprobaciones. Si falta consignar el resultado, incorpóralo en la siguiente actualización documental. Usa estados distintos para trabajo local, CI y despliegue.

Se tomó como referencia la organización de arquitectura, despliegue y evidencias de [RIKUY_DEEP_G2](https://github.com/d-a-b-o/RIKUY_DEEP_G2/tree/main/docs).
