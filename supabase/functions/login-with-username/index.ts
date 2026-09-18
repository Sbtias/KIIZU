import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const { username, password } = await req.json();
    const name = String(username ?? "").trim();

    if (!name || !password) return json({ error: "USERNAME_PASSWORD_REQUIRED" }, 400);

    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const secretKey = secretKeys.default;
    const publishableKey = publishableKeys.default;

    if (!secretKey || !publishableKey) return json({ error: "FUNCTION_KEYS_NOT_CONFIGURED" }, 500);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const client = createClient(Deno.env.get("SUPABASE_URL")!, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", name)
      .maybeSingle();

    if (profileError || !profile) return json({ error: "LOGIN_FAILED" }, 401);

    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(profile.id);

    if (userError || !userData.user?.email) return json({ error: "LOGIN_FAILED" }, 401);

    const { data: authData, error: authError } =
      await client.auth.signInWithPassword({
        email: userData.user.email,
        password: String(password)
      });

    if (authError || !authData.session) return json({ error: "LOGIN_FAILED" }, 401);

    return json({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token
    });
  } catch {
    return json({ error: "LOGIN_FAILED" }, 401);
  }
});
