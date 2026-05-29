CREATE TABLE IF NOT EXISTS public.modules (
  id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(140) NOT NULL,
  description TEXT,
  route VARCHAR(255),
  icon TEXT,
  sort_order NUMERIC(10,2) NOT NULL DEFAULT 100,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  parent TEXT NULL,
  scope_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT modules_parent_fk FOREIGN KEY (parent) REFERENCES public.modules(id)
);

CREATE INDEX IF NOT EXISTS idx_modules_status ON public.modules(status);
CREATE INDEX IF NOT EXISTS idx_modules_sort_order ON public.modules(sort_order);
