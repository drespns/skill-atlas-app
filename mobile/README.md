# Finanzas (móvil)

App Android **Expo + React Native** sincronizada con el cuaderno web [`/tools/expense-tracker`](/tools/expense-tracker) vía Supabase `user_client_state` (scope `tools_expense_tracker`).

Producto hermano de la web **Finanzas** (antes SkillAtlas Gastos). En móvil: captura rápida y resumen del mes; el cuaderno completo (suscripciones, patrimonio, inversiones…) está en la web.

## Requisitos

- Node 22+
- [Expo Go](https://expo.dev/go) en el móvil (desarrollo) o EAS Build (APK/AAB)

## Configuración

```bash
cp mobile/.env.example mobile/.env
# Rellena EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (mismas que la web)
# Opcional: EXPO_PUBLIC_FINANZAS_WEB_URL=https://tu-dominio.com
```

Desde la raíz del monorepo:

```bash
pnpm install
pnpm mobile
```

Android:

```bash
pnpm mobile:android
```

## Build Play Store (EAS)

Guía paso a paso (cuenta Play, EAS, APK, producción, seguridad): **[`docs/play-store.md`](docs/play-store.md)**.

Resumen corto:

## Monorepo

- Dominio: [`packages/expense-core`](../packages/expense-core)
- Sync: [`mobile/lib/expense-sync.ts`](lib/expense-sync.ts)

## Roadmap

- v1.1: deudas, previstos, suscripciones (parcial)
- v1.2: patrimonio, recordatorios push
- v2: paridad con analítica web
