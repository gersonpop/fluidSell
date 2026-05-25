# Especificacion: Sistema de Roles y Microroles Configurables

## Contexto
La plataforma requiere un modelo de autorizacion granular para controlar acceso por modulo y accion en web y app movil. Se necesita soportar multiempresa, gobierno por Super Usuario y proteccion de integridad de permisos.

## Objetivo
Diseñar un sistema de roles y microroles configurable que permita definir permisos precisos por modulo y accion, segmentar por `companyId`, y proteger el contenido de permisos contra manipulacion directa en base de datos.

## Usuario principal
- Super Usuario (SU): administra roles globalmente, incluyendo todos los clientes.
- Administrador Cliente: gestiona asignaciones de roles dentro de su empresa.
- Usuario Final: opera modulos segun permisos efectivos.

## Historia de usuario
Como usuario y super usuario de la plataforma, necesito un sistema de roles y microroles configurables para controlar acceso a modulos y acciones especificas en web y app movil, con segmentacion por cliente y proteccion criptografica del contenido de permisos.

## Alcance
- Modulo SU para crear, editar, activar/desactivar, clonar y eliminar roles.
- Definicion de microroles reutilizables.
- Composicion de roles a partir de microroles.
- Permisos por modulo y accion.
- Segmentacion por `companyId` para clientes.
- Scope de rol (`SU` o `cliente`).
- Persistencia de contenido de rol como JSON estructurado, parseado y cifrado.
- Validacion de integridad del contenido cifrado.
- Auditoria de cambios sobre roles y microroles.
- Aplicacion uniforme de permisos en web y app movil.

## Fuera de alcance
- Diseño visual final del modulo de administracion.
- Estrategia de infraestructura de llaves (HSM/KMS detallado).
- Migracion historica completa de permisos legados.
- Politicas IAM externas a la plataforma.

## Reglas funcionales
1. El sistema permite crear roles con `nombre`, `comentario`, `scope`, `companyId` (segun aplique) y `contenidoRol`.
2. El `scope` permitido es `SU` o `cliente`.
3. Para roles `cliente`, `companyId` es obligatorio.
4. Para roles `SU`, `companyId` puede ser nulo o global.
5. El SU puede consultar y administrar roles de cualquier `companyId`.
6. Un cliente solo puede consultar y administrar roles de su propio `companyId`.
7. El contenido del rol se representa como JSON estructurado por modulo/accion.
8. El JSON se almacena cifrado y con verificacion de integridad.
9. Si falla la integridad al leer permisos, el rol se marca invalido y no se aplica.
10. Un rol puede incluir multiples microroles.
11. Un microrol define permisos granulares de acciones especificas por modulo.
12. Un microrol puede reutilizarse en multiples roles.
13. Un usuario puede tener uno o varios roles asignados.
14. Los permisos efectivos del usuario se calculan por union de permisos permitidos.
15. Debe existir accion de clonado de roles.
16. No se permite eliminar un rol asignado a usuarios activos sin reasignacion previa.
17. El nombre del rol debe ser unico dentro del mismo scope y contexto (`companyId` para cliente).
18. El sistema audita creacion, edicion, activacion/desactivacion, clonado y eliminacion.
19. Cambios de permisos deben reflejarse en nuevas sesiones y soportar invalidacion de sesiones activas.
20. La validacion de permisos debe ser consistente entre API, web y app movil.

## Estados y casos borde
- Rol activo: disponible para asignacion y evaluacion.
- Rol inactivo: no asignable, visible para auditoria.
- Rol invalido por integridad: bloqueado automaticamente.
- Microrol huerfano: sin uso en roles (permitido, marcado para limpieza).
- Acceso cruzado entre clientes (`companyId` distinto): denegado y auditado.
- Eliminacion de rol con usuarios asignados: bloqueada.
- JSON mal formado: guardado rechazado.
- Asignaciones duplicadas: no permitidas.
- Falla de descifrado/parseo: permisos no aplican y se registra evento de seguridad.

## Criterios de aceptacion
1. El SU puede crear un rol de cliente con `companyId` y solo ese cliente + SU lo visualizan.
2. Un cliente no puede ver roles de otro `companyId`.
3. El contenido de rol se almacena cifrado y se recupera para evaluacion de permisos.
4. Si se altera manualmente el contenido cifrado en BD, el rol se invalida y bloquea.
5. Un rol compuesto por microroles concede solo las acciones definidas.
6. La validacion de permisos es equivalente en web y app movil para el mismo usuario.
7. El sistema impide eliminar roles con asignaciones activas.
8. El sistema registra auditoria completa de cambios.
9. El SU puede listar roles filtrando por `companyId` o todos.
10. Clientes solo crean/editan roles de su propio `companyId`.

## Suposiciones confirmadas
- Existe modulo exclusivo de SU para gestionar roles y microroles.
- Los microroles definen permisos granulares por accion y se reutilizan entre roles.
- Permisos consistentes en web y app movil.
- La tabla de roles incluye `companyId` para segmentar clientes.
- El SU puede ver y administrar roles de todos los clientes.
- El contenido de permisos se maneja como JSON parseado y cifrado.
- Se requiere bloqueo y registro ante alteracion invalida del contenido.
- Se requiere auditoria funcional de cambios.
