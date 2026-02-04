create extension if not exists vector;

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

create index if not exists memoraiz_documents_embedding_idx on memoraiz_documents using ivfflat (embedding vector_cosine_ops);
