create table public.chat_messages (
  id uuid not null default gen_random_uuid (),
  household_id uuid not null,
  sender_id uuid not null,
  sender_type text not null,
  message text null,
  message_type text not null default 'text'::text,
  image_url text null,
  created_at timestamp with time zone null default now(),
  read_at timestamp with time zone null,
  deleted_at timestamp with time zone null,
  voice_url text null,
  sticker_url text null,
  voice_duration_seconds integer null,
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_household_id_fkey foreign KEY (household_id) references households (id) on delete CASCADE,
  constraint chat_messages_message_type_check check (
    (
      message_type = any (
        array[
          'text'::text,
          'image'::text,
          'voice'::text,
          'sticker'::text
        ]
      )
    )
  ),
  constraint chat_messages_sender_type_check check (
    (
      sender_type = any (array['family'::text, 'elderly'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_chat_messages_household on public.chat_messages using btree (household_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_chat_messages_unread on public.chat_messages using btree (household_id, read_at) TABLESPACE pg_default
where
  (read_at is null);