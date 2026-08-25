# Gestión de la Interfaz de Usuario

Este documento describe los elementos comunes de la interfaz de usuario de Gestión APSOL y sus comportamientos dinámicos.

---

## Colapso Automático del Panel Lateral (Sidebar)

**Qué hace:** 
Contrae de forma automática el panel lateral de navegación después de 10 segundos de estar expandido, con el fin de optimizar el espacio de trabajo en pantalla cuando el usuario no está interactuando con el menú de navegación.

**Escenarios cubiertos:**
- **Escenario normal (Sin interacción):** Al expandirse el panel lateral (bien sea en la carga inicial o al pulsar el botón manualmente), si el usuario no posiciona el cursor sobre el panel, este se contraerá automáticamente a los 10 segundos.
- **Escenario con interacción (Protección de selección):** Si el usuario posiciona el cursor del ratón sobre cualquier parte del panel lateral, el temporizador de 10 segundos se detiene de inmediato. Esto garantiza que el panel no se cierre de forma inesperada mientras el usuario lee las opciones o se prepara para hacer clic en alguna sección.

**Casos borde conocidos:**
- **Salida del ratón:** Si el usuario retira el cursor del panel lateral, el temporizador se reinicia desde cero (10 segundos de espera nuevos).
- **Cierre manual:** Si el usuario pulsa manualmente el botón de colapso antes de los 10 segundos, el temporizador activo se destruye de inmediato para evitar ejecuciones huérfanas en el estado del componente.

**Restricciones o supuestos:**
- El comportamiento asume que la interacción principal se realiza mediante dispositivo apuntador (ratón o panel táctil).
- El temporizador está acoplado al ciclo de vida del componente en el cliente de React y se limpia adecuadamente para evitar fugas de memoria si el usuario navega a páginas externas o cierra la pestaña.
