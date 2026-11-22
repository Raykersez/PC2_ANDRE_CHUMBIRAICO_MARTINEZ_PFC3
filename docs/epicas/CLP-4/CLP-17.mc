# CLP-17 · HU-19: Registrar acopio de mermas orgánicas

[Jira](https://pc2-andrechumbiraico-pfc3.atlassian.net/browse/CLP-17) · [Evidencia](../../evidencias/CLP-17.mc)

El encargado de residuos elige un punto activo en /sanidad y registra un peso positivo con hasta tres decimales en kilogramos. Internamente se guardan gramos enteros, código del punto, zona al registrar, fecha del servidor y responsable. Un reenvío con el mismo identificador y los mismos datos devuelve el registro anterior.

El operador habilita el permiso con npm run staff -- --encargado-residuos correo y administra puntos mediante npm run staff -- --punto-acopio código zona activo|inactivo. No se incluyen puntos operativos de ejemplo.

CI remoto e integración a main pendientes.
