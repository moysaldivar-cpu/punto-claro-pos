import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type UserRole = "admin" | "gerente" | "cajero";

type CreatePosUserBody = {
  nombre?: string;
  pin?: string;
  rol?: UserRole;
  store_id?: string;
  store_ids?: string[];
  activo?: boolean;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function makeEmailSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 60);
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Metodo no permitido." },
        { status: 405 }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return Response.json(
        { error: "Usuario no autenticado." },
        { status: 401 }
      );
    }

    const {
      data: { user: callerUser },
      error: callerError,
    } = await ctx.supabaseAdmin.auth.getUser(token);

    if (callerError || !callerUser) {
      console.error(
        "Token de administrador invalido:",
        callerError?.message ?? "sin usuario"
      );

      return Response.json(
        { error: "Usuario no autenticado." },
        { status: 401 }
      );
    }

    const { data: adminRows, error: adminError } = await ctx.supabaseAdmin
      .from("pos_users")
      .select("id")
      .eq("auth_user_id", callerUser.id)
      .eq("rol", "admin")
      .eq("activo", true)
      .limit(1);

    if (adminError) {
      console.error("Error verificando administrador:", adminError);

      return Response.json(
        { error: "No se pudo verificar el administrador." },
        { status: 500 }
      );
    }

    if (!adminRows || adminRows.length === 0) {
      return Response.json(
        { error: "No tienes permisos para crear usuarios." },
        { status: 403 }
      );
    }

    let body: CreatePosUserBody;

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Solicitud invalida." },
        { status: 400 }
      );
    }

    const nombre = body.nombre?.trim() ?? "";
    const pin = body.pin?.trim() ?? "";
    const rol = body.rol;
    const storeId = body.store_id?.trim() ?? "";
    const activo =
      typeof body.activo === "boolean" ? body.activo : true;

    if (!nombre) {
      return Response.json(
        { error: "Escribe el nombre del usuario." },
        { status: 400 }
      );
    }

    if (!/^\d{8}$/.test(pin)) {
      return Response.json(
        { error: "El PIN debe contener exactamente 8 digitos." },
        { status: 400 }
      );
    }

    if (!rol || !["admin", "gerente", "cajero"].includes(rol)) {
      return Response.json(
        { error: "Rol invalido." },
        { status: 400 }
      );
    }

    if (!storeId || !UUID_REGEX.test(storeId)) {
      return Response.json(
        { error: "Selecciona una sucursal principal valida." },
        { status: 400 }
      );
    }

    let managerStoreIds: string[] = [storeId];

    if (rol === "gerente") {
      const requestedStoreIds = Array.isArray(body.store_ids)
        ? body.store_ids
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean)
        : [];

      if (requestedStoreIds.some((id) => !UUID_REGEX.test(id))) {
        return Response.json(
          { error: "Una de las sucursales seleccionadas no es valida." },
          { status: 400 }
        );
      }

      managerStoreIds = Array.from(
        new Set([storeId, ...requestedStoreIds])
      );
    }

    const storeIdsToValidate =
      rol === "gerente" ? managerStoreIds : [storeId];

    const { data: storeRows, error: storesError } =
      await ctx.supabaseAdmin
        .from("pos_stores")
        .select("id, is_active")
        .in("id", storeIdsToValidate);

    if (storesError) {
      console.error("Error verificando sucursales:", storesError);

      return Response.json(
        { error: "No se pudieron verificar las sucursales." },
        { status: 500 }
      );
    }

    if (!storeRows || storeRows.length !== storeIdsToValidate.length) {
      return Response.json(
        { error: "Una o mas sucursales no existen." },
        { status: 400 }
      );
    }

    if (storeRows.some((store) => store.is_active === false)) {
      return Response.json(
        { error: "No puedes asignar una sucursal inactiva." },
        { status: 400 }
      );
    }

    const { data: existingUsers, error: existingUsersError } =
      await ctx.supabaseAdmin
        .from("pos_users")
        .select("id, nombre");

    if (existingUsersError) {
      console.error(
        "Error verificando nombres existentes:",
        existingUsersError
      );

      return Response.json(
        { error: "No se pudo verificar el nombre del usuario." },
        { status: 500 }
      );
    }

    const normalizedNewName = normalizeName(nombre);

    const duplicateName = (existingUsers ?? []).some(
      (user) =>
        typeof user.nombre === "string" &&
        normalizeName(user.nombre) === normalizedNewName
    );

    if (duplicateName) {
      return Response.json(
        {
          error:
            "Ya existe un usuario con ese nombre. Usa un nombre diferente.",
        },
        { status: 409 }
      );
    }

    const emailSlug = makeEmailSlug(nombre);

    if (!emailSlug) {
      return Response.json(
        { error: "No se pudo generar el acceso para ese nombre." },
        { status: 400 }
      );
    }

    const internalEmail =
      `${emailSlug}@punto-claro-pos.example.com`;

    const {
      data: authCreateData,
      error: authCreateError,
    } = await ctx.supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: pin,
      email_confirm: true,
    });

    if (authCreateError || !authCreateData.user) {
      console.error(
        "Error creando usuario en Supabase Auth:",
        authCreateError?.message ?? "sin usuario"
      );

      return Response.json(
        {
          error:
            "No se pudo crear la cuenta de acceso. Verifica que el nombre no genere un acceso ya existente.",
        },
        { status: 500 }
      );
    }

    const authUserId = authCreateData.user.id;

    async function cleanup(
      posUserId: string | null,
      authId: string
    ) {
      try {
        if (posUserId) {
          await ctx.supabaseAdmin
            .from("pos_user_stores")
            .delete()
            .eq("user_id", posUserId);

          await ctx.supabaseAdmin
            .from("pos_users")
            .delete()
            .eq("id", posUserId);
        }

        await ctx.supabaseAdmin.auth.admin.deleteUser(authId);
      } catch (cleanupError) {
        console.error(
          "Error durante limpieza de usuario incompleto:",
          cleanupError
        );
      }
    }

    const {
      data: newPosUser,
      error: posUserError,
    } = await ctx.supabaseAdmin
      .from("pos_users")
      .insert({
        nombre,
        password: null,
        rol,
        store_id: storeId,
        activo,
        auth_user_id: authUserId,
      })
      .select("id, nombre, rol, store_id, activo")
      .single();

    if (posUserError || !newPosUser) {
      console.error(
        "Error creando usuario POS:",
        posUserError
      );

      await cleanup(null, authUserId);

      return Response.json(
        { error: "No se pudo crear el usuario POS." },
        { status: 500 }
      );
    }

    if (rol === "gerente") {
      const rows = managerStoreIds.map((managerStoreId) => ({
        user_id: newPosUser.id,
        store_id: managerStoreId,
      }));

      const { error: managerStoresError } =
        await ctx.supabaseAdmin
          .from("pos_user_stores")
          .insert(rows);

      if (managerStoresError) {
        console.error(
          "Error asignando sucursales al gerente:",
          managerStoresError
        );

        await cleanup(newPosUser.id, authUserId);

        return Response.json(
          {
            error:
              "No se pudieron asignar las sucursales. El usuario incompleto fue eliminado.",
          },
          { status: 500 }
        );
      }
    }

    return Response.json({
      ok: true,
      user_id: newPosUser.id,
      nombre: newPosUser.nombre,
      rol: newPosUser.rol,
      store_id: newPosUser.store_id,
      store_ids:
        rol === "gerente" ? managerStoreIds : [storeId],
      activo: newPosUser.activo,
    });
  }),
};
