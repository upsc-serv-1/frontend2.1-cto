alter table public.question_states
  add column if not exists attempt_id text;

create index if not exists idx_question_states_user_question
  on public.question_states (user_id, question_id);

create index if not exists idx_question_states_attempt_id
  on public.question_states (attempt_id);

create index if not exists idx_question_states_test_id
  on public.question_states (test_id);

create index if not exists idx_test_attempts_user_submitted
  on public.test_attempts (user_id, submitted_at desc);

alter table public.user_settings
  add column if not exists analytics_layout jsonb not null default
  '{
    "review": [
      "summary",
      "outcomes",
      "subject_accuracy",
      "time_distribution",
      "fatigue",
      "difficulty",
      "mistake_types",
      "confidence",
      "weak_areas",
      "insights"
    ],
    "overall": [
      "smart_insight",
      "performance_trajectory",
      "subject_proficiency",
      "elimination_zone",
      "theme_heatmap",
      "fatigue_difficulty",
      "mistake_categorization",
      "repeated_weaknesses"
    ]
  }'::jsonb;

comment on column public.question_states.attempt_id is 'Links per-question state snapshots to a specific test_attempts.id for clean review analytics.';
comment on column public.user_settings.analytics_layout is 'Per-user ordering preferences for review and overall analytics cards.';
