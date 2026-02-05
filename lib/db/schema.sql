create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists company_profiles (
  id uuid primary key,
  user_id text not null,
  name text,
  industry text,
  description text,
  ai_maturity_level text,
  ai_usage text,
  goals text,
  updated_at timestamptz not null default now()
);

create table if not exists memoraiz_documents (
  id uuid primary key,
  source text,
  title text,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  stable_user_id text not null,
  tab_session_id text not null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  deleted_at timestamptz
);

create index if not exists conversations_user_updated_idx
  on conversations (stable_user_id, updated_at);

create index if not exists conversations_user_created_idx
  on conversations (stable_user_id, created_at);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at);

create index if not exists memoraiz_documents_embedding_idx on memoraiz_documents using ivfflat (embedding vector_cosine_ops);
