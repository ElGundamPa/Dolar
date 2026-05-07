# DolarDashboard — Trading Vault

Dashboard de ventas en tiempo real con identidad **money machine + tech oscuro**: negro/antracita, azul eléctrico, plateado metálico, ornamentación de billete grabado. Cuando un agente cierra una venta, se dispara una **animación de cañón de dinero** con foto, monto, billetes con física suave y 3 SFX (arranque mecánico → ráfaga de cash → stinger de confirmación).

> **Misma arquitectura, contratos y rutas** que el repo origen ([ElGundamPa/Sale](https://github.com/ElGundamPa/Sale.git)). Sólo cambia identidad visual y la animación/SFX del jackpot.

## Stack

- React 18 + TypeScript + Vite
- React Router v6
- Tailwind CSS
- Framer Motion + CSS keyframes
- Supabase (Auth + Postgres + Storage + Edge Functions)
- WaveSurfer.js v7 (audio trimmer del admin)
- React Hook Form + Zod
- Lucide React

## 1) Correr en local

```bash
cp .env.example .env       # rellenar con los valores de Supabase
npm install
npm run dev
```

Si no hay Supabase configurado todavía, el dashboard cae a `mockTeams` y la animación se puede probar disparando ventas desde el admin en cuanto conectes el backend.

> **Nota WSL:** si tu `npm` está en `/mnt/c/Program Files/nodejs/` y el repo en el filesystem Linux, npm falla con `UNC paths are not supported`. Solución: instalar Node nativo en Linux (vía nvm o apt), o correr desde PowerShell en Windows.

## 2) Configurar Supabase

1. **Crear proyecto** en [supabase.com](https://supabase.com).
2. **Copiar credenciales** desde *Project Settings → API*:
   - `VITE_SUPABASE_URL` → URL del proyecto.
   - `VITE_SUPABASE_ANON_KEY` → anon/public key.
   Pegar en `.env`.
3. **Correr la migración inicial** (crea tablas, RLS, buckets):
   - Vía Supabase CLI: `supabase db push`
   - O vía Dashboard: *SQL editor* → pegar `supabase/migrations/0001_initial_schema.sql` → Run.
4. **Seed** (3 mesas + tunables):
   - SQL editor → pegar `supabase/seed.sql` → Run.
5. **Crear el usuario admin**:
   - *Authentication → Users → Add user* → email + password → marcar *Auto Confirm*.
   - No hay signup público; sólo este usuario puede entrar a `/admin`.
6. **Desplegar la Edge Function** (con la URL del Apps Script como secret).

   El deployment actual del Apps Script es:

   ```
   ID  : AKfycbwKp8YrPbAQjApOnMhClk7DSVNLp6y4BzepykCAZqW13AMeuKubgfOXpdUFV1lmVtm6Dg
   URL : https://script.google.com/macros/s/AKfycbwKp8YrPbAQjApOnMhClk7DSVNLp6y4BzepykCAZqW13AMeuKubgfOXpdUFV1lmVtm6Dg/exec
   ```

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase secrets set APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbwKp8YrPbAQjApOnMhClk7DSVNLp6y4BzepykCAZqW13AMeuKubgfOXpdUFV1lmVtm6Dg/exec"
   supabase functions deploy google-sheets-proxy --no-verify-jwt
   ```

   Si más adelante recreás el deployment desde Apps Script, Google va a darte un ID/URL nuevos. Repetí el `supabase secrets set` y el `deploy` con la URL nueva.

## 3) Apps Script (Google Sheets)

El proyecto usa el mismo `doGet()` que el repo original. Vive en `supabase/apps-script/Code.gs`. Devuelve:

```json
{
  "teams": [{
    "id": "mesa-1",
    "name": "Mesa 1",
    "goal": 50000,
    "total_real": 12345,
    "agents": [{ "id": "...", "name": "Alexis", "sales": 4500, "teamId": "mesa-1" }]
  }],
  "newSales": [{ "agentName": "Alexis", "entryDate": "...", "value": 1500 }]
}
```

Si tu Sheet aún no está publicado:

1. *Extensiones → Apps Script* en tu Sheet.
2. Pegar el contenido de `supabase/apps-script/Code.gs`.
3. *Implementar → Nueva implementación → Aplicación web*:
   - *Ejecutar como:* yo
   - *Quién tiene acceso:* **cualquier persona**
4. Copiar la URL `https://script.google.com/macros/s/.../exec` y pegarla en el `supabase secrets set APPS_SCRIPT_URL=...` del paso 6 de arriba.

## 4) Desplegar a producción

Recomendado: **Vercel** (Vite framework preset).

1. Importar el repo en Vercel.
2. Setear las dos env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) y opcionalmente `VITE_BRAND_*` en *Project Settings → Environment Variables*.
3. *Deploy*.

La Edge Function vive en Supabase, no en Vercel.

## Estructura

```
src/
├── pages/
│   ├── Index.tsx              # Dashboard público
│   ├── AdminLogin.tsx
│   ├── AdminDashboard.tsx
│   └── NotFound.tsx
├── components/
│   ├── dashboard/             # VaultBackground, StartScreen, DashboardView,
│   │                          # TeamCard, AgentRow, JackpotOverlay (money cannon),
│   │                          # NeonText, BrandMark, HexBadge
│   ├── admin/                 # ProtectedRoute, AgentsTab, TeamsTab,
│   │                          # SettingsTab, AgentDialog
│   └── ui/button.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useAgents.ts
│   ├── useAgentsAdmin.ts
│   ├── useAppSettings.ts
│   ├── useAppSettingsAdmin.ts
│   ├── useTeamsAdmin.ts
│   ├── useGoogleSheetData.ts
│   ├── useAudioPlayer.ts
│   └── useJackpotSfx.ts       # money-cannon SFX (mechanical / cashBurst / winStinger)
├── lib/                       # supabase.ts, buildTeams.ts, utils.ts, logger.ts
├── types/                     # index.ts (UI), database.ts (rows)
├── config/                    # constants.ts, branding.ts, mockData.ts
├── styles/animations.css
├── index.css                  # vault palette, banknote frame, premium buttons
└── main.tsx

public/
├── bg-vault.svg               # background con grid azul + spotlights
├── bill.svg                   # billete decorativo
├── favicon.svg
├── logos/dolar-dashboard.svg
└── sounds/                    # opcional — drop-in MP3 que reemplazan los SFX sintetizados

supabase/
├── migrations/0001_initial_schema.sql
├── functions/google-sheets-proxy/index.ts
├── apps-script/Code.gs
└── seed.sql
```

## Variables de entorno

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BRAND_NAME=DolarDashboard
VITE_BRAND_LOGO=/logos/dolar-dashboard.svg
VITE_BRAND_TAGLINE=Money machine · Trading vault · Real time
VITE_BRAND_MONOGRAM=$
```

---

## Guía de rebranding

Esta app está pensada para ser **clonada con otra identidad** sin tocar componentes.

### 1) Nombre, tagline, monograma

Editá `.env` (o `src/config/branding.ts` si querés bakearlo en el código):

| Variable | Para qué |
|---|---|
| `VITE_BRAND_NAME` | Nombre comercial (header, login, título de pestaña) |
| `VITE_BRAND_LOGO` | Ruta del logo en `/public` (`null`/vacío = se usa el monograma SVG) |
| `VITE_BRAND_TAGLINE` | Línea bajo el brand en la start screen |
| `VITE_BRAND_MONOGRAM` | 1–3 letras de fallback si no hay logo |

### 2) Logo

Reemplazá `public/logos/dolar-dashboard.svg` o apuntá `VITE_BRAND_LOGO` a otro path. Si la imagen no carga, el componente `BrandMark` cae automáticamente al monograma SVG.

### 3) Paleta

La paleta vive en dos lugares:

- **Tokens CSS** en `src/index.css` (`:root { --vault-* }`). Cambiá esos valores y todo el dashboard sigue.
- **Tailwind** en `tailwind.config.ts` (`colors.vault`).

Ambos deben quedar en sync. Para una marca completamente nueva normalmente solo se tocan:

- `--vault-blue`, `--vault-blue-bright`, `--vault-blue-deep`  ← color de acento principal
- `--vault-silver`, `--vault-platinum`                        ← texto / metales
- `--vault-ink`, `--vault-obsidian`                            ← fondo
- `colors.vault.*` correspondiente en Tailwind

### 4) Fondo

`public/bg-vault.svg` es el fondo. Si querés otro, dejá el archivo con el mismo nombre o cambiá `--bg-image` en `src/index.css`.

### 5) Tipografía

Las families se cargan desde Google Fonts en `index.html`. Cambiá:

- Display (banknote serif): `Cinzel` / `Playfair Display`
- Sans (UI): `Inter` / `Manrope`
- Digital (counters): `JetBrains Mono` / `IBM Plex Mono`

Después actualizá `tailwind.config.ts` (`fontFamily`) y los stacks en `src/index.css`.

---

## Guía para cambiar sonidos / animaciones

### Sonidos del cañón de dinero

Por defecto los 3 SFX se sintetizan en runtime con la Web Audio API (sin archivos binarios → 0 bytes en producción).

Para usar audio real, dejá MP3 en `/public/sounds/`:

| Archivo | Cuándo suena |
|---|---|
| `sfx-mechanical-start.mp3` | Stage 1 — “lock and load” del cañón |
| `sfx-cash-burst.mp3` | Stage 2 — billetes saliendo |
| `sfx-win-stinger.mp3` | Stage 3 — confirmación premium |

`useJackpotSfx` los detecta automáticamente y los prefiere sobre el sintetizador. Si un archivo no existe o está corrupto, se cae al synth (nunca bloquea la UI).

**Volumen y mute** son configurables en `/admin → Configuración → Audio`. Persisten en localStorage:
- `dolar.audio.muted` (`"1"` / `"0"`)
- `dolar.audio.master` (número 0–1)

### Animación

- Tiempos por etapa: `src/config/constants.ts` (`CANNON_FLASH_MS`, `CANNON_ARM_MS`, `CANNON_FIRE_MS`, `CANNON_REVEAL_MS`).
- Duración total: `app_settings.jackpot_duration_seconds` en Supabase (editable desde `/admin`).
- Densidad de billetes y modo fallback: `useReducedFx()` en `JackpotOverlay.tsx` (detecta `prefers-reduced-motion`, cores ≤ 4 o memoria ≤ 4 GB → reduce a 18 billetes en vez de 44).
- Geometría del cañón / billete: SVG inline al final de `JackpotOverlay.tsx` (sin dependencias externas).

---

## Checklist de validación final

- [ ] `/` carga el dashboard público (con mock o datos reales).
- [ ] `/admin/login` autentica con Supabase.
- [ ] `/admin` muestra tabs *Agentes*, *Mesas*, *Configuración* y exige sesión.
- [ ] Animación de **money cannon** dispara con flash azul, billetes con física, contador y camera shake.
- [ ] Los 3 SFX (mechanical / cashBurst / winStinger) suenan y respetan mute + volumen.
- [ ] Cola serial: dos ventas seguidas no encinan animaciones.
- [ ] `npm run build` termina sin errores.
- [ ] Mobile y desktop responsivos.

---

## Origen y acuerdos preservados

- Misma estructura de tablas (`teams`, `agents`, `app_settings`) y nombres de campos.
- Mismo contrato Apps Script (`teams[]`, `newSales[]`, `submittedAt`).
- Misma cola serial de jackpots, hidratación de `processed` desde localStorage, y dedupe por `agentName|submittedAt|value`.
- Mismas rutas: `/`, `/admin/login`, `/admin`, `/404`.
- Misma Edge Function (`google-sheets-proxy`) con CORS configurable y validación de payload.

Si comparás este proyecto con el original, **se siente el mismo producto en lógica y UX**, pero con identidad visual y audiovisual totalmente nueva basada en *dinero premium + tech oscuro*.
