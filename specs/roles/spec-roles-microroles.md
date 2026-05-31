# Especificación: Sistema de Roles y Permisos Granulares por Módulo

## Contexto
La plataforma requiere de un modelo de autorización robusto y granular que permita restringir y habilitar el acceso a los diferentes módulos y submódulos de la aplicación, tanto en la interfaz web como en la aplicación móvil. Para garantizar una administración limpia, se requiere un módulo visual donde se puedan mapear todos los módulos activos de la base de datos y definir de forma precisa permisos de lectura, creación, actualización y borrado por cada rol asignado a las distintas organizaciones (empresas).

---

## Objetivo
Diseñar e implementar el módulo de administración y el motor de validación de **Roles y Permisos Granulares** incorporando **Controles de Integridad Criptográfica** y un **Flujo de Respaldo Cifrado con Restauración para Super Usuarios**. El sistema permitirá:
1. Mapear de forma jerárquica los módulos y submódulos registrados en la tabla `modules`.
2. Crear, editar y eliminar roles por empresa (`companyId`), donde cada rol encapsula el conjunto total y exclusivo de accesos de un usuario.
3. Configurar de manera precisa cuatro acciones básicas (**Leer, Crear, Actualizar y Borrar**) y acciones especiales (custom actions) por cada módulo y submódulo.
4. Asegurar la consistencia de estos permisos en la navegación (web y móvil) y blindar el acceso a nivel de API (backend).
5. Detectar en tiempo real la manipulación de base de datos o ataques mediante firmas HMAC-SHA256, restringiendo accesos y permitiendo la recuperación segura SU desde copias cifradas AES-256-CBC.

---

## Usuario Principal
*   **Súper Usuario (SU)**: Administrador global de la plataforma con privilegios completos, único rol autorizado para ejecutar la reparación y restauración de consistencia de roles comprometidos.
*   **Administrador de Empresa (Admin)**: Gestiona la creación de roles específicos y la asignación de usuarios dentro del alcance de su organización (`companyId`). No tiene privilegios para restaurar roles vulnerados.
*   **Usuario Final**: Empleado de la empresa que accede a los módulos según los permisos definidos en su rol asignado.

---

## Historia de Usuario
Como desarrollador de la plataforma, requiero que el módulo de roles me permita mapear los módulos de la aplicación contenidos en la tabla `modules`, generar diferentes roles desglosando el acceso a **Lectura, Creación, Actualización y Borrado** de cada módulo, y resguardar la seguridad del sistema ante inyecciones de datos o manipulaciones maliciosas de la base de datos mediante firmas criptográficas de integridad y respaldos cifrados exclusivos para Super Usuarios.

---

## Alcance
*   **Interfaz de Administración de Roles**: Panel interactivo para seleccionar un cargo, ver su descripción, alcance (scope) y una cuadrícula jerárquica con checkboxes para configurar los permisos por módulo.
*   **Mapeo Dinámico de Módulos**: Agrupación visual de los módulos de la base de datos en tres categorías: *Aplicación Móvil*, *Menú Principal*, y *General*.
*   **Permisos de Cuatro Acciones y Acciones Especiales**: Configuración granular de **Leer, Crear, Actualizar y Borrar** más acciones de negocio personalizadas por módulo.
*   **Firma de Seguridad e Integridad Criptográfica**: Cada cargo almacena un hash `hashPermission` calculado determinísticamente con HMAC-SHA256 a partir de sus permisos activos. Si los datos se alteran manualmente, se inhabilita el acceso y se marca como `"vulnerada"`.
*   **Copia de Seguridad Cifrada (`RolePermissionSecurity`)**: Respaldo cifrado simétrico mediante **AES-256-CBC** de los permisos legítimos de cada rol en el momento de ser guardados.
*   **Acción de Reparación SU**: Módulo premium para Super Usuarios que permite restaurar el cargo vulnerado descifrando el respaldo, identificando granularmente las discrepancias e inyecciones de datos fraudulentos en base de datos, registrando un informe completo en `audit_logs` y re-estableciendo la firma digital válida.
*   **Asignación de Rol Único**: Cada usuario final tendrá asociado exactamente un solo rol activo por organización.
*   **Seguridad y Aislamiento por Tenant (`companyId`)**: Los roles creados por una organización son privados y no pueden ser consultados ni modificados por otras empresas.
*   **Control de Acceso en Backend (API)**: Validación en tiempo de ejecución en la API dinámica para rechazar operaciones de escritura si el rol del usuario no tiene los permisos necesarios o está vulnerado.

---

## Fuera de Alcance
*   Asignación de múltiples roles simultáneos a un mismo usuario (herencia aditiva).
*   Políticas de acceso para servicios IAM externos o proveedores de la nube (AWS/Azure/GCP).
*   Auditoría de lectura (solo se auditan las mutaciones de datos: creación, edición, borrado y reparaciones).

---

## Requerimientos No Funcionales
*   **Rendimiento**: El cálculo de permisos del usuario logueado debe realizarse en el servidor durante la sesión y ser cached para evitar parpadeos visuales (flickering) al navegar en el cliente.
*   **Seguridad y Cifrado**: El JSON de permisos asignado al rol debe almacenarse de forma cifrada simétricamente (AES-256-CBC) y validarse mediante firma HMAC-SHA256 para prevenir manipulaciones manuales en caliente.
*   **Integridad Referencial**: Impedir la eliminación de un módulo en la base de datos si existen permisos activos de roles asociados a él.

---

## Restricción de Persistencia
*   Todos los roles, módulos, permisos y respaldos cifrados deben ser almacenados en la base de datos relacional PostgreSQL activa en caliente.
*   No se permite simular la persistencia de permisos en archivos locales JSON o memoria temporal para el cierre de esta funcionalidad en producción.

---

## Reglas Funcionales
1.  **Unicidad de Asignación**: Un usuario está vinculado a exactamente **un único Rol activo** a la vez por cada empresa (`companyId`). Este rol representa el contenedor completo y absoluto de sus accesos.
2.  **Mapeo de Módulos Activos**: La cuadrícula de configuración de roles solo debe listar los módulos de la base de datos que se encuentren en estado `'active'`.
3.  **Heredabilidad de Hijos**: Si un módulo padre tiene permisos desactivados por completo, sus submódulos hijos heredan la restricción por defecto y no pueden ser accedidos.
4.  **Granularidad de Permisos**:
    *   **Leer**: Habilita la visibilidad en el menú de navegación (Sidebar) y permite peticiones `GET` a la API correspondiente.
    *   **Crear**: Habilita los botones de "Agregar" y autoriza peticiones `POST`.
    *   **Actualizar**: Habilita los botones de "Editar/Guardar" y autoriza peticiones `PATCH`.
    *   **Borrar**: Habilita los botones de "Eliminar" y autoriza peticiones `DELETE`.
5.  **Auto-activación de Lectura**: Al otorgar cualquier permiso CRUD (Crear, Actualizar, Borrar) o habilitar una acción especial para un módulo en la matriz, el sistema marcará y activará automáticamente el permiso de **Leer** correspondiente.
6.  **Confirmación para Revocar Lectura**: Al intentar deshabilitar el permiso de **Leer** en un módulo que posee otros permisos o acciones especiales activas, se interrumpirá la acción y se desplegará un modal premium advirtiendo que se revocarán todos los permisos y acciones del módulo en bloque.
7.  **Depreciación Histórica**: Si un módulo tiene permisos activos asignados y se guarda sin ningún permiso habilitado, la fila existente no se borra, sino que pasa al estado `'deprecated'`. Si se vuelve a guardar un permiso para ese módulo, se creará una fila nueva con estado `'active'` en lugar de reactivar la antigua.
8.  **Integridad por Firmas**: Cada cargo en la base de datos posee un campo `hashPermission` que representa la firma criptográfica HMAC-SHA256 de sus permisos activos ordenados determinísticamente. En cada lectura, el servidor valida la firma. Si difiere, bloquea los permisos (retornando un set vacío) y marca al cargo con el estado de integridad `"vulnerada"`.
9.  **Respaldo Cifrado Simétrico**: Al guardar permisos legítimamente, se crea o actualiza un registro en `RolePermissionSecurity` que contiene los permisos serializados en un JSON encriptado mediante **AES-256-CBC** con claves derivadas del `AUTH_SECRET` del servidor.
10. **Reparación SU Exclusiva**: La acción de restauración o depuración a cero de cargos con estado `"vulnerada"` está estrictamente restringida a usuarios con rol `"SU"` en cabeceras de sesión.
11. **Comparación e Informe Granular**: Durante el proceso de restauración, el backend descifra la copia cifrada AES-256-CBC, realiza un mapeo diferencial para detectar las modificaciones no autorizadas hechas directamente en PostgreSQL (filas borradas de la base de datos, inyecciones de nuevos módulos, o valores CRUD o acciones alteradas), sobrescribe la base de datos con los registros válidos, recalcula y firma el hash de seguridad, y registra un reporte textual detallado en `audit_logs` bajo el tipo de acción `"repair_audit_report"`.
12. **Aislamiento Multitenant**: Un cliente corporativo solo puede ver y editar los roles que tengan su mismo `companyId`. El súper usuario (`SU`) puede administrar los roles de todas las empresas.
13. **Protección de Roles Activos**: No se permite eliminar un Rol si existen usuarios activos asignados a él; el sistema debe exigir la reasignación de los usuarios a otro Rol antes de proceder.

---

## Estados y Casos Borde
*   **Rol Activo**: Disponible para ser asignado a usuarios. Sus permisos se evalúan en tiempo real en cada petición.
*   **Rol Inactivo**: Oculto para nuevas asignaciones, pero se mantiene en la base de datos para auditoría histórica.
*   **Cargos con Integridad Completa**: Cargos cuya firma en base de datos coincide con el cálculo dinámico de permisos activos actuales. Se muestra `"Completa"` en color verde en el panel de control.
*   **Cargos con Integridad Vulnerada**: Cargos cuya firma digital no coincide debido a manipulación externa en base de datos. Se inhabilitan los accesos normales en caliente, se muestra un indicador `"VULNERADA"` intermitente en rojo, y se activa el botón dinámico de reparación `"🛠️ Reparar"`.
*   **Intento de Acceso Cruzado**: Si un usuario intenta enviar un `companyId` alterado en las cabeceras HTTP, la API bloqueará la petición registrando un evento de seguridad de denegación de acceso.
*   **Módulos sin Permisos**: Si a un usuario se le retiran todos los permisos de un módulo, este módulo desaparecerá instantáneamente de su Sidebar.

---

## Diseño Funcional de UI

El módulo de Roles presentará un diseño homogéneo, dinámico y de alta fidelidad como se describe a continuación:

### 1. Panel de Control Superior
*   **Filtros Rápidos e Inputs**: Buscador inteligente por ID clave, nombre o descripción y selector rápido de alcances generales (Scopes).
*   **Columnas Dinámicas**: Menú desplegable para ocultar/mostrar columnas clave de la grilla en caliente (`ID Clave`, `Nombre`, `Descripción`, `Alcance`, `Cant. Permisos`, `Integridad`, `Acciones`).
*   **Botón Agregar Cargo**: Elemento premium color verde menta (`#2ad072`) que despliega el Drawer lateral para la creación del cargo.

### 2. Grilla de Cargos e Integridad Visual
*   **Columna de Integridad**: Despliega un badge con la verificación del sistema en tiempo real:
    *   *Completa* (Verde): Indica consistencia criptográfica exitosa.
    *   *VULNERADA* (Rojo intermitente con animación `animate-pulse` e ícono de advertencia): Indica firma dañada debido a manipulación ilícita externa.
*   **Botón Dinámico de Acción**:
    *   Si la integridad es *Completa*, se muestra el botón tradicional **"Ver permisos"** (estilo violeta).
    *   Si la integridad es *VULNERADA*, el botón es reemplazado por la acción animada **"🛠️ Reparar"** (en color rojo/rosa de alta advertencia).

### 3. Modal de Reparación de Integridad
Activado al presionar el botón de reparación:
*   **Si el Actor de Sesión no es "SU"**: Despliega un banner premium de color rojo con ícono de candado indicando que el acceso está estrictamente restringido y bloquea cualquier acción de escritura o botones.
*   **Si el Actor de Sesión es "SU"**: Despliega una alerta de seguridad del sistema y provee dos elecciones claras:
    1.  **Restaurar desde Respaldo Cifrado**: Dispara la restauración, activa un spinner e indicador de progreso y despliega los resultados de discrepancias en color de alto contraste en un visor de consola oscura (`bg-slate-950 font-mono text-slate-100 p-4 rounded-2xl`).
    2.  **Configurar desde Cero**: Revoca de forma completa los permisos alterados y reinicia la copia de seguridad cifrada, abriendo una ventana limpia para reasignar accesos legítimos.

### 4. Cuadrícula de Permisos Jerárquica y Acciones Especiales
Organizada en acordeones o secciones por categorías de módulos:
*   **Sección A: Aplicación Móvil** (Módulos como *Postcosecha*, *Boncheo*, *Cuarto Frío*, *Registrar Enfermedades*).
*   **Sección B: Menú Principal** (Módulos como *Inicio*, *Dashboard*, *Cultivo*, *Talento Humano*).
*   **Sección C: General** (Módulos como *Administración*, *Configuraciones*).

Cada fila de módulo presentará:
*   El nombre del módulo y su ruta técnica entre paréntesis (ej. `Postcosecha ( /ScanPost )`).
*   Checkboxes agrupados bajo las columnas: **Leer**, **Crear**, **Actualizar**, y **Borrar**.
*   Botón **"Acciones"** con indicación en badge superior sobre la cantidad de acciones especiales configuradas en el módulo.
*   Menú desplegable dinámico al dar clic en "Acciones", renderizando una grilla con switches/checkboxes de accesos específicos de negocio (ej. *Escanear Postcosecha*, *Aprobar Lote*, *Clonar Rol*).
*   Sangría visual clara para diferenciar submódulos hijos (ej. bajo *Cultivo*: *Asignaciones*, *Etiquetas*, *Variedades*, *Fincas*).

---

## Backend y Reglas de Dominio
Al realizar cualquier operación de base de datos a través de la API dinámica (`/api/v1/db/roles` y `/api/v1/db/role_assignments`), el backend ejecutará:
1.  **Resolución de Sesión**: Carga del `x-actor-role` y `x-company-id`.
2.  **Validación de Escritura**: Comprobación en `public.RolePermission` de que el usuario logueado tenga el permiso `can_write = true` en el módulo de administración de roles (`/admin/roles`).
3.  **Invalidación de Caché**: Al editar los permisos de un Rol, el backend emitirá una invalidación de las sesiones activas asociadas a ese rol para obligar a Next-Auth a recargar las capacidades en la próxima navegación del usuario.

---

## Contratos API

### 1. Obtener y Listar Roles del Tenant (Integridad y Firmas Dinámicas)
*   **Endpoint**: `GET /api/v1/db/roles`
*   **Cabeceras**: Autenticación estándar y Tenant ID.
*   **Respuesta Exitosa (200 OK)**:
    ```json
    {
      "table": "roles",
      "count": 1,
      "data": [
        {
          "id": "uuid-rol",
          "key_id": "VEN",
          "name": "Vendedor",
          "description": "Responsable de ventas",
          "scope": "user",
          "company_id": "900000000",
          "status": "active",
          "hashPermission": "8c922f805604eaaed7d3...",
          "integrityStatus": "completa",
          "permissions": {
            "m-postcosecha": {
              "read": true,
              "create": false,
              "update": false,
              "delete": false,
              "status": "active",
              "microroles": {
                "scan_post": true
              }
            }
          }
        }
      ]
    }
    ```

### 2. Guardar/Actualizar Permisos de un Rol (Firma Digital y Copia de Respaldo Cifrada)
*   **Endpoint**: `PATCH /api/v1/db/roles`
*   **Body**:
    ```json
    {
      "id": "uuid-rol",
      "permissions": {
        "m-postcosecha": {
          "read": true,
          "create": false,
          "update": false,
          "delete": false,
          "microroles": {
            "scan_post": true
          }
        }
      }
    }
    ```
*   **Operación Backend**: Actualiza la firma `hashPermission` mediante HMAC-SHA256, serializa y cifra simétricamente en AES-256-CBC y escribe la copia de seguridad cifrada en `RolePermissionSecurity`.
*   **Respuesta Exitosa (200 OK)**: `{ "table": "roles", "data": { "id": "uuid-rol", ... } }`

### 3. Reparación y Restauración de Integridad (Exclusivo Super Usuario SU)
*   **Endpoint**: `PATCH /api/v1/db/roles`
*   **Body**:
    ```json
    {
      "id": "uuid-rol",
      "action": "repair",
      "repairAction": "restore"
    }
    ```
    *(Nota: `repairAction` puede tomar el valor `"restore"` para restaurar copia cifrada o `"scratch"` para restablecer a cero)*.
*   **Operación Backend**: Valida privilegio `"SU"`, recupera y descifra el respaldo cifrado, computa diferencias y alteraciones no autorizadas contra la base de datos, re-establece permisos correctos, re-firma el hash, inserta el reporte detallado en `audit_logs` y retorna el reporte.
*   **Respuesta Exitosa (200 OK)**:
    ```json
    {
      "table": "roles",
      "data": {
        "ok": true,
        "report": "Se detectaron las siguientes discrepancias en base de datos:\n1. Módulo \"Postcosecha\": canCreate cambiado de FALSE a TRUE (ALTERADO)\n2. Módulo \"Boncheo\": Permisos ILEGALES añadidos por fuera de la aplicación."
      }
    }
    ```
*   **Error (403 Forbidden - Actor no SU)**:
    ```json
    {
      "message": "Forbidden: Solo el Super Usuario (SU) está autorizado para reparar la integridad de un cargo."
    }
    ```

---

## Datos y Persistencia

### Modelo de Datos en Prisma (`schema.prisma`)

```prisma
model Role {
  id                      String                  @id @default(cuid())
  key_id                  String                  @unique
  name                    String
  description             String?
  scope                   String
  company_id              String?
  status                  String                  @default("active")
  hashPermission          String?                 // Firma criptográfica HMAC-SHA256 de permisos
  createdAt               DateTime                @default(now())
  updatedAt               DateTime                @updatedAt
  permissions             RolePermission[]
  securityBackup          RolePermissionSecurity? // Vínculo a copia de seguridad cifrada
}

model RolePermission {
  id        String   @id @default(cuid())
  roleId    String
  moduleId  String
  canRead   Boolean  @default(false)
  canCreate Boolean  @default(false)
  canUpdate Boolean  @default(false)
  canDelete Boolean  @default(false)
  actions   Json?    @default("{}")              // Acciones especiales de negocio
  status    String   @default("active")          // 'active' o 'deprecated'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  role      Role     @relation(fields: [roleId], references: [id])
  module    Modules  @relation(fields: [moduleId], references: [id])

  @@index([roleId])
}

model RolePermissionSecurity {
  id        String   @id @default(cuid())
  roleId    String   @unique
  backup    String   // JSON de matriz de permisos cifrado en AES-256-CBC
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  role      Role     @relation(fields: [roleId], references: [id])
}
```

---

## Seguridad y Permisos
*   **RLS (Row-Level Security)**: Se habilitará en la tabla `"Role"` y `"RolePermission"` de forma que un usuario con `company_id` específico jamás pueda visualizar ni editar roles de otro tenant.
*   **Protección de Clave Primaria**: Todas las modificaciones se basan en el ID único (UUID), validado contra la sesión del usuario.
*   **Control de SU**: Las configuraciones de scope `Super Admin` solo pueden ser manipuladas por actores con `x-actor-role = 'SU'`.

---

## Plan de Testing
1.  **Pruebas Unitarias**:
    *   Verificar que al consultar los permisos de un usuario, se retorne correctamente la matriz de lectura/escritura de su rol asignado.
    *   Verificar que un usuario sin rol asignado reciba permisos denegados por defecto en todos los módulos.
2.  **Pruebas de Integración (API)**:
    *   Realizar peticiones `POST`/`PATCH` con un rol que tenga `can_create = false` o `can_update = false` y validar que retorne exactamente `403 Forbidden`.
    *   Intentar eliminar un rol asignado a usuarios activos y validar que la API retorne un error de negocio controlado.
3.  **Pruebas Manuales (UI)**:
    *   Asignar el rol de "Vendedor" a un usuario de pruebas, entrar con su cuenta y validar que los módulos no autorizados no se rendericen en el Sidebar y que los botones de "Agregar/Eliminar" estén ocultos.

---

## Plan de Entrega por Tareas

### Fase 1: Datos y Backend
*   **Tarea 1**: Crear las tablas `"Role"` y `"RolePermission"` en la base de datos PostgreSQL (Neon).
    *   *Criterio de Aceptación*: Tablas creadas con claves primarias, foráneas y restricciones de unicidad.
*   **Tarea 2**: Configurar los accesos CRUD en `pgDynamicDbStore.ts` y la ruta dinámica de API `/api/v1/db/roles`.
    *   *Criterio de Aceptación*: La API responde a GET, POST, PATCH y DELETE de roles aislando por `companyId`.

### Fase 2: Interfaz de Usuario y Controles
*   **Tarea 3**: Desarrollar el componente visual de cuadrícula jerárquica con checkboxes para Leer, Crear, Actualizar y Borrar.
    *   *Criterio de Aceptación*: Lista correctamente los módulos en sus tres secciones, respeta la sangría de los submódulos y actualiza el estado de selección en el cliente.
*   **Tarea 4**: Implementar el panel lateral (Drawer) de adición/edición de Roles.
    *   *Criterio de Aceptación*: Transición deslizable suave, validación de inputs y envío correcto de payloads a la base de datos.

### Fase 3: Integración de Seguridad y Menú
*   **Tarea 5**: Integrar el filtro de menús en el Sidebar basado en la tabla `"RolePermission"`.
    *   *Criterio de Aceptación*: Los módulos ocultos en el rol desaparecen instantáneamente del Sidebar al iniciar sesión.

---

## Matriz de Trazabilidad
| Requerimiento (Spec) | Tarea de Entrega | Caso de Prueba |
| :--- | :--- | :--- |
| **Rol Único por Usuario** | Tarea 1 y 2 | Intentar asociar múltiples roles en la tabla de asignación. |
| **Cuadrícula Jerárquica** | Tarea 3 | Verificar el renderizado de módulos e hijos con sangría. |
| **Granularidad de Permisos** | Tarea 3 y 4 | Marcar y guardar combinaciones específicas de Leer/Crear/Actualizar/Borrar. |
| **Validación de API** | Tarea 2 | Petición de escritura no autorizada retorna `403 Forbidden`. |
| **Aislamiento Multitenant** | Tarea 2 y 5 | Usuario de Empresa A no puede leer ni ver roles de Empresa B. |

---

## Criterios de Aceptación
1.  **Criterio 1**: El administrador de la empresa solo visualiza y edita los roles asociados a su propio `companyId`.
2.  **Criterio 2**: Un usuario de la plataforma tiene estrictamente **un solo rol asignado** que agrupa y limita todos sus accesos.
3.  **Criterio 3**: La cuadrícula de permisos desglosa las cuatro acciones esenciales (**Leer, Crear, Actualizar, Borrar**) mapeadas directamente de la tabla `modules`.
4.  **Criterio 4**: Al desmarcar el permiso de "Leer" para un módulo, dicho módulo queda oculto en el Sidebar del usuario y su acceso por URL directa queda bloqueado.
5.  **Criterio 5**: El sistema impide la eliminación de cualquier Rol que tenga al menos un usuario activo asignado.

---

## Suposiciones Confirmadas
*   El usuario posee **un único rol activo** que representa su conjunto total y exclusivo de accesos en su organización.
*   La cuadrícula se estructura de forma jerárquica distinguiendo entre Aplicación Móvil, Menú Principal y General.
*   La asignación de permisos se basa en cuatro acciones básicas configurables (Leer, Crear, Actualizar, Borrar).
*   El backend valida estas capacidades dinámicamente antes de mutar registros de cualquier entidad.
