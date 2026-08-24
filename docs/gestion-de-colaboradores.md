# Gestión de Colaboradores

**Qué hace:** Administra los expedientes de recursos humanos de los colaboradores de APSOL, permitiendo el registro de datos personales, información financiera de cobro (CBU/alias), contratos y tarifas base, además del cálculo automático de días libres disponibles.

---

## Escenarios cubiertos

### 1. Visualización y Edición de Expediente
* Muestra datos de contacto, DNI, CUIT, Dirección, y Datos de pago (Banco, CBU, Alias).
* Permite modificar estos campos y guardarlos de forma persistente.

### 2. Sincronización de Perfiles de Usuario
* El expediente del colaborador está enlazado a un usuario del sistema (`usuario_id`).
* Al guardar los cambios de Nombre, Apellido o Email en la ficha del colaborador, el sistema actualiza automáticamente estas columnas en la tabla centralizada de perfiles (`apsol_usuarios`), garantizando que la información se mantenga sincronizada.

### 3. Cálculo de Días Libres Disponibles
* Se calculan dinámicamente desde el frontend restando la fecha de inicio de contrato del colaborador con la fecha de hoy para calcular la cantidad de meses trabajados.
* El total de meses se multiplica por la tasa del último contrato del colaborador (ej. `1,25` días libres por mes) para arrojar el saldo disponible en tiempo real.

### 4. Tarifas de Presupuestación
* La tarifa por hora del colaborador se calcula automáticamente en base a su último contrato activo:
  * Si el honorario del contrato es por hora (`$/hs`), se usa ese valor directo.
  * Si el honorario es mensual (`$/mes`), se divide por la dedicación mensual de horas pactada.

---

## Casos borde conocidos

* **Colaboradores sin Usuario Asociado:** Si un colaborador no tiene un `usuario_id` vinculado (por ejemplo, registros históricos migrados del Excel), sus datos financieros y personales de colaborador se guardan normalmente, pero no se intentará sincronizar la tabla de usuarios para evitar errores de clave foránea.
* **Manejo de Estados (Activo/Inactivo):** El frontend utiliza un checkbox booleano (`activo`), el cual es traducido automáticamente antes del guardado al valor ENUM (`Activo` o `Inactivo`) que requiere la base de datos de Supabase.

---

## Restricciones o supuestos

* **Creación de Nuevos Usuarios:** El expediente del colaborador depende de que la cuenta de usuario ya esté creada a través del proceso de registro/auth de Supabase. No se puede crear un usuario fantasma desde la ficha del colaborador debido a restricciones de integridad referencial con el esquema `auth.users`.
