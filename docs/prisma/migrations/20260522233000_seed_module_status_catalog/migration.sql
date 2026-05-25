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
  'moduleStatus',
  'estado de modulo',
  'system',
  NOW(),
  NOW()
FROM (
  VALUES
    ('modActive', 'Activo', 'active'),
    ('modInactive', 'Inactivo', 'inactive'),
    ('modDeprecated', 'Depreciado', 'deprecated')
) AS seed(initials_pk, name, value)
WHERE NOT EXISTS (
  SELECT 1
  FROM public."st_Multidata" m
  WHERE lower(m."type") = 'modulestatus'
    AND lower(m."value") = lower(seed.value)
);
