# Checkpoint — Módulo Caja (Cash Register)

Proyecto: Punto Claro POS  
Stack: Vite + React + TypeScript + Supabase  
Fecha: 2026-01-28  

---

## ✅ Estado general

El módulo **Caja** quedó implementado y validado en su versión base, con flujo real y estable, sin romper ventas ni inventario.

La UI actual se considera **congelada** como base estable.

---

## 🔁 Flujo validado (end-to-end)

1. **Caja cerrada**
   - No hay registros en `cash_register_closures` con `closed_at IS NULL`
   - UI muestra estado: **CERRADA**
   - Botón **Abrir caja** habilitado
   - Botón **Cerrar caja** deshabilitado

2. **Abrir caja**
   - Acción explícita desde UI
   - INSERT en `cash_register_closures`:
     - `store_id`
     - `opened_at = now()`
     - `closed_at = NULL`
   - Regla: solo **1 caja abierta por sucursal**
   - UI actualiza estado a **ABIERTA**

3. **Ventas con caja abierta**
   - Las ventas se procesan normalmente
   - Inventario descuenta correctamente (vía RPC `create_sale_with_items`)
   - Cada venta queda asociada por `store_id`
   - El resumen de caja se calcula **solo con ventas creadas después de `opened_at`**

4. **Resumen de caja (tiempo real)**
   - Visible **solo si la caja está ABIERTA**
   - Incluye:
     - Número de ventas
     - Total de ventas
     - Total en efectivo (`payment_cash`)
     - Total en tarjeta (`payment_card`)
   - Regla clave:
     - NO incluye ventas hechas antes de abrir la caja actual

5. **Cerrar caja**
   - Acción explícita desde UI
   - UPDATE en `cash_register_closures`:
     - `closed_at = now()`
   - UI cambia estado a **CERRADA**
   - Resumen deja de mostrarse
   - Botón **Cerrar caja** se deshabilita

---

## 🔒 Reglas de negocio confirmadas

- Solo puede existir **una caja abierta por store**
- El período de la caja está definido por:
  - `opened_at` → inicio
  - `closed_at` → fin
- El resumen de caja:
  - NO espera al cierre
  - Se muestra en tiempo real
  - Solo cuenta ventas posteriores a la apertura

---

## 🧱 Regla de trabajo (muy importante)

### UI Inmutable

A partir de este checkpoint:

- ❌ No se deben quitar botones visibles
- ❌ No se debe cambiar layout existente
- ❌ No se deben mover textos validados
- ❌ No se deben alterar flujos ya claros

Todo nuevo desarrollo debe ser:
- Backend
- Lógica interna
- Documentación
- Validaciones invisibles

Cualquier cambio visual requiere autorización explícita.

---

## 🟢 Estado del módulo

✔️ Apertura de caja  
✔️ Cierre de caja  
✔️ Resumen de caja  
✔️ Integración UI ↔ Supabase  
✔️ Estabilidad confirmada  

Este checkpoint se considera **base sólida** para:
- Corte de caja
- Reportes
- Validaciones adicionales
