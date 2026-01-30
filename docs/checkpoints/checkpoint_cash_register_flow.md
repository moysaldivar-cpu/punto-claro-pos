# Checkpoint: Flujo de Caja – POS Punto Claro

## Estado
🟡 EN PROGRESO  
Fecha: 2026-01-26

---

## Objetivo de este checkpoint
Documentar y cerrar el flujo completo de caja:
abrir → vender → cerrar,
sin romper ventas ni inventario.

---

## Estado actual del sistema (ANTES DE CAMBIOS)

### Qué SÍ existe
- Tabla `cash_register_closures`
- Apertura de caja registrada en BD
- Ventas se asocian a una caja abierta
- Inventario descuenta correctamente al vender

### Qué NO existe todavía
- Cierre formal de caja
- Totales calculados al cerrar
- Botón de “Cerrar caja” en UI
- Validación estricta: venta solo con caja abierta

---

## Regla actual implícita
El sistema permite vender mientras exista una
caja abierta, pero no controla aún el cierre.

Esto se documenta antes de modificar comportamiento.
---

## Regla oficial del flujo de caja (A DEFINIR Y CERRAR)

### Regla 1 — Caja obligatoria
❌ No se permite ninguna venta si NO existe una caja abierta
para la sucursal activa.

### Regla 2 — Una sola caja abierta
Solo puede existir **UNA caja abierta por sucursal** al mismo tiempo.

### Regla 3 — Asociación obligatoria
Toda venta debe:
- Tener `cash_register_id`
- Estar asociada a la caja abierta activa
- Fallar si no existe caja válida

### Regla 4 — Cierre explícito
El cierre de caja:
- Se ejecuta de forma explícita
- Calcula totales reales desde ventas
- Marca la caja como cerrada
- Impide nuevas ventas hasta nueva apertura

Estas reglas se implementarán primero en backend
y después reflejadas en la UI.
CHECKPOINT: Caja v1
- Apertura backend
- Venta validada
- Cierre con totales
Estado validado:
- Venta real ejecutada
- Inventario descontado correctamente
- Cierre con totales verificado en BD
