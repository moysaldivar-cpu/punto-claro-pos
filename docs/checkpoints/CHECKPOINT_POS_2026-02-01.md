# CHECKPOINT POS PUNTO CLARO — 2026-02-01

## 🔒 ESTADO GENERAL
Sistema POS en estado ESTABLE.
Frontend y backend sincronizados.
Navegación funcional, sin pantallas blancas.

---

## ✅ FUNCIONALIDADES CONFIRMADAS
- Punto de Venta (CajeroPOS) operativo
- Sidebar renderiza correctamente
- Routing corregido (sin doble BrowserRouter)
- AppShell con <Outlet /> funcionando
- Usuarios cargan correctamente vía RPC
- Ventas / Reportes / Configuración con placeholders
- Corte de caja accesible
- Inventario y Productos estables

---

## 🧠 DECISIONES TÉCNICAS CLAVE (NO CAMBIAR SIN RAZÓN)
- `BrowserRouter` vive SOLO en `main.tsx`
- `Router.tsx` usa únicamente `<Routes />`
- Sidebar NO se toca (rutas alineadas por alias en Router)
- `store_id` se obtiene desde `localStorage`
- `auth.users` NO se consulta desde frontend
- Datos de usuarios se obtienen vía RPC:
  - `get_users_with_roles()`

---

## 🔐 SUPABASE
- RPC activa:
  - `get_users_with_roles`
- RLS:
  - `profiles` y `products` temporalmente sin RLS
  - RLS pendiente de reactivarse con calma

---

## ⛔ ARCHIVOS CONGELADOS (NO TOCAR)
- `src/AppShell.tsx`
- `src/Router.tsx`
- `src/contexts/AuthContext.tsx`
- Lógica de POS (`CajeroPOS.tsx`) mientras no haya bug real

---

## ⚠️ RIESGOS CONOCIDOS
- RLS aún no reactivado
- Ventas reales aún no implementadas
- Placeholders sin lógica (intencional)

---

## 🎯 SIGUIENTE OBJETIVO
Implementar Ventas reales:
1. Lista de ventas (lectura)
2. Totales
3. Filtros
4. Detalle de venta

Siempre partiendo de este checkpoint.
