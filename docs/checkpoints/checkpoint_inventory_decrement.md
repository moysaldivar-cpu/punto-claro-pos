# Checkpoint: Inventario POS Punto Claro

## Estado
✅ CERRADO  
Fecha: 2026-01-26

---

## Contexto
Este checkpoint documenta la corrección definitiva del problema de
**descuento de inventario tras una venta** en el POS Punto Claro.

El problema fue intermitente, silencioso y difícil de rastrear.

---

## Problema original
El inventario **NO se descontaba de forma persistente**:

- A veces bajaba y “rebotaba”
- A veces no bajaba nada
- No aparecían errores visibles
- La venta se registraba correctamente

Inicialmente se sospechó de:
- Supabase
- RLS
- Triggers
- Transacciones

Todo lo anterior era incorrecto.

---

## Causa raíz (CRÍTICO)
❌ **Desalineación Frontend → Datos reales de inventory**

La UI enviaba `product_id` que:
- No correspondían exactamente a filas válidas en `inventory`
- O no coincidían con el `store_id` activo

Consecuencia:
- El `UPDATE inventory` no encontraba filas
- SQL no lanzaba error
- El sistema fallaba **en silencio**

🚨 Importante:
- **NO era Supabase**
- **NO era RLS**
- **NO eran los triggers**

Era falta de validación estricta entre frontend y backend.

---

## Solución aplicada (DEFINITIVA)

### Backend (Supabase / SQL)

Se reforzó el RPC `create_sale_with_items` con reglas estrictas:

- Función configurada como:
  - `SECURITY DEFINER`
  - `SET row_security = off`
- Validaciones explícitas:
  - `store_id` obligatorio
  - `product_id` obligatorio
  - Stock suficiente antes de descontar
- Regla crítica:
  - El `UPDATE inventory` **DEBE afectar EXACTAMENTE 1 fila**
  - Si no afecta ninguna → `RAISE EXCEPTION`

**Regla de oro:**
> Si el inventario no baja, la venta **DEBE fallar**.

No se permiten ventas “fantasma”.

---

### Frontend (React / POS)

Se expuso el payload real enviado al RPC para validación visual:

```ts
console.log("RPC PAYLOAD >>>", payload)
