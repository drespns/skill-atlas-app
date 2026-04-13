-- saas-025: /study — Nivel A: vincular workspace a Proyecto y Tecnologías (SkillAtlas)
-- Requiere: saas-020 (study_workspaces), saas-001 (projects/technologies con user_id).

alter table public.study_workspaces
  add column if not exists linked_project_id uuid null references public.projects (id) on delete set null;

create or replace function public.study_workspace_linked_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.linked_project_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.projects p
    where p.id = new.linked_project_id and p.user_id = new.user_id
  ) then
    raise exception 'linked_project_id must reference a project owned by the workspace user';
  end if;
  return new;
end;
$$;

drop trigger if exists study_workspaces_linked_project_check on public.study_workspaces;
create trigger study_workspaces_linked_project_check
before insert or update of linked_project_id, user_id on public.study_workspaces
for each row execute function public.study_workspace_linked_project_owner();

create table if not exists public.study_workspace_technologies (
  user_id uuid not null references auth.users (id) on delete cascade,
  technology_id uuid not null references public.technologies (id) on delete cascade,
  primary key (user_id, technology_id)
);

create index if not exists study_workspace_technologies_technology_idx
  on public.study_workspace_technologies (technology_id);

alter table public.study_workspace_technologies enable row level security;

drop policy if exists "study_workspace_technologies_select_own" on public.study_workspace_technologies;
create policy "study_workspace_technologies_select_own"
on public.study_workspace_technologies
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "study_workspace_technologies_insert_own" on public.study_workspace_technologies;
create policy "study_workspace_technologies_insert_own"
on public.study_workspace_technologies
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.technologies t
    where t.id = technology_id and t.user_id = auth.uid()
  )
);

drop policy if exists "study_workspace_technologies_delete_own" on public.study_workspace_technologies;
create policy "study_workspace_technologies_delete_own"
on public.study_workspace_technologies
for delete
to authenticated
using (auth.uid() = user_id);
