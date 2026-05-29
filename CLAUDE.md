# Seahorse — AI Agent Rules

> Este archivo contiene las reglas que **todo agente de IA** debe seguir al trabajar en este proyecto.
> Léelo **SIEMPRE** al inicio de cada sesión.

---

## 📋 Reglas Obligatorias

### 1. Documentar los cambios

Después de cada modificación en el código, **debes actualizar los archivos de documentación relevantes**:

| Archivo | Cuándo actualizarlo |
|---|---|
| `knowledge.md` | Nueva feature, cambio de arquitectura, comando nuevo, bug fix importante |
| `README.md` | Cambios en setup, requisitos, comandos, estructura del proyecto |
| `AGENTS.md` | Nuevos skills, cambios en skill-to-task mapping, convenciones de frontend |
| `docs/API.md` | Nuevos endpoints, cambios en request/response de APIs existentes |
| `PRODUCT.md` | Cambios en la visión del producto, diseño, o tono |
| `DESIGN.md` | Cambios en el design system (colores, tipografía, componentes, motion) |
| `CRITIQUE.md` | Actualizar score si se resuelven issues de la critique |

**Formato de documentación:**
- Usa un lenguaje claro y conciso
- Incluye ejemplos de código cuando sea relevante
- Actualiza las tablas de referencia (comandos, rutas, config)
- Para bug fixes: agrega entrada en `Recent Fixes` de `knowledge.md`

### 2. Hacer commit después de cada cambio significativo

Después de implementar un cambio o grupo de cambios relacionados, **debes hacer commit**:

```bash
git add .
git commit -m "tipo(ámbito): descripción concisa"
```

**Tipos de commit (Conventional Commits):**

| Tipo | Uso |
|---|---|
| `feat` | Nueva feature |
| `fix` | Bug fix |
| `refactor` | Refactorización sin cambio funcional |
| `docs` | Documentación |
| `style` | Formato, estilos (no code) |
| `test` | Tests |
| `chore` | Mantenimiento, config, CI/CD |
| `perf` | Optimización de rendimiento |

**Ejemplos:**
```
feat(scraper): add LinkedIn auto-apply module
fix(api): resolve 404 CV not found due to import mismatch
docs: update knowledge.md with auto-apply issue link
refactor(pipeline): extract CV generator into separate module
```

### 3. Hacer push después de cada commit

Después de hacer commit, **debes hacer push** inmediatamente:

```bash
git push origin <branch-actual>
```

**Regla:** No debe quedar ningún commit local sin pushear al finalizar la sesión.

### 4. Actualizar el archivo de issues cerradas

Cuando se completa una feature de una GitHub Issue, agrega la entrada en la tabla de **Closed Issues** en `knowledge.md`:

```markdown
| # | Title | Resolution |
|---|---|---|
| 34 | feat: Auto-Apply | ✅ Implementado Sprint 1 |
```

---

## ✅ Workflow para cada tarea

Cada tarea debe seguir este flujo **obligatorio**:

```
1. Leer CLAUDE.md + knowledge.md + AGENTS.md
2. Recopilar contexto del código relevante
3. Implementar los cambios
4. Typecheck (npx tsc --noEmit)
5. Code review automático (según lo disponible)
6. Documentar los cambios (knowledge.md, README.md, etc.)
7. git add + git commit
8. git push
```

**No puedes saltarte ningún paso.** Si algo falla (typecheck, commit, push), debes resolverlo antes de continuar.

---

## 📝 Notas adicionales

- **Commits atómicos:** Un commit por cambio lógico. No acumules múltiples cambios no relacionados en un solo commit.
- **Push temprano, push seguido:** No esperes a tener todo listo para hacer push. Commits pequeños y frecuentes.
- **No hagas push a `main` directamente.** El proyecto usa `main` como rama principal. Si trabajas en una feature, usa una rama.
- **Mantén los archivos de documentación organizados.** Si agregas una sección nueva, usa el mismo formato y estilo que las secciones existentes.
- **TypeScript pasa `npx tsc --noEmit` sin errores** antes de hacer commit. Esto es obligatorio.
- **Tests pasan `npm test`** si el cambio afecta lógica existente.

---

## 🔗 Referencias rápidas

| Recurso | Propósito |
|---|---|
| `knowledge.md` | Documentación general del proyecto |
| `AGENTS.md` | Skill mappings y convenciones de frontend |
| `DESIGN.md` | Design system y guías visuales |
| `PRODUCT.md` | Visión del producto y brand |
| `README.md` | Setup, comandos, estructura |
| `.github/ISSUE_TEMPLATE/` | Templates para issues |
| `docs/API.md` | Documentación de la API |
