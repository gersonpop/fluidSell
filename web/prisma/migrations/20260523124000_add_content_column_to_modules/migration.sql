ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS content VARCHAR(40);

UPDATE public.modules
SET content = COALESCE(content, page_content)
WHERE content IS NULL;
