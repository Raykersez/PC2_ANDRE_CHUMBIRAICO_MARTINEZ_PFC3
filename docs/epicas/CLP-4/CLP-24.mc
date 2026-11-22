# CLP-24 · HU-20: Consultar el resumen de acopio por zona

[Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-24) · [Evidencia](../../evidencias/CLP-24.mc)

El supervisor de limpieza consulta el intervalo inclusivo de días de Lima por zona o para todas las zonas. La API cuenta los registros vigentes y suma sus kilogramos. Un intervalo sin datos devuelve cero en ambos indicadores. Desactivar un punto no invalida sus entregas históricas.

La cuenta se habilita mediante npm run staff -- --supervisor-limpieza correo. Dependabot propone actualizaciones npm semanales. El workflow comprueba la identidad del bot, limita sus PR a manifiestos y el lockfile y conserva CI. La revisión usa Dependency Review cuando está disponible y la auditoría npm para PR de Dependabot en repositorios privados sin esa función.

CI remoto e integración a main pendientes. La generación de PR de Dependabot se verifica cuando la configuración llegue a la rama predeterminada.
