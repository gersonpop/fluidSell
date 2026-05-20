# TASKS.md – Plan de implementación para Codex

## Regla general

Codex debe implementar una tarea pequeña a la vez. Cada tarea debe compilar y no debe romper lo anterior.

---

# FASE 0 – Preparación del repositorio

## Tarea 0.1 – Inicializar proyecto
Objetivo:
Crear base Next.js + TypeScript.

Criterios:
- App Router.
- ESLint activo.
- Tailwind configurado.
- Estructura base limpia.

## Tarea 0.2 – Configurar Prisma y PostgreSQL
Objetivo:
Agregar Prisma.

Criterios:
- `prisma/schema.prisma`.
- `.env.example`.
- Prisma generate funcional.

---

# FASE 1 – Base de datos inicial

## Tarea 1.1 – Crear modelos core SaaS
Modelos:
- PlatformUser
- Company
- BrandProfile
- Subscription
- Plan
- Payment
- AuditLog

Criterios:
- Company separado de BrandProfile.
- CompanyStatus enum.
- Relaciones correctas.

## Tarea 1.2 – Crear modelos RBAC
Modelos:
- CompanyUser
- Role
- UserRole
- Module
- RolePermission opcional como tabla editable
- Role.hashPermission

Criterios:
- Scope PLATFORM / COMPANY.
- Module con parentId para sidebar.
- CRUD + actions.
- hashPermission obligatorio o nullable durante bootstrap.

## Tarea 1.3 – Crear modelos negocio empresa
Modelos:
- Product
- Customer
- Segment
- CustomerSegment
- Campaign
- CampaignProduct
- ContentAsset
- Lead
- Sale
- SaleItem
- AutomationRule
- Integration
- Competitor

Criterios:
- Todas las entidades operativas con empresaId.
- Índices por empresaId.
- Enums para estados.

---

# FASE 2 – Módulos y permisos

## Tarea 2.1 – Seed de módulos
Crear seed con módulos para:
- Plataforma SaaS
- Empresa cliente

Criterios:
- key único.
- scope.
- route.
- icon.
- category.
- parentKey/parentId.
- isMenu.
- isActive.

## Tarea 2.2 – Servicio de permisos
Crear funciones:
- buildPermissionJson(role)
- encryptPermissions(json)
- decryptPermissions(hash)
- syncRolePermissions(roleId)
- syncAllRolesWithModules()

Criterios:
- Nuevos módulos se agregan con permisos false.
- Mantener permisos existentes.
- Versionar JSON.
- Actualizar syncedAt.

## Tarea 2.3 – Validación de sidebar
Crear utilidad:
- buildSidebarFromPermissions(permissionJson)

Criterios:
- Mostrar módulo si read=true.
- Mostrar padre si tiene hijos visibles.
- Ocultar módulo sin permisos.
- Ignorar isActive=false.

## Tarea 2.4 – Middleware de permisos backend
Crear helper:
- requirePermission(session, moduleKey, action)

Criterios:
- Validar superusuario.
- Validar empresaId.
- Validar CRUD/actions.
- Lanzar error controlado si no tiene permiso.

---

# FASE 3 – Autenticación y multitenancy

## Tarea 3.1 – Implementar auth
Criterios:
- Login usuario plataforma.
- Login usuario empresa.
- Sesión contiene userId, empresaId, scope, roles.

## Tarea 3.2 – Middleware multitenant
Criterios:
- Resolver empresaId desde sesión.
- Bloquear acceso cruzado.
- Permitir superusuario global.

---

# FASE 4 – Vista Superusuario

## Tarea 4.1 – CRUD Empresas
Criterios:
- Crear empresa.
- Editar empresa.
- Suspender empresa.
- Ver empresas.
- Acceder como soporte.

## Tarea 4.2 – Planes y suscripciones
Criterios:
- Crear planes.
- Asignar plan a empresa.
- Definir límites.

## Tarea 4.3 – Pagos y promociones
Criterios:
- Registrar pagos manuales.
- Estado suscripción.
- Promociones/códigos futuros.

## Tarea 4.4 – Insights globales
Criterios:
- Empresas activas.
- Campañas totales.
- Leads totales.
- Consumo IA futuro.

---

# FASE 5 – Vista Empresa

## Tarea 5.1 – Configuración empresa + BrandProfile
Criterios:
- Datos empresa.
- Logo, colores, tono, manual de marca.
- Validación Zod.

## Tarea 5.2 – Usuarios y roles
Criterios:
- Crear usuario empresa.
- Asignar roles.
- Configurar permisos por módulo.
- Regenerar hashPermission.

## Tarea 5.3 – Productos
Criterios:
- CRUD productos.
- empresaId automático.
- Tags y keywords.

## Tarea 5.4 – Clientes / CRM
Criterios:
- CRUD clientes.
- Tipo lead/prospect/customer.
- Origen.
- Segmentos.

## Tarea 5.5 – Segmentación
Criterios:
- Crear segmento manual.
- Relacionar clientes.
- Guardar criteria JSON.

---

# FASE 6 – Marketing

## Tarea 6.1 – Contenido
Criterios:
- Crear ContentAsset.
- Tipos: flyer, copy, story, post, whatsapp message.
- Guardar prompt y output IA.

## Tarea 6.2 – Campañas
Criterios:
- Crear campaña por producto.
- Crear campaña por segmento.
- Estados.
- Aprobación.
- Programación.

## Tarea 6.3 – Leads
Criterios:
- Registrar lead asociado a campaña.
- Asignar responsable.
- Estado lead.

## Tarea 6.4 – Automatización
Criterios:
- Crear reglas con trigger/conditions/actions JSON.
- Activar/desactivar.
- No ejecutar todavía si no hay worker.

---

# FASE 7 – Integraciones MVP

## Tarea 7.1 – Integración Meta placeholder
Criterios:
- Registrar integración Meta.
- Guardar metadata.
- Preparar estructura para tokens cifrados.

## Tarea 7.2 – WhatsApp links
Criterios:
- Generar link wa.me con mensaje.
- Asociar lead.
- Plantillas de mensajes.

---

# FASE 8 – IA

## Tarea 8.1 – Servicio IA copy
Criterios:
- Generar copy usando producto, segmento y BrandProfile.
- Guardar prompt/output.

## Tarea 8.2 – Sugerencia campaña
Criterios:
- Dado producto sin ventas, sugerir campaña.
- No publicar automáticamente.
- Notificar encargado.

---

# FASE 9 – Reportes

## Tarea 9.1 – Dashboard empresa
Criterios:
- Campañas por estado.
- Leads nuevos.
- Productos activos.
- Contenido generado.

## Tarea 9.2 – Reporte campaña
Criterios:
- Leads por campaña.
- Estado.
- Fechas.
