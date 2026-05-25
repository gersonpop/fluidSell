INSERT INTO public."st_Multidata" (
  "Initials_PK",
  "name",
  "value",
  "type",
  "typeDescription",
  "typeUse",
  "created_at",
  "updated_at"
)
SELECT
  seed.initials_pk,
  seed.name,
  seed.value,
  'pageContent',
  'modo de contenido de pagina',
  'system',
  NOW(),
  NOW()
FROM (
  VALUES
    ('pageEmbedded', 'Embebido', 'embedded'),
    ('pageNew', 'Nueva pagina', 'newPage')
) AS seed(initials_pk, name, value)
WHERE NOT EXISTS (
  SELECT 1
  FROM public."st_Multidata" m
  WHERE lower(m."type") = 'pagecontent'
    AND lower(m."value") = lower(seed.value)
);
