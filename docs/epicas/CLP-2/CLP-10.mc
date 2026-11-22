# CLP-10 · HU-08: Emitir y validar una credencial QR

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-10) · [Evidencia](../../evidencias/CLP-10.mc)

El responsable de control emite una credencial solo para un expediente verificado sin credencial vigente. SQLite serializa la emisión y conserva las credenciales anteriores. El QR apunta a una URL pública con un identificador aleatorio opaco. La consulta pública devuelve estado y vencimiento y excluye el expediente y los documentos.

El primer alcance usa 365 días de vigencia desde la emisión. En el instante de vencimiento o tras la revocación, la validación indica el motivo y que el servicio queda sin autorización. El responsable de control puede revocar y emitir una nueva credencial.

Se agregó CodeQL para JavaScript y TypeScript. El análisis se activa en repositorios públicos o con CODEQL_ENABLED=true si el repositorio privado dispone de GitHub Code Security.

Integración a main y comprobaciones de PR pendientes.
