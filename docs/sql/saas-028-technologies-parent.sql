-- saas-028: tecnología madre para librerías / paquetes (jerarquía opcional)
-- Requiere: saas-001 (technologies.user_id), saas-019 opcional (kind).

alter table public.technologies
  add column if not exists parent_technology_id uuid null references public.technologies (id) on delete set null;

alter table public.technologies
  drop constraint if exists technologies_parent_not_self;

alter table public.technologies
  add constraint technologies_parent_not_self
  check (parent_technology_id is null or parent_technology_id <> id);

create index if not exists technologies_user_parent_idx
  on public.technologies (user_id, parent_technology_id)
  where parent_technology_id is not null;

create or replace function public.technologies_parent_same_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_technology_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.technologies p
    where p.id = new.parent_technology_id
      and p.user_id = new.user_id
  ) then
    raise exception 'parent_technology_id must reference a technology owned by the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists technologies_parent_same_user_trg on public.technologies;
create trigger technologies_parent_same_user_trg
before insert or update of parent_technology_id, user_id on public.technologies
for each row execute function public.technologies_parent_same_user();
