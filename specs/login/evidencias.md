# Evidencias de ejecucion - Login Social

## Convencion
- Todas las evidencias del backlog de login deben guardarse en `specs/login/`.
- Cada tarea debe dejar evidencia minima de: cambios realizados, validacion ejecutada y resultado.
- Si aplica, adjuntar captura o log en archivos separados dentro de `specs/login/evidencias/`.

## Registro actual

### 2026-05-21 - Orquestacion inicial desde spec
- **Fuente revisada**: `specs/login/onboarding-social-con-catalogos.md`
- **Backlog actualizado**: `.scrum/scrum-db.json`
- **Resultado**:
  - Creado `EPIC-050` (Onboarding Social y Alta Administrativa)
  - Creadas historias `STORY-LOGIN-001` a `STORY-LOGIN-004`
  - Creadas tareas `TASK-LOGIN-001` a `TASK-LOGIN-010`
  - Iniciada ejecucion de `STORY-LOGIN-001` y `TASK-LOGIN-001`
- **Validacion**:
  - JSON de `.scrum/scrum-db.json` validado correctamente (`python3 -m json.tool`)

### 2026-05-21 - Ejecucion backlog login (fase 1)
- **Historias impactadas**:
  - `STORY-LOGIN-001` (Done)
  - `STORY-LOGIN-002` (Done)
  - `STORY-LOGIN-003` (InProgress)
  - `STORY-LOGIN-004` (InProgress)
- **Tareas completadas**:
  - `TASK-LOGIN-001` endpoint resolve social onboarding
  - `TASK-LOGIN-002` guard de bloqueo por `PENDING_APPROVAL`
  - `TASK-LOGIN-003` formulario onboarding
  - `TASK-LOGIN-004` selects dependientes pais/departamento/ciudad
  - `TASK-LOGIN-005` APIs de catalogos
  - `TASK-LOGIN-006` validaciones de unicidad y catalogos
  - `TASK-LOGIN-007` persistencia y transicion con auditoria
- **Implementacion (archivos principales)**:
  - `web/src/server/loginOnboardingStore.ts`
  - `web/src/server/loginAccess.ts`
  - `web/src/lib/auth-options.ts`
  - `web/src/app/[locale]/onboarding/page.tsx`
  - `web/src/app/[locale]/onboarding/OnboardingClient.tsx`
  - `web/src/app/[locale]/pending-approval/page.tsx`
  - `web/src/app/[locale]/(protect)/pending-users/page.tsx`
  - `web/src/app/[locale]/(protect)/home/page.tsx`
  - `web/src/app/[locale]/(protect)/scrum/page.tsx`
  - `web/src/app/[locale]/(protect)/account-config/page.tsx`
  - `web/src/app/api/v1/auth/social/onboarding/resolve/route.ts`
  - `web/src/app/api/v1/auth/social/onboarding/submit/route.ts`
  - `web/src/app/api/v1/auth/social/onboarding/status/route.ts`
  - `web/src/app/api/v1/catalogs/companies/route.ts`
  - `web/src/app/api/v1/catalogs/countries/route.ts`
  - `web/src/app/api/v1/catalogs/departments/route.ts`
  - `web/src/app/api/v1/catalogs/cities/route.ts`
  - `web/src/app/api/v1/catalogs/multidata/route.ts`
  - `web/src/app/api/v1/admin/users/pending-approvals/route.ts`
  - `web/src/app/api/v1/admin/users/[userId]/approve/route.ts`
  - `web/src/app/api/v1/admin/users/[userId]/reject/route.ts`
- **Pruebas ejecutadas**:
  - `npm run lint` -> OK (sin errores; warning existente previo en `protected-sidebar-layout.tsx` por uso de `<img>`)
  - `python3 -m json.tool .scrum/scrum-db.json` -> OK
- **Pendientes abiertos**:
  - `TASK-LOGIN-008` catalogos desde `st_Multidata`/semillas completas
  - `TASK-LOGIN-009` acciones UI de aprobar/rechazar en bandeja admin
  - `TASK-LOGIN-010` suite E2E completa del flujo

### 2026-05-21 - Cierre backlog login (fase 2)
- **Tareas completadas**:
  - `TASK-LOGIN-008` semillas de catalogos para reutilizacion futura
  - `TASK-LOGIN-009` UI de aprobar/rechazar en bandeja admin
  - `TASK-LOGIN-010` validacion E2E del flujo completo (nuevo -> pendiente -> aprobado)
- **Implementacion (archivos principales)**:
  - `.scrum/login-catalog-db.json`
  - `web/src/server/loginOnboardingStore.ts`
  - `web/src/app/[locale]/(protect)/pending-users/PendingUsersClient.tsx`
  - `web/src/app/[locale]/(protect)/pending-users/page.tsx`
- **Pruebas ejecutadas**:
  - `npm run lint` -> OK (sin errores; warning previo en `protected-sidebar-layout.tsx`)
  - Flujo API E2E por HTTP local (evidencias en `specs/login/evidencias/`):
    - `resolve-new.json`
    - `submit-new.json`
    - `status-new.json`
    - `pending-list-before-approve.json`
    - `approve-user.json`
    - `status-after-approve.json`
    - `dev-server.log`
  - `python3 -m json.tool .scrum/scrum-db.json` -> OK
- **Resultado funcional**:
  - Backlog login completado (`TASK-LOGIN-001` a `TASK-LOGIN-010` en Done)
  - Historias login completadas (`STORY-LOGIN-001` a `STORY-LOGIN-004` en Done)
  - Epica `EPIC-050` en Done

### 2026-05-21 - Retroalimentacion aplicada (manual API + prisma/data.sql)
- **Objetivo**: alinear catalogos y rutas con `docs/API_V1_DB_MANUAL.md`, `docs/prisma/schema.prisma` y `docs/prisma/data.sql`.
- **Ajustes aplicados**:
  - Se extendio allowlist dinamica para `st_state` y `st_city` en `web/src/server/dynamicDbStore.ts`.
  - Se agrego parseo y seed desde `data.sql` para `st_State` y `st_City` en `web/src/server/dynamicDbStore.ts`.
  - `loginOnboardingStore` ahora arma catalogos desde tablas dinamicas (`st_multidata`, `st_country`, `st_state`, `st_city`) en lugar de hardcode.
  - Se agregaron alias de compatibilidad para ruta `bd`:
    - `web/src/app/api/v1/bd/multi/route.ts`
    - `web/src/app/api/v1/bd/[table]/route.ts`
- **Prueba ejecutada**:
  - `npm run lint` -> OK (solo warning previo existente en sidebar por `<img>`)

### 2026-05-21 - Persistencia de usuario en base de datos real
- **Cambio principal**:
  - `loginOnboardingStore` ya no guarda usuarios en archivo local; ahora crea y actualiza en PostgreSQL (`onboarding_users`).
- **Archivos**:
  - `web/src/server/loginOnboardingStore.ts`
  - `docs/prisma/schema.prisma`
- **Pruebas online ejecutadas**:
  - `POST /api/v1/auth/social/onboarding/submit` con usuario `online-user@test.com` -> `200 OK`.
  - Verificacion directa en DB (consulta SQL via `pg`) -> registro existente con `status=pending_approval`.
- **Resultado**:
  - El alta/actualizacion del usuario onboarding queda persistida en base de datos real.

### 2026-05-22 - Normalizacion de onboarding sobre PlatformUser y userStatus
- **Objetivo**: corregir definicion de datos de onboarding para no reutilizar columnas semanticas (`position`/`avatar`) y depurar `userStatus` para flujo social.
- **Cambios aplicados**:
  - Se agregaron columnas dedicadas en DB real: `PlatformUser.department_code` y `PlatformUser.city_code`.
  - Se hizo backfill de datos previos desde `position` y `avatar` para mantener compatibilidad.
  - `loginOnboardingStore` ahora mapea `department` -> `department_code` y `city` -> `city_code`.
  - Se actualizo el modelo Prisma `PlatformUser` en `docs/prisma/schema.prisma` con `departmentCode` y `cityCode`.
  - Se depuro `st_Multidata(type='userStatus')` para mantener solo valores de onboarding: `active`, `inactive`, `pending_approval` en `es` y `en`.
- **Validacion ejecutada**:
  - Verificacion SQL de columnas en `PlatformUser` -> presentes (`department_code`, `city_code`).
  - Verificacion SQL de catalogo `userStatus` -> 6 filas exactas (3 valores x 2 idiomas).
  - `npm run -s typecheck` en `web/` -> OK.
- **Resultado**:
  - El flujo onboarding queda persistiendo en columnas correctas y el estado de usuario queda alineado al catalogo definido para aprobacion administrativa.

## Plantilla de evidencia por tarea

### TASK-LOGIN-XXX - <titulo>
- **Estado**: ToDo | InProgress | Done
- **Fecha**: YYYY-MM-DD
- **Implementacion**:
  - <archivo1>
  - <archivo2>
- **Pruebas ejecutadas**:
  - `<comando>` -> <resultado>
- **Resultado funcional**:
  - <que quedo funcionando>
- **Pendientes**:
  - <si aplica>
