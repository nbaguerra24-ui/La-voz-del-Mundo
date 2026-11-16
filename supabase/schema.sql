-- La Voz del Mundo: esquema inicial para Supabase/Postgres.
-- Ejecuta este archivo en Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  country text,
  language text not null default 'Español',
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  description text,
  category text not null default 'Humanidad',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint one_vote_per_user_per_poll unique (poll_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;

create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users create own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Published polls are public to signed-in users" on public.polls for select to authenticated using (is_published = true);
create policy "Options for published polls are visible" on public.poll_options for select to authenticated using (exists (select 1 from public.polls p where p.id = poll_id and p.is_published = true));
create policy "Users can read own vote" on public.votes for select to authenticated using (auth.uid() = user_id);
create policy "Users can cast own vote" on public.votes for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.polls p where p.id = poll_id and p.is_published = true) and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = votes.poll_id));

-- Crea automáticamente el perfil al registrarse. El país e idioma se toman de metadata del alta.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, country, language)
  values (new.id, new.raw_user_meta_data ->> 'country', coalesce(new.raw_user_meta_data ->> 'language', 'Español'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Datos de ejemplo. Las encuestas quedan publicadas para pruebas tras iniciar sesión.
with p as (
  insert into public.polls (question, description, category, is_published) values
  ('¿Crees que el mundo está mejorando o empeorando?', 'Una pregunta para conocer cómo percibimos el rumbo de nuestro planeta.', 'Humanidad', true),
  ('¿Qué debería ser prioridad para la humanidad?', 'Elige el cambio que consideras más urgente.', 'Sociedad', true),
  ('¿La inteligencia artificial mejorará nuestras vidas?', 'Queremos conocer tu perspectiva sobre el futuro tecnológico.', 'Tecnología', true)
  returning id, question
)
insert into public.poll_options (poll_id, label, sort_order)
select p.id, x.label, x.ord
from p
join lateral (values
  ('¿Crees que el mundo está mejorando o empeorando?', 'Está mejorando', 1),
  ('¿Crees que el mundo está mejorando o empeorando?', 'Está empeorando', 2),
  ('¿Crees que el mundo está mejorando o empeorando?', 'Sigue igual', 3),
  ('¿Crees que el mundo está mejorando o empeorando?', 'No lo sé', 4),
  ('¿Qué debería ser prioridad para la humanidad?', 'Educación para todos', 1),
  ('¿Qué debería ser prioridad para la humanidad?', 'Paz y seguridad', 2),
  ('¿Qué debería ser prioridad para la humanidad?', 'Cuidar el planeta', 3),
  ('¿Qué debería ser prioridad para la humanidad?', 'Reducir la pobreza', 4),
  ('¿La inteligencia artificial mejorará nuestras vidas?', 'Sí, mucho', 1),
  ('¿La inteligencia artificial mejorará nuestras vidas?', 'Sí, pero con riesgos', 2),
  ('¿La inteligencia artificial mejorará nuestras vidas?', 'No estoy seguro/a', 3),
  ('¿La inteligencia artificial mejorará nuestras vidas?', 'No', 4)
) as x(question, label, ord) on x.question = p.question;


-- Devuelve únicamente resultados agregados; no expone quién votó por cada opción.
create or replace function public.get_poll_results(p_poll_id uuid)
returns table (option_id uuid, label text, vote_count bigint, percentage numeric)
language sql stable security definer set search_path = public as $$
  with counts as (
    select o.id as option_id, o.label, count(v.id)::bigint as vote_count
    from public.poll_options o
    left join public.votes v on v.option_id = o.id and v.poll_id = p_poll_id
    where o.poll_id = p_poll_id
    group by o.id, o.label, o.sort_order
  ), totals as (select coalesce(sum(vote_count), 0)::numeric as total from counts)
  select counts.option_id, counts.label, counts.vote_count,
    case when totals.total = 0 then 0 else round((counts.vote_count::numeric / totals.total) * 100, 1) end as percentage
  from counts cross join totals order by counts.label;
$$;
revoke all on function public.get_poll_results(uuid) from public;
grant execute on function public.get_poll_results(uuid) to authenticated;
