import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ FALTAN VARIABLES DE SUPABASE EN VERCEL");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 👇 ESTO ARREGLA EL ERROR DE CONSOLA
if (typeof window !== "undefined") {
  (window as any).supabase = supabase;
}
