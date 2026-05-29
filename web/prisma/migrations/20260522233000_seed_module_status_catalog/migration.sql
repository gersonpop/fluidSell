CREATE TABLE IF NOT EXISTS public."st_Multidata" (
  "Initials_PK" VARCHAR(50) NOT NULL,
  name VARCHAR(140) NOT NULL,
  value VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  "typeDescription" TEXT NULL,
  "typeUse" VARCHAR(100) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (value, type)
);

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
