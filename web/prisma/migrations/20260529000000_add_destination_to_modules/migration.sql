-- AlterTable
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS destination VARCHAR(255);
ALTER TABLE public."Modules" ADD COLUMN IF NOT EXISTS destination TEXT;
