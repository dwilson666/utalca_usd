import type { WizardDraft, WizardStepKey } from '@rat/shared';
import { RETENTION_UNITS, RETENTION_UNIT_LABEL } from '@rat/shared';
import type { Catalogs } from '../../lib/catalogs';
import type { UnitOption } from '../../lib/units';
import { CheckList, Field, firstError, TextArea, TextInput, Toggle, type FieldErrors } from './fields';

export interface StepProps {
  draft: WizardDraft;
  set: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
  catalogs: Catalogs;
  units: UnitOption[];
  selectableUnits: UnitOption[];
  errors: FieldErrors;
}

const toggleIn = (arr: string[], id: string) =>
  arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

// ── 1 · Identificación ──────────────────────────────────────────────────────
function StepIdentificacion({ draft, set, selectableUnits, errors }: StepProps) {
  return (
    <>
      <Field label="Nombre de la actividad de tratamiento" required error={firstError(errors, 'title')}
        hint="Un nombre corto y reconocible, p. ej. «Gestión de becas socioeconómicas».">
        <TextInput value={draft.title} onChange={(v) => set('title', v)} invalid={!!errors['title']} />
      </Field>

      <Field label="Unidad responsable" required error={firstError(errors, 'responsible_unit_id')}
        hint="La unidad que decide sobre este tratamiento. Determina quién puede ver y editar el RAT.">
        <select
          value={draft.responsible_unit_id ?? ''}
          onChange={(e) => set('responsible_unit_id', e.target.value || null)}
        >
          <option value="">— Seleccione —</option>
          {selectableUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name_short}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Responsable interno de la actividad" required
        error={firstError(errors, 'operational_owner_name')}
        hint="Persona de la unidad que conoce el proceso y responde por su información (nombre y cargo).">
        <TextInput
          value={draft.operational_owner_name}
          onChange={(v) => set('operational_owner_name', v)}
          invalid={!!errors['operational_owner_name']}
        />
      </Field>
    </>
  );
}

// ── 2 · Finalidad y tratamiento ─────────────────────────────────────────────
function StepFinalidad({ draft, set, errors }: StepProps) {
  return (
    <>
      <Field label="Finalidad del tratamiento" required error={firstError(errors, 'purpose')}
        hint="Para qué se usan los datos. Sea específico: «verificar elegibilidad y pagar becas», no «gestión académica».">
        <TextArea value={draft.purpose} onChange={(v) => set('purpose', v)} invalid={!!errors['purpose']} />
      </Field>
      <Field label="Descripción del proceso" required error={firstError(errors, 'description')}
        hint="Cómo opera: quién recolecta, en qué sistemas se guarda, qué pasos sigue la información.">
        <TextArea value={draft.description} onChange={(v) => set('description', v)} rows={4}
          invalid={!!errors['description']} />
      </Field>
      <Field label="Origen de los datos" required error={firstError(errors, 'data_source')}
        hint="De dónde provienen: del propio titular, de otra unidad, de un organismo externo…">
        <TextInput value={draft.data_source} onChange={(v) => set('data_source', v)}
          invalid={!!errors['data_source']} />
      </Field>
    </>
  );
}

// ── 3 · Titulares y datos ───────────────────────────────────────────────────
function StepTitulares({ draft, set, catalogs, errors }: StepProps) {
  const anyProtected = catalogs.subjectCategories
    .filter((c) => draft.subject_category_ids.includes(c.id))
    .some((c) => c.is_protected_group);
  const anySensitive = catalogs.dataCategories
    .filter((c) => draft.data_category_ids.includes(c.id))
    .some((c) => c.is_sensitive);

  return (
    <>
      <Field label="Categorías de titulares" required error={firstError(errors, 'subject_category_ids')}
        hint="Los grupos de personas cuyos datos se tratan.">
        <CheckList
          options={catalogs.subjectCategories.map((c) => ({
            id: c.id,
            label: c.label,
            flag: c.is_protected_group ? 'grupo protegido' : undefined,
          }))}
          selected={draft.subject_category_ids}
          onToggle={(id) => set('subject_category_ids', toggleIn(draft.subject_category_ids, id))}
        />
      </Field>
      {anyProtected && (
        <div className="callout callout--warn" style={{ marginBottom: 16 }}>
          Incluye grupos protegidos (p. ej. NNA): el tratamiento exige mayor cuidado y, por lo general,
          una base de licitud reforzada.
        </div>
      )}

      <Field label="Categorías de datos" required error={firstError(errors, 'data_category_ids')}
        hint="Los tipos de dato personal involucrados. Los marcados como «sensible» activan requisitos adicionales.">
        <CheckList
          options={catalogs.dataCategories.map((c) => ({
            id: c.id,
            label: c.label,
            flag: c.is_sensitive ? 'sensible' : undefined,
          }))}
          selected={draft.data_category_ids}
          onToggle={(id) => set('data_category_ids', toggleIn(draft.data_category_ids, id))}
        />
      </Field>
      {anySensitive && (
        <div className="callout callout--warn" style={{ marginBottom: 4 }}>
          Trata <b>datos sensibles</b>. En el paso «Base jurídica» deberá declarar una base reforzada
          (consentimiento explícito o fines estadísticos) para poder enviar a revisión.
        </div>
      )}
    </>
  );
}

// ── 4 · Base jurídica ───────────────────────────────────────────────────────
function StepBaseJuridica({ draft, set, catalogs, errors }: StepProps) {
  const selected = new Set(draft.legal_bases.map((b) => b.legal_basis_id));
  function toggle(id: string) {
    if (selected.has(id)) {
      set('legal_bases', draft.legal_bases.filter((b) => b.legal_basis_id !== id));
    } else {
      set('legal_bases', [...draft.legal_bases, { legal_basis_id: id, justification: '' }]);
    }
  }
  function setJust(id: string, v: string) {
    set('legal_bases', draft.legal_bases.map((b) => (b.legal_basis_id === id ? { ...b, justification: v } : b)));
  }
  return (
    <Field label="Bases de licitud" required error={firstError(errors, 'legal_bases')}
      hint="El fundamento legal que habilita el tratamiento (art. 12–13 de la Ley 21.719). Puede declararse más de una.">
      <div style={{ display: 'grid', gap: 8 }}>
        {catalogs.legalBases.map((b) => {
          const on = selected.has(b.id);
          return (
            <div key={b.id} style={{
              border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 11px',
              background: on ? 'var(--brand-weak)' : 'var(--surface)',
            }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(b.id)} style={{ width: 'auto' }} />
                <span>
                  {b.label}
                  {b.requires_reinforced && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>
                      reforzada
                    </span>
                  )}
                </span>
              </label>
              {on && (
                <input
                  placeholder="Justificación (opcional)"
                  value={draft.legal_bases.find((x) => x.legal_basis_id === b.id)?.justification ?? ''}
                  onChange={(e) => setJust(b.id, e.target.value)}
                  style={{ marginTop: 7 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </Field>
  );
}

// ── 5 · Destinatarios y transferencias ──────────────────────────────────────
function StepDestinatarios({ draft, set, catalogs, errors }: StepProps) {
  function addRecipient() {
    const first = catalogs.recipientTypes[0];
    if (!first) return;
    set('recipients', [
      ...draft.recipients,
      { recipient_type_id: first.id, name: '', is_processor: first.is_processor, detail: '' },
    ]);
  }
  function patchRecipient(i: number, patch: Partial<WizardDraft['recipients'][number]>) {
    set('recipients', draft.recipients.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addTransfer() {
    set('transfers', [...draft.transfers, { country: '', guarantee_type_id: undefined, detail: '' }]);
  }
  function patchTransfer(i: number, patch: Partial<WizardDraft['transfers'][number]>) {
    set('transfers', draft.transfers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  return (
    <>
      <Field label="Destinatarios de los datos" required error={firstError(errors, 'recipients')}
        hint="A quién se comunican los datos. Si solo circulan dentro de la unidad, agregue «Unidades internas».">
        <div style={{ display: 'grid', gap: 8 }}>
          {draft.recipients.map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 10, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <select value={r.recipient_type_id} onChange={(e) => patchRecipient(i, { recipient_type_id: e.target.value })} style={{ flex: 1, minWidth: 180 }}>
                  {catalogs.recipientTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <button type="button" className="btn btn--ghost" onClick={() => set('recipients', draft.recipients.filter((_, idx) => idx !== i))}>
                  Quitar
                </button>
              </div>
              <input placeholder="Nombre concreto (p. ej. proveedor, organismo)" value={r.name}
                onChange={(e) => patchRecipient(i, { name: e.target.value })} />
              <Toggle checked={r.is_processor} onChange={(v) => patchRecipient(i, { is_processor: v })}
                label="Es un encargado de tratamiento (procesa por cuenta de la Universidad)" />
            </div>
          ))}
          <button type="button" className="btn" onClick={addRecipient}>+ Agregar destinatario</button>
        </div>
      </Field>

      <Field label="Transferencias internacionales"
        error={firstError(errors, 'transfers')}
        hint="Solo si los datos salen de Chile. Cada destino debe indicar su garantía (cláusulas tipo, país adecuado…).">
        <div style={{ display: 'grid', gap: 8 }}>
          {draft.transfers.map((t, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 10, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input placeholder="País de destino" value={t.country} onChange={(e) => patchTransfer(i, { country: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
                <select value={t.guarantee_type_id ?? ''} onChange={(e) => patchTransfer(i, { guarantee_type_id: e.target.value || undefined })} style={{ flex: 1, minWidth: 180 }}>
                  <option value="">— Garantía —</option>
                  {catalogs.transferGuaranteeTypes.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
                <button type="button" className="btn btn--ghost" onClick={() => set('transfers', draft.transfers.filter((_, idx) => idx !== i))}>Quitar</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn" onClick={addTransfer}>+ Agregar transferencia</button>
        </div>
      </Field>
    </>
  );
}

// ── 6 · Conservación ────────────────────────────────────────────────────────
function StepConservacion({ draft, set, catalogs, errors }: StepProps) {
  return (
    <>
      <Field label="Criterio de conservación" required error={firstError(errors, 'retention_criterion_id')}
        hint="Cómo se decide cuánto tiempo se conservan los datos.">
        <select value={draft.retention_criterion_id ?? ''} onChange={(e) => set('retention_criterion_id', e.target.value || null)}>
          <option value="">— Seleccione —</option>
          {catalogs.retentionCriteria.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Field label="Plazo (valor)">
          <input type="number" min={1} value={draft.retention_value ?? ''}
            onChange={(e) => set('retention_value', e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label="Unidad de tiempo">
          <select value={draft.retention_unit ?? ''} onChange={(e) => set('retention_unit', (e.target.value || null) as WizardDraft['retention_unit'])}>
            <option value="">—</option>
            {RETENTION_UNITS.map((u) => (
              <option key={u} value={u}>{RETENTION_UNIT_LABEL[u]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Detalle de la conservación"
        hint="Precise el plazo o la regla, p. ej. «5 años tras el egreso, luego anonimización».">
        <TextArea value={draft.retention_text} onChange={(v) => set('retention_text', v)} />
      </Field>
    </>
  );
}

// ── 7 · Automatización ──────────────────────────────────────────────────────
function StepAutomatizacion({ draft, set, errors }: StepProps) {
  function addDecision() {
    set('automated_decisions', [
      ...draft.automated_decisions,
      { description: '', stage: '', human_in_the_loop: true, produces_profiling: false },
    ]);
  }
  function patchDecision(i: number, patch: Partial<WizardDraft['automated_decisions'][number]>) {
    set('automated_decisions', draft.automated_decisions.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  return (
    <>
      <Field label="¿Hay decisiones automatizadas?" required
        hint="Decisiones que producen efectos sobre las personas y se toman sin intervención humana significativa.">
        <div style={{ display: 'grid', gap: 8 }}>
          <Toggle checked={draft.has_automated_decision} onChange={(v) => set('has_automated_decision', v)}
            label="Sí, este tratamiento incluye decisiones automatizadas" />
          <Toggle checked={draft.uses_ai} onChange={(v) => set('uses_ai', v)}
            label="Se emplean modelos de inteligencia artificial" />
        </div>
      </Field>

      {draft.has_automated_decision && (
        <Field label="Decisiones automatizadas" required error={firstError(errors, 'automated_decisions')}>
          <div style={{ display: 'grid', gap: 8 }}>
            {draft.automated_decisions.map((d, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 10, display: 'grid', gap: 6 }}>
                <input placeholder="Descripción de la decisión" value={d.description}
                  onChange={(e) => patchDecision(i, { description: e.target.value })} />
                <input placeholder="Etapa del proceso (opcional)" value={d.stage}
                  onChange={(e) => patchDecision(i, { stage: e.target.value })} />
                <Toggle checked={d.human_in_the_loop} onChange={(v) => patchDecision(i, { human_in_the_loop: v })}
                  label="Hay revisión humana antes de aplicar la decisión" />
                <Toggle checked={d.produces_profiling} onChange={(v) => patchDecision(i, { produces_profiling: v })}
                  label="Genera perfilamiento" />
                <button type="button" className="btn btn--ghost" onClick={() => set('automated_decisions', draft.automated_decisions.filter((_, idx) => idx !== i))}>
                  Quitar
                </button>
              </div>
            ))}
            <button type="button" className="btn" onClick={addDecision}>+ Agregar decisión</button>
          </div>
        </Field>
      )}

      <Field label="Sistemas propios que soportan el tratamiento"
        hint="Sistemas o aplicaciones de la Universidad donde reside la información.">
        <TextArea value={draft.own_systems_text} onChange={(v) => set('own_systems_text', v)} />
      </Field>
    </>
  );
}

// ── 8 · Seguridad ───────────────────────────────────────────────────────────
function StepSeguridad({ draft, set, catalogs, errors }: StepProps) {
  return (
    <Field label="Medidas de seguridad aplicadas" required error={firstError(errors, 'security_measure_ids')}
      hint="Los controles técnicos y organizativos que protegen esta información.">
      <CheckList
        options={catalogs.securityMeasures.map((m) => ({ id: m.id, label: m.label, hint: m.description ?? undefined }))}
        selected={draft.security_measure_ids}
        onToggle={(id) => set('security_measure_ids', toggleIn(draft.security_measure_ids, id))}
      />
    </Field>
  );
}

// ── 9 · Revisión ────────────────────────────────────────────────────────────
function StepRevision({ draft, catalogs, units }: StepProps) {
  const label = (list: { id: string; label: string }[], ids: string[]) =>
    list.filter((x) => ids.includes(x.id)).map((x) => x.label).join(' · ') || '—';
  const unitName = units.find((u) => u.id === draft.responsible_unit_id)?.name_short ?? '—';

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted" style={{ fontSize: 12 }}>{k}</span>
      <span>{v || <span className="muted">—</span>}</span>
    </div>
  );

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Revise el resumen. Al enviar a revisión, la actividad queda bloqueada para edición hasta que
        el equipo del DPD la apruebe u observe.
      </p>
      <Row k="Nombre" v={draft.title} />
      <Row k="Unidad responsable" v={unitName} />
      <Row k="Responsable interno" v={draft.operational_owner_name} />
      <Row k="Finalidad" v={draft.purpose} />
      <Row k="Descripción" v={draft.description} />
      <Row k="Origen de los datos" v={draft.data_source} />
      <Row k="Titulares" v={label(catalogs.subjectCategories, draft.subject_category_ids)} />
      <Row k="Categorías de datos" v={label(catalogs.dataCategories, draft.data_category_ids)} />
      <Row k="Bases de licitud" v={label(catalogs.legalBases, draft.legal_bases.map((b) => b.legal_basis_id))} />
      <Row k="Destinatarios" v={draft.recipients.map((r) => r.name || catalogs.recipientTypes.find((t) => t.id === r.recipient_type_id)?.label).join(' · ')} />
      <Row k="Transferencias" v={draft.transfers.map((t) => t.country).join(' · ')} />
      <Row k="Conservación" v={label(catalogs.retentionCriteria, draft.retention_criterion_id ? [draft.retention_criterion_id] : [])} />
      <Row k="Decisiones automatizadas" v={draft.has_automated_decision ? `Sí (${draft.automated_decisions.length})` : 'No'} />
      <Row k="Medidas de seguridad" v={label(catalogs.securityMeasures, draft.security_measure_ids)} />
    </div>
  );
}

export const STEP_COMPONENTS: Record<WizardStepKey, (p: StepProps) => JSX.Element> = {
  identificacion: StepIdentificacion,
  finalidad: StepFinalidad,
  titulares: StepTitulares,
  base_juridica: StepBaseJuridica,
  destinatarios: StepDestinatarios,
  conservacion: StepConservacion,
  automatizacion: StepAutomatizacion,
  seguridad: StepSeguridad,
  revision: StepRevision,
};
