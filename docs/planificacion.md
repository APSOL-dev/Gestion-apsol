## Planificación y Gantt Cuatrimestral/Trimestral

**Qué hace:**
Este módulo permite al usuario Administrador crear, editar y visualizar planes estratégicos de trabajo organizados en períodos de fechas libres (por ejemplo, cuatrimestres o trimestres). El componente principal es un diagrama de Gantt interactivo que permite estructurar los objetivos del período, añadir notas de referencia (subobjetivos), definir tareas y asignar colaboradores de la organización en una escala de tiempo semanal.

**Escenarios cubiertos:**
- **Historial de Planes:** Visualización en lista de todos los planes creados por la organización, diferenciados por estado (Borrador, En curso, Finalizado) con búsqueda rápida por nombre.
- **Fechas Libres:** Creación de planes configurando fecha de inicio y fin personalizadas. El número de semanas del Gantt se calcula automáticamente.
- **Gestión de Objetivos:** Creación y modificación en tiempo real de tarjetas de objetivos con colores asignados dinámicamente y descripción/métrica.
- **Subobjetivos / Notas:** Lista rápida de chips de texto para aclaraciones o notas generales de la planificación.
- **Gantt Interactivo:**
  - Creación de tareas asociadas a objetivos específicos.
  - Movimiento (arrastrar) y redimensionamiento (cambiar ancho) de barras de tareas para ajustar la fecha de inicio y duración en semanas.
  - Asignación de colaboradores de la base de datos (con popup selector y visualización de avatares).
  - Ciclo de progreso de tarea mediante click simple en la barra (0% -> 30% -> 50% -> 100%).
- **Línea de Tiempo Actual:** Indicador visual de la semana en curso y del día de hoy en la escala temporal.

**Casos borde conocidos:**
- **Sin colaboradores asignados:** Las tareas muestran un avatar unassigned ("+") que permite abrir la asignación.
- **Plan sin objetivos:** El Gantt se muestra vacío con un botón para agregar el primer objetivo.
- **Cambio de rango de fechas del Gantt:** Si se modifican las fechas de un plan existente mediante el botón "Fechas", las semanas se recalculan. Si alguna tarea queda fuera del nuevo rango, sus coordenadas se ajustan automáticamente a los límites del nuevo período.

**Restricciones o supuestos:**
- **Acceso exclusivo Admin:** Solo los usuarios con cargo diferente a "Colaborador" (es decir, Administradores/Admins) pueden ver, crear y modificar planes de trabajo. Para los colaboradores el menú no aparece en el sidebar y el acceso a la ruta es redirigido al inicio.
- **Semanas Redondeadas:** El Gantt trabaja con granularidad de semanas completas para inicio y duración.
- **Persistencia en Base de Datos:** Todos los cambios realizados (mover barras, reescribir títulos de objetivos o tareas, etc.) se sincronizan inmediatamente con la base de datos de Supabase.
