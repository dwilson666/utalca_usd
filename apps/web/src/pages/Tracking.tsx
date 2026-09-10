import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENGAGEMENT_STAGES, ENGAGEMENT_STAGE_LABEL, can, type EngagementStage } from '@rat/shared';
import {
  deleteContact,
  fetchContacts,
  fetchTracking,
  saveContact,
  saveEngagement,
  type Contact,
  type EngagementRow,
} from '../lib/trackingApi';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader, QueryState } from '../components/ui';

const STAGE_TONE: Record<EngagementStage, string> = {
  no_contactada: 'neutral',
  contactada: 'info',
  agendada: 'accent',
  reunion_realizada: 'accent',
  en_seguimiento: 'warning',
  levantamiento_completo: 'success',
};

export function Tracking() {
  const qc = useQueryClient();
  const { authz } = useAuth();
  const canManage = can(authz, 'tracking.manage');
  const q = useQuery({ queryKey: ['tracking'], queryFn: fetchTracking });
  const [filter, setFilter] = useState<EngagementStage | ''>('');
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const stageMut = useMutation({
    mutationFn: ({ unitId, patch }: { unitId: string; patch: Parameters<typeof saveEngagement>[1] }) =>
      saveEngagement(unitId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracking'] }),
    onError: (e) => setErr(e instanceof Error ? e.message : 'No se pudo guardar.'),
  });

  const rows = useMemo(
    () => (q.data ?? []).filter((r) => !filter || r.stage === filter),
    [q.data, filter],
  );

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of q.data ?? []) m[r.stage] = (m[r.stage] ?? 0) + 1;
    return m;
  }, [q.data]);

  return (
    <>
      <PageHeader
        eyebrow="Gestión del DPD"
        title="Seguimiento del levantamiento"
        sub="Estado del contacto y las reuniones con cada unidad. Módulo separado del RAT."
      />

      <QueryState isLoading={q.isLoading} error={q.error}>
        <div className="kpis" style={{ marginBottom: 16 }}>
          {ENGAGEMENT_STAGES.map((s) => (
            <button
              key={s}
              className="kpi"
              style={{ textAlign: 'left', cursor: 'pointer', border: filter === s ? '1px solid var(--brand)' : undefined }}
              onClick={() => setFilter(filter === s ? '' : s)}
            >
              <div className="n">{counts[s] ?? 0}</div>
              <div className="l">{ENGAGEMENT_STAGE_LABEL[s]}</div>
            </button>
          ))}
        </div>

        {err && <div className="callout callout--crit" style={{ marginBottom: 12 }}>{err}</div>}

        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Etapa</th>
                <th>Contacto</th>
                <th>Reunión</th>
                <th>Contactos</th>
                <th>RAT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <TrackingRow
                  key={r.unit_id}
                  r={r}
                  canManage={canManage}
                  open={openUnit === r.unit_id}
                  onToggleOpen={() => setOpenUnit(openUnit === r.unit_id ? null : r.unit_id)}
                  onStage={(stage) => { setErr(null); stageMut.mutate({ unitId: r.unit_id, patch: { stage } }); }}
                  onSave={(patch) => { setErr(null); stageMut.mutate({ unitId: r.unit_id, patch }); }}
                  busy={stageMut.isPending}
                />
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ padding: 20 }}>Sin unidades en esta etapa.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </QueryState>
    </>
  );
}

function TrackingRow({
  r,
  canManage,
  open,
  onToggleOpen,
  onStage,
  onSave,
  busy,
}: {
  r: EngagementRow;
  canManage: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onStage: (s: EngagementStage) => void;
  onSave: (patch: Parameters<typeof saveEngagement>[1]) => void;
  busy: boolean;
}) {
  return (
    <>
      <tr>
        <td><b style={{ fontSize: 13 }}>{r.unit_name}</b></td>
        <td>
          {canManage ? (
            <select value={r.stage} disabled={busy} onChange={(e) => onStage(e.target.value as EngagementStage)}>
              {ENGAGEMENT_STAGES.map((s) => <option key={s} value={s}>{ENGAGEMENT_STAGE_LABEL[s]}</option>)}
            </select>
          ) : (
            <span className={`pill pill--${STAGE_TONE[r.stage]}`}>{ENGAGEMENT_STAGE_LABEL[r.stage]}</span>
          )}
        </td>
        <td className="mono" style={{ fontSize: 12 }}>{r.contacted_on ?? '—'}</td>
        <td className="mono" style={{ fontSize: 12 }}>{r.meeting_on ?? '—'}</td>
        <td className="mono">{r.contacts}</td>
        <td className="mono">{r.activities}</td>
        <td>
          <button className="btn btn--ghost" style={{ fontSize: 12, padding: '3px 8px' }} onClick={onToggleOpen}>
            {open ? 'Cerrar' : 'Detalle'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--sunken)', padding: 14 }}>
            <EngagementDetail r={r} canManage={canManage} onSave={onSave} busy={busy} />
          </td>
        </tr>
      )}
    </>
  );
}

function EngagementDetail({
  r,
  canManage,
  onSave,
  busy,
}: {
  r: EngagementRow;
  canManage: boolean;
  onSave: (patch: Parameters<typeof saveEngagement>[1]) => void;
  busy: boolean;
}) {
  const [contactedOn, setContactedOn] = useState(r.contacted_on ?? '');
  const [meetingOn, setMeetingOn] = useState(r.meeting_on ?? '');
  const [pending, setPending] = useState(r.pending_items ?? '');
  const [notes, setNotes] = useState(r.notes ?? '');
  const dirty =
    contactedOn !== (r.contacted_on ?? '') ||
    meetingOn !== (r.meeting_on ?? '') ||
    pending !== (r.pending_items ?? '') ||
    notes !== (r.notes ?? '');

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Fecha de contacto</span>
            <input type="date" value={contactedOn} disabled={!canManage} onChange={(e) => setContactedOn(e.target.value)} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Fecha de reunión</span>
            <input type="date" value={meetingOn} disabled={!canManage} onChange={(e) => setMeetingOn(e.target.value)} />
          </label>
        </div>
        <label className="field" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Pendientes</span>
          <textarea rows={2} value={pending} disabled={!canManage} onChange={(e) => setPending(e.target.value)} style={{ resize: 'vertical' }} />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notas</span>
          <textarea rows={2} value={notes} disabled={!canManage} onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
        </label>
        {canManage && dirty && (
          <button
            className="btn btn--primary"
            disabled={busy}
            style={{ justifySelf: 'start' }}
            onClick={() => onSave({
              contacted_on: contactedOn || null,
              meeting_on: meetingOn || null,
              pending_items: pending.trim() || null,
              notes: notes.trim() || null,
            })}
          >
            Guardar seguimiento
          </button>
        )}
      </div>

      <ContactsPanel unitId={r.unit_id} canManage={canManage} />
    </div>
  );
}

function ContactsPanel({ unitId, canManage }: { unitId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['contacts', unitId], queryFn: () => fetchContacts(unitId) });
  const [adding, setAdding] = useState(false);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['contacts', unitId] });
    void qc.invalidateQueries({ queryKey: ['tracking'] });
  };
  const saveMut = useMutation({ mutationFn: saveContact, onSuccess: () => { invalidate(); setAdding(false); } });
  const delMut = useMutation({ mutationFn: deleteContact, onSuccess: invalidate });

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Contactos de la unidad</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {(q.data ?? []).map((c) => (
          <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '7px 9px', fontSize: 13, background: 'var(--surface)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <b>{c.full_name}</b>
              {c.position && <span className="muted" style={{ fontSize: 12 }}>{c.position}</span>}
              <span style={{ flex: 1 }} />
              {canManage && (
                <button className="btn btn--ghost" style={{ fontSize: 11, padding: '2px 6px' }} disabled={delMut.isPending} onClick={() => delMut.mutate(c.id)}>
                  Quitar
                </button>
              )}
            </div>
            {(c.email || c.phone) && (
              <div className="muted" style={{ fontSize: 12 }}>{[c.email, c.phone].filter(Boolean).join(' · ')}</div>
            )}
          </div>
        ))}
        {(q.data ?? []).length === 0 && <span className="muted" style={{ fontSize: 12 }}>Sin contactos.</span>}
      </div>

      {canManage && (adding ? (
        <ContactForm unitId={unitId} busy={saveMut.isPending} onCancel={() => setAdding(false)} onSave={(c) => saveMut.mutate(c)} />
      ) : (
        <button className="btn" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>+ Agregar contacto</button>
      ))}
    </div>
  );
}

function ContactForm({
  unitId,
  busy,
  onSave,
  onCancel,
}: {
  unitId: string;
  busy: boolean;
  onSave: (c: Omit<Contact, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
      <input placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Cargo" value={position} onChange={(e) => setPosition(e.target.value)} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
        <input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn--primary" disabled={name.trim().length < 2 || busy}
          onClick={() => onSave({ unit_id: unitId, full_name: name, position, email, phone, notes: null })}>
          Agregar
        </button>
        <button className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
