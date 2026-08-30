# Play Store — Finanzas móvil (guía para quien no ha publicado apps)

Pasos reales para tener la app en tu móvil / Play Console. Bundle actual: `app.skillatlas.gastos`.

## A) Probar YA (Expo web o móvil)

1. En el PC:
   ```bash
   pnpm install
   pnpm mobile
   ```
2. Abre `http://localhost:8081` (o Expo Go con SDK 56 si lo tienes).
3. Entra con **GitHub / LinkedIn** (o email). Redirects OAuth: `http://localhost:8081/**` en Supabase.
4. Pestañas: **Inicio** (patrimonio + gráfico) · **Suscripciones** · **Movimientos** (+ FAB) · **Inversiones** · **Ajustes** (cuenta por defecto).

Esto **no** publica en Play Store; solo desarrollo.

---

## B) Cuenta y herramientas (una sola vez)

1. Cuenta Google (la que usarás en Play).
2. [Google Play Console](https://play.google.com/console) — cuota única de registro (~25 USD).
3. Cuenta [expo.dev](https://expo.dev) (gratis).
4. En el PC:
   ```bash
   npm i -g eas-cli
   cd mobile
   eas login
   eas init
   ```
   - `eas init` crea un **projectId real** y lo escribe en `app.json` (sustituye el `00000000-…`).
5. Confirma que `mobile/.env` tiene las keys de Supabase (EAS las inyecta en build si las configuras como secrets; ver abajo).

### Secrets de EAS (recomendado)

```bash
cd mobile
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://….supabase.co"
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ…"
eas secret:create --name EXPO_PUBLIC_FINANZAS_WEB_URL --value "https://tu-dominio.com"
```

Nunca subas el service role. Solo anon key.

---

## C) Primer APK interno (para instalarte tú)

```bash
cd mobile
eas build -p android --profile preview
```

Cuando termine, Expo te da un enlace para **descargar el APK**. Instálalo en el móvil (permitir “orígenes desconocidos” / instalar apps desconocidas).

Perfil `preview` = APK de prueba, no hace falta Play Store.

---

## D) Publicar en Play Store (producción)

1. Genera el **AAB** (formato que pide Google):
   ```bash
   cd mobile
   eas build -p android --profile production
   ```
2. En Play Console → **Crear app** → nombre “Finanzas”, categoría Finanzas, gratis/pago.
3. Completa el cuestionario de **contenido** (privacidad, público objetivo, etc.).
4. Sube el AAB en **Prueba interna** primero (recomendado):
   - Crea una lista de testers (tu Gmail).
   - Sube el build → invita → instala desde el enlace de Play.
5. Cuando esté estable → **Producción** (revisión de Google: días/semanas la primera vez).

### Política de privacidad (obligatoria si hay login / datos)

Necesitas una URL pública (página en tu web) que diga:
- Qué datos guardas (email, JSON del cuaderno si sync).
- Que el cifrado E2E es opcional y la frase no va al servidor.
- Contacto.

Sin esto Google suele rechazar.

---

## E) Seguridad (checklist)

| Qué | Cómo |
|-----|------|
| Keys en el APK | Solo `anon` + URL pública. RLS en Supabase obligatorio. |
| Secrets | EAS secrets, no `.env` en git. |
| Firma | EAS gestiona el keystore en la nube (guarda acceso a la cuenta Expo). |
| Auth | Email/contraseña u OAuth (GitHub / LinkedIn); cierra sesión en móviles compartidos. |
| Sync | Usuario activa “Copia en cuenta”; E2E con frase solo en cliente. |
| Play | Prueba interna antes de producción; no pidas permisos de SMS/contactos si no los usas. |

---

## F) Errores frecuentes

- **Supabase “Coming up…”** tras reanudar: espera 2–5 min; Auth debe estar Healthy antes de login.
- **Login falla en APK**: faltan secrets EAS o URL de redirect; el móvil no usa el `.env` local del PC.
- **`projectId` placeholder**: sin `eas init` el build falla o no asocia el proyecto.
- **OAuth te manda al login de skillatlas.app**: en móvil el redirect debe ser HTTPS del Site URL.
  Añade en Supabase → Redirect URLs:
  - `https://skillatlas.app/auth/expo-callback`
  - `https://skillatlas.app/**`
  - `http://localhost:8081/**` (solo Expo web en el PC)
  La app usa `openAuthSessionAsync` y captura los tokens al llegar a `/auth/expo-callback` (no hace falta quedarte en la web).

---

## Orden recomendado esta semana

1. Expo Go + sync con web (A).  
2. `eas login` + `eas init` + secrets (B).  
3. APK preview e instalarte (C).  
4. Play Console + privacidad + prueba interna (D).  
5. Producción cuando la web/móvil estén estables.
