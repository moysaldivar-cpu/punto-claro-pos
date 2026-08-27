import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logoutPosAuth } from "@/lib/posAuth";

type PosUser = {
  id: string;
  nombre: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string | null;

  // Compatibilidad con codigo viejo
  role?: string;
  email?: string;
};

type CurrentPosUserRow = {
  id: string;
  nombre: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string | null;
};

type CurrentPosUserStoreRow = {
  store_id: string;
  store_name: string;
  is_active: boolean;
  auto_print_ticket: boolean;
};

type ContextType = {
  user: PosUser | null;
  loading: boolean;
  logout: () => Promise<void>;

  // Compatibilidad con codigo viejo
  signOut?: () => Promise<void>;
};

const PosAuthContext = createContext<ContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  signOut: async () => {},
});

function clearLocalPosSession() {
  localStorage.removeItem("pos_user");
  localStorage.removeItem("store_id");
}

function readStoredStoreId(): string | null {
  const storeId = localStorage.getItem("store_id");
  return storeId || null;
}

function saveValidatedPosUser(user: PosUser) {
  localStorage.setItem("pos_user", JSON.stringify(user));

  if (user.store_id) {
    localStorage.setItem("store_id", user.store_id);
  } else {
    localStorage.removeItem("store_id");
  }
}

export function PosAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PosUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadValidatedSession() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          clearLocalPosSession();

          if (active) {
            setUser(null);
          }

          return;
        }

        const { data, error } = await supabase.rpc(
          "get_current_pos_users"
        );

        if (error) {
          throw error;
        }

        const rows = (data || []) as CurrentPosUserRow[];

        if (rows.length === 0) {
          await logoutPosAuth();

          if (active) {
            setUser(null);
          }

          return;
        }

        const storedStoreId = readStoredStoreId();
        let validatedUser: PosUser | null = null;

        // PROVISIONAL u otra identidad vinculada a varias filas POS.
        if (rows.length > 1) {
          const selectedRow = storedStoreId
            ? rows.find((row) => row.store_id === storedStoreId)
            : null;

          if (!selectedRow) {
            await logoutPosAuth();

            if (active) {
              setUser(null);
            }

            return;
          }

          validatedUser = {
            id: selectedRow.id,
            nombre: selectedRow.nombre,
            rol: selectedRow.rol,
            store_id: selectedRow.store_id,
            role: selectedRow.rol,
          };
        } else {
          const row = rows[0];

          // Gerente: validar que la sucursal activa este realmente asignada.
          if (row.rol === "gerente") {
            const { data: storesData, error: storesError } =
              await supabase.rpc("get_current_pos_user_stores");

            if (storesError) {
              throw storesError;
            }

            const stores = (storesData || []) as CurrentPosUserStoreRow[];

            const validStore = storedStoreId
              ? stores.find(
                  (store) =>
                    store.store_id === storedStoreId &&
                    store.is_active
                )
              : null;

            if (!validStore) {
              await logoutPosAuth();

              if (active) {
                setUser(null);
              }

              return;
            }

            validatedUser = {
              id: row.id,
              nombre: row.nombre,
              rol: row.rol,
              store_id: validStore.store_id,
              role: row.rol,
            };
          } else {
            validatedUser = {
              id: row.id,
              nombre: row.nombre,
              rol: row.rol,
              store_id: row.store_id,
              role: row.rol,
            };
          }
        }

        saveValidatedPosUser(validatedUser);

        if (active) {
          setUser(validatedUser);
        }
      } catch (error) {
        console.error("Error validando sesion POS:", error);
        clearLocalPosSession();

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadValidatedSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearLocalPosSession();

        if (active) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    try {
      await logoutPosAuth();
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  }

  async function signOut() {
    await logout();
  }

  return (
    <PosAuthContext.Provider
      value={{
        user,
        loading,
        logout,
        signOut,
      }}
    >
      {children}
    </PosAuthContext.Provider>
  );
}

export function usePosAuth() {
  return useContext(PosAuthContext);
}

// ADAPTADORES PARA QUE TODO LO VIEJO SIGA FUNCIONANDO
export const AuthProvider = PosAuthProvider;
export const useAuth = usePosAuth;
