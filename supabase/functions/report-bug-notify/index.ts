// Edge Function: report-bug-notify
// Recibe { id } de un bug_report ya guardado y lo envía por correo (Resend).
// Si no hay RESEND_API_KEY configurada, responde { emailed: false } sin error.
// Requiere sesión autenticada (cualquier usuario).
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('BUG_MAIL_FROM') ?? 'RAT UTalca (bugs) <onboarding@resend.dev>';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'no_token' }, 401);
  const asCaller = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u } = await asCaller.auth.getUser();
  if (!u?.user) return json({ error: 'invalid_token' }, 401);

  if (!RESEND_API_KEY) return json({ ok: true, emailed: false, reason: 'no_resend_key' });

  let id: string;
  try {
    id = (await req.json()).id;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!id) return json({ error: 'missing_id' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data: bug } = await admin.from('bug_reports').select('*').eq('id', id).maybeSingle();
  if (!bug) return json({ error: 'not_found' }, 404);

  const { data: setting } = await admin
    .from('app_settings').select('value').eq('key', 'bug.notify_email').maybeSingle();
  const to = typeof setting?.value === 'string' ? setting.value : 'davidlaawl@gmail.com';

  const errs = Array.isArray(bug.console_errors) && bug.console_errors.length
    ? `<p><b>Errores de consola:</b></p><pre style="font-size:11px;background:#f4f4f4;padding:8px;border-radius:4px">${escapeHtml(
        JSON.stringify(bug.console_errors, null, 2),
      )}</pre>`
    : '';
  const html = `
    <h2 style="margin:0 0 4px">🐞 Nuevo reporte — RAT UTalca</h2>
    <p style="font-size:15px"><b>${escapeHtml(bug.title)}</b></p>
    <p style="white-space:pre-wrap">${escapeHtml(bug.description)}</p>
    <hr>
    <p style="font-size:13px;color:#444">
      <b>Reporta:</b> ${escapeHtml(bug.reporter_email ?? bug.reporter_user_id ?? '—')} (${escapeHtml(bug.role_hint ?? '—')})<br>
      <b>Ruta:</b> ${escapeHtml(bug.route ?? '—')}<br>
      <b>URL:</b> ${escapeHtml(bug.url ?? '—')}<br>
      <b>Navegador:</b> ${escapeHtml(bug.user_agent ?? '—')} · <b>Viewport:</b> ${escapeHtml(bug.viewport ?? '—')}<br>
      <b>Commit:</b> ${escapeHtml(bug.app_commit ?? '—')}
    </p>
    ${errs}
    <p style="color:#999;font-size:12px">id: ${bug.id} · ${bug.created_at}</p>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: `🐞 ${bug.title}`, html }),
    });
    if (!r.ok) return json({ ok: true, emailed: false, reason: `resend_${r.status}` });
    return json({ ok: true, emailed: true });
  } catch (e) {
    return json({ ok: true, emailed: false, reason: String(e) });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
