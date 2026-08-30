import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type ResetPinBody = {
  target_pos_user_id?: string;
  pin?: string;
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Metodo no permitido." },
        { status: 405 }
      );
    }

    const callerAuthUserId = ctx.userClaims?.id;

    if (!callerAuthUserId) {
      return Response.json(
        { error: "Usuario no autenticado." },
        { status: 401 }
      );
    }

    const { data: adminRows, error: adminError } = await ctx.supabaseAdmin
      .from("pos_users")
      .select("id")
      .eq("auth_user_id", callerAuthUserId)
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
        { error: "No tienes permisos para restablecer PIN." },
        { status: 403 }
      );
    }

    let body: ResetPinBody;

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Solicitud invalida." },
        { status: 400 }
      );
    }

    const targetPosUserId = body.target_pos_user_id?.trim() ?? "";
    const pin = body.pin?.trim() ?? "";

    if (!targetPosUserId) {
      return Response.json(
        { error: "Falta el usuario objetivo." },
        { status: 400 }
      );
    }

    if (!/^\d{8}$/.test(pin)) {
      return Response.json(
        { error: "El PIN debe contener exactamente 8 digitos." },
        { status: 400 }
      );
    }

    const { data: targetUser, error: targetError } = await ctx.supabaseAdmin
      .from("pos_users")
      .select("id, nombre, auth_user_id")
      .eq("id", targetPosUserId)
      .maybeSingle();

    if (targetError) {
      console.error("Error consultando usuario objetivo:", targetError);
      return Response.json(
        { error: "No se pudo consultar el usuario." },
        { status: 500 }
      );
    }

    if (!targetUser) {
      return Response.json(
        { error: "Usuario POS no encontrado." },
        { status: 404 }
      );
    }

    if (!targetUser.auth_user_id) {
      return Response.json(
        { error: "El usuario todavia no esta vinculado a Supabase Auth." },
        { status: 409 }
      );
    }

    const { error: updateError } =
      await ctx.supabaseAdmin.auth.admin.updateUserById(
        targetUser.auth_user_id,
        {
          password: pin,
        }
      );

    if (updateError) {
      console.error("Error actualizando PIN en Supabase Auth:", updateError);
      return Response.json(
        { error: "No se pudo actualizar el PIN." },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      user_id: targetUser.id,
      nombre: targetUser.nombre,
    });
  }),
};
