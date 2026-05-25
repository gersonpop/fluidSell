# Skills Index (Global + Recomendados)

Este archivo deja registro de skills globales detectados y skills recomendados para instalar a futuro.

## Rutas de skills globales en esta maquina

- `/Users/gersonpop/.agents/skills/`
- `/Users/gersonpop/Documents/Proyectos/.skills/`
- `/Users/gersonpop/.claude/skills/`

## Skills globales relevantes ya disponibles

- `next-best-practices`
- `frontend-design`
- `design-taste-frontend`
- `tailwind-design-system`
- `vercel-react-best-practices`
- `vercel-composition-patterns`
- `web-design-guidelines`
- `tdd`
- `spec-definer`
- `subagent-driven-development`
- `skill-creator`
- `find-skills`

## Lo que vi en skills.sh y conviene instalar para este proyecto

Enfocado en monorepo Next.js, seguridad/autenticacion, calidad y release:

1. `vercel-labs/agent-skills/deploy-to-vercel`
   - Estandariza despliegue y checks de Vercel (root dir `web/`).
2. `xixu-me/skills/github-actions-docs`
   - Ayuda a robustecer CI/CD y flujos de versionado.
3. `anthropics/skills/webapp-testing`
   - Mejora cobertura de validaciones funcionales E2E/UI.
4. `better-auth/skills/better-auth-best-practices`
   - Buen complemento para decisiones de auth y hardening.
5. `supabase/agent-skills/supabase-postgres-best-practices`
   - Aunque no uses Supabase Auth, aporta practicas fuertes para Postgres.
6. `obra/superpowers/systematic-debugging`
   - Reduce tiempo de diagnostico cuando hay errores intermitentes.
7. `obra/superpowers/verification-before-completion`
   - Refuerza calidad antes de cerrar tareas.
8. `obra/superpowers/using-git-worktrees`
   - Muy util para ramas paralelas (web/mobile/n8n/docs).

## Skills instalados ahora (manual)

Se intentó usar `npx skillsadd`, pero el servicio respondio con error (`Failed to fetch skills list from skills.ws`).
Para no bloquear el trabajo, se instalaron manualmente desde repos oficiales en `/Users/gersonpop/.agents/skills/`:

- `deploy-to-vercel`
- `webapp-testing`
- `github-actions-docs`
- `systematic-debugging`
- `verification-before-completion`
- `using-git-worktrees`

## Skills locales del proyecto (custom)

- `.agent/skill-settings-config-crud-pattern.md`
  - Estandar para construir paginas de Settings con tabla, busqueda, boton agregar y formulario de creacion/edicion conectados a API dinamica y BD.

## Comando base de instalacion

```bash
npx skillsadd <owner/repo>
```

## Criterios para aceptar un skill nuevo

- Debe aportar valor directo a los flujos del proyecto (auth, seguridad, UI, CI/CD, release).
- Debe evitar lock-in innecesario y mantener portabilidad a VPS.
- Debe tener instrucciones claras y mantenidas.
- Debe poder validarse con checks reales (lint/build/tests/deploy).
