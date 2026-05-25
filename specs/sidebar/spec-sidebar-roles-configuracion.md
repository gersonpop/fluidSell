# Especificacion: Sidebar Integrado con Roles y Configuracion de Cuentas

## Contexto
El sidebar es el punto principal de navegacion a modulos. Hoy se requiere que su visibilidad este gobernada por roles para evitar accesos no autorizados y reducir ruido visual. Adicionalmente, se necesita un modulo de configuracion de usuario para administrar cuentas de clientes.

## Objetivo
Asegurar que los modulos visibles en el sidebar dependan de permisos de rol/microrol, y habilitar un modulo de configuracion donde se definan y gestionen configuraciones de cuentas de clientes.

## Usuario principal
- Super Usuario (SU)
- Administrador Cliente

## Historia de usuario
Como Super Usuario, necesito que el sidebar este integrado con los roles de usuario para que desde alli se controle el acceso visible a modulos, y que exista un modulo de configuracion de usuario para definir configuraciones de cuentas de clientes.

## Alcance
- Control de visibilidad de iconos/modulos en sidebar por rol y microrol.
- Reglas de ocultamiento de modulos sin permiso.
- Modulo de configuracion de usuario para cuentas cliente.
- Segmentacion por `companyId` en administracion cliente.
- Consistencia de reglas entre web y mobile.
- Rechazo de acceso directo por URL a modulos no autorizados.
- Trazabilidad basica de cambios de configuracion y permisos.

## Fuera de alcance
- Rediseño completo del sistema visual del sidebar.
- Cambio de modelo de autenticacion.
- Definicion detallada de infraestructura tecnica.
- Migracion masiva de datos historicos de permisos.

## Reglas funcionales
1. Cada modulo del sidebar debe tener una regla de visibilidad asociada a rol/microrol.
2. Si el usuario no tiene permiso para un modulo, ese modulo no se muestra en el sidebar.
3. El Super Usuario puede configurar que modulos son visibles por cada rol.
4. Los administradores cliente solo pueden gestionar configuraciones de cuentas dentro de su `companyId`.
5. El modulo de configuracion de usuario debe permitir gestionar estado de cuenta y asignacion de roles por cliente.
6. La visibilidad de sidebar debe actualizarse tras cambios de permisos en nuevas sesiones.
7. Debe definirse comportamiento para usuario sin rol asignado (sidebar minimo o vacio controlado).
8. Si se intenta entrar por URL a un modulo no autorizado, el acceso se rechaza.
9. El sistema debe registrar trazabilidad de cambios de configuracion y permisos visibles de sidebar.
10. La misma politica de visibilidad aplica en web y mobile para el mismo usuario.

## Estados y casos borde
- Usuario con permisos completos: sidebar muestra todos los modulos permitidos.
- Usuario con permisos parciales: sidebar muestra subset filtrado.
- Usuario sin rol: sidebar minimo y sin accesos no autorizados.
- Rol actualizado: sidebar refleja cambios segun politica de refresco.
- Acceso directo por URL sin permiso: acceso denegado.
- Administrador cliente intentando configurar otro `companyId`: operacion denegada.
- Cuenta inactiva/suspendida: se restringe acceso a modulos segun politica de cuenta.

## Criterios de aceptacion
1. Un usuario con rol limitado no ve iconos de modulos fuera de su permiso.
2. Un usuario no autorizado no puede abrir modulo por URL directa.
3. El SU puede modificar visibilidad de modulos por rol y ver el efecto en usuarios de prueba.
4. Un administrador cliente solo gestiona cuentas y configuraciones de su propio `companyId`.
5. El modulo de configuracion permite asignar o retirar roles a cuentas cliente.
6. Existe registro de cambios para acciones de configuracion y permisos.
7. La regla de visibilidad funciona igual en web y mobile.

## Suposiciones confirmadas
- La visibilidad de modulos en sidebar se gobierna por rol/microrol.
- Si no hay permiso, el modulo no se muestra en sidebar.
- El SU define visibilidad por rol desde configuracion.
- Cliente administra configuraciones dentro de su `companyId`.
- El modulo de configuracion cubre cuentas cliente y asignacion de roles.
- Cambios de permisos impactan sidebar en nuevas sesiones.
- Existe manejo definido para usuarios sin rol.
- Acceso directo a modulos no autorizados se bloquea.
- Se mantiene trazabilidad de cambios relevantes.

## Trazabilidad a Scrum
- Epic: `EPIC-030` - Sidebar por Roles y Configuracion de Cuentas.
- Stories:
  - `STORY-SIDEBAR-001` - Visibilidad de modulos en sidebar por rol y microrol.
  - `STORY-SIDEBAR-002` - Bloqueo de acceso directo por URL en modulos no autorizados.
  - `STORY-SIDEBAR-003` - Modulo de configuracion de cuentas cliente segmentado por `companyId`.

## Asignacion de agentes (orquestacion)
- `access-policy-guardian`: matriz de visibilidad, segmentacion por `companyId` y coherencia de politicas.
- `frontend-navigation-specialist`: rendering dinamico del sidebar por permisos.
- `backend-auth-integrator`: enforcement de autorizacion en rutas/URL directas.
- `cybersecurity-guardian`: auditoria de denegaciones y trazabilidad de eventos.
- `ui-system-architect`: UI del modulo de configuracion de cuentas/roles.
- `qa-e2e-analyst`: validacion E2E de reglas funcionales en web.
