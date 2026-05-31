"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SettingModule } from "@/app/[locale]/(protect)/setting/layout";

function isImageIcon(value: string | null) {
  if (!value) return false;
  const icon = value.trim().toLowerCase();
  return icon.startsWith("data:image/") || icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

function normalizeTextIcon(value: string | null) {
  const icon = String(value ?? "").trim();
  if (icon.length === 1 || icon.length === 2) return icon;
  return "◦";
}

type EmbeddedPatternProps = {
  locale: string;
  parentTitle: string;
  items: SettingModule[];
  activeRoute?: string;
  children: React.ReactNode;
};

export function EmbeddedPattern({ locale, parentTitle, items, activeRoute, children }: EmbeddedPatternProps) {
  const pathname = usePathname();
  const autoActiveRoute = `/${pathname.split("/").slice(2).join("/")}`;
  const resolvedActiveRoute = activeRoute ?? autoActiveRoute;

  const [width, setWidth] = useState(260);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const savedWidth = localStorage.getItem("embedded_menu_panel_width");
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= 180 && parsed <= 450) {
        setWidth(parsed);
      }
    }

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startResize = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = width;

    const doResize = (mouseMoveEvent: MouseEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(450, startWidth + deltaX));
      setWidth(newWidth);
      localStorage.setItem("embedded_menu_panel_width", String(newWidth));
    };

    const stopResize = () => {
      window.removeEventListener("mousemove", doResize);
      window.removeEventListener("mouseup", stopResize);
    };

    window.addEventListener("mousemove", doResize);
    window.addEventListener("mouseup", stopResize);
  }, [width]);

  return (
    <section className="embedded-pattern-container flex flex-col lg:flex-row h-full w-full gap-1 overflow-hidden">
      <aside
        id="menuPanel"
        style={{ width: isDesktop ? `${width}px` : "100%" }}
        className="embedded-menu-panel h-full rounded-2xl border border-slate-200 bg-white p-4 ml-0 text-slate-700 flex flex-col overflow-hidden shrink-0"
      >
        <h2 className="embedded-menu-title text-xs font-bold uppercase tracking-[0.12em] text-slate-400 border-b border-slate-100 pb-2">{parentTitle}</h2>
        <nav className="embedded-menu-nav mt-3 space-y-2 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
          {items.length === 0 ? <p className="text-xs text-slate-500">No hay módulos hijos activos.</p> : null}
          {items.map((item) => {
            const href = `/${locale}${item.route}`;
            const active = item.route === resolvedActiveRoute;
            return (
              <Link
                key={item.id}
                href={href}
                className={`embedded-menu-link flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition ${active
                    ? "embedded-menu-link-active border-cyan-300 bg-cyan-50 text-cyan-900 font-bold"
                    : "embedded-menu-link-inactive border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
              >
                <span className="embedded-menu-icon-wrapper grid h-7 w-7 place-items-center overflow-hidden rounded-lg text-xs leading-none bg-slate-100 border border-slate-200/50 text-slate-600 shrink-0">
                  {isImageIcon(item.icon) ? <img src={item.icon ?? ""} alt="icon" className="h-4 w-4 object-contain" /> : normalizeTextIcon(item.icon)}
                </span>
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Draggable resize divider handle */}
      <div
        onMouseDown={startResize}
        className="embedded-menu-resizer flex items-center justify-center select-none"
        title="Arrastra para cambiar el tamaño"
      >
        <div className="flex flex-col gap-1.5 text-slate-300/80 hover:text-slate-400/80 transition-colors">
          <span className="w-1 h-1 bg-current rounded-full"></span>
          <span className="w-1 h-1 bg-current rounded-full"></span>
          <span className="w-1 h-1 bg-current rounded-full"></span>
        </div>
      </div>

      <div id="contentPanel" className="embedded-content-panel h-full rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </section>
  );
}
