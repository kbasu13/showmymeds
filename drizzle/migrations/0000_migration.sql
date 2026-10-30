create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  referral_code text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- premium grants managed by admin from backend
create table public.premium_users (
  user_id uuid primary key,
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);
grant select on public.premium_users to authenticated;
grant all on public.premium_users to service_role;
alter table public.premium_users enable row level security;
create policy "own premium" on public.premium_users for select to authenticated using (user_id = auth.uid());
create policy "admins manage premium" on public.premium_users for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.caregiver_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  caregiver_id uuid,
  invite_token text not null unique default encode(gen_random_bytes(16),'hex'),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.caregiver_links to authenticated;
grant all on public.caregiver_links to service_role;
alter table public.caregiver_links enable row level security;
create policy "patient manages links" on public.caregiver_links for all to authenticated
  using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "caregiver sees own links" on public.caregiver_links for select to authenticated
  using (caregiver_id = auth.uid());
create policy "caregiver removes self" on public.caregiver_links for delete to authenticated
  using (caregiver_id = auth.uid());

create or replace function public.is_caregiver_of(_patient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.caregiver_links
    where patient_id = _patient and caregiver_id = auth.uid() and status = 'accepted')
$$;

create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "caregiver reads patient profile" on public.profiles for select to authenticated
  using (public.is_caregiver_of(id));

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  composition text,
  form text not null default 'tablet',
  dosage text,
  dose_qty numeric not null default 1,
  times text[] not null default '{08:00}',
  start_date date not null default current_date,
  end_date date,
  stock numeric not null default 0,
  image_url text,
  prescription_path text,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.medicines to authenticated;
grant all on public.medicines to service_role;
alter table public.medicines enable row level security;
create policy "own medicines" on public.medicines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "caregiver reads medicines" on public.medicines for select to authenticated
  using (public.is_caregiver_of(user_id));

create table public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time text not null,
  taken_at timestamptz not null default now(),
  unique (medicine_id, scheduled_date, scheduled_time)
);
grant select, insert, update, delete on public.dose_logs to authenticated;
grant all on public.dose_logs to service_role;
alter table public.dose_logs enable row level security;
create policy "own logs" on public.dose_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "caregiver reads logs" on public.dose_logs for select to authenticated
  using (public.is_caregiver_of(user_id));

create or replace function public.take_dose(_medicine uuid, _date date, _time text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into public.dose_logs(medicine_id, scheduled_date, scheduled_time)
  values (_medicine, _date, _time);
  update public.medicines set stock = greatest(stock - dose_qty, 0)
  where id = _medicine and user_id = auth.uid();
end $$;

create or replace function public.accept_invite(_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.caregiver_links;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into l from public.caregiver_links where invite_token = _token for update;
  if not found then raise exception 'invalid invite'; end if;
  if l.patient_id = auth.uid() then raise exception 'cannot accept own invite'; end if;
  if l.status = 'accepted' and l.caregiver_id <> auth.uid() then raise exception 'invite already used'; end if;
  update public.caregiver_links set caregiver_id = auth.uid(), status = 'accepted' where id = l.id;
  return l.patient_id;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          nullif(new.raw_user_meta_data->>'referral_code',''));
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();