-- ============================================================
-- BetFellas v8 — Kullanıcı içeriği denetimi (Apple Guideline 1.2)
-- Lig duvarında (chat) kullanıcı üretimi içerik var. App Store kuralları
-- gereği: (a) uygunsuz içeriği BİLDİRME, (b) kullanıcıyı ENGELLEME,
-- (c) bildirimleri inceleyip 24 saat içinde aksiyon alma altyapısı.
-- ============================================================

-- ---------- 1. ENGELLEME ----------
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;

create policy "blocks_select_own" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "blocks_insert_own" on public.user_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid() and blocked_id <> auth.uid());
create policy "blocks_delete_own" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- ---------- 2. İÇERİK BİLDİRİMLERİ ----------
create table if not exists public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  message_id       uuid references public.feed_messages(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  league_id        uuid references public.leagues(id) on delete cascade,
  reason           text,
  status           text not null default 'open' check (status in ('open','reviewed','actioned')),
  created_at       timestamptz not null default now()
);
alter table public.content_reports enable row level security;

-- Aynı mesaj aynı kişi tarafından bir kez bildirilir
create unique index if not exists uq_report_once
  on public.content_reports(reporter_id, message_id);

-- Kullanıcı sadece kendi bildirimini ekleyebilir; okuma yok
-- (incelemeyi service_role / admin yapar — RLS bypass eder).
create policy "reports_insert_own" on public.content_reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- ---------- 3. BİLDİRME RPC'si ----------
-- reported_user_id ve league_id sunucuda mesajdan türetilir (istemci uyduramaz).
create or replace function public.report_message(_message_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _msg public.feed_messages;
begin
  select * into _msg from public.feed_messages where id = _message_id;
  if _msg.id is null then raise exception 'mesaj bulunamadı'; end if;
  if not public.is_league_member(_msg.league_id, auth.uid()) then
    raise exception 'yetki yok';
  end if;
  insert into public.content_reports (reporter_id, message_id, reported_user_id, league_id, reason)
  values (auth.uid(), _message_id, _msg.user_id, _msg.league_id, _reason)
  on conflict (reporter_id, message_id) do nothing;
end; $$;

-- ---------- 4. DUVAR OKUMA POLİTİKASI: engellenenleri gizle ----------
-- Engellenen kullanıcının mesajları sorgudan hiç dönmesin (sunucu tarafı).
drop policy if exists "feed_select_member" on public.feed_messages;
create policy "feed_select_member" on public.feed_messages
  for select to authenticated using (
    public.is_league_member(league_id, auth.uid())
    and (
      user_id is null
      or not exists (
        select 1 from public.user_blocks b
        where b.blocker_id = auth.uid()
          and b.blocked_id = public.feed_messages.user_id
      )
    )
  );
