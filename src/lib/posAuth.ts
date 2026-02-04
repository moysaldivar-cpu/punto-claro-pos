import { supabase } from "./supabase";

export type PosUser = {
  id: string;
  nombre: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string;
};

export async function loginPos(nombre: string, password: string) {
  const { data, error } = await supabase
    .from("pos_users")
    .select("*")
    .eq("nombre", nombre)
    .eq("password", password)
    .eq("activo", true)
    .single();

  if (error || !data) {
    throw new Error("Usuario o contraseña incorrectos");
  }

  // Guardamos sesión local
  localStorage.setItem("pos_user", JSON.stringify(data));
  localStorage.setItem("store_id", data.store_id);

  return data as PosUser;
}

export function logoutPos() {
  localStorage.removeItem("pos_user");
  localStorage.removeItem("store_id");
}

export function getPosUser(): PosUser | null {
  const u = localStorage.getItem("pos_user");
  return u ? JSON.parse(u) : null;
}
