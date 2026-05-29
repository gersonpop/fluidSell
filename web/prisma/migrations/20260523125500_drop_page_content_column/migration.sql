UPDATE public.modules
SET content = COALESCE(content, page_content)
WHERE content IS NULL;

ALTER TABLE public.modules
DROP COLUMN IF EXISTS page_content;
