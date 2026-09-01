# ProfePadel

App web (PWA) para que un profesor de pádel organice su semana de clases: horarios, alumnos, cobros y estadísticas. Login con Google, base de datos en Supabase, avisos por WhatsApp mediante links `wa.me`.

## 1. Requisitos

- Node.js 18+
- Una cuenta de Supabase (ya está creado el proyecto `profepadel`, project ref `azmthvagwqywldynmawa`)
- Una cuenta de Google Cloud para el login con Google

## 2. Variables de entorno

El archivo `.env` ya viene cargado con la URL y la clave pública (anon) del proyecto de Supabase:

```
VITE_SUPABASE_URL=https://azmthvagwqywldynmawa.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_gtLWo-rUzOtS6Hd0Xhx-oA_QtyR_a9w
```

Si en algún momento creás tu propio proyecto de Supabase, reemplazá estos valores por los tuyos (Project Settings → API).

## 3. Activar el login con Google (paso obligatorio)

Por seguridad, esto tenés que hacerlo vos desde tu propia cuenta de Google — no lo puede configurar un tercero.

1. Andá a [Google Cloud Console](https://console.cloud.google.com/) → creá un proyecto (o usá uno existente).
2. **APIs y servicios → Pantalla de consentimiento OAuth**: configurala como "Externa", cargá el nombre de la app (ProfePadel) y tu email de soporte.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - En **Orígenes autorizados de JavaScript** agregá la URL donde vayas a publicar la app (por ejemplo `https://profepadel.vercel.app` y `http://localhost:5173` para probar local).
   - En **URI de redirección autorizados** agregá exactamente:
     `https://azmthvagwqywldynmawa.supabase.co/auth/v1/callback`
   - Guardá y copiá el **Client ID** y el **Client Secret**.
4. Andá al [panel de Supabase](https://supabase.com/dashboard/project/azmthvagwqywldynmawa/auth/providers) → **Authentication → Providers → Google** → activalo y pegá el Client ID y Client Secret. Guardá.
5. En **Authentication → URL Configuration**, cargá como **Site URL** la URL donde publiques la app (o `http://localhost:5173` mientras probás local), y agregala también en **Redirect URLs**.

Una vez hecho esto, el botón "Continuar con Google" va a funcionar.

## 4. Correr en local

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173`.

## 5. Publicar en producción

La forma más simple es con [Vercel](https://vercel.com) o [Netlify](https://netlify.com):

1. Subí esta carpeta a un repositorio de GitHub.
2. Importá el repo en Vercel/Netlify.
3. Framework: **Vite**. Build command: `npm run build`. Output: `dist`.
4. Cargá las mismas variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en la configuración del proyecto.
5. Una vez que tengas la URL final, sumala en Google Cloud (orígenes autorizados) y en Supabase (Site URL / Redirect URLs), como se explica arriba.

También podés generar el build vos mismo y subir la carpeta `dist/` a cualquier hosting estático:

```bash
npm run build
```

## 6. Qué hace la app

- **Inicio**: resumen del día (clases hoy, ganancia del mes, alumnos), avisos de cobros pendientes y alumnos sin notificar.
- **Panel Profe → Mi calendario**: vista Mes / Semana / Día. Los huecos salen automáticamente según tus horarios configurados; tocás un hueco y asignás un alumno (existente o nuevo) en segundos.
- **Panel Profe → Alumnos**: ficha de cada alumno (categoría, género, día/horario habitual, si está "enfriándose"), búsqueda y filtros.
- **Panel Profe → Caja**: total facturado del mes, quién debe, quién ya pagó, y gastos (por ejemplo lo que rendís al club) — la ganancia real ya sale descontando esos gastos en Inicio y Estadísticas.
- **Panel Profe → Estadísticas**: ganancia del mes comparada con el anterior, facturado, pendiente, neto por alumno, clases dadas y alertas.
- **Configuración**: horarios (día por día, con horario habitual y excepciones), tarifas (individual/dúo/trío/grupo/mensual, en ARS/UYU/MXN/USD/CLP), aviso de deuda, mensajes de WhatsApp predeterminados (recordatorio, aviso de deuda, invitación a cubrir un hueco, reconquista), notificaciones, tema claro/oscuro y tamaño de letra.

Todos los mensajes de WhatsApp se abren con `wa.me` (el texto ya viene armado, vos tocás enviar) — no requiere ninguna cuenta de WhatsApp Business ni aprobaciones de Meta.

## 7. Base de datos

El esquema completo (perfiles, tarifas, horarios, alumnos, clases, pagos, gastos, notificaciones y plantillas de mensajes) ya está creado en Supabase con seguridad a nivel de fila (cada profesor solo ve sus propios datos). Al iniciar sesión por primera vez, un trigger crea automáticamente el perfil, las tarifas por defecto y las plantillas de mensajes.
