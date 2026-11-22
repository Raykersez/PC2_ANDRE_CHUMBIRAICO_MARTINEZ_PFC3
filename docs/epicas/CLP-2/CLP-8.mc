# CLP-8 · HU-06: Registrar expediente de estibador

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-8) · [Evidencia](../../evidencias/CLP-8.mc)

En /estibadores, el solicitante autenticado presenta identificación y sustento laboral. El portal devuelve un número ES y muestra Pendiente de verificación. SQLite protege la identidad normalizada con una restricción única y guarda expediente y archivos en una transacción. Si la identidad ya existe, se indica continuar desde la cuenta original.

Los adjuntos PDF, JPG y PNG tienen un límite individual de 2 MB. La API verifica el formato y autoriza la descarga al titular. SQLite conserva los binarios fuera de los logs de aplicación y los binarios sintéticos de la prueba se generan en memoria.

Integración a main y comprobaciones de PR pendientes.
