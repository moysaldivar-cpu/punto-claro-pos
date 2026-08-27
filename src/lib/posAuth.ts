import { supabase } from "./supabase";

export type PosUser = {
  id: string;
  nombre: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string | null;
  store_name?: string | null;
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
  store_name?: string | null;
};

type GetPosUserStoresRow = {
  store_id: string;
  store_name: string;
  is_active: boolean;
  auto_print_ticket: boolean;
};

type CurrentPosUserRow = {
  id: string;
  nombre: string;
  rol: string;
  store_id: string | null;
  store_name: string | null;
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

/*
 * LOGIN LEGADO
 * Se conserva temporalmente mientras validamos Supabase Auth.
 */
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
    throw new Error("Usuario o contrasena incorrectos");
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

/*
 * LOGIN NUEVO CON SUPABASE AUTH
 * Todavia no es utilizado por Login.tsx.
 */
export async function loginPosWithAuth(
  nombre: string,
  password: string
): Promise<PosUser[]> {
  const cleanNombre = nombre.trim();

  const { data: resolvedEmail, error: resolveError } = await supabase.rpc(
    "resolve_pos_auth_email",
    {
      p_nombre: cleanNombre,
    }
  );

  if (resolveError) {
    throw new Error(`Error resolviendo usuario POS: ${resolveError.message}`);
  }

  const email =
    typeof resolvedEmail === "string" ? resolvedEmail.trim() : "";

  if (!email) {
    throw new Error("Usuario o PIN incorrectos");
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    throw new Error("Usuario o PIN incorrectos");
  }

  const { data, error } = await supabase.rpc("get_current_pos_users");

  if (error) {
    await supabase.auth.signOut();
    throw new Error(`Error consultando usuario autenticado: ${error.message}`);
  }

  const rows = (data || []) as CurrentPosUserRow[];

  if (rows.length === 0) {
    await supabase.auth.signOut();
    throw new Error("La cuenta autenticada no tiene un usuario POS activo");
  }

  const users = rows.map(
    (row): PosUser => ({
      id: row.id,
      nombre: row.nombre,
      rol: row.rol as PosUser["rol"],
      store_id: row.store_id,
      store_name: row.store_name,
    })
  );

  return users;
}

/*
 * SUCURSALES DEL USUARIO AUTENTICADO
 * Usa auth.uid() en PostgreSQL.
 */
export async function getCurrentPosUserStores(): Promise<PosUserStore[]> {
  const { data, error } = await supabase.rpc(
    "get_current_pos_user_stores"
  );

  if (error) {
    throw new Error(
      `Error consultando sucursales autenticadas: ${error.message}`
    );
  }

  return ((data || []) as GetPosUserStoresRow[]).filter(
    (store) => store.is_active
  );
}

/*
 * RPC LEGADO
 * Se conserva temporalmente.
 */
export async function getPosUserStores(userId: string) {
  const { data, error } = await supabase.rpc("get_pos_user_stores", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(
      `Error consultando sucursales del usuario: ${error.message}`
    );
  }

  return ((data || []) as GetPosUserStoresRow[]).filter(
    (store) => store.is_active
  );
}

export function setActiveStoreForSession(
  user: PosUser,
  storeId: string
) {
  const updatedUser: PosUser = {
    ...user,
    store_id: storeId,
  };

  localStorage.setItem("pos_user", JSON.stringify(updatedUser));
  localStorage.setItem("store_id", storeId);

  return updatedUser;
}

export function savePosUserSession(user: PosUser) {
  localStorage.setItem("pos_user", JSON.stringify(user));

  if (user.store_id) {
    localStorage.setItem("store_id", user.store_id);
  } else {
    localStorage.removeItem("store_id");
  }
}

export function logoutPos() {
  localStorage.removeItem("pos_user");
  localStorage.removeItem("store_id");
  clearSupabaseAuthTokens();
}

export async function logoutPosAuth() {
  localStorage.removeItem("pos_user");
  localStorage.removeItem("store_id");

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Error cerrando sesion: ${error.message}`);
  }
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
