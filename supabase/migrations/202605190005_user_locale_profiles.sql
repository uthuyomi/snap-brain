-- User locale preference for UI and AI-generated memory text.

alter table public.profiles
  add column if not exists locale text not null default 'auto',
  add column if not exists preferred_ai_language text not null default 'auto';

alter table public.profiles
  drop constraint if exists profiles_locale_check;

alter table public.profiles
  add constraint profiles_locale_check
  check (locale in ('auto', 'ja', 'en'));

alter table public.profiles
  drop constraint if exists profiles_preferred_ai_language_check;

alter table public.profiles
  add constraint profiles_preferred_ai_language_check
  check (preferred_ai_language in ('auto', 'ja', 'en'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  detected_locale text;
begin
  detected_locale := lower(coalesce(
    new.raw_user_meta_data ->> 'locale',
    new.raw_user_meta_data ->> 'language',
    new.raw_app_meta_data ->> 'locale',
    ''
  ));

  insert into public.profiles (id, display_name, locale, preferred_ai_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name', new.email),
    case when detected_locale like 'ja%' then 'ja' else 'en' end,
    case when detected_locale like 'ja%' then 'ja' else 'en' end
  )
  on conflict (id) do update
  set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    locale = case
      when public.profiles.locale = 'auto' then excluded.locale
      else public.profiles.locale
    end,
    preferred_ai_language = case
      when public.profiles.preferred_ai_language = 'auto' then excluded.preferred_ai_language
      else public.profiles.preferred_ai_language
    end;

  return new;
end;
$$;
