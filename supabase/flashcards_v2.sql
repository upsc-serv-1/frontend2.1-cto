-- ========================================================================
-- flashcards_v2.sql — proper SM-2, images, rich content
-- ========================================================================

-- 1. Front/back rich content + images
alter table public.cards add column if not exists front_text       text;
alter table public.cards add column if not exists back_text        text;
alter table public.cards add column if not exists front_image_url  text;
alter table public.cards add column if not exists back_image_url   text;
alter table public.cards add column if not exists card_type        text default 'qa'; -- qa | note_block | manual
alter table public.cards add column if not exists source           jsonb;            -- {kind:'question'|'note', id, ref}
alter table public.cards add column if not exists created_at       timestamptz default now();
alter table public.cards add column if not exists updated_at       timestamptz default now();

-- Backfill: copy old fields into new ones if present
update public.cards
   set front_text = coalesce(front_text, question_text),
       back_text  = coalesce(back_text, answer_text)
 where front_text is null or back_text is null;

-- 2. user_cards SM-2 columns
alter table public.user_cards add column if not exists ease_factor     numeric(4,2) default 2.5;
alter table public.user_cards add column if not exists interval_days   integer       default 0;
alter table public.user_cards add column if not exists repetitions     integer       default 0;
alter table public.user_cards add column if not exists last_quality    smallint;     -- 0..5
alter table public.user_cards add column if not exists last_reviewed   timestamptz;
alter table public.user_cards add column if not exists next_review     timestamptz;
alter table public.user_cards add column if not exists status          text default 'new'; -- new|learning|review|mastered|leech
alter table public.user_cards add column if not exists lapses          integer default 0;

-- 3. Card-level review log (history)
create table if not exists public.card_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  card_id       uuid not null,
  reviewed_at   timestamptz default now(),
  quality       smallint not null check (quality between 0 and 5),
  prev_interval integer,
  new_interval  integer,
  prev_ef       numeric(4,2),
  new_ef        numeric(4,2)
);
create index if not exists idx_card_reviews_user_card on public.card_reviews(user_id, card_id, reviewed_at desc);

-- 4. RLS for new columns / table
alter table public.card_reviews enable row level security;
drop policy if exists "card_reviews own" on public.card_reviews;
create policy "card_reviews own" on public.card_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
