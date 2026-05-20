# MODULES_SEED.md – Catálogo inicial de módulos

Este documento define los módulos iniciales que deben cargarse en la tabla `Module`.

---

## Scope PLATFORM

| key | name | route | icon | category | parentKey | actions |
|---|---|---|---|---|---|---|
| platform.dashboard | Dashboard SaaS | /platform/dashboard | LayoutDashboard | Plataforma | null | export |
| platform.companies | Empresas | /platform/companies | Building2 | Plataforma | null | suspend, accessAsSupport |
| platform.plans | Planes | /platform/plans | BadgeDollarSign | Monetización | null | |
| platform.subscriptions | Suscripciones | /platform/subscriptions | CreditCard | Monetización | null | suspend |
| platform.payments | Pagos | /platform/payments | WalletCards | Monetización | null | applyDiscount, export |
| platform.promotions | Promociones | /platform/promotions | TicketPercent | Monetización | null | |
| platform.users | Usuarios plataforma | /platform/users | Users | Seguridad | null | |
| platform.modules | Módulos | /platform/modules | Boxes | Seguridad | null | syncPermissions |
| platform.roles | Roles plataforma | /platform/roles | Shield | Seguridad | null | |
| platform.support | Soporte | /platform/support | LifeBuoy | Operación | null | accessAsSupport |
| platform.insights | Insights globales | /platform/insights | BarChart3 | Analítica | null | export |
| platform.ai-usage | Consumo IA/API | /platform/ai-usage | Bot | Analítica | null | export |
| platform.audit | Auditoría | /platform/audit | ScrollText | Seguridad | null | export |
| platform.settings | Configuración SaaS | /platform/settings | Settings | Plataforma | null | |

---

## Scope COMPANY

| key | name | route | icon | category | parentKey | actions |
|---|---|---|---|---|---|---|
| company.dashboard | Dashboard | /app/dashboard | LayoutDashboard | Empresa | null | export |
| company.settings | Configuración empresa | /app/settings | Settings | Empresa | null | |
| company.brand | Identidad de marca | /app/brand | Palette | Empresa | null | |
| company.users | Usuarios | /app/users | Users | Seguridad | null | |
| company.roles | Roles y permisos | /app/roles | Shield | Seguridad | null | syncPermissions |
| company.products | Productos | /app/products | Package | Comercial | null | import, export |
| company.customers | Clientes CRM | /app/customers | ContactRound | Comercial | null | import, export, assign |
| company.segments | Segmentación | /app/segments | ListFilter | Comercial | null | generateWithAI |
| company.content | Contenido | /app/content | Images | Marketing | null | generateWithAI, approve |
| company.templates | Plantillas | /app/templates | LayoutTemplate | Marketing | company.content | approve |
| company.campaigns | Campañas | /app/campaigns | Megaphone | Marketing | null | approve, publish, pause, schedule |
| company.leads | Leads | /app/leads | UserPlus | Comercial | null | assign, export |
| company.automation | Automatización | /app/automation | Workflow | Automatización | null | activate, deactivate |
| company.integrations | Integraciones | /app/integrations | Plug | Integraciones | null | |
| company.meta | Meta | /app/integrations/meta | Facebook | Integraciones | company.integrations | publish |
| company.whatsapp | WhatsApp | /app/integrations/whatsapp | MessageCircle | Integraciones | company.integrations | transferConversation, useAI |
| company.reports | Reportes | /app/reports | BarChart3 | Analítica | null | export |
| company.competitors | Competidores | /app/competitors | Search | Inteligencia mercado | null | analyzeWithAI |
| company.support | Soporte | /app/support | LifeBuoy | Soporte | null | |
