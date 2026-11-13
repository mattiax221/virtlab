-- NetLab: docenti, classi, laboratori salvati e consegne.
-- Applica DOPO 20261113120000_profiles.sql (SQL editor di Supabase o `supabase db push`).
--
-- Ruoli account: user (allievo), teacher (docente), admin.
-- Il vecchio ruolo "viewer" diventa "teacher".

-- ---------------------------------------------------------------------------
-- Ruolo docente
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'teacher' where role = 'viewer';
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'teacher', 'admin'));

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teacher', 'admin') and banned = false
  );
$$;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'student' check (member_role in ('student', 'teacher')),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists class_members_user_idx on public.class_members (user_id);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  -- Verifiche automatiche: [{ "kind": "ping-ok", "from": "PC0", "target": "192.168.1.1" }, …]
  checks jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists assignments_class_idx on public.assignments (class_id);

create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  data jsonb not null,
  assignment_id uuid references public.assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- un lab didattico sta ben sotto questo limite; evita abusi di spazio
  constraint labs_data_size check (octet_length(data::text) < 2000000)
);
create index if not exists labs_owner_idx on public.labs (owner_id, updated_at desc);

create table if not exists public.submissions (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  lab_id uuid not null references public.labs (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (assignment_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Funzioni di supporto per le regole di accesso (security definer:
-- leggono le tabelle senza passare dalle regole, così non c'è ricorsione)
-- ---------------------------------------------------------------------------
create or replace function public.is_class_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.class_members
    where class_id = cid and user_id = auth.uid()
  );
$$;

create or replace function public.is_class_teacher(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or (
    public.is_teacher() and exists (
      select 1 from public.class_members
      where class_id = cid and user_id = auth.uid() and member_role = 'teacher'
    )
  );
$$;

/** Il chiamante insegna in una classe di cui uid fa parte (o è admin). */
create or replace function public.teaches_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or (
    public.is_teacher() and exists (
      select 1
      from public.class_members t
      join public.class_members s on s.class_id = t.class_id
      where t.user_id = auth.uid() and t.member_role = 'teacher' and s.user_id = uid
    )
  );
$$;

create or replace function public.assignment_class(aid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select class_id from public.assignments where id = aid;
$$;

revoke all on function public.is_teacher() from public;
revoke all on function public.is_class_member(uuid) from public;
revoke all on function public.is_class_teacher(uuid) from public;
revoke all on function public.teaches_user(uuid) from public;
revoke all on function public.assignment_class(uuid) from public;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.teaches_user(uuid) to authenticated;
grant execute on function public.assignment_class(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------
create or replace function public.new_join_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  code text;
begin
  loop
    -- 6 caratteri senza 0/O/1/I per evitare errori di lettura alla lavagna
    code := translate(upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)), '01', '79');
    exit when not exists (select 1 from public.classes where join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.classes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.join_code is null or new.join_code = '' then
    new.join_code := public.new_join_code();
  end if;
  new.join_code := upper(new.join_code);
  return new;
end;
$$;

drop trigger if exists classes_before_insert on public.classes;
create trigger classes_before_insert
  before insert on public.classes
  for each row execute function public.classes_before_insert();

-- Chi crea la classe ne diventa docente
create or replace function public.classes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.class_members (class_id, user_id, member_role)
    values (new.id, new.created_by, 'teacher')
    on conflict (class_id, user_id) do update set member_role = 'teacher';
  end if;
  return new;
end;
$$;

drop trigger if exists classes_after_insert on public.classes;
create trigger classes_after_insert
  after insert on public.classes
  for each row execute function public.classes_after_insert();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists labs_touch on public.labs;
create trigger labs_touch
  before update on public.labs
  for each row execute function public.touch_updated_at();

-- Nessuno può spostare un lab su un altro proprietario
create or replace function public.labs_keep_owner()
returns trigger
language plpgsql
as $$
begin
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists labs_keep_owner on public.labs;
create trigger labs_keep_owner
  before update on public.labs
  for each row execute function public.labs_keep_owner();

-- Iscrizione con codice classe: { "class_code": "AB12CD" } nei metadati di signUp
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(coalesce(new.email, 'utente'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  select id into cid
  from public.classes
  where join_code = upper(trim(coalesce(new.raw_user_meta_data->>'class_code', '')));
  if cid is not null then
    insert into public.class_members (class_id, user_id, member_role)
    values (cid, new.id, 'student')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funzioni chiamabili dall’app
-- ---------------------------------------------------------------------------

/** L’utente collegato entra in una classe con il codice. Restituisce il nome. */
create or replace function public.join_class(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  if auth.uid() is null then
    raise exception 'Accesso richiesto';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and banned) then
    raise exception 'Account disattivato';
  end if;
  select id, name into c from public.classes where join_code = upper(trim(code));
  if c.id is null then
    raise exception 'Codice classe non valido';
  end if;
  insert into public.class_members (class_id, user_id, member_role)
  values (c.id, auth.uid(), 'student')
  on conflict do nothing;
  return c.name;
end;
$$;

/** Il docente aggiunge alla classe un utente già registrato, per email. */
create or replace function public.add_class_member(cid uuid, member_email text, as_teacher boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  urole text;
begin
  if not public.is_class_teacher(cid) then
    raise exception 'Solo un docente della classe può farlo';
  end if;
  select id, role into uid, urole from public.profiles where lower(email) = lower(trim(member_email));
  if uid is null then
    raise exception 'Nessun utente registrato con questa email';
  end if;
  if as_teacher and urole not in ('teacher', 'admin') then
    raise exception 'Per renderlo docente della classe, prima dagli il ruolo Docente';
  end if;
  insert into public.class_members (class_id, user_id, member_role)
  values (cid, uid, case when as_teacher then 'teacher' else 'student' end)
  on conflict (class_id, user_id) do update set member_role = excluded.member_role;
  return uid;
end;
$$;

/** Nuovo codice di iscrizione (per esempio se quello vecchio è circolato troppo). */
create or replace function public.regenerate_join_code(cid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  if not public.is_class_teacher(cid) then
    raise exception 'Solo un docente della classe può farlo';
  end if;
  code := public.new_join_code();
  update public.classes set join_code = code where id = cid;
  return code;
end;
$$;

revoke all on function public.join_class(text) from public;
revoke all on function public.add_class_member(uuid, text, boolean) from public;
revoke all on function public.regenerate_join_code(uuid) from public;
revoke all on function public.new_join_code() from public;
grant execute on function public.join_class(text) to authenticated;
grant execute on function public.add_class_member(uuid, text, boolean) to authenticated;
grant execute on function public.regenerate_join_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Regole di accesso (RLS)
-- ---------------------------------------------------------------------------

-- Profili: i docenti vedono anche gli allievi delle loro classi
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.teaches_user(id));

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.labs enable row level security;
alter table public.submissions enable row level security;

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated
  using (created_by = auth.uid() or public.is_class_member(id));
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes for insert to authenticated
  with check (public.is_teacher() and created_by = auth.uid());
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update to authenticated
  using (public.is_class_teacher(id)) with check (public.is_class_teacher(id));
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete to authenticated
  using (public.is_class_teacher(id));

drop policy if exists members_select on public.class_members;
create policy members_select on public.class_members for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));
drop policy if exists members_update on public.class_members;
create policy members_update on public.class_members for update to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
drop policy if exists members_delete on public.class_members;
create policy members_delete on public.class_members for delete to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(class_id));
-- inserimenti solo tramite join_class / add_class_member / trigger

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated
  using (public.is_class_member(class_id));
drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments for all to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));

drop policy if exists labs_select on public.labs;
create policy labs_select on public.labs for select to authenticated
  using (owner_id = auth.uid() or public.teaches_user(owner_id));
drop policy if exists labs_insert on public.labs;
create policy labs_insert on public.labs for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists labs_update on public.labs;
create policy labs_update on public.labs for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists labs_delete on public.labs;
create policy labs_delete on public.labs for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions for select to authenticated
  using (user_id = auth.uid() or public.is_class_teacher(public.assignment_class(assignment_id)));
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_class_member(public.assignment_class(assignment_id))
    and exists (select 1 from public.labs l where l.id = lab_id and l.owner_id = auth.uid())
  );
drop policy if exists submissions_update on public.submissions;
create policy submissions_update on public.submissions for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.labs l where l.id = lab_id and l.owner_id = auth.uid())
  );
drop policy if exists submissions_delete on public.submissions;
create policy submissions_delete on public.submissions for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.classes, public.class_members, public.assignments, public.labs, public.submissions
  from public, anon;
grant select, insert, update, delete on public.classes to authenticated;
grant select, update, delete on public.class_members to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.labs to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.submissions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
