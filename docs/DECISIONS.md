# DECISIONS.md – Decisiones arquitectónicas

## ADR-001 – Plataforma multitenant por empresaId

Decisión:
Todas las entidades operativas tendrán `empresaId`, que referencia `Company.id`.

Motivo:
Garantizar aislamiento de datos por empresa y permitir operación SaaS.

Consecuencias:
- Todas las consultas deben filtrar por empresaId.
- El superusuario puede saltar el filtro bajo validación explícita.
- El frontend no envía empresaId como fuente confiable.

---

## ADR-002 – Separar BrandProfile de Company

Decisión:
La identidad de marca se guarda en `BrandProfile`, no en `Company`.

Motivo:
La identidad visual crecerá con logos, colores, tipografías, tono, manuales, restricciones y reglas para IA.

Consecuencias:
- Company queda limpia para datos administrativos.
- BrandProfile puede evolucionar sin afectar Company.

---

## ADR-003 – Permisos dinámicos con hashPermission cifrado

Decisión:
Cada rol tendrá `hashPermission`, que contiene un JSON cifrado con módulos, CRUD y actions.

Motivo:
Evitar cambios directos maliciosos en permisos desde base de datos y permitir reconstruir permisos en login.

Consecuencias:
- Se requiere servicio de cifrado/descifrado.
- Se requiere sincronización cuando aparecen módulos nuevos.
- El backend debe validar permisos descifrados o equivalentes confiables.

---

## ADR-004 – Catálogo maestro de módulos

Decisión:
Los módulos viven en tabla `Module`.

Motivo:
Evitar sidebar y permisos hardcodeados.

Consecuencias:
- El sidebar se construye dinámicamente.
- Al crear un módulo se sincronizan roles.
- Los módulos tienen scope, route, icon, parent y estado.

---

## ADR-005 – CRUD + actions especiales

Decisión:
Los permisos tendrán CRUD básico y acciones especiales por módulo.

Motivo:
La plataforma requiere acciones como aprobar, publicar, pausar, programar, exportar, acceder como soporte, suspender.

Consecuencias:
- El JSON de permisos debe soportar `actions`.
- Backend debe validar CRUD y actions.

---

## ADR-006 – Sidebar control visual, backend control real

Decisión:
El sidebar oculta módulos sin permiso read, pero el backend siempre valida.

Motivo:
La UI no es seguridad suficiente.

Consecuencias:
- Crear helper `requirePermission`.
- Validar server actions/API routes.

---

## ADR-007 – Campañas por producto y por cliente

Decisión:
El motor de campañas soporta dos flujos:
- Producto -> segmento -> contenido -> aprobación -> publicación.
- Clientes/segmentos -> IA sugiere campaña -> aprobación -> publicación.

Motivo:
Permite marketing manual y data-driven.

---

## ADR-008 – MVP Integración nivel 2

Decisión:
El MVP integra publicación Meta básica y WhatsApp mediante links/mensajes básicos. Meta Ads y WhatsApp API oficial quedan para fase avanzada.

Motivo:
Reducir complejidad inicial y validar mercado rápido.

---

## ADR-009 – Automatización configurable

Decisión:
Las reglas de automatización se guardan como trigger/conditions/actions JSON.

Motivo:
Evitar lógica quemada en código.

Consecuencias:
- Se puede construir workflow engine futuro.
- MVP puede guardar reglas aunque la ejecución sea progresiva.
