-- saas-027: varios espacios de estudio por usuario (`study_spaces`) + `study_space_id` en datos de /study
-- Requiere: saas-020 … saas-026 aplicados (study_workspaces, study_sources, study_chunks, study_user_notes, study_workspace_technologies, linked_project_id).
--
-- Migración: un `study_space` por usuario que ya tenga datos; se reasignan filas existentes a ese espacio.
-- Tras aplicar, la app filtra fuentes/notas/chunks/workspace por `study_space_id` y el selector de estudio persiste `activeStudySpaceId` en `user_client_state` (scope `study_prefs`).

create extension if not exists pgcrypto;

-- ── 1) Espacios nombrados ───────────────────────────────────────────────────
create table if not exists public.study_spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_spaces_user_sort_idx on public.study_spaces (user_id, sort_order asc, created_at desc);

alter table public.study_spaces enable row level security;

drop policy if exists "study_spaces_select_own" on public.study_spaces;
create policy "study_spaces_select_own"
on public.study_spaces for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "study_spaces_insert_own" on public.study_spaces;
create policy "study_spaces_insert_own"
on public.study_spaces for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "study_spaces_update_own" on public.study_spaces;
create policy "study_spaces_update_own"
on public.study_spaces for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "study_spaces_delete_own" on public.study_spaces;
create policy "study_spaces_delete_own"
on public.study_spaces for delete to authenticated
using (auth.uid() = user_id);

drop trigger if exists study_spaces_set_updated_at on public.study_spaces;
create trigger study_spaces_set_updated_at
before update on public.study_spaces
for each row execute function public.set_updated_at();

-- ── 2) Sembrar un espacio por usuario con filas en tablas de estudio ─────────
insert into public.study_spaces (user_id, title, sort_order)
select distinct u.user_id, '', 0
from (
  select user_id from public.study_workspaces
  union
  select user_id from public.study_sources
  union
  select user_id from public.study_user_notes
  union
  select user_id from public.study_workspace_technologies
) u
where not exists (select 1 from public.study_spaces s where s.user_id = u.user_id);

-- ── 3) study_workspaces: pasar PK de user_id a study_space_id ───────────────
alter table public.study_workspaces add column if not exists study_space_id uuid null references public.study_spaces (id) on delete cascade;

update public.study_workspaces w
set study_space_id = s.id
from public.study_spaces s
where s.user_id = w.user_id and w.study_space_id is null;

insert into public.study_workspaces (user_id, study_space_id, active_ids, session_notes, linked_project_id)
select s.user_id, s.id, '{}'::text[], '', null
from public.study_spaces s
where not exists (select 1 from public.study_workspaces w where w.study_space_id = s.id);

drop trigger if exists study_workspaces_linked_project_check on public.study_workspaces;

-- Quitar RLS que referencia user_id antes de borrar la columna (evita 2BP01).
drop policy if exists "study_workspaces_select_own" on public.study_workspaces;
drop policy if exists "study_workspaces_insert_own" on public.study_workspaces;
drop policy if exists "study_workspaces_update_own" on public.study_workspaces;
drop policy if exists "study_workspaces_delete_own" on public.study_workspaces;

alter table public.study_workspaces drop constraint if exists study_workspaces_pkey;

alter table public.study_workspaces alter column study_space_id set not null;

alter table public.study_workspaces add primary key (study_space_id);

alter table public.study_workspaces drop constraint if exists study_workspaces_user_id_fkey;
alter table public.study_workspaces drop column if exists user_id;

create or replace function public.study_workspace_linked_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare suid uuid;
begin
  if new.linked_project_id is null then
    return new;
  end if;
  select sp.user_id into suid from public.study_spaces sp where sp.id = new.study_space_id;
  if suid is null then
    raise exception 'study_space_id not found';
  end if;
  if not exists (
    select 1 from public.projects p
    where p.id = new.linked_project_id and p.user_id = suid
  ) then
    raise exception 'linked_project_id must reference a project owned by the study space owner';
  end if;
  return new;
end;
$$;

create trigger study_workspaces_linked_project_check
before insert or update of linked_project_id, study_space_id on public.study_workspaces
for each row execute function public.study_workspace_linked_project_owner();

create policy "study_workspaces_select_own" on public.study_workspaces for select to authenticated
using (exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid()));

create policy "study_workspaces_insert_own" on public.study_workspaces for insert to authenticated
with check (exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid()));

create policy "study_workspaces_update_own" on public.study_workspaces for update to authenticated
using (exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid()))
with check (exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid()));

create policy "study_workspaces_delete_own" on public.study_workspaces for delete to authenticated
using (exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid()));

-- ── 4) study_sources ────────────────────────────────────────────────────────
alter table public.study_sources add column if not exists study_space_id uuid null references public.study_spaces (id) on delete cascade;

update public.study_sources ss
set study_space_id = s.id
from public.study_spaces s
where s.user_id = ss.user_id and ss.study_space_id is null;

alter table public.study_sources alter column study_space_id set not null;

create index if not exists study_sources_space_created_idx on public.study_sources (study_space_id, created_at desc);

drop policy if exists "study_sources_select_own" on public.study_sources;
drop policy if exists "study_sources_insert_own" on public.study_sources;
drop policy if exists "study_sources_update_own" on public.study_sources;
drop policy if exists "study_sources_delete_own" on public.study_sources;

create policy "study_sources_select_own" on public.study_sources for select to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_sources_insert_own" on public.study_sources for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_sources_update_own" on public.study_sources for update to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_sources_delete_own" on public.study_sources for delete to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

-- ── 5) study_chunks (denormalizado para RLS / índices) ───────────────────────
alter table public.study_chunks add column if not exists study_space_id uuid null references public.study_spaces (id) on delete cascade;

update public.study_chunks c
set study_space_id = s.study_space_id
from public.study_sources s
where s.id = c.source_id and c.study_space_id is null;

alter table public.study_chunks alter column study_space_id set not null;

create index if not exists study_chunks_space_source_idx on public.study_chunks (study_space_id, source_id);

drop policy if exists "study_chunks_select_own" on public.study_chunks;
drop policy if exists "study_chunks_insert_own" on public.study_chunks;
drop policy if exists "study_chunks_update_own" on public.study_chunks;
drop policy if exists "study_chunks_delete_own" on public.study_chunks;

create policy "study_chunks_select_own" on public.study_chunks for select to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_chunks_insert_own" on public.study_chunks for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_chunks_update_own" on public.study_chunks for update to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_chunks_delete_own" on public.study_chunks for delete to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

-- ── 6) study_user_notes ─────────────────────────────────────────────────────
alter table public.study_user_notes add column if not exists study_space_id uuid null references public.study_spaces (id) on delete cascade;

update public.study_user_notes n
set study_space_id = s.id
from public.study_spaces s
where s.user_id = n.user_id and n.study_space_id is null;

alter table public.study_user_notes alter column study_space_id set not null;

drop index if exists study_user_notes_user_sort_idx;
create index if not exists study_user_notes_space_sort_idx on public.study_user_notes (study_space_id, sort_order asc, created_at desc);

drop policy if exists "study_user_notes_select_own" on public.study_user_notes;
drop policy if exists "study_user_notes_insert_own" on public.study_user_notes;
drop policy if exists "study_user_notes_update_own" on public.study_user_notes;
drop policy if exists "study_user_notes_delete_own" on public.study_user_notes;

create policy "study_user_notes_select_own" on public.study_user_notes for select to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_user_notes_insert_own" on public.study_user_notes for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_user_notes_update_own" on public.study_user_notes for update to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

create policy "study_user_notes_delete_own" on public.study_user_notes for delete to authenticated
using (
  auth.uid() = user_id
  and exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
);

-- ── 7) Tecnologías enlazadas por espacio ────────────────────────────────────
create table if not exists public.study_space_technologies (
  study_space_id uuid not null references public.study_spaces (id) on delete cascade,
  technology_id uuid not null references public.technologies (id) on delete cascade,
  primary key (study_space_id, technology_id)
);

create index if not exists study_space_technologies_technology_idx on public.study_space_technologies (technology_id);

insert into public.study_space_technologies (study_space_id, technology_id)
select s.id, swt.technology_id
from public.study_workspace_technologies swt
join public.study_spaces s on s.user_id = swt.user_id
on conflict do nothing;

alter table public.study_space_technologies enable row level security;

drop policy if exists "study_space_technologies_select_own" on public.study_space_technologies;
create policy "study_space_technologies_select_own"
on public.study_space_technologies for select to authenticated
using (exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid()));

drop policy if exists "study_space_technologies_insert_own" on public.study_space_technologies;
create policy "study_space_technologies_insert_own"
on public.study_space_technologies for insert to authenticated
with check (
  exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid())
  and exists (select 1 from public.technologies t where t.id = technology_id and t.user_id = auth.uid())
);

drop policy if exists "study_space_technologies_delete_own" on public.study_space_technologies;
create policy "study_space_technologies_delete_own"
on public.study_space_technologies for delete to authenticated
using (exists (select 1 from public.study_spaces sp where sp.id = study_space_id and sp.user_id = auth.uid()));

drop table if exists public.study_workspace_technologies;
