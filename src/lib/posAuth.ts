import { supabase } from "./supabase";

export type PosUser = {
  id: string;
  nombre: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string | null;
};

export type PosUserStore = {
  store_id: string;
  store_name: string;
  is_active: boolean;
  auto_print_ticket: boolean;
};

type LoginPosUserRow = {
  id: string;
  nombre: string;
  rol: string;
  store_id: string | null;
};

type GetPosUserStoresRow = {
  store_id: string;
  store_name: string;
  is_active: boolean;
  auto_print_ticket: boolean;
};

function clearSupabaseAuthTokens() {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (!key) continue;

    if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

export async function loginPos(nombre: string, password: string) {
  const cleanNombre = nombre.trim();

  clearSupabaseAuthTokens();

  const { data, error } = await supabase.rpc("login_pos_user", {
    p_nombre: cleanNombre,
    p_password: password,
  });

  if (error) {
    throw new Error(`Error consultando usuarios POS: ${error.message}`);
  }

  const rows = (data || []) as LoginPosUserRow[];

  if (rows.length === 0) {
    throw new Error("Usuario o contraseña incorrectos");
  }

  const row = rows[0];

  const user: PosUser = {
    id: row.id,
    nombre: row.nombre,
    rol: row.rol as PosUser["rol"],
    store_id: row.store_id,
  };

  localStorage.setItem("pos_user", JSON.stringify(user));

  if (user.store_id) {
    localStorage.setItem("store_id", user.store_id);
  } else {
    localStorage.removeItem("store_id");
  }

  return user;
}

export async function getPosUserStores(userId: string) {
  const { data, error } = await supabase.rpc("get_pos_user_stores", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Error consultando sucursales del usuario: ${error.message}`);
  }

  return ((data || []) as GetPosUserStoresRow[]).filter((store) => store.is_active);
}

export function setActiveStoreForSession(user: PosUser, storeId: string) {
  const updatedUser: PosUser = {
    ...user,
    store_id: storeId,
  };

  localStorage.setItem("pos_user", JSON.stringify(updatedUser));
  localStorage.setItem("store_id", storeId);

  return updatedUser;
}

export function logoutPos() {
  localStorage.removeItem("pos_user");
  localStorage.removeItem("store_id");
  clearSupabaseAuthTokens();
}

export function getPosUser(): PosUser | null {
  const u = localStorage.getItem("pos_user");

  if (!u) return null;

  try {
    return JSON.parse(u) as PosUser;
  } catch {
    localStorage.removeItem("pos_user");
    return null;
  }
}