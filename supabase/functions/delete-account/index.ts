// Hesap silme — App Store ve Google Play zorunluluğu.
// Kullanıcı kendi JWT'siyle çağırır; fonksiyon kimliği doğrular ve
// service role ile auth kaydını siler (profiles -> cascade ile temizlenir).
// Deploy: npx supabase functions deploy delete-account
// (JWT doğrulaması AÇIK kalmalı — --no-verify-jwt KULLANMA)

import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Oturum doğrulanamadı" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  const admin = createClient(URL, SERVICE);
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    return new Response(JSON.stringify({ error: delErr.message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
});
