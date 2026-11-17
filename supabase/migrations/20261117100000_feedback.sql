-- NetLab: bacheca bug e idee (pubblica in lettura, chiunque può inserire).
-- Applica dopo le migrazioni profiles / classi (SQL editor Supabase o `supabase db push`).

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bug', 'idea')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 3 and 4000),
  author_name text not null default '' check (char_length(author_name) <= 80),
  contact text not null default '' check (char_length(contact) <= 120),
  user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'done', 'wontfix')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_kind_idx on public.feedback (kind, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert_anyone on public.feedback;
create policy feedback_insert_anyone
  on public.feedback for insert
  to anon, authenticated
  with check (true);

drop policy if exists feedback_select_public on public.feedback;
create policy feedback_select_public
  on public.feedback for select
  to anon, authenticated
  using (true);

drop policy if exists feedback_update_admin on public.feedback;
create policy feedback_update_admin
  on public.feedback for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists feedback_delete_admin on public.feedback;
create policy feedback_delete_admin
  on public.feedback for delete
  to authenticated
  using (public.is_admin());

revoke all on public.feedback from public;
grant select, insert on public.feedback to anon, authenticated;
grant update, delete on public.feedback to authenticated;
