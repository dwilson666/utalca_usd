// Edge Function: users-invite
// Invita un usuario por correo institucional y le asigna rol + unidades.
// AUTORIZACIÓN (capa 2): el llamador debe tener `user.manage`. Se verifica con
// SU JWT antes de usar el service_role. El alta por auto-registro está deshabilitada.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const inviteSchema = z.object({
  email: z.string().email().endsWith('@utalca.cl'),
  full_name: z.string().trim().min(2),
  role_code: z.enum(['superadmin', 'dpd_admin', 'auditor', 'unit_manager', 'collaborator']),
  scope: z.enum(['global', 'unit']),
  unit_assignments: z
    .array(
      z.object({
        unit_id: z.string().uuid(),
        unit_role: z.enum(['jefe', 'colaborador', 'consulta']),
        includes_descendants: z.boolean().default(false),
      }),
    )
    .default([]),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  // Cliente con el JWT del llamador → sujeto a RLS y a app.has_perm().
  const asCaller = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authz, error: azErr } = await asCaller.rpc('my_authz');
  if (azErr) return json({ error: 'authz_check_failed', detail: azErr.message }, 500);
  if (!authz?.mfa) return json({ error: 'mfa_required' }, 403);
  if (!authz?.permissions?.includes('user.manage')) return json({ error: 'forbidden' }, 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'validation', issues: parsed.error.issues }, 422);
  const input = parsed.data;

  if (input.scope === 'global' && !['superadmin', 'dpd_admin', 'auditor'].includes(input.role_code)) {
    return json({ error: 'scope_role_mismatch' }, 422);
  }

  // service_role: solo a partir de aquí, ya verificada la autorización.
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name },
  });
  if (invErr || !invited?.user) {
    return json({ error: 'invite_failed', detail: invErr?.message }, 500);
  }
  const uid = invited.user.id;

  const { data: role } = await admin.from('roles').select('id').eq('code', input.role_code).single();
  if (!role) return json({ error: 'role_not_found' }, 500);

  const { error: urErr } = await admin
    .from('user_roles')
    .upsert({ user_id: uid, role_id: role.id, scope: input.scope, granted_by: authz.user_id });
  if (urErr) return json({ error: 'role_assign_failed', detail: urErr.message }, 500);

  if (input.unit_assignments.length) {
    const { error: uaErr } = await admin.from('user_unit_assignments').upsert(
      input.unit_assignments.map((a) => ({
        user_id: uid,
        unit_id: a.unit_id,
        unit_role: a.unit_role,
        includes_descendants: a.includes_descendants,
        granted_by: authz.user_id,
      })),
    );
    if (uaErr) return json({ error: 'unit_assign_failed', detail: uaErr.message }, 500);
  }

  // El trigger trg_audit sobre user_roles / user_unit_assignments ya deja el
  // registro en audit_log; no hace falta un write_audit explícito aquí.
  return json({ ok: true, user_id: uid });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}
