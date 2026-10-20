# Quiniela Worlds 2026

Pick'ems privado del Mundial de LoL 2026 para el grupo. Vite + React + TypeScript, datos en Supabase y web en GitHub Pages.

## Lo que tienes que hacer tú (una sola vez)

### 1. Crear el proyecto en Supabase
1. Entra en <https://supabase.com>, crea un proyecto nuevo (plan gratuito, región `West EU` o la que quieras).
2. Ve a **SQL Editor → New query**, pega el contenido entero de [`supabase/schema.sql`](supabase/schema.sql) y dale a **Run**.
   Se puede volver a ejecutar más adelante sin perder datos (por ejemplo, si actualizamos funciones).
3. Ve a **Project Settings → API** (o **Data API / API Keys**) y copia:
   - la **Project URL** (`https://xxxx.supabase.co`)
   - la clave pública: la **anon key** (legacy) o la **publishable key** (`sb_publishable_…`). Cualquiera de las dos vale.
     ⚠️ Nunca uses la `service_role` / `secret` key.

### 2. Poner los secrets en GitHub
En el repo: **Settings → Secrets and variables → Actions → New repository secret**:

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | la Project URL |
| `VITE_SUPABASE_ANON_KEY` | la anon / publishable key |

### 3. Activar GitHub Pages
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
Después ve a **Actions → Desplegar en GitHub Pages → Run workflow** (o haz cualquier push a `main`).
La web queda en `https://pipa-bit.github.io/quiniela-worlds/`.

### 4. Cambiar los códigos y dar de alta todo
Códigos iniciales:
- Código del grupo: `worlds2026`
- Código de admin: `admin2026`

Entra en `…/quiniela-worlds/#/admin`, ve a **Ajustes** y cámbialos. Luego crea equipos, jugadores y partidos.
Pasa a tus amigos la URL y el código del grupo.

## Cómo se usa

- **Jugadores:** código del grupo → eligen su nombre (se recuerda en el móvil). Predicen cada partido hasta su hora de inicio.
- **Admin** (`#/admin`):
  - *Resultados:* un toque en el marcador final. Se puede cambiar o borrar en cualquier momento y los puntos se recalculan solos.
  - *Partidos:* fase, ronda, equipos, Bo1/Bo3/Bo5 y hora **de Madrid**. Para un retraso, edita el partido y cambia la hora.
  - *Bloquear / desbloquear* un partido a mano desde Resultados.
  - *Equipos:* el logo puede ser una URL o un fichero que subas a `public/logos/` (escribe `logos/gen.png`).

## Puntuación

- +1 por acertar el ganador, +1 extra por el resultado exacto (solo Bo3/Bo5).
- Desempate: más exactos → más aciertos de ganador → orden alfabético.
- Nada se guarda a mano: las vistas `prediction_scores` y `leaderboard` en SQL (y la misma lógica en `src/lib/scoring.ts`) lo calculan todo a partir de predicciones y resultados.

## Decisiones tomadas donde la especificación era ambigua

- **Jornada** (para las flechas ▲▼ de la clasificación) = día natural en hora de Madrid. Se compara con la clasificación sin el último día con resultados.
- **Empate total** (mismos puntos, exactos y aciertos): mismo puesto; el alfabético solo decide el orden en la lista.
- Bo1 se guarda como marcador 1-0 / 0-1.
- Si el admin cambia el formato de un partido (p. ej. de Bo1 a Bo3), se borran las predicciones que ya no encajan con el nuevo formato.
- Un partido con resultado queda cerrado aunque se desbloquee.
- El admin puede meter el resultado antes de la hora (no se lo impido, por si hay que corregir algo).
- La app se refresca sola cada 30 s y al volver a la pestaña (sin tiempo real, para no complicarlo).
- Las rutas usan `#` (`#/admin`, `#/clasificacion`…) y `base: './'` en Vite, así funciona en Pages sin depender del nombre del repo.
- Seguridad mínima: todo se puede leer con la clave pública salvo la tabla de códigos; las escrituras solo pasan por funciones SQL que comprueban el código del grupo o de admin.

## Desarrollo local

```bash
npm install
cp .env.example .env   # y rellena URL y clave
npm run dev
npm test               # tests de puntos, desempates, rachas, tabla suiza y horas
```

`supabase/test.sql` prueba el flujo completo en SQL (crear equipos y partidos, predecir con dos jugadores, cierre por hora y bloqueo, resultados, Bo1 vs exacto en Bo3, corrección y desempates). Se ejecuta contra una base con el esquema cargado y lo deshace todo al terminar.

## Plan

**Fase 1 (hecha):** esquema y RPC, despliegue, entrada, admin, partidos con predicciones visibles, clasificación con desempates y flechas, tabla suiza, estadísticas básicas (% por jugador y fase, exactos, rachas, contra corriente) y un cuadro de eliminatorias sencillo.

**Fase 2:** preguntas bonus, gráfica de evolución, equipo en el que más acierta/falla cada uno, pulido visual.
