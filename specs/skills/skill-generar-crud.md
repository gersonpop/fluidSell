# Skill: Generador de Vistas CRUD Homogéneas y Premium

Esta skill define la especificación técnica, el diseño visual y el estándar de código para generar interfaces de administración de datos (CRUD) homogéneas dentro de la plataforma. Cualquier vista de gestión de datos (como la gestión de usuarios, roles u otras tablas) debe cumplir con esta estructura para garantizar una experiencia de usuario consistente, fluida y de alta gama.

---

## 1. Patrón Visual y Componentes de Interfaz

La vista CRUD se compone de cuatro zonas interactivas principales:

### A. Barra de Herramientas Superior (Filtros y Búsqueda)
*   **Buscador**: Campo de texto a la izquierda (`max-w-[44%]`) que realiza búsquedas instantáneas y seguras en memoria (reseteando la paginación a la página 1).
*   **Filtros de Categoría/Estado**: Menús desplegables (`<select>`) a la derecha para segmentar los datos de forma inmediata.
*   **Menú de Selección de Columnas (Show/Hide Columns)**: Botón con un dropdown flotante que contiene checkboxes para alternar la visibilidad de cada columna de la tabla en tiempo real.
*   **Botón Agregar**: Botón premium de acción principal (color de acento de la app) que abre el panel lateral en modo "Crear".

### B. Tabla de Datos Paginada y Dinámica
*   **Cabeceras Dinámicas**: Solo renderiza las columnas que están activas en el estado de `visibleColumns`.
*   **Menú Flotante de Fila (Acciones)**: Un botón de tres puntos verticales (`⋮`) que despliega de forma flotante las opciones de **Editar** y **Eliminar** para evitar saturar visualmente la fila.
*   **Paginación Limpia**: Barra inferior que indica el total de registros filtrados, selector de filas por página (5, 10, 20) y botones de navegación (previo/siguiente) con deshabilitación suave.

### C. Panel Lateral Deslizable (Slide-Over Drawer/Sheet)
*   **Animación de Entrada Premium**: Un panel que se desliza desde el borde derecho de la pantalla mediante transiciones CSS combinando clases de visibilidad y traducción de ejes (`translate-x-full` a `translate-x-0`).
*   **Capa de Fondo (Backdrop)**: Capa oscura translúcida con difuminado suave (`backdrop-blur-[2px]`) que cubre el resto de la pantalla y cierra el panel al hacer clic en ella.
*   **Formulario Dinámico**: Adaptado a los campos específicos de la tabla en base de datos.
*   **Acciones**: Botones de "Cancelar" (color rose/rojo destructivo suave) y "Guardar/Crear" (color de acento con estado de carga deshabilitado).

---

## 2. Integración Estándar con el Endpoint Dinámico `/api/v1/db/[table]`

Todas las operaciones se realizan mediante peticiones fetch al endpoint dinámico respetando las siguientes cabeceras de autorización de desarrollo/producción:

```typescript
const headers = {
  "Authorization": "Bearer local-dev-token",
  "x-oauth-session": "active",
  "x-actor-id": "admin-ui",
  "x-actor-role": "SU",
  "x-company-id": "" // Se rellena opcionalmente con el companyId del usuario logueado
};
```

### Operaciones del CRUD:
*   **GET (Listar)**: `fetch("/api/v1/db/[table]", { headers })`
*   **POST (Crear)**: `fetch("/api/v1/db/[table]", { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(formData) })`
*   **PATCH (Editar)**: `fetch("/api/v1/db/[table]", { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ id: selectedRowId, ...formData }) })`
*   **DELETE (Eliminar)**: `fetch("/api/v1/db/[table]", { method: "DELETE", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ id: rowId }) })`

---

## 3. Plantilla Base del Componente React (TSX)

```typescript
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

// 1. Definir columnas disponibles y por defecto
const DEFAULT_COLUMNS = ["id", "campo1", "campo2", "actions"];

export function DataManager() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMNS));
  const [openRowMenu, setOpenRowMenu] = useState<number | null>(null);
  
  // Estados del Drawer (Deslizable lateral)
  const [openDrawer, setOpenDrawer] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [actionMode, setActionMode] = useState("add"); // "add" | "edit"
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  
  // Estado del Formulario
  const [form, setForm] = useState({
    campo1: "",
    campo2: ""
  });

  // Carga de datos y lógica CRUD...
}
```
