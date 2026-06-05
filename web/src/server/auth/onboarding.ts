import {Pool} from "pg";

export type OnboardingStatus = "active" | "inactive" | "pending_approval" | "failed";
export type ResolveFlow = "ACTIVE" | "FORM_REQUIRED" | "PENDING_ONLY" | "PROVIDER_CONFLICT";

type SocialProvider = "google" | "facebook" | "linkedin";

type UserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  companyId: string;
  countryCode: string;
  country: string;
  department: string;
  city: string;
  dni: string;
  birthDate: string;
  gender: string;
  status: OnboardingStatus;
  provider: SocialProvider;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingSubmitInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyId: string;
  countryCode: string;
  country: string;
  department: string;
  city: string;
  dni: string;
  birthDate: string;
  gender: string;
  provider: SocialProvider;
  avatar?: string;
  metadata?: any;
};

export type OnboardingCancelInput = {
  email: string;
  provider: SocialProvider;
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyId?: string;
  countryCode?: string;
  country?: string;
  department?: string;
  city?: string;
  dni?: string;
  birthDate?: string;
  gender?: string;
  avatar?: string;
  metadata?: any;
};

type CatalogDb = {
  companies: Array<{id: string; name: string}>;
  countries: Array<{code: string; label: string; prefixArea: string}>;
  departmentsByCountry: Record<string, Array<{code: string; label: string}>>;
  citiesByDepartment: Record<string, Array<{code: string; label: string}>>;
  multidataByGroup: Record<string, Array<{value: string; label: string}>>;
};

const defaultCatalogDb: CatalogDb = {
  companies: [
    {id: "company-generic-su", name: "Compania Generica SU"},
    {id: "company-demo-001", name: "Company Demo 001"}
  ],
  countries: [
    {code: "CO", label: "Colombia", prefixArea: "+57"},
    {code: "MX", label: "Mexico", prefixArea: "+52"}
  ],
  departmentsByCountry: {},
  citiesByDepartment: {},
  multidataByGroup: {
    gender: [
      {value: "male", label: "Masculino"},
      {value: "female", label: "Femenino"},
      {value: "other", label: "Otro"}
    ],
    countryCode: [
      {value: "+57", label: "+57"},
      {value: "+52", label: "+52"}
    ]
  }
};

const REQUIRED_USER_STATUS_VALUES = [
  {value: "active", label: "Activo"},
  {value: "inactive", label: "Inactivo"},
  {value: "pending_approval", label: "Pendiente de aprobacion"},
  {value: "failed", label: "Fallido"}
];

let pool: Pool | null = null;

function normalizePgConnectionString(raw: string) {
  try {
    const url = new URL(raw);
    const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
    const useLibpqCompat = url.searchParams.get("uselibpqcompat")?.toLowerCase() === "true";
    if (!useLibpqCompat && (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca")) {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }
    pool = new Pool({connectionString: normalizePgConnectionString(connectionString)});
  }
  return pool;
}

function normalizeStatus(status: string | null | undefined): OnboardingStatus {
  const raw = String(status ?? "").trim().toLowerCase();
  if (raw === "active") return "active";
  if (raw === "pending_approval") return "pending_approval";
  if (raw === "failed") return "failed";
  return "inactive";
}

function mapRowToUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id_user_pk),
    email: String(row.user_email),
    firstName: String(row.name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: `${String(row.name ?? "")} ${String(row.last_name ?? "")}`.trim(),
    phone: String(row.phone_number ?? ""),
    companyId: String(row.companyId ?? ""),
    countryCode: String(row.country_code),
    country: String(row.country_iso ?? ""),
    department: String(row.department_code ?? ""),
    city: String(row.city_code ?? ""),
    dni: String(row.dni),
    birthDate: String(row.birth_date),
    gender: String(row.gender),
    status: normalizeStatus(String(row.status)),
    provider: String(row.provider ?? "google") as SocialProvider,
    avatar: row.avatar ? String(row.avatar) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

async function ensureUserStatusCatalog() {
  const rows = await getPool().query('SELECT value FROM "st_Multidata" WHERE type=$1', ["userStatus"]);
  const existing = new Set(rows.rows.map((row) => String(row.value).toLowerCase()));

  for (const item of REQUIRED_USER_STATUS_VALUES) {
    if (!existing.has(item.value)) {
      await getPool().query(
        'INSERT INTO "st_Multidata" ("Initials_PK", name, value, type, "typeDescription", "typeUse", created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) ON CONFLICT (value, type) DO NOTHING',
        [item.value, item.label, item.value, "userStatus", "Estado de usuario onboarding", "Admin"]
      );
    }
  }
}


type CatalogCache = {
  data: CatalogDb;
  expiresAt: number;
} | null;

let catalogCache: CatalogCache = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateCatalogCache() {
  catalogCache = null;
}

async function readCatalogDb(): Promise<CatalogDb> {
  const now = Date.now();
  if (catalogCache && catalogCache.expiresAt > now) {
    return catalogCache.data;
  }

  try {
    const [companyRows, multidataRows, countryRows, stateRows, cityRows] = await Promise.all([
      getPool().query('SELECT id, "commercialName" FROM "Company" ORDER BY "commercialName" ASC'),
      getPool().query('SELECT name, value, type FROM "st_Multidata"'),
      getPool().query('SELECT prefix_area, iso, nombre FROM "st_Country"'),
      getPool().query('SELECT id_state, state, iso_country FROM "st_State"'),
      getPool().query('SELECT id_city, city, iso_country, state_id FROM "st_City"')
    ]);

    const rowsToStrings = (value: unknown) => String(value ?? "").trim();
    const countries = countryRows.rows
      .map((row) => {
        const prefixRaw = rowsToStrings(row.prefix_area);
        const prefixArea = prefixRaw.length > 0 ? `+${prefixRaw.replace(/^\+/, "")}` : "";
        return {code: rowsToStrings(row.iso), label: rowsToStrings(row.nombre), prefixArea};
      })
      .filter((row) => row.code.length > 0);

    const departmentsByCountry: Record<string, Array<{code: string; label: string}>> = {};
    for (const row of stateRows.rows) {
      const countryCode = rowsToStrings(row.iso_country);
      const code = rowsToStrings(row.id_state);
      const label = rowsToStrings(row.state);
      if (!countryCode || !code || !label) continue;
      departmentsByCountry[countryCode] ??= [];
      departmentsByCountry[countryCode].push({code, label});
    }

    const citiesByDepartment: Record<string, Array<{code: string; label: string}>> = {};
    for (const row of cityRows.rows) {
      const stateCode = rowsToStrings(row.state_id);
      const code = rowsToStrings(row.id_city);
      const label = rowsToStrings(row.city);
      if (!stateCode || !code || !label) continue;
      citiesByDepartment[stateCode] ??= [];
      citiesByDepartment[stateCode].push({code, label});
    }

    const multidataByGroup: Record<string, Array<{value: string; label: string}>> = {};
    for (const row of multidataRows.rows) {
      const group = rowsToStrings(row.type);
      const value = rowsToStrings(row.value);
      const label = rowsToStrings(row.name);
      if (!group || !value || !label) continue;
      multidataByGroup[group] ??= [];
      multidataByGroup[group].push({value, label});
    }

    const companies = companyRows.rows.map((row) => ({
      id: String(row.id),
      name: String(row.commercialName ?? row.id)
    }));

    const result: CatalogDb = {
      companies: companies.length > 0 ? companies : defaultCatalogDb.companies,
      countries: countries.length > 0 ? countries : defaultCatalogDb.countries,
      departmentsByCountry: Object.keys(departmentsByCountry).length > 0 ? departmentsByCountry : defaultCatalogDb.departmentsByCountry,
      citiesByDepartment: Object.keys(citiesByDepartment).length > 0 ? citiesByDepartment : defaultCatalogDb.citiesByDepartment,
      multidataByGroup: Object.keys(multidataByGroup).length > 0 ? multidataByGroup : defaultCatalogDb.multidataByGroup
    };

    catalogCache = {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS
    };

    return result;
  } catch {
    return defaultCatalogDb;
  }
}


function assertCatalogValue(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export async function getCatalogCompanies() {
  const db = await readCatalogDb();
  return db.companies;
}

export async function getCatalogCountries() {
  const db = await readCatalogDb();
  return db.countries;
}

export async function getCatalogDepartments(countryCode: string) {
  const db = await readCatalogDb();
  return db.departmentsByCountry[countryCode] ?? [];
}

export async function getCatalogCities(departmentCode: string, countryCode?: string) {
  const db = await readCatalogDb();
  const cities = db.citiesByDepartment[departmentCode] ?? [];
  if (!countryCode) return cities;
  const validDepartmentCodes = new Set((db.departmentsByCountry[countryCode] ?? []).map((item) => item.code));
  return validDepartmentCodes.has(departmentCode) ? cities : [];
}

export async function getCatalogMultidata(group: string) {
  const db = await readCatalogDb();
  return db.multidataByGroup[group] ?? [];
}

export async function resolveSocialOnboarding(email: string, provider: SocialProvider): Promise<{flow: ResolveFlow; user: UserRecord | null}> {
  await ensureUserStatusCatalog();
  
  // 1. Check PlatformUser first
  const userRow = await getPool().query('SELECT * FROM "PlatformUser" WHERE lower("user_email")=lower($1) LIMIT 1', [email]);
  if ((userRow.rowCount ?? 0) > 0) {
    const user = mapRowToUser(userRow.rows[0]);
    if (user.provider !== provider) {
      return {flow: "PROVIDER_CONFLICT", user};
    }
    if (user.status === "pending_approval") {
      return {flow: "PENDING_ONLY", user};
    }
    if (user.status === "inactive") {
      return {flow: "FORM_REQUIRED", user};
    }
    return {flow: "ACTIVE", user};
  }

  // 2. Check Onboarding table
  const onboardingRow = await getPool().query('SELECT * FROM "Onboarding" WHERE lower("email")=lower($1) LIMIT 1', [email]);
  if ((onboardingRow.rowCount ?? 0) > 0) {
    const ob = onboardingRow.rows[0];
    const obProvider = ob.provider as SocialProvider;
    
    const obUser: UserRecord = {
      id: String(ob.id),
      email: String(ob.email),
      firstName: String(ob.name ?? ""),
      lastName: String(ob.last_name ?? ""),
      fullName: `${String(ob.name ?? "")} ${String(ob.last_name ?? "")}`.trim(),
      phone: String(ob.phone_number ?? ""),
      companyId: String(ob.companyId ?? ""),
      countryCode: String(ob.country_code ?? ""),
      country: String(ob.country_iso ?? ""),
      department: String(ob.department_code ?? ""),
      city: String(ob.city_code ?? ""),
      dni: String(ob.dni ?? ""),
      birthDate: ob.birth_date ? new Date(ob.birth_date).toISOString() : "",
      gender: String(ob.gender ?? ""),
      status: normalizeStatus(String(ob.status)),
      provider: obProvider,
      avatar: ob.avatar ? String(ob.avatar) : undefined,
      createdAt: new Date(ob.created_at).toISOString(),
      updatedAt: new Date(ob.updated_at).toISOString()
    };

    if (obProvider !== provider) {
      return {flow: "PROVIDER_CONFLICT", user: obUser};
    }
    if (obUser.status === "pending_approval") {
      return {flow: "PENDING_ONLY", user: obUser};
    }
    return {flow: "FORM_REQUIRED", user: obUser};
  }

  return {flow: "FORM_REQUIRED", user: null};
}

export async function submitSocialOnboarding(input: OnboardingSubmitInput) {
  await ensureUserStatusCatalog();

  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedDni = input.dni.trim();
  const allRequired = [
    input.firstName,
    input.lastName,
    input.phone,
    input.companyId,
    input.countryCode,
    input.country,
    input.department,
    input.city,
    normalizedDni,
    input.birthDate,
    input.gender,
    normalizedEmail
  ].every((value) => value.trim().length > 0);
  if (!allRequired) {
    throw new Error("All required fields must be provided");
  }

  const catalogs = await readCatalogDb();
  const validCountryCodes = new Set<string>([
    ...(catalogs.multidataByGroup.countryCode ?? []).map((item) => item.value),
    ...catalogs.countries.map((item) => item.prefixArea)
  ]);
  assertCatalogValue(catalogs.companies.some((c) => c.id === input.companyId), "Invalid company");
  assertCatalogValue(validCountryCodes.has(input.countryCode), "Invalid country code");
  assertCatalogValue(catalogs.countries.some((item) => item.code === input.country), "Invalid country");
  assertCatalogValue((catalogs.departmentsByCountry[input.country] ?? []).some((item) => item.code === input.department), "Invalid department");
  assertCatalogValue((catalogs.citiesByDepartment[input.department] ?? []).some((item) => item.code === input.city), "Invalid city");
  assertCatalogValue((catalogs.multidataByGroup.gender ?? []).some((item) => item.value === input.gender), "Invalid gender");

  const duplicateUser = await getPool().query(
    'SELECT "provider" FROM "PlatformUser" WHERE "country_code"=$1 AND "dni"=$2 AND lower("user_email")<>lower($3) LIMIT 1',
    [input.countryCode, normalizedDni, normalizedEmail]
  );
  const duplicateOnboarding = await getPool().query(
    'SELECT "provider" FROM "Onboarding" WHERE "country_code"=$1 AND "dni"=$2 AND lower("email")<>lower($3) LIMIT 1',
    [input.countryCode, normalizedDni, normalizedEmail]
  );
  if ((duplicateUser.rowCount ?? 0) > 0) {
    const existingProvider = duplicateUser.rows[0].provider || "google";
    throw new Error(`DNI_CONFLICT:${existingProvider}`);
  }
  if ((duplicateOnboarding.rowCount ?? 0) > 0) {
    const existingProvider = duplicateOnboarding.rows[0].provider || "google";
    throw new Error(`DNI_CONFLICT:${existingProvider}`);
  }

  // Verify that the user is not already fully active in PlatformUser
  const existingUserResult = await getPool().query('SELECT * FROM "PlatformUser" WHERE lower("user_email")=lower($1) LIMIT 1', [normalizedEmail]);
  if ((existingUserResult.rowCount ?? 0) > 0) {
    throw new Error("User is already fully registered on the platform");
  }

  const existingResult = await getPool().query('SELECT * FROM "Onboarding" WHERE lower("email")=lower($1) LIMIT 1', [normalizedEmail]);
  const id = (existingResult.rowCount ?? 0) > 0 ? String(existingResult.rows[0].id) : nextId("ONB");
  const previousStatus = (existingResult.rowCount ?? 0) > 0 ? normalizeStatus(String(existingResult.rows[0].status)) : null;
  const previousProvider = (existingResult.rowCount ?? 0) > 0 ? String(existingResult.rows[0].provider) : null;

  if (previousProvider && previousProvider !== input.provider) {
    throw new Error(`User already linked with provider ${previousProvider}`);
  }

  const birthDateValue = input.birthDate ? input.birthDate : null;
  const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

  await getPool().query(
    `
      INSERT INTO "Onboarding" (
        "id","email","name","last_name","phone_number","companyId","country_code","country_iso","department_code","city_code","dni","birth_date","gender","status","provider","avatar","metadata","created_at","updated_at"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW()
      )
      ON CONFLICT ("email")
      DO UPDATE SET
        "name"=EXCLUDED."name",
        "last_name"=EXCLUDED."last_name",
        "phone_number"=EXCLUDED."phone_number",
        "companyId"=EXCLUDED."companyId",
        "country_code"=EXCLUDED."country_code",
        "country_iso"=EXCLUDED."country_iso",
        "department_code"=EXCLUDED."department_code",
        "city_code"=EXCLUDED."city_code",
        "dni"=EXCLUDED."dni",
        "birth_date"=EXCLUDED."birth_date",
        "gender"=EXCLUDED."gender",
        "status"=EXCLUDED."status",
        "provider"=EXCLUDED."provider",
        "avatar"=EXCLUDED."avatar",
        "metadata"=EXCLUDED."metadata",
        "updated_at"=NOW()
    `,
    [
      id,
      normalizedEmail,
      input.firstName,
      input.lastName,
      input.phone,
      input.companyId,
      input.countryCode,
      input.country,
      input.department,
      input.city,
      normalizedDni,
      birthDateValue,
      input.gender,
      "pending_approval",
      input.provider,
      input.avatar ?? null,
      metadataJson
    ]
  );

  await getPool().query(
    `INSERT INTO "AuditLog" (id,"actorType","actorId",action,entity,"entityId",metadata,"createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())`,
    [
      nextId("ONAUDIT"),
      "system",
      normalizedEmail,
      (existingResult.rowCount ?? 0) > 0 ? "update-onboarding" : "create-onboarding",
      "Onboarding",
      id,
      JSON.stringify({provider: input.provider, fromStatus: previousStatus, toStatus: "pending_approval"})
    ]
  );

  const saved = await getPool().query('SELECT * FROM "Onboarding" WHERE "id"=$1', [id]);
  const row = saved.rows[0];
  return {
    id: String(row.id),
    email: String(row.email),
    firstName: String(row.name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: `${String(row.name ?? "")} ${String(row.last_name ?? "")}`.trim(),
    phone: String(row.phone_number ?? ""),
    companyId: String(row.companyId ?? ""),
    countryCode: String(row.country_code),
    country: String(row.country_iso ?? ""),
    department: String(row.department_code ?? ""),
    city: String(row.city_code ?? ""),
    dni: String(row.dni),
    birthDate: String(row.birth_date),
    gender: String(row.gender),
    status: normalizeStatus(String(row.status)),
    provider: String(row.provider ?? "google") as SocialProvider,
    avatar: row.avatar ? String(row.avatar) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function cancelSocialOnboarding(input: OnboardingCancelInput) {
  await ensureUserStatusCatalog();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedDni = input.dni?.trim() || null;

  const existingResult = await getPool().query('SELECT * FROM "Onboarding" WHERE lower("email")=lower($1) LIMIT 1', [normalizedEmail]);
  const id = (existingResult.rowCount ?? 0) > 0 ? String(existingResult.rows[0].id) : nextId("ONB");
  const previousStatus = (existingResult.rowCount ?? 0) > 0 ? normalizeStatus(String(existingResult.rows[0].status)) : null;

  const birthDateValue = input.birthDate ? input.birthDate : null;
  const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

  await getPool().query(
    `
      INSERT INTO "Onboarding" (
        "id","email","name","last_name","phone_number","companyId","country_code","country_iso","department_code","city_code","dni","birth_date","gender","status","provider","avatar","metadata","created_at","updated_at"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW()
      )
      ON CONFLICT ("email")
      DO UPDATE SET
        "name"=COALESCE(EXCLUDED."name", "Onboarding"."name"),
        "last_name"=COALESCE(EXCLUDED."last_name", "Onboarding"."last_name"),
        "phone_number"=COALESCE(EXCLUDED."phone_number", "Onboarding"."phone_number"),
        "companyId"=COALESCE(EXCLUDED."companyId", "Onboarding"."companyId"),
        "country_code"=COALESCE(EXCLUDED."country_code", "Onboarding"."country_code"),
        "country_iso"=COALESCE(EXCLUDED."country_iso", "Onboarding"."country_iso"),
        "department_code"=COALESCE(EXCLUDED."department_code", "Onboarding"."department_code"),
        "city_code"=COALESCE(EXCLUDED."city_code", "Onboarding"."city_code"),
        "dni"=COALESCE(EXCLUDED."dni", "Onboarding"."dni"),
        "birth_date"=COALESCE(EXCLUDED."birth_date", "Onboarding"."birth_date"),
        "gender"=COALESCE(EXCLUDED."gender", "Onboarding"."gender"),
        "status"=EXCLUDED."status",
        "provider"=EXCLUDED."provider",
        "avatar"=COALESCE(EXCLUDED."avatar", "Onboarding"."avatar"),
        "metadata"=EXCLUDED."metadata",
        "updated_at"=NOW()
    `,
    [
      id,
      normalizedEmail,
      input.firstName || null,
      input.lastName || null,
      input.phone || null,
      input.companyId || null,
      input.countryCode || null,
      input.country || null,
      input.department || null,
      input.city || null,
      normalizedDni,
      birthDateValue,
      input.gender || null,
      "failed",
      input.provider,
      input.avatar || null,
      metadataJson
    ]
  );

  await getPool().query(
    `INSERT INTO "AuditLog" (id,"actorType","actorId",action,entity,"entityId",metadata,"createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())`,
    [
      nextId("ONAUDIT"),
      "system",
      normalizedEmail,
      "cancel-onboarding",
      "Onboarding",
      id,
      JSON.stringify({provider: input.provider, fromStatus: previousStatus, toStatus: "failed"})
    ]
  );
}

export async function listPendingApprovals() {
  await ensureUserStatusCatalog();
  const rows = await getPool().query('SELECT * FROM "Onboarding" WHERE "status"=$1 ORDER BY "created_at" DESC', ["pending_approval"]);
  return rows.rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    firstName: String(row.name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: `${String(row.name ?? "")} ${String(row.last_name ?? "")}`.trim(),
    phone: String(row.phone_number ?? ""),
    companyId: String(row.companyId ?? ""),
    countryCode: String(row.country_code),
    country: String(row.country_iso ?? ""),
    department: String(row.department_code ?? ""),
    city: String(row.city_code ?? ""),
    dni: String(row.dni),
    birthDate: String(row.birth_date),
    gender: String(row.gender),
    status: normalizeStatus(String(row.status)),
    provider: String(row.provider ?? "google") as SocialProvider,
    avatar: row.avatar ? String(row.avatar) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }));
}

export async function updateApprovalStatus(userId: string, actor: string, action: "approve" | "reject") {
  await ensureUserStatusCatalog();
  
  const current = await getPool().query('SELECT * FROM "Onboarding" WHERE "id"=$1 LIMIT 1', [userId]);
  if ((current.rowCount ?? 0) === 0) {
    throw new Error("Onboarding record not found");
  }
  const ob = current.rows[0];

  const nextStatus = action === "approve" ? "active" : "inactive";

  await getPool().query('UPDATE "Onboarding" SET "status"=$1, "updated_at"=NOW() WHERE "id"=$2', [nextStatus, userId]);

  if (action === "approve") {
    const existingUser = await getPool().query('SELECT * FROM "PlatformUser" WHERE lower("user_email")=lower($1) LIMIT 1', [ob.email]);
    const platformUserId = (existingUser.rowCount ?? 0) > 0 ? String(existingUser.rows[0].id_user_pk) : nextId("USR");

    await getPool().query(
      `
      INSERT INTO "PlatformUser" (
        "id_user_pk","user_email","username","name","last_name","phone_number","companyId","country_code","country_iso","department_code","city_code","dni","birth_date","gender","status","provider","avatar","created_at","updated_at"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW()
      )
      ON CONFLICT ("user_email")
      DO UPDATE SET
        "name"=EXCLUDED."name",
        "last_name"=EXCLUDED."last_name",
        "phone_number"=EXCLUDED."phone_number",
        "companyId"=EXCLUDED."companyId",
        "country_code"=EXCLUDED."country_code",
        "country_iso"=EXCLUDED."country_iso",
        "department_code"=EXCLUDED."department_code",
        "city_code"=EXCLUDED."city_code",
        "dni"=EXCLUDED."dni",
        "birth_date"=EXCLUDED."birth_date",
        "gender"=EXCLUDED."gender",
        "status"=EXCLUDED."status",
        "provider"=EXCLUDED."provider",
        "avatar"=EXCLUDED."avatar",
        "updated_at"=NOW()
      `,
      [
        platformUserId,
        ob.email,
        ob.email,
        ob.name,
        ob.last_name,
        ob.phone_number,
        ob.companyId,
        ob.country_code,
        ob.country_iso,
        ob.department_code,
        ob.city_code,
        ob.dni,
        ob.birth_date,
        ob.gender,
        "active",
        ob.provider,
        ob.avatar
      ]
    );

    await getPool().query(
      `INSERT INTO "AuditLog" (id,"actorType","actorId",action,entity,"entityId",metadata,"createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())`,
      [
        nextId("ONAUDIT"),
        "system",
        actor,
        "approve-user",
        "PlatformUser",
        platformUserId,
        JSON.stringify({fromStatus: "pending_approval", toStatus: "active"})
      ]
    );

    let roleId: string | null = null;
    if (ob.metadata) {
      try {
        const meta = typeof ob.metadata === "string" ? JSON.parse(ob.metadata) : ob.metadata;
        roleId = meta?.roleId || null;
      } catch (err) {
        console.error("Error parsing onboarding metadata", err);
      }
    }

    if (roleId) {
      const { calculateRoleAssignmentSecurityHash } = await import("@/server/pgDynamicDbStore");
      const hashPermission = await calculateRoleAssignmentSecurityHash(platformUserId, roleId, ob.companyId);
      const userRoleId = `UR-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      await getPool().query(
        `INSERT INTO public."UserRole" (id, platform_user_id, "roleId", hash_permission, company_id, "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (platform_user_id, "roleId", company_id) 
         DO UPDATE SET hash_permission = EXCLUDED.hash_permission`,
        [userRoleId, platformUserId, roleId, hashPermission, ob.companyId]
      );

      const roleRow = await getPool().query('SELECT name FROM public."Role" WHERE id = $1 LIMIT 1', [roleId]);
      if (roleRow.rows.length > 0) {
        const roleName = roleRow.rows[0].name;
        await getPool().query('UPDATE public."PlatformUser" SET position = $1 WHERE id_user_pk = $2', [roleName, platformUserId]);
      }
    }
  }

  await getPool().query(
    `INSERT INTO "AuditLog" (id,"actorType","actorId",action,entity,"entityId",metadata,"createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())`,
    [
      nextId("ONAUDIT"),
      "system",
      actor,
      action === "approve" ? "approve-onboarding" : "reject-onboarding",
      "Onboarding",
      userId,
      JSON.stringify({fromStatus: String(ob.status), toStatus: nextStatus})
    ]
  );

  const updated = await getPool().query('SELECT * FROM "Onboarding" WHERE "id"=$1', [userId]);
  const row = updated.rows[0];
  return {
    id: String(row.id),
    email: String(row.email),
    firstName: String(row.name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: `${String(row.name ?? "")} ${String(row.last_name ?? "")}`.trim(),
    phone: String(row.phone_number ?? ""),
    companyId: String(row.companyId ?? ""),
    countryCode: String(row.country_code),
    country: String(row.country_iso ?? ""),
    department: String(row.department_code ?? ""),
    city: String(row.city_code ?? ""),
    dni: String(row.dni),
    birthDate: String(row.birth_date),
    gender: String(row.gender),
    status: normalizeStatus(String(row.status)),
    provider: String(row.provider ?? "google") as SocialProvider,
    avatar: row.avatar ? String(row.avatar) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
