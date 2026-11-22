# Evidencia de CLP-24

La [prueba de EP-04](../../backend/test/sanitary.test.mjs) verifica dos zonas, días con datos y sin datos, la transición exacta de medianoche en Lima, los permisos y la exclusión de registros anulados.

Con una base de pruebas, registra acopios siguiendo [CLP-17](CLP-17.mc). Habilita un supervisor mediante npm run staff -- --supervisor-limpieza supervisor@example.invalid. En /sanidad consulta el mismo día para una zona y para todas. Consulta también un día sin entregas y comprueba cero kilogramos y cero registros. Revisión interactiva y ejecución remota de Dependabot pendientes.

El formato JUnit se generó y se leyó localmente. Se verificó que el control de PR acepta un título convencional de Dependabot para cambios de paquetes, rechaza un título inválido y bloquea cambios ajenos al alcance o a la identidad del bot.

Resultado local: 31 pruebas aprobadas, compilación correcta y documentación válida.
