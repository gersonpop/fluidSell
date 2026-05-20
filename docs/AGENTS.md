# AGENTS.md

## Proyecto

Plataforma SaaS multitenant para marketing automation, CRM, generación de contenido con IA, campañas Meta y conversión vía WhatsApp.

Este archivo es la guía operativa para Codex. Antes de implementar cualquier cambio, leer este archivo y los documentos relacionados.

## Fuente de verdad

Antes de tocar código, revisar:

- `SPEC.md`
- `TASKS.md`
- `DECISIONS.md`
- `permissions.schema.json`
- `prisma/schema.prisma` si existe

## Stack objetivo

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS
- shadcn/ui
- Zod
- Auth.js / NextAuth o Clerk
- Redis + BullMQ para trabajos en background
- OpenAI API para IA
- Meta Graph API / Marketing API futuro
- WhatsApp Business API futuro

## Skills globales recomendados (OpenCode)

Estos skills se usan como aceleradores. No reemplazan las reglas de `SPEC.md`, `TASKS.md` y `DECISIONS.md`.

- `frontend-design`: diseño y construcción de pantallas/páginas con calidad visual alta.
- `web-design-guidelines`: revisión de consistencia visual, jerarquía y UX de interfaz web.
- `design-taste-frontend`: elevar nivel visual para evitar UI genérica.
- `tailwind-design-system`: construcción de sistema visual reusable con Tailwind.
- `vercel-react-best-practices`: patrones de performance y estructura para React/Next.js.
- `vercel-composition-patterns`: composición de componentes reutilizables y escalables.
- `vercel-react-native-skills`: solo aplicar en trabajo móvil (React Native/Expo).
- `tdd`: flujo red-green-refactor para features/bugs críticos.
- `skill-creator`: crear skills internos del equipo cuando aparezcan procesos repetitivos.

### Cuándo usar cada skill en este proyecto

- UI de dashboard, landing interna o módulos CRUD: `frontend-design` + `web-design-guidelines`.
- Refactor de componentes con props complejas: `vercel-composition-patterns`.
- Optimización de carga/render y buenas prácticas Next.js: `vercel-react-best-practices`.
- Estandarización de estilos por módulo: `tailwind-design-system`.
- Tareas con alta sensibilidad funcional (permisos, multitenancy, auth): `tdd`.
- Trabajo móvil futuro: `vercel-react-native-skills`.
- Si se detecta un flujo recurrente (ej. scaffolding de módulos RBAC): `skill-creator`.

## Reglas multitenant obligatorias

- Todas las entidades operativas deben tener `empresaId`.
- `empresaId` referencia a `Company.id`.
- Nunca confiar en `empresaId` enviado desde frontend.
- `empresaId` debe obtenerse de sesión/token.
- Súper usuario puede acceder globalmente.
- Usuario empresa solo puede acceder a su `empresaId`.
- Todas las consultas operativas deben filtrar por `empresaId`, salvo superusuario.
- Agregar índices por `empresaId` en tablas grandes.

## Reglas de permisos

- El sistema usa roles dinámicos.
- Los módulos viven en tabla `Module`.
- Los permisos se construyen como JSON con CRUD + actions.
- El JSON se cifra y se guarda en `Role.hashPermission`.
- Al iniciar sesión se descifra `hashPermission`.
- El sidebar se construye desde permisos descifrados.
- Si `read=false`, el módulo no aparece.
- Si un padre no tiene read pero tiene hijos visibles, se muestra como agrupador.
- Backend debe validar permiso real antes de ejecutar acciones.
- El frontend solo oculta o muestra UI, no protege datos.
- Al crear módulo nuevo, sincronizar permisos de todos los roles afectados.
- Los módulos nuevos se agregan con permisos false por defecto.

## Reglas de arquitectura

- `Company` solo contiene datos administrativos, legales y comerciales básicos.
- `BrandProfile` contiene identidad de marca y debe estar separado de `Company`.
- No hardcodear módulos ni permisos.
- No mezclar lógica SaaS con lógica empresa si puede separarse por scope.
- Mantener servicios y validadores reutilizables.
- Usar Zod para validación de inputs.
- Usar transacciones Prisma en operaciones críticas.

## Seguridad

- No exponer tokens de integraciones.
- Cifrar access tokens y refresh tokens de Meta/WhatsApp.
- No retornar hashes ni permisos cifrados al frontend.
- Retornar únicamente permisos descifrados mínimos necesarios para UI.
- Validar permisos en server actions / API routes.
- Registrar auditoría para acciones críticas:
  - cambio de permisos
  - acceso soporte
  - cambio de plan
  - publicación de campaña
  - activación modo automático
  - cambios en integraciones

## Convenciones de código

- TypeScript estricto.
- Componentes UI pequeños y reutilizables.
- Separar capa de datos, validación y UI.
- Preferir nombres claros en inglés técnico para modelos Prisma.
- Mantener `empresaId` como nombre del campo multitenant por decisión del proyecto.
- Usar enums para estados.
- Evitar `any`.
- Manejar errores con mensajes claros.

## Comandos esperados

Si el proyecto aún no existe:
- Crear proyecto con Next.js + TypeScript.

Cuando exista:
- Instalar: `npm install`
- Desarrollo: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Prisma generate: `npx prisma generate`
- Prisma migrate: `npx prisma migrate dev`
- Prisma Studio: `npx prisma studio`

## Flujo de trabajo para cada tarea

1. Leer contexto.
2. Proponer plan breve.
3. Implementar solo la tarea solicitada.
4. No modificar áreas no relacionadas.
5. Ejecutar lint/build si aplica.
6. Mostrar resumen de cambios.
7. Indicar archivos modificados.
8. Indicar pendientes o riesgos.

## Definición de terminado

Una tarea está terminada solo si:

- Compila.
- Respeta multitenancy.
- Respeta permisos.
- No rompe schema Prisma.
- No hardcodea módulos.
- Tiene validación de inputs.
- Tiene manejo básico de errores.
- El código es mantenible.
- Se documentan decisiones relevantes en `DECISIONS.md` si hay cambios de arquitectura.

## No hacer

- No crear toda la plataforma en una sola tarea.
- No eliminar modelos existentes sin autorización.
- No omitir validación backend por confiar en UI.
- No guardar credenciales en texto plano.
- No meter identidad de marca en Company.
- No crear módulos quemados en sidebar.
