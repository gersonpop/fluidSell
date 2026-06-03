"use client";

import {useEffect, useMemo, useState} from "react";
import {signOut} from "next-auth/react";

type Props = {
  locale: string;
  email: string;
  provider: "google" | "facebook" | "linkedin";
  defaultFullName: string;
  defaultAvatar?: string;
  conflictingProvider?: "google" | "facebook" | "linkedin" | null;
};

export function OnboardingClient({locale, email, provider, defaultFullName, defaultAvatar, conflictingProvider}: Props) {
  const [companies, setCompanies] = useState<Array<{id: string; name: string}>>([]);
  const [genders, setGenders] = useState<Array<{value: string; label: string}>>([]);
  const [countries, setCountries] = useState<Array<{code: string; label: string; prefixArea?: string}>>([]);
  const [departments, setDepartments] = useState<Array<{code: string; label: string}>>([]);
  const [cities, setCities] = useState<Array<{code: string; label: string}>>([]);
  const [roles, setRoles] = useState<Array<{id: string; name: string}>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(!!conflictingProvider);
  const [showDniConflictModal, setShowDniConflictModal] = useState(false);
  const [dniConflictProvider, setDniConflictProvider] = useState<string | null>(null);

  const defaultNameParts = defaultFullName.trim().split(/\s+/).filter(Boolean);
  const defaultFirstName = defaultNameParts.slice(0, 1).join(" ");
  const defaultLastName = defaultNameParts.slice(1).join(" ");

  const [form, setForm] = useState({
    firstName: defaultFirstName,
    lastName: defaultLastName,
    phone: "",
    companyId: "",
    roleId: "",
    countryCode: "",
    country: "",
    department: "",
    city: "",
    dni: "",
    birthDate: "",
    gender: "",
    avatar: (typeof defaultAvatar === "string" ? defaultAvatar : "") as string
  });

  useEffect(() => {
    async function loadBaseCatalogs() {
      const cacheKey = "onboarding_bootstrap";
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            setCompanies(data.companies ?? []);
            setGenders(data.genders ?? []);
            setCountries(data.countries ?? []);
            return;
          } catch {
            // Ignore parse error
          }
        }
      }

      const response = await fetch("/api/v1/auth/social/onboarding/bootstrap");
      const data = await response.json();

      const uniqueByValue = <T extends {value: string}>(items: T[]) => {
        const seen = new Set<string>();
        return items.filter((item) => {
          if (seen.has(item.value)) return false;
          seen.add(item.value);
          return true;
        });
      };

      const rawGenders = (data.genders ?? []) as Array<{value: string; label: string}>;
      const finalGenders = uniqueByValue(rawGenders);
      setCompanies(data.companies ?? []);
      setGenders(finalGenders);
      setCountries(data.countries ?? []);

      if (typeof window !== "undefined") {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            companies: data.companies ?? [],
            genders: finalGenders,
            countries: data.countries ?? []
          })
        );
      }
    }
    void loadBaseCatalogs();
  }, []);

  useEffect(() => {
    if (!form.country) {
      return;
    }
    async function loadDepartments() {
      const cacheKey = `onboarding_deps_${form.country}`;
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            setDepartments(data ?? []);
            return;
          } catch {
            // Ignore parse error
          }
        }
      }

      const response = await fetch(`/api/v1/auth/social/onboarding/departments?countryCode=${encodeURIComponent(form.country)}`);
      const data = await response.json();
      const items = data.items ?? [];
      setDepartments(items);

      if (typeof window !== "undefined") {
        localStorage.setItem(cacheKey, JSON.stringify(items));
      }
    }
    void loadDepartments();
  }, [form.country]);

  useEffect(() => {
    if (!form.department) {
      return;
    }
    async function loadCities() {
      const cacheKey = `onboarding_cities_${form.country}_${form.department}`;
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            setCities(data ?? []);
            return;
          } catch {
            // Ignore parse error
          }
        }
      }

      const response = await fetch(
        `/api/v1/auth/social/onboarding/cities?countryCode=${encodeURIComponent(form.country)}&departmentCode=${encodeURIComponent(form.department)}`
      );
      const data = await response.json();
      const items = data.items ?? [];
      setCities(items);

      if (typeof window !== "undefined") {
        localStorage.setItem(cacheKey, JSON.stringify(items));
      }
    }
    void loadCities();
  }, [form.country, form.department]);

  useEffect(() => {
    if (!form.companyId) {
      setRoles([]);
      setForm((p) => ({ ...p, roleId: "" }));
      return;
    }
    async function loadRoles() {
      try {
        const response = await fetch(`/api/v1/auth/social/onboarding/roles?companyId=${encodeURIComponent(form.companyId)}`);
        const data = await response.json();
        setRoles(data.items ?? []);
      } catch (err) {
        console.error("Error loading roles", err);
      }
    }
    void loadRoles();
  }, [form.companyId]);

  const valid = useMemo(
    () =>
      [
        form.firstName,
        form.lastName,
        form.phone,
        form.companyId,
        form.roleId,
        form.countryCode,
        form.country,
        form.department,
        form.city,
        form.dni,
        form.birthDate,
        form.gender
      ].every((value) => value.trim().length > 0),
    [form]
  );

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/v1/upload", {
        method: "POST",
        headers: {
          Authorization: "Bearer local-dev-token",
          "x-oauth-session": "active",
          "x-actor-id": "users-manager-ui",
          "x-actor-role": "SU",
          "x-company-id": ""
        },
        body: formData
      });

      const resBody = await response.json();
      if (!response.ok) {
        throw new Error(resBody.message || "Error al subir la imagen");
      }

      setForm((prev) => ({ ...prev, avatar: resBody.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/social/onboarding/submit", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          email,
          provider,
          ...form,
          phone: form.phone,
          metadata: {
            roleId: form.roleId
          }
        })
      });
      const data = await response.json();
      setSaving(false);

      if (!response.ok) {
        if (data.message && data.message.startsWith("DNI_CONFLICT:")) {
          const parts = data.message.split(":");
          const confProvider = parts[1] || "google";
          setDniConflictProvider(confProvider);
          setShowDniConflictModal(true);
          return;
        }
        setError(data.message ?? "No fue posible guardar");
        return;
      }

      window.location.href = `/${locale}/pending-approval`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
      setSaving(false);
    }
  }

  async function handleCancel() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/social/onboarding/cancel", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          email,
          provider,
          ...form,
          phone: form.phone
        })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message ?? "No fue posible cancelar el registro");
      }
      await signOut({callbackUrl: `/${locale}`});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar el registro");
      setSaving(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-full overflow-y-auto bg-cover bg-center bg-no-repeat py-8 px-4 flex items-center justify-center text-white"
      style={{backgroundImage: "url('/images/onboarding-brackgorund.png')"}}
    >
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />

      <main className="relative z-10 w-full max-w-3xl my-auto">
        <section className="liquid-card rounded-[2rem] p-6 sm:p-8">
          <span className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] border-2 border-white/20" />
          <span className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-12px_28px_rgba(255,255,255,0.05),0_18px_40px_rgba(2,23,56,0.2)]" />
          
          {/* Header: Two-column layout */}
          <div className="grid grid-cols-12 gap-5 items-center mb-6">
            {/* Left: Avatar (5/12) */}
            <div className="col-span-5 flex flex-col items-center justify-center py-2 select-none">
              <div
                onClick={() => document.getElementById("avatar-file-input")?.click()}
                className="h-48 w-48 rounded-full border-2 border-white/20 hover:border-purple-400 shadow-lg relative overflow-hidden group cursor-pointer bg-white/10 flex items-center justify-center transition-all duration-200"
              >
                {typeof form.avatar === "string" && form.avatar && (form.avatar.startsWith("http://") || form.avatar.startsWith("https://") || form.avatar.startsWith("/")) ? (
                  <img
                    src={form.avatar}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 text-2xl font-bold text-white uppercase">
                    {`${form.firstName || "?"}${form.lastName || "?"}`.trim().split(/\s+/).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                  </div>
                )}

                <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col items-center justify-center text-white p-1 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mb-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  <span className="text-[9px] font-extrabold uppercase tracking-wide">Subir Foto</span>
                </div>

                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  </div>
                )}
              </div>

              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <span className="text-[10px] text-slate-300 font-semibold mt-2 text-center leading-tight">
                {form.avatar ? "Imagen cargada" : "Haz clic para subir"}
              </span>

              {defaultAvatar && form.avatar !== defaultAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, avatar: defaultAvatar }));
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-purple-300 hover:text-purple-200 bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-0.5 rounded-full transition cursor-pointer shadow-sm"
                >
                  <span>Usar foto de red social</span>
                </button>
              )}
            </div>

            {/* Right: Company, DNI, Names (7/12) */}
            <div className="col-span-7 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200 mb-1">FluidSell</p>
                <h1 className="text-xl font-semibold leading-7 tracking-tight text-white lg:text-2xl lg:leading-8">Completa tu registro</h1>
                <p className="text-xs leading-5 text-slate-300 mt-1">Tu cuenta quedará en revisión hasta que un administrador la apruebe.</p>
              </div>

              <select
                value={form.companyId}
                onChange={(e) => setForm((p) => ({...p, companyId: e.target.value}))}
                className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-2.5 text-sm text-white outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
              >
                <option value="" className="bg-slate-900 text-white">Empresa</option>
                {companies.map((item) => (
                  <option key={item.id} value={item.id} className="bg-slate-900 text-white">{item.name}</option>
                ))}
              </select>
              <select
                value={form.roleId}
                onChange={(e) => setForm((p) => ({...p, roleId: e.target.value}))}
                disabled={!form.companyId}
                className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-2.5 text-sm text-white outline-none transition-all focus:ring-4 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="bg-slate-900 text-white">Cargo / Puesto</option>
                {roles.map((item) => (
                  <option key={item.id} value={item.id} className="bg-slate-900 text-white">{item.name}</option>
                ))}
              </select>
              <input
                value={form.dni}
                onChange={(e) => setForm((p) => ({...p, dni: e.target.value}))}
                className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-2.5 text-sm text-white placeholder-white/50 outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
                placeholder="DNI / Identificación"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({...p, firstName: e.target.value}))}
                  className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-2.5 text-sm text-white placeholder-white/50 outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
                  placeholder="Nombres"
                />
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({...p, lastName: e.target.value}))}
                  className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-2.5 text-sm text-white placeholder-white/50 outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
                  placeholder="Apellidos"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <select
              value={form.country}
              onChange={(e) => {
                const nextCountry = e.target.value;
                const selectedCountry = countries.find((item) => item.code === nextCountry);
                setDepartments([]);
                setCities([]);
                setForm((p) => ({
                  ...p,
                  country: nextCountry,
                  countryCode: selectedCountry?.prefixArea ?? p.countryCode,
                  department: "",
                  city: ""
                }));
              }}
              className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-3 text-sm text-white outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
            >
              <option value="" className="bg-slate-900 text-white">País</option>
              {countries.map((item) => (
                <option key={item.code} value={item.code} className="bg-slate-900 text-white">{item.label}</option>
              ))}
            </select>
            <select
              value={form.department}
              onChange={(e) => {
                setCities([]);
                setForm((p) => ({...p, department: e.target.value, city: ""}));
              }}
              className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-3 text-sm text-white outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
            >
              <option value="" className="bg-slate-900 text-white">Estado/Provincia</option>
              {departments.map((item) => (
                <option key={item.code} value={item.code} className="bg-slate-900 text-white">{item.label}</option>
              ))}
            </select>
            <select
              value={form.city}
              onChange={(e) => setForm((p) => ({...p, city: e.target.value}))}
              className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-3 text-sm text-white outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
            >
              <option value="" className="bg-slate-900 text-white">Ciudad</option>
              {cities.map((item) => (
                <option key={item.code} value={item.code} className="bg-slate-900 text-white">{item.label}</option>
              ))}
            </select>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <input
                value={form.countryCode}
                readOnly
                className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/50 outline-none cursor-default"
                placeholder="Código"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({...p, phone: e.target.value.replace(/\D/g, "")}))}
                className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-3 text-sm text-white placeholder-white/50 outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
                placeholder="Teléfono"
              />
            </div>
            <input
              value={form.birthDate}
              onChange={(e) => setForm((p) => ({...p, birthDate: e.target.value}))}
              type="date"
              className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-3 text-sm text-white outline-none transition-all focus:ring-4 focus:ring-purple-500/20 [color-scheme:dark]"
            />
            <select
              value={form.gender}
              onChange={(e) => setForm((p) => ({...p, gender: e.target.value}))}
              className="w-full rounded-xl border border-white/10 bg-white/10 hover:border-white/20 focus:border-purple-400 focus:bg-white/15 px-4 py-3 text-sm text-white outline-none transition-all focus:ring-4 focus:ring-purple-500/20"
            >
              <option value="" className="bg-slate-900 text-white">Género</option>
              {genders.map((item) => (
                <option key={item.value} value={item.value} className="bg-slate-900 text-white">{item.label}</option>
              ))}
            </select>
          </div>

          {error ? <p className="mt-3 text-sm text-rose-400 font-medium">{error}</p> : null}

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
            <button
              disabled={!valid || saving}
              onClick={() => void submit()}
              className="w-full sm:w-2/3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 active:from-cyan-500 active:to-blue-600 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition-all duration-200 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 disabled:shadow-none"
            >
              {saving ? "Guardando..." : "Guardar y enviar a revisión"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCancel()}
              className="w-full sm:w-1/3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 px-5 py-3 font-semibold text-rose-200 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Cancelando..." : "Cancelar"}
            </button>
          </div>
        </section>
      </main>

      {showConflictModal && conflictingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md liquid-card rounded-[2rem] p-6 sm:p-8 text-white">
            <span className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] border-2 border-white/20" />
            <span className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-12px_28px_rgba(255,255,255,0.05),0_18px_40px_rgba(2,23,56,0.2)]" />
            
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-amber-400 animate-pulse">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold mb-2">Registro existente</h2>
              
              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                Tu correo electrónico ya se encuentra registrado en FluidSell utilizando la red social{" "}
                <span className="font-semibold text-sky-300">
                  {conflictingProvider === "google"
                    ? "Google"
                    : conflictingProvider === "facebook"
                    ? "Facebook"
                    : "LinkedIn"}
                </span>
                .
              </p>

              <div className="w-full">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void handleCancel();
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 active:from-cyan-500 active:to-blue-600 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Procesando..." : "Ir a iniciar sesión"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDniConflictModal && dniConflictProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md liquid-card rounded-[2rem] p-6 sm:p-8 text-white">
            <span className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] border-2 border-white/20" />
            <span className="pointer-events-none absolute inset-[1px] rounded-[1.95rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-12px_28px_rgba(255,255,255,0.05),0_18px_40px_rgba(2,23,56,0.2)]" />
            
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-amber-400 animate-pulse">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold mb-2">DNI ya registrado</h2>
              
              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                Este DNI ya se encuentra registrado con la red social{" "}
                <span className="font-semibold text-sky-300">
                  {dniConflictProvider === "google"
                    ? "Google"
                    : dniConflictProvider === "facebook"
                    ? "Facebook"
                    : "LinkedIn"}
                </span>
                . Cancela este registro e ingresa con esa red social.
              </p>

              <div className="w-full">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void handleCancel();
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 active:from-cyan-500 active:to-blue-600 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Procesando..." : "Ir a iniciar sesión"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
