# Skill: Settings Config CRUD Pattern

## Proposito
Estandarizar la construccion de pantallas de configuracion administrativa en Settings con el patron:
- tabla de registros
- busqueda/filtros
- boton agregar
- formulario desplegable para crear/editar
- acciones por fila
- persistencia en BD via API dinamica

Este skill sirve como blueprint reutilizable para futuras configuraciones (modulos, empresas, integraciones, etiquetas, parametros, etc.).

---

## Cuando usar este skill

Usalo cuando se necesite una pagina de Settings con:
1. administracion CRUD de una entidad,
2. listado con criterios de busqueda,
3. formulario de alta/edicion,
4. restricciones por rol (ej. solo `SU` muta),
5. evidencia de pruebas y trazabilidad.

---

## Referencia base analizada

Fuente ejemplo:
- `Proyecto Agrotrack/agrotrack/src/app/(protected)/admin/user/page.jsx`
- `Proyecto Agrotrack/agrotrack/src/app/(protected)/admin/user/component.js`

Patron observado:
- `page` server obtiene sesion y delega al componente client.
- componente client concentra estado de tabla, filtros, paginacion, ordenamiento y formulario.
- busqueda por texto + filtro de estado.
- acciones por fila (ver/editar/eliminar) via menu contextual.
- boton agregar que abre formulario.
- feedback de carga/errores/exito.

---

## Arquitectura recomendada (reutilizable)

### 1) Estructura de archivos
- `page.tsx` (server): valida sesion/rol, prepara datos iniciales.
- `Config<Entity>Client.tsx` (client): tabla + filtros + formulario + acciones.
- `server/<entity>DbStore.ts` (server): reglas de dominio y acceso a BD.
- `api/v1/db/[table]/route.ts`: contrato dinamico unico.

### 2) Flujo de datos
1. Carga inicial de listado + catalogos (scope/status/tipos).
2. Usuario filtra/busca/ordena.
3. Usuario abre formulario (crear/editar).
4. Submit a API dinamica (`POST` o `PATCH`).
5. Refresco del listado y de widgets relacionados (ej. sidebar).
6. Delete logico (`DELETE` -> `status=inactive`).

### 3) Control de permisos
- Lectura: segun politica de la entidad.
- Mutaciones: solo rol autorizado (ej. `SU`).
- Validacion backend obligatoria aunque frontend oculte botones.

---

## Contrato UX minimo obligatorio

### A) Cabecera de pantalla
- titulo de seccion
- descripcion corta
- estado general (loading/error)

### B) Barra de controles
- input busqueda por campos principales
- filtros (status/scope/tipo)
- boton `Agregar`

### C) Tabla
- columnas de negocio (code, name, status, updated_at...)
- ordenamiento por columnas clave
- paginacion
- estado vacio claro

### D) Acciones por fila
- editar
- desactivar/reactivar
- (opcional) ver detalle

### E) Formulario desplegable
- modo crear/editar reutilizando componente
- validaciones inline
- bloqueo de campos inmutables (ej. `code`)
- botones guardar/cancelar

### F) Feedback
- toast exito/error
- mensajes accionables
- confirmacion previa en cambios destructivos/logicos

---

## Contrato tecnico minimo

1. Persistencia real en BD (prohibido JSON local funcional).
2. API dinamica como unico canal de la entidad (`/api/v1/db/<table>`).
3. Reglas de dominio en capa server, no solo en UI.
4. Auditoria de mutaciones y denegaciones.
5. Soporte soft-delete por estado.
6. Validaciones de integridad referencial y catalogos.

---

## Checklist de implementacion por entidad

### Backend
- [ ] Tabla creada con PK, unique, indices y timestamps.
- [ ] Allowlist de tabla habilitada en API dinamica.
- [ ] `POST/PATCH/DELETE` con control de rol.
- [ ] `DELETE` logico por `status`.
- [ ] Validaciones de negocio y catalogos.
- [ ] Auditoria de cambios.

### Frontend
- [ ] Vista en Settings con layout de secciones.
- [ ] Tabla con busqueda/filtros/paginacion.
- [ ] Formulario crear/editar desplegable.
- [ ] Acciones por fila y confirmaciones.
- [ ] Manejo de loading/empty/error/forbidden.

### QA
- [ ] Unit tests de validaciones.
- [ ] Integracion API con BD.
- [ ] E2E del flujo completo.
- [ ] Evidencia de no uso de datos locales.

---

## Plantilla de definicion rapida (copiar/pegar)

```md
Entidad: <nombre>
Tabla BD: <table>
Scope de acceso lectura: <roles>
Scope de acceso mutacion: <roles>
Campos: <lista>
Campo inmutable: <ej. code>
Delete logico: <status target>
Catalogos requeridos: <ej. st_multidata.type=roleScope>
Filtros UI: <lista>
Columnas tabla UI: <lista>
Pruebas obligatorias: Unit/Integracion/E2E
```

---

## Anti-patrones prohibidos

1. Crear endpoint especifico cuando ya existe ruta dinamica valida.
2. Guardar datos funcionales en archivos locales (`.json`) para el flujo final.
3. Dejar autorizacion solo en frontend.
4. Borrado fisico sin regla explicita.
5. No auditar cambios de configuracion.

---

## Criterio de finalizacion (DoD)

Se considera completada una configuracion cuando:
- la entidad se administra desde Settings con tabla+filtros+formulario,
- toda mutacion persiste en BD por API dinamica,
- control de permisos esta activo en backend,
- pruebas Unit/Integracion/E2E pasan,
- evidencia queda registrada en backlog/scrum.
