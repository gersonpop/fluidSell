ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS page_content TEXT;

UPDATE public.modules
SET page_content = COALESCE(page_content, content)
WHERE page_content IS NULL;
