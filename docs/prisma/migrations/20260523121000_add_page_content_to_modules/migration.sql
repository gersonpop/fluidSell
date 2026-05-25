ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS page_content VARCHAR(40);

UPDATE public.modules
SET page_content = COALESCE(page_content, 'newPage');
