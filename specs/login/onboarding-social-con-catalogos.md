# Especificacion: Onboarding social con alta administrativa y catalogos maestros

## Contexto
La plataforma requiere un flujo de autenticacion social seguro para usuarios nuevos o inactivos. Ademas, el formulario de onboarding debe usar catalogos corporativos (empresas, ubicacion, genero) para estandarizar datos y permitir reutilizacion futura en otros formularios.

## Objetivo
Permitir que usuarios autenticados por red social completen/actualicen su informacion mediante campos controlados por catalogo, queden en estado pendiente de alta y no accedan a la plataforma hasta aprobacion administrativa.

## Usuario principal
- Usuario final autenticado por red social.
- Administrador interno autorizado (SU/rol admin) que aprueba altas.

## Historia de usuario
Como usuario, cuando me logueo con red social y no existo o estoy inactivo, debo completar un formulario con datos validados. Al guardar, quedo pendiente de alta y no puedo ingresar hasta ser habilitado por seguridad.

## Alcance
- Resolucion de estado de usuario tras login social.
- Formulario onboarding para nuevo/inactivo.
- Uso obligatorio de catalogos para empresa, pais, departamento, ciudad y genero.
- Persistencia de datos y cambio de estado a pendiente.
- Bloqueo de acceso para pendientes.
- Flujo admin para aprobar/rechazar.

## Fuera de alcance
- Validacion documental contra fuentes gubernamentales externas.
- Aprobacion automatica sin actor administrativo.
- Rediseño global de la aplicacion fuera del flujo onboarding/admin.

## Requerimientos no funcionales
- Seguridad: proteccion de PII, sin exposicion de datos sensibles en logs.
- Integridad: datos de selects solo desde catalogos autorizados.
- Confiabilidad: endpoints idempotentes en operaciones criticas.
- Rendimiento: carga de catalogos y submit < 500ms p95 (objetivo).
- Trazabilidad: auditoria de cambios de estado y acciones administrativas.
- Escalabilidad funcional: catalogos reutilizables para futuros formularios.

## Reglas funcionales
1. El flujo aplica para todos los proveedores sociales habilitados.
2. Se valida existencia de usuario por email social.
3. Se valida unicidad por `countryCode + dni`.
4. No se permite mismo DNI en el mismo pais.
5. Se permite mismo numero de DNI en paises distintos.
6. Si usuario no existe: mostrar formulario de alta.
7. Si usuario existe e inactivo: mostrar formulario precargado para actualizacion.
8. Campos obligatorios: nombre completo, telefono, empresa, pais, departamento, ciudad, codigo de pais, dni, genero.
9. `empresa` debe seleccionarse de empresas existentes.
10. `pais`, `departamento`, `ciudad`, `codigoPais`, `genero` deben venir de catalogos.
11. No se aceptan valores fuera de catalogo.
12. Si falta catalogo o no hay opciones, mostrar estado controlado y bloquear guardado.
13. Al guardar correctamente, usuario queda `PENDING_APPROVAL`.
14. Usuario `PENDING_APPROVAL` no puede acceder a modulos internos.
15. Usuario pendiente puede autenticarse y solo ver pantalla de revision.
16. Si intenta otra red social y ya existe vinculacion, informar proveedor vinculado y no crear usuario alterno.
17. Solo admin autorizado puede aprobar/rechazar alta.
18. Toda transicion relevante debe quedar auditada.

## Estados y casos borde
Estados:
- `NEW_SOCIAL_USER` -> Formulario -> `PENDING_APPROVAL`
- `INACTIVE_USER` -> Formulario -> `PENDING_APPROVAL`
- `PENDING_APPROVAL` -> Pantalla en revision (sin acceso funcional)
- `ACTIVE` -> Acceso normal
- `REJECTED` (si aplica politica) -> mensaje de rechazo y ruta de soporte

Casos borde:
- proveedor no entrega email;
- catalogo vacio o no disponible;
- usuario selecciona pais y no existen departamentos;
- conflicto por `countryCode + dni`;
- conflicto por proveedor social diferente;
- timeout/error al guardar;
- reintento de usuario pendiente.

## Diseno funcional de UI
Pantallas:
1. **Onboarding social (nuevo/inactivo)**
   - Secciones: identidad, contacto, ubicacion, empresa.
   - Campos:
     - texto: nombre completo, telefono, dni, email (editable segun regla negocio).
     - select: empresa, genero, codigoPais, pais, departamento, ciudad.
   - Dependencias:
     - pais -> filtra departamentos
     - departamento -> filtra ciudades
   - Reglas UX:
     - selects cargan con estado `loading`, `empty`, `error`.
     - submit deshabilitado hasta formulario valido.
     - mensajes especificos por error de validacion/conflicto.

2. **Pantalla solicitud en revision**
   - Mensaje: cuenta pendiente de alta por seguridad.
   - Acciones: cerrar sesion, reintentar mas tarde.

3. **Bandeja admin de pendientes**
   - Lista con filtros (proveedor, fecha, estado, empresa).
   - Acciones: aprobar/rechazar con motivo.

## Backend y reglas de dominio
- Resolver login social:
  - `ACTIVE`: acceso.
  - `NEW/INACTIVE`: requiere formulario.
  - `PENDING_APPROVAL`: bloquear y mostrar revision.
  - `PROVIDER_CONFLICT`: bloquear creacion y mostrar proveedor ligado.
- Al submit:
  - validar existencia de todos los IDs/codigos de catalogo recibidos.
  - validar unicidad `countryCode + dni`.
  - crear/actualizar usuario.
  - cambiar estado a `PENDING_APPROVAL`.
  - registrar auditoria.
- Alta admin:
  - `approve`: `PENDING_APPROVAL -> ACTIVE`.
  - `reject`: `PENDING_APPROVAL -> REJECTED/INACTIVE` segun politica definida.

## Contratos API
- `POST /api/v1/auth/social/onboarding/resolve`
  - output: `ACTIVE | FORM_REQUIRED | PENDING_ONLY | PROVIDER_CONFLICT`
- `POST /api/v1/auth/social/onboarding/submit`
  - valida payload + catalogos + unicidad y deja pendiente
- `GET /api/v1/auth/social/onboarding/status`
  - devuelve estado actual para decidir vista

Catalogos:
- `GET /api/v1/catalogs/companies`
- `GET /api/v1/catalogs/countries`
- `GET /api/v1/catalogs/departments?countryCode=...`
- `GET /api/v1/catalogs/cities?countryCode=...&departmentCode=...`
- `GET /api/v1/catalogs/multidata?group=gender`
- `GET /api/v1/catalogs/multidata?group=countryCode`

Admin:
- `GET /api/v1/admin/users/pending-approvals`
- `POST /api/v1/admin/users/{id}/approve`
- `POST /api/v1/admin/users/{id}/reject`

Codigos:
- `200/201` exito
- `400` validacion
- `403` no autorizado
- `409` conflicto identidad/proveedor/catalogo invalido
- `500` error interno

## Datos y persistencia
Tablas/entidades:
- `User`
- `UserSocialIdentity`
- `UserStatusAudit`
- `OnboardingAudit`
- `Company` (fuente de empresas)
- `st_Multidata` (fuente de catalogos parametrizables)

Uso de `st_Multidata`:
- Debe contener, como minimo, grupos para:
  - `gender`
  - `countryCode`
  - `country`
  - `department`
  - `city`
- Si se requieren nuevos valores o enums funcionales, se crean en `st_Multidata` para reutilizacion futura.
- Politica: no hardcodear opciones de formulario en frontend/backend.

Restricciones:
- unique compuesta `countryCode + dni`.
- integridad de llaves de referencia de catalogos.
- validacion server-side de pertenencia a catalogo en submit.

## Seguridad y permisos
- Solo rol admin autorizado ejecuta approve/reject.
- Usuario pendiente bloqueado en rutas/procesos internos.
- Sanitizacion de errores para no filtrar informacion sensible.
- Auditoria obligatoria en:
  - submit onboarding
  - cambios de estado
  - acciones de aprobacion/rechazo.

## Plan de testing
Unit:
- validadores de campos obligatorios
- validador de unicidad pais+dni
- validadores de pertenencia a catalogo

Integracion:
- resolve por cada estado
- submit exitoso y submit con catalogo invalido
- dependencia pais/departamento/ciudad
- approve/reject con control de permisos

E2E:
1. nuevo social -> formulario -> seleccion catalogos -> pendiente -> bloqueo
2. inactivo -> precarga -> actualiza -> pendiente
3. conflicto proveedor social -> mensaje correcto
4. catalogo vacio/error -> bloqueo de submit + mensaje
5. admin aprueba -> usuario pasa a activo y puede ingresar

## Plan de entrega por tareas

### Frontend
1. Construir formulario onboarding con campos y validaciones.
2. Implementar selects dependientes pais/departamento/ciudad.
3. Integrar selects de empresa y multidata (genero, codigoPais).
4. Implementar pantalla “solicitud en revision”.
5. Construir bandeja admin de pendientes con aprobar/rechazar.

### Backend
6. Implementar `resolve` de onboarding social.
7. Implementar `submit` con validacion de catalogos y unicidad pais+dni.
8. Implementar bloqueo funcional para estado pendiente.
9. Implementar endpoints admin approve/reject con autorizacion.
10. Implementar endpoints de catalogos (companies, location, multidata).

### Datos
11. Definir/ajustar estructura de `st_Multidata` segun `docs/prisma/data.sql`.
12. Crear semilla de catalogos base (gender, countryCode, country, department, city).
13. Aplicar restricciones de unicidad/integridad necesarias.
14. Registrar auditorias de estado y acciones criticas.

### Testing/QA
15. Suite unit/integration para validaciones y transiciones.
16. Suite E2E del flujo completo onboarding + admin alta.
17. Pruebas de regresion de acceso bloqueado para pendientes.

## Matriz de trazabilidad
- CA1-CA2 (nuevo/inactivo con formulario) -> T1,T6,T7 -> IT,E2E-1,2
- CA3 (estado pendiente) -> T7,T14 -> IT,E2E-1,2
- CA4 (bloqueo de acceso) -> T8,T17 -> IT,E2E-1,2
- CA5-CA6 (pais+dni) -> T7,T13,T15 -> Unit,IT
- CA7 (proveedor conflictivo) -> T6,T15 -> IT,E2E-3
- CA8-CA9 (validaciones/errores) -> T1,T2,T3,T7 -> Unit,IT,E2E-4
- CA10 (auditoria) -> T14,T9 -> IT
- CA11 (catalogos obligatorios) -> T3,T10,T11,T12 -> IT,E2E-1,4

## Criterios de aceptacion
1. Usuario nuevo por red social siempre completa formulario antes de continuar.
2. Usuario inactivo por red social siempre actualiza datos antes de continuar.
3. El formulario solo permite seleccionar valores validos de catalogo para empresa, genero, codigoPais, pais, departamento y ciudad.
4. Si un catalogo requerido no tiene datos o falla, el sistema bloquea guardado y muestra mensaje claro.
5. Guardado exitoso deja estado `PENDING_APPROVAL`.
6. Usuario `PENDING_APPROVAL` no accede a modulos internos.
7. Se rechaza duplicado `countryCode + dni` en mismo pais.
8. Se permite mismo DNI en pais distinto.
9. Si existe vinculacion con otra red social, se informa proveedor y no se crea cuenta nueva.
10. Solo admin autorizado puede aprobar/rechazar pendientes.
11. Al aprobar, usuario pasa a `ACTIVE` y puede ingresar.
12. Toda accion clave deja registro de auditoria.

## Suposiciones confirmadas
- Flujo comun para todos los proveedores sociales.
- Formulario unico para nuevos e inactivos con precarga.
- Alta final manual por administrador.
- Catalogos maestros via `Company` y `st_Multidata`.
- Nuevos valores de listas se gestionan en catalogo reutilizable, no hardcodeados.
