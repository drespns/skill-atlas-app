# SkillAtlas Gastos (móvil)

App Android **Expo + React Native** sincronizada con el cuaderno web [`/tools/expense-tracker`](https://skillatlas.app/tools/expense-tracker) vía Supabase `user_client_state` (scope `tools_expense_tracker`).

## Requisitos

- Node 22+
- [Expo Go](https://expo.dev/go) en el móvil (desarrollo) o EAS Build (APK/AAB)

## Configuración

```bash
cp mobile/.env.example mobile/.env
# Rellena EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (mismas que la web)
```

Desde la raíz del monorepo (con `mobile/.env` ya configurado):

```bash
pnpm install
pnpm mobile
```

Android emulador/dispositivo:

```bash
pnpm mobile:android
```

Navegador (preview limitado):

```bash
pnpm mobile:web
```

## Build Play Store (EAS)

1. Instala EAS CLI: `npm i -g eas-cli`
2. `cd mobile && eas login && eas init` (sustituye `projectId` en `app.json`)
3. `eas build -p android --profile production` → AAB para Play Console
4. Internal testing: `eas build -p android --profile preview` → APK

## Monorepo

- Dominio compartido: [`packages/expense-core`](../packages/expense-core)
- Sync: [`mobile/lib/expense-sync.ts`](lib/expense-sync.ts)

## Roadmap

- v1.1: deudas, previstos, suscripciones
- v1.2: patrimonio, recordatorios push
- v2: paridad con analítica web
