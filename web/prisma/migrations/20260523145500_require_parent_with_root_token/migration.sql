ALTER TABLE public.modules
DROP CONSTRAINT IF EXISTS modules_parent_fk;

UPDATE public.modules
SET parent = '/'
WHERE parent IS NULL OR trim(parent) = '';

ALTER TABLE public.modules
ALTER COLUMN parent SET DEFAULT '/',
ALTER COLUMN parent SET NOT NULL;
