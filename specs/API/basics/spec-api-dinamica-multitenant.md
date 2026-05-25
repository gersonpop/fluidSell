# Especificacion: API dinamica multi-tenant con Prisma, OAuth y seguridad por scope

## Contexto
Se requiere habilitar un backend capaz de operar multiples tablas mediante rutas dinamicas, manteniendo control estricto de acceso por rol/scope y segmentacion por `companyId`. El objetivo es centralizar reglas de seguridad para evitar exposicion de datos entre empresas y simplificar operaciones CRUD.

## Objetivo
Definir una especificacion funcional para construir rutas API dinamicas (`/api/v1/bd/[table]`), un modelo Prisma con tablas necesarias, y reglas de seguridad con token en encabezado, sesion OAuth y CORS, incluyendo comportamiento diferenciado por scope del rol usando el mismo endpoint.

## Usuario principal
- Super Usuario (`SU`)
- Usuarios de cliente con scope por compania

## Historia de usuario
Como usuario necesito desarrollar rutas API, crear el modelo Prisma y tablas en base de datos, y asegurar que las rutas queden protegidas con token en encabezado, sesion OAuth y CORS; ademas, necesito operar por un endpoint dinamico unico que cambie su alcance segun el scope del rol.

## Alcance
- Ruta dinamica base para CRUD: `/api/v1/bd/[table]`.
- Uso del mismo endpoint para acceso global o filtrado, segun scope recibido en headers/token.
- Definicion de endpoint con comportamiento `SU` (sin filtro de compania) y comportamiento cliente (filtro forzado por `companyId`).
- Modelo de datos Prisma con entidades de negocio y seguridad (usuarios, sesiones OAuth, roles/scopes, asignaciones, auditoria).
- Proteccion obligatoria por token + sesion OAuth activa.
- Politica CORS con origenes permitidos y rechazo de no permitidos.
- Respuestas estandarizadas de error de autenticacion/autorizacion/validacion.
- Asignacion de responsable experto backend para asegurar cumplimiento de proteccion de rutas.

## Historias de usuario diferidas
1. Como DevOps, necesito definir pipeline y entorno de despliegue para publicar de forma segura las APIs multi-tenant.
2. Como arquitecto tecnico, necesito cerrar decisiones tecnicas complementarias para mejorar mantenibilidad, observabilidad y operacion.
3. Como administrador, necesito una interfaz de gestion para operar tablas, roles y auditoria sin uso manual de APIs.
4. Como equipo de datos, necesito una estrategia de migracion historica para llevar datos legacy al nuevo modelo Prisma.
5. Como plataforma, necesito optimizaciones avanzadas de rendimiento para soportar alta concurrencia y volumen de datos.

## Reglas funcionales
1. El sistema expone CRUD dinamico mediante `/api/v1/bd/[table]`.
2. El sistema permite operar sobre cualquier tabla del esquema soportado por Prisma, sujeto a reglas de seguridad.
3. Todas las rutas requieren encabezado `Authorization` con token valido.
4. Todo token debe corresponder a una sesion OAuth activa; sesion invalida o expirada implica denegacion.
5. El scope del rol se envia en headers/token y determina el alcance de datos en el mismo endpoint.
6. Si el scope es `SU`, las operaciones se ejecutan sin filtro por `companyId` (acceso global).
7. Si el scope no es `SU`, el sistema aplica siempre filtro forzado por `companyId` derivado de identidad/sesion, ignorando `companyId` externo en query/body.
8. El sistema rechaza cualquier intento de acceso cross-company para scopes no `SU`.
9. Deben existir tablas Prisma para usuarios, sesiones OAuth, roles/scopes, asignaciones y auditoria.
10. Las operaciones registran trazabilidad minima (actor, scope, tabla, accion, timestamp, resultado).
11. CORS valida origen contra allowlist y bloquea origenes no autorizados.
12. Las respuestas de error son consistentes y legibles para cliente API.

## Estados y casos borde
- Token ausente: solicitud rechazada.
- Token invalido: solicitud rechazada.
- Sesion OAuth expirada/inexistente: solicitud rechazada.
- Scope `SU`: acceso global permitido segun operacion valida.
- Scope cliente: acceso limitado estrictamente al `companyId` de sesion.
- `companyId` enviado por cliente distinto al de sesion: nunca aplicado.
- Tabla inexistente en esquema: error de validacion.
- Metodo no soportado para la operacion: error de metodo.
- Origen CORS no permitido: solicitud bloqueada.
- Usuario sin scope declarado: acceso denegado por defecto.
- Error interno de lectura/escritura: respuesta controlada sin exposicion sensible.

## Criterios de aceptacion
1. Dado un usuario `SU`, al consultar `/api/v1/bd/[table]`, obtiene datos globales sin filtro `companyId`.
2. Dado un usuario no `SU`, al consultar el mismo endpoint, solo obtiene datos de su `companyId`.
3. Dado un usuario no `SU`, si intenta forzar otro `companyId`, la API no devuelve datos fuera de su compania.
4. Toda solicitud sin token o con token invalido retorna estado de no autorizado.
5. Toda solicitud con sesion OAuth invalida/expirada retorna denegacion.
6. CORS permite origenes en allowlist y bloquea origenes no permitidos.
7. El sistema registra eventos de acceso/denegacion con actor, scope y tabla afectada.
8. El modelo Prisma incluye y relaciona correctamente tablas de usuarios, sesiones OAuth, roles/scopes, asignaciones y auditoria.
9. El CRUD dinamico funciona sobre tablas del esquema definido, respetando validaciones y seguridad.
10. Existe responsable asignado como experto backend para proteccion de rutas y verificacion final.

## Suposiciones confirmadas
- El endpoint principal es dinamico: `/api/v1/bd/[table]`.
- El mismo endpoint cambia su comportamiento segun scope del rol.
- El scope se transmite en headers/token.
- Existe modo `SU` con acceso total y modo cliente con filtro forzado por `companyId`.
- El sistema incluye token + sesion OAuth + CORS como controles obligatorios.
- Se requiere trazabilidad/auditoria de accesos y cambios.
- El trabajo se ejecuta con liderazgo de un experto backend en seguridad de rutas.
