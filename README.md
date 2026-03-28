# SkillAtlas

![Astro](https://img.shields.io/badge/Astro-6.0-FF5D01?logo=astro&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2-06B6D4?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/Status-MVP-blue)
![Data Source](https://img.shields.io/badge/Data-Mock_(Supabase_next)-6E56CF)
![License](https://img.shields.io/badge/License-Private-lightgrey)

Aplicación web para **gestionar y mostrar conocimiento técnico**:
tecnologías, conceptos, progreso de aprendizaje y proyectos de portfolio.

---

## ✨ MVP actual

- Flujo principal: **Tecnologías → Conceptos → Proyectos → Portfolio**
- UI en Astro con Tailwind (modo claro/oscuro)
- Selector de idioma ES/EN (base ya montada)
- Embeds de proyectos (Tableau/GitHub links mock)
- Capa de datos desacoplada para migrar a Supabase sin romper la UI

---

## 🧱 Stack

- **Frontend:** Astro
- **Estilos:** Tailwind CSS v4
- **Lógica cliente:** TypeScript
- **Backend (próximo):** Supabase (PostgreSQL)

---

## 📁 Estructura del proyecto

```text
/
├─ public/
│  ├─ icons/                # SVGs de tecnologías y marcas
│  └─ favicon.svg
├─ src/
│  ├─ components/           # UI reutilizable (cards, badges, embeds...)
│  ├─ config/               # Configuración compartida (icon mapping)
│  ├─ data/                 # Capa de datos (mock hoy, supabase mañana)
│  ├─ layouts/              # AppShell (header/nav/theme)
│  ├─ pages/                # Rutas Astro
│  ├─ scripts/              # Lógica cliente (theme + i18n)
│  └─ styles/               # CSS global + Tailwind
├─ astro.config.mjs
└─ package.json
```

![Supabase DB](/public/db/supabase-db.png)

---

## 🗺️ Rutas actuales

- `/` Landing
- `/app` Dashboard
- `/technologies` Lista de tecnologías
- `/technologies/:techId` Detalle de tecnología + conceptos
- `/projects` Lista de proyectos
- `/projects/:projectId` Detalle de proyecto + embeds + conceptos
- `/portfolio` Portfolio público
- `/settings` Ajustes

---

## 🚀 Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

---

## 🧠 Arquitectura de datos (importante)

El proyecto **no importa `mock.ts` directamente** desde la UI.
Se usa `src/data/index.ts` como facade:

- Hoy: reexporta datos/funciones del mock
- Mañana: podrá cambiar a provider Supabase con el mismo contrato

Esto evita reescribir páginas/componentes al migrar backend.

---

## 🔜 Próximos pasos recomendados

1. Definir contrato final de `src/data/index.ts` (providers)
2. Crear `supabaseProvider` (lectura inicial)
3. Sustituir mocks por queries reales
4. Completar i18n en toda la UI
5. Añadir CRUD mínimo (tecnologías, conceptos, proyectos)

---

## 📌 Nota

Este repositorio está en fase MVP y prioriza claridad del código,
iteración rápida y preparación para migración a Supabase.
