# README_Codex.md – Cómo usar este paquete con Codex

## Archivos incluidos

- `SPEC.md`: especificación funcional y técnica del producto.
- `AGENTS.md`: instrucciones permanentes para Codex.
- `TASKS.md`: plan de implementación por fases.
- `DECISIONS.md`: decisiones arquitectónicas.
- `API_V1_DB_MANUAL.md`: manual de endpoints dinamicos `api/v1/db`.
- `permissions.schema.json`: estructura del JSON cifrado de permisos.
- `MODULES_SEED.md`: catálogo inicial de módulos para sidebar/RBAC.
- `prisma/schema.prisma`: schema Prisma inicial recomendado.

## Cómo usarlo

1. Copiar todos los archivos en la raíz del proyecto.
2. Crear carpeta `prisma` si no existe.
3. Poner `schema.prisma` dentro de `/prisma`.
4. Abrir Codex en la raíz del repo.
5. Pedirle que lea:
   - `SPEC.md`
   - `AGENTS.md`
   - `TASKS.md`
   - `DECISIONS.md`
   - `API_V1_DB_MANUAL.md`
   - `permissions.schema.json`
   - `MODULES_SEED.md`

## Primer prompt recomendado para Codex

```txt
Lee SPEC.md, AGENTS.md, TASKS.md, DECISIONS.md, permissions.schema.json y MODULES_SEED.md.

No implementes todavía.

Haz un análisis del repositorio actual, identifica qué existe, qué falta y propón un plan de implementación de la FASE 0 y FASE 1. 
No modifiques archivos sin mostrar primero el plan.
```

## Segundo prompt recomendado

```txt
Implementa únicamente la Tarea 0.1 y 0.2 de TASKS.md.

Requisitos:
- Crear/configurar Next.js + TypeScript si no existe.
- Configurar Prisma.
- Preparar .env.example.
- No implementar módulos funcionales todavía.
- Ejecutar lint/build si aplica.
- Mostrar resumen de archivos modificados.
```

## Regla de trabajo

No pedirle a Codex "haz toda la plataforma". Trabajar por tarea.
