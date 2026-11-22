# CLP-20 · HU-09: Consultar el tarifario oficial de estibaje

[Historia en Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-20) · [Evidencia](../../evidencias/CLP-20.mc)

El tarifario público en /estibadores/tarifario permite filtrar por servicio. Muestra el monto en soles, la unidad de cobro y la fecha de inicio. Si el servicio no cuenta con una tarifa vigente, informa que no hay una publicada.

La operación de MercaOrden carga servicios y tarifas oficiales mediante el comando staff. Las tarifas empiezan a medianoche de Lima en la fecha de inicio. La fecha de fin, cuando existe, es exclusiva. Una versión posterior reemplaza a la anterior desde su inicio. SQLite conserva las versiones y sus identificadores para que el [flujo de asignación de servicios](CLP-11.mc) referencie la versión utilizada. Aún falta cargar el catálogo oficial.

El workflow incluye revisión de dependencias de PR para repositorios públicos o privados con GitHub Code Security y DEPENDENCY_REVIEW_ENABLED=true. Integración a main y ejecución remota de CI pendientes.
