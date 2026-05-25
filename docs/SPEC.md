# SPEC.md – Plataforma SaaS de Marketing Automation + CRM + IA

## 1. Objetivo del sistema

Construir una plataforma SaaS multitenant que permita a empresas cliente gestionar campañas de marketing en Meta, generar contenido con IA, administrar productos, clientes/leads, segmentación, automatización comercial e integración inicial con WhatsApp Business.

La plataforma debe permitir que el dueño del SaaS administre empresas, planes, pagos, permisos, consumo e insights globales, y que cada empresa cliente administre su propia operación comercial y de community management.

Documentacion complementaria de API:
- `API_V1_DB_MANUAL.md`: manual operativo de endpoints dinamicos `api/v1/db`, seguridad y ejemplos.

---

## 2. Modelo de negocio

El sistema tiene tres niveles:

```txt
PLATAFORMA SaaS
  └── EMPRESA CLIENTE
        └── CLIENTES / LEADS DE LA EMPRESA
```

### Nivel 0 – Plataforma
Corresponde al dueño del SaaS. Tiene acceso global y administra:
- Empresas cliente
- Planes y membresías
- Pagos
- Promociones
- Soporte
- Insights globales
- Consumo de IA/API
- Auditoría

### Nivel 1 – Empresa cliente
Empresa que paga por usar la plataforma. Administra:
- Usuarios
- Roles
- Productos
- Clientes/leads
- Segmentos
- Contenido
- Campañas
- Automatizaciones
- Integraciones
- Reportes

### Nivel 2 – Clientes de la empresa
Contactos, leads o compradores finales de cada empresa cliente.

---

## 3. Principio multitenant

Todas las entidades operativas deben incluir:

```txt
empresaId -> Company.id
```

Reglas obligatorias:
- Cada empresa solo puede ver sus propios datos.
- `empresaId` no debe confiarse desde el frontend.
- El backend debe tomar `empresaId` desde sesión/token.
- El súper usuario puede consultar información global.
- Todas las consultas operativas deben filtrar por `empresaId`, salvo contexto explícito de superusuario.
- Las tablas grandes deben indexar `empresaId`.

---

## 4. Vistas principales del sistema

### 4.1 Vista Superusuario / Plataforma SaaS

Módulos esperados:
- Dashboard SaaS
- Empresas
- Planes / Membresías
- Pagos / Facturación
- Promociones SaaS
- Usuarios internos de plataforma
- Soporte / Acceso asistido
- Insights globales
- Consumo IA/API
- Auditoría
- Configuración SaaS
- Módulos y permisos

### 4.2 Vista Empresa Cliente

Módulos esperados:
- Dashboard empresa
- Configuración empresa
- Usuarios y roles
- Productos
- Clientes / CRM
- Segmentación
- Contenido
- Campañas
- Automatización
- Integraciones
- Reportes
- Soporte

---

## 5. Roles y permisos

El sistema debe manejar RBAC dinámico por empresa.

### 5.1 Roles base sugeridos

#### Plataforma
- SUPER_ADMIN
- PLATFORM_SUPPORT
- PLATFORM_BILLING
- PLATFORM_ANALYST

#### Empresa
- ADMINISTRADOR
- COMMUNITY_MANAGER
- DISENADOR
- VENDEDOR
- ANALISTA
- SOPORTE_ASISTIDO

### 5.2 Permisos

Cada rol se compone de permisos por módulo:
- read
- create
- update
- delete
- actions opcionales por módulo

Ejemplo de acciones especiales:
- approve
- publish
- pause
- schedule
- export
- import
- assign
- generateWithAI
- accessAsSupport
- suspend
- applyDiscount

### 5.3 hashPermission

El rol debe tener un campo `hashPermission` que almacena el JSON de permisos cifrado.

Flujo de creación:
```txt
Matriz CRUD + actions
  -> JSON
  -> String serializado
  -> Cifrado
  -> hashPermission
```

Flujo de login:
```txt
Login
  -> Leer rol del usuario
  -> Leer hashPermission
  -> Descifrar
  -> Reconstruir JSON de permisos
  -> Construir sidebar
  -> Validar permisos en frontend
  -> Validar permisos en backend
```

### 5.4 Sidebar dinámico

El sidebar se construye desde el JSON descifrado.

Reglas:
- Un módulo se muestra si `permissions.read === true`.
- Si el módulo padre no tiene read, pero tiene hijos visibles, se muestra como agrupador.
- Si todos los permisos están en false, no se muestra.
- Si `isActive=false`, no se muestra.
- El sidebar es solo control visual. El backend siempre debe validar permisos.

### 5.5 Sincronización de módulos

Problema detectado: cuando la app crece y se crean módulos nuevos, los `hashPermission` existentes quedan desactualizados.

Regla obligatoria:
Cuando se cree, active o modifique un módulo:
1. Buscar todos los roles afectados.
2. Descifrar su `hashPermission`.
3. Comparar contra el catálogo maestro `Module`.
4. Agregar módulos faltantes con permisos false.
5. Mantener permisos existentes.
6. Eliminar o ignorar módulos inactivos según política.
7. Incrementar versión.
8. Re-cifrar y guardar `hashPermission`.

También debe existir validación de sincronización al login.

---

## 6. Empresas

La entidad Company debe contener datos administrativos, legales y comerciales básicos.

Identidad de marca NO debe estar dentro de Company. Debe estar separada en BrandProfile.

### Company contiene
- Nombre legal
- Nombre comercial
- NIT/taxId
- Sector
- País
- Ciudad
- Zona
- Dirección
- Teléfono
- WhatsApp
- Email
- Sitio web
- Estado

### BrandProfile contiene
- Logo principal
- Logo secundario
- Colores
- Tipografías
- Tono de comunicación
- Slogan
- Manual de marca
- Restricciones visuales
- Guías de comunicación

---

## 7. Productos

Un producto pertenece a una empresa y puede participar en muchas campañas.

Campos esperados:
- empresaId
- nombre
- categoría
- marca
- descripción
- precio base
- imagen
- estado activo/inactivo
- tipo producto
- frecuencia de recompra estimada
- tags
- público objetivo
- palabras clave

Regla:
- Producto 1:N Campañas mediante CampaignProduct.

---

## 8. Clientes / CRM

La plataforma debe funcionar como CRM ligero.

Tipos:
- Lead
- Prospecto
- Cliente

Orígenes:
- Meta
- WhatsApp
- Manual
- Importación
- Futuras integraciones

Campos esperados:
- empresaId
- nombre
- teléfono
- WhatsApp
- email
- ciudad
- zona
- tipo
- origen
- notas
- historial de interacciones
- historial de compras futuro

---

## 9. Segmentación

La segmentación debe ser híbrida:
- Manual
- Automática

Segmentación base MVP:
- Tipo de cliente
- Ciudad / zona
- Producto de interés
- Cliente nuevo / recurrente
- Canal de origen

Segmentación futura:
- Frecuencia de compra
- Valor del cliente
- Última compra
- Última interacción
- Interacción con campañas
- Score comercial

---

## 10. Motor de campañas

La plataforma debe permitir campañas desde dos enfoques.

### 10.1 Campaña orientada a producto

Flujo:
1. Seleccionar producto
2. Seleccionar segmento
3. Generar contenido con IA o plantilla
4. Ajustar texto
5. Enviar a aprobación
6. Programar
7. Publicar automáticamente
8. Capturar leads
9. Enviar a WhatsApp

### 10.2 Campaña orientada a clientes

Flujo:
1. Validar clientes por segmento
2. Analizar histórico de compras
3. Identificar clientes nuevos / recurrentes / inactivos
4. IA sugiere posibles campañas
5. IA genera contenido según plantillas
6. Usuario aprueba
7. Crear campaña en redes
8. Medir efectividad
9. Capturar resultados y leads
10. Personalizar respuesta en WhatsApp
11. Transferir a vendedor o administrador

### Estados de campaña

- DRAFT
- AI_GENERATED
- IN_REVIEW
- APPROVED
- SCHEDULED
- PUBLISHED
- PAUSED
- FINISHED
- REJECTED
- FAILED

---

## 11. Motor de contenido

Contenido generado:
- Imagen tipo flyer
- Texto publicitario / copy
- Variaciones del mismo anuncio
- Historias / stories
- Publicaciones Facebook / Instagram
- Mensajes para WhatsApp
- Respuestas automáticas chatbot
- Videos cortos futuro

Modelo de generación:
```txt
Plantilla + IA
```

Reglas:
- Respetar BrandProfile.
- Permitir edición manual.
- Permitir aprobación.
- Guardar prompt y salida IA.
- Permitir reutilización de piezas exitosas.

---

## 12. Automatización

El sistema debe permitir reglas tipo:

```txt
Cuando ocurra X -> evaluar condiciones -> ejecutar acciones
```

Reglas definidas:
- Cuando entra un lead, guardarlo automáticamente.
- Cuando alguien escribe, clasificarlo y responder con IA.
- Cuando se requiere humano, direccionar a administrador, vendedor u otro encargado.
- Cuando un producto no se vende, crear campaña sugerida pero no lanzarla automáticamente.
- Cuando exista oportunidad comercial, notificar al encargado.
- Requerir aprobación antes de lanzar campañas.
- Permitir modo automático bajo responsabilidad del encargado.
- Limitar campañas por plan.
- Distribuir presupuesto mensual para evitar consumo total en una semana.
- Evitar saturación de campañas.
- Identificar empresas competencia y analizar contenido/campañas/mercado.

---

## 13. Integraciones

### MVP Nivel 2
- Publicación automática en Facebook e Instagram.
- Programación de publicaciones.
- Captura básica de leads desde comentarios/mensajes si la API lo permite.
- WhatsApp mediante link personalizado y mensajes automáticos básicos.
- Notificación al encargado.

### Escalable Nivel 3
- Meta Ads API.
- Segmentación pagada avanzada.
- Formularios de leads.
- WhatsApp Business Platform API.
- Chatbot IA en tiempo real.
- Medición CTR/CPC/conversión/ROI.

---

## 14. Análisis de competencia

La plataforma debe permitir registrar competidores por empresa.

Campos:
- empresaId
- nombre
- website
- facebookUrl
- instagramUrl
- notas

Futuro:
- Análisis de contenido.
- Frecuencia de publicación.
- Tipos de campañas.
- Mensajes usados.
- Nichos detectados.
- Oportunidades sugeridas por IA.

---

## 15. Criterios de aceptación generales

El sistema se considera correctamente implementado si:

- Permite crear empresas.
- Aísla datos por empresaId.
- Permite superusuario global.
- Permite roles dinámicos.
- Genera y descifra hashPermission.
- Construye sidebar según permisos.
- Valida permisos en backend.
- Sincroniza permisos cuando aparecen módulos nuevos.
- Separa BrandProfile de Company.
- Permite CRUD de productos.
- Permite CRUD de clientes.
- Permite segmentos.
- Permite campañas con estados.
- Permite contenido híbrido IA + plantilla.
- Permite registrar leads.
- Permite automatizaciones configurables.
- Está preparado para Meta y WhatsApp.

---

## 16. Restricciones técnicas

- No hardcodear módulos.
- No confiar en permisos del frontend.
- No confiar en empresaId enviado por frontend.
- No mezclar datos de empresas.
- No guardar tokens de integración sin cifrado.
- No poner identidad de marca dentro de Company.
- No crear reglas de automatización quemadas en código si pueden ser configurables.
