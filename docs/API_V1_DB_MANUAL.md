# Manual API V1 - Endpoints dinamicos DB

## Base URL
- Local: `http://localhost:3000/api/v1/db`

## Endpoints disponibles
- `GET /api/v1/db/[table]` - Lista registros o consulta por `id`.
- `POST /api/v1/db/[table]` - Crea un registro.
- `PATCH /api/v1/db/[table]` - Actualiza un registro por `id`.
- `DELETE /api/v1/db/[table]` - Elimina un registro por `id`.
- `GET /api/v1/db/multi` - Consulta multiples tablas en una sola llamada.
- `OPTIONS` en ambos endpoints para CORS.

## Tablas permitidas (allowlist)
- `users`
- `modules`
- `oauth_sessions`
- `roles`
- `role_assignments`
- `audit_logs`
- `st_multidata`
- `st_country`

Nota: el nombre de tabla es case-insensitive. Ejemplos validos: `st_multidata`, `st_Multidata`, `ST_MULTIDATA`.

## Seguridad y control de acceso
Todas las solicitudes deben incluir:
- `Authorization: Bearer <token>`
- `x-oauth-session: active`
- `x-actor-id: <id_actor>`
- `x-actor-role: SU | cliente`
- `x-company-id: <companyId>` (obligatorio para `cliente`)

Reglas de seguridad:
- Si falta `Authorization` o no es Bearer, responde `401`.
- Si `x-oauth-session` no es `active`, responde `401`.
- Si el origen CORS no esta permitido por `CORS_ALLOWLIST`, responde `403`.
- Si el rol es `cliente` y falta `x-company-id`, responde `403`.
- Si la tabla no esta en allowlist, responde `400`.

## Regla SU vs cliente (filtro companyId)
- `SU`:
  - Acceso global.
  - Puede leer/escribir sin filtro por compania.
- `cliente`:
  - Acceso restringido por `companyId`.
  - En tablas multi-tenant, la API fuerza `companyId` al valor de `x-company-id`.
  - Si el body trae otro `companyId`, se ignora y se reemplaza por el de cabecera.

Tablas con control por `companyId` (multi-tenant):
- `users`
- `oauth_sessions`
- `roles`
- `role_assignments`

Tablas sin filtro de compania:
- `modules`
- `audit_logs`
- `st_multidata`
- `st_country`

## Endpoint 1: `/api/v1/db/[table]`

### GET - Listar, consultar por id y busqueda por columnas
Consulta general:
```bash
curl "http://localhost:3000/api/v1/db/st_Multidata" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-1" \
  -H "x-actor-role: SU"
```

Consulta por id:
```bash
curl "http://localhost:3000/api/v1/db/users?id=USERS-000001" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-1" \
  -H "x-actor-role: SU"
```

Busqueda personalizada con pares `key/value`:
```bash
curl "http://localhost:3000/api/v1/db/st_Multidata?key=type&value=language&key2=language&value2=es" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-1" \
  -H "x-actor-role: SU"
```

Busqueda con operadores (`op`, `op2`, ...):
```bash
curl "http://localhost:3000/api/v1/db/st_Country?key=prefix_area&value=57&op=gte&key2=nombre&value2=col&op2=like" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-1" \
  -H "x-actor-role: SU"
```

Busqueda personalizada con formato `parametroN` (pares o ternas):
```bash
curl "http://localhost:3000/api/v1/db/st_Multidata?parametro1=type&parametro2=language&parametro3=language&parametro4=es" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-1" \
  -H "x-actor-role: SU"
```

Con operador en `parametroN` (terna: `columna`, `valor`, `operador`):
```bash
curl "http://localhost:3000/api/v1/db/st_Country?parametro1=prefix_area&parametro2=50&parametro3=gt&parametro4=nombre&parametro5=co&parametro6=like" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-1" \
  -H "x-actor-role: SU"
```

Reglas de filtro en GET:
- Se pueden enviar multiples filtros y todos se aplican con logica `AND`.
- `id` puede convivir con filtros adicionales.
- Si una columna no existe en el registro, ese registro no pasa el filtro.
- Operadores soportados: `eq`, `neq`, `like`, `in`, `gt`, `lt`, `gte`, `lte`.
- Si no envias operador, usa `eq` por defecto.
- `in` recibe valores separados por coma. Ejemplo: `value=CO,MX,AR`.
- `gt/lt/gte/lte` intentan comparar como numero; si no aplica, comparan como fecha.

Respuesta:
```json
{
  "table": "st_Multidata",
  "count": 2,
  "data": [
    {"id": "STM-000001", "name": "Espanol"},
    {"id": "STM-000002", "name": "English"}
  ]
}
```

### POST - Crear
```bash
curl -X POST "http://localhost:3000/api/v1/db/users" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-2" \
  -H "x-actor-role: cliente" \
  -H "x-company-id: company-demo-001" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana","email":"ana@test.com","companyId":"otra-company"}'
```

En este caso, al ser `cliente`, `companyId` se guarda como `company-demo-001`.

### PATCH - Actualizar
```bash
curl -X PATCH "http://localhost:3000/api/v1/db/users" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-2" \
  -H "x-actor-role: cliente" \
  -H "x-company-id: company-demo-001" \
  -H "Content-Type: application/json" \
  -d '{"id":"USERS-000001","name":"Ana Maria"}'
```

### DELETE - Eliminar
```bash
curl -X DELETE "http://localhost:3000/api/v1/db/users" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-2" \
  -H "x-actor-role: cliente" \
  -H "x-company-id: company-demo-001" \
  -H "Content-Type: application/json" \
  -d '{"id":"USERS-000001"}'
```

## Endpoint 2: `/api/v1/db/multi`
Permite consultar varias tablas con query params (cualquier nombre de parametro, el valor es la tabla).

Ejemplo con curl:
```bash
curl "http://localhost:3000/api/v1/db/multi?params1=st_Multidata&params2=st_Country" \
  -H "Authorization: Bearer test-token" \
  -H "x-oauth-session: active" \
  -H "x-actor-id: qa-user-1" \
  -H "x-actor-role: SU"
```

Ejemplo con axios:
```ts
const params = {
  params1: "st_Multidata",
  params2: "st_Country"
};

const dataRes = (await axios.get("/api/v1/db/multi", {params})).data;
const multidata = dataRes.st_Multidata;
const countries = dataRes.st_Country;
```

Respuesta esperada:
```json
{
  "st_Multidata": [{"id":"STM-000001"}],
  "st_Country": [{"id":"STC-000001"}]
}
```

## Seed de catalogos
- Si `st_multidata` y `st_country` estan vacias en `../.scrum/dynamic-db.json`, el backend intenta sembrarlas automaticamente desde `docs/prisma/data.sql`.

## Onboarding social (catalogos y estados)

### Endpoints
- `GET /api/v1/auth/social/onboarding/bootstrap`
  - Devuelve `companies`, `countries`, `countryCodes`, `genders`.
- `GET /api/v1/auth/social/onboarding/departments?countryCode=<ISO>`
  - Devuelve estados/provincias filtrados por pais.
- `GET /api/v1/auth/social/onboarding/cities?countryCode=<ISO>&departmentCode=<ID_STATE>`
  - Devuelve ciudades filtradas por pais + estado/provincia.
- `POST /api/v1/auth/social/onboarding/submit`
  - Registra/actualiza onboarding y deja estado pendiente.

### Fuente de datos para formularios
- `countries` se construye desde `st_country` (`iso`, `nombre`, `prefix_area`).
- `departments` se construye desde `st_state` filtrando por `iso_country`.
- `cities` se construye desde `st_city` filtrando por `state_id` y validando `iso_country`.
- `genders` y otros valores parametrizables se leen desde `st_multidata`.

### Estados de usuario onboarding en `st_multidata`
- Tipo: `userStatus`.
- Valores requeridos:
  - `active`
  - `inactive`
  - `pending_approval`

Regla operativa:
- Si alguno de esos valores no existe en `st_multidata`, el backend lo crea automaticamente (idiomas `es` y `en`) antes de procesar el flujo onboarding.

## Errores comunes
- `{"message":"Table 'X' is not allowed"}`: tabla fuera de allowlist.
- `{"message":"Unauthorized"}`: falta/incorrecto `Authorization`.
- `{"message":"OAuth session invalid or expired"}`: `x-oauth-session` distinto de `active`.
- `{"message":"Forbidden"}`: rol `cliente` sin `x-company-id` o acceso cruzado de compania.
