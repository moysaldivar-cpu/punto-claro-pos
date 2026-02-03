export type Role = "admin" | "gerente" | "cajero";

type Action =
  | "export"
  | "view_totals"
  | "view_history"
  | "view_sales_history"
  | "view_cash_register_history"
  | "create_users"
  | "config_system";

const matrix: Record<Role, Action[]> = {
  cajero: [
    // LO QUE SÍ PUEDE
  ],

  gerente: [
    "view_history",        // movimientos e inventario
  ],

  admin: [
    "export",
    "view_totals",
    "view_history",
    "view_sales_history",
    "view_cash_register_history",
    "create_users",
    "config_system",
  ],
};

export function can(role: Role | null | undefined, action: Action) {
  if (!role) return false;
  return matrix[role].includes(action);
}
