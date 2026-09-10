import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EDITABLE_ACTIVITY_STATUS,
  EMPTY_WIZARD_DRAFT,
  WIZARD_STEPS,
  makeActivitySubmitSchema,
  wizardStepSchemas,
  type WizardDraft,
  type WizardStepKey,
} from '@rat/shared';
import { useAuth } from '../auth/AuthProvider';
import { useCatalogs, reinforcedLegalBasisIds, sensitiveDataCategoryIds } from '../lib/catalogs';
import { selectableUnitsFor, useUnits } from '../lib/units';
import {
  createDraftActivity,
  loadActivity,
  refreshMeta,
  saveAllSteps,
  saveStep,
  type ActivityMeta,
} from '../lib/activityApi';
import { transitionActivity } from '../lib/queries';
import { fetchObservations, resolveObservation } from '../lib/reviewApi';
import { clearLocal, readLocal, saveLocal } from '../lib/wizardLocal';
import { PageHeader } from '../components/ui';
import { ObservationItem } from '../components/Observations';
import { STEP_COMPONENTS } from './wizard/steps';
import type { FieldErrors } from './wizard/fields';

type Phase = 'loading' | 'ready' | 'error';

function zodErrors(issues: { path: (string | number)[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) {
    const key = i.path.join('.');
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

export function ActivityWizard() {
  const { id: routeId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { authz } = useAuth();
  const catalogsQ = useCatalogs();
  const unitsQ = useUnits();

  const [phase, setPhase] = useState<Phase>(routeId ? 'loading' : 'ready');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<ActivityMeta | null>(null);
  const [draft, setDraft] = useState<WizardDraft>(EMPTY_WIZARD_DRAFT);
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<null | 'save' | 'next' | 'submit'>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [restorable, setRestorable] = useState<null | { draft: WizardDraft; step: number }>(null);
  const dirtyRef = useRef(false);
  const opRef = useRef(false);

  const step = WIZARD_STEPS[stepIdx]!;
  const isEditableStatus = !meta || EDITABLE_ACTIVITY_STATUS.has(meta.status);
  const isCorrection = !!meta && (meta.status === 'OBSERVADO' || meta.status === 'CORREGIDO');

  const obsQ = useQuery({
    queryKey: ['activity', meta?.id, 'obs'],
    queryFn: () => fetchObservations(meta!.id),
    enabled: !!meta && isCorrection,
  });
  const openObs = (obsQ.data ?? []).filter((o) => !o.resolved_at);
  const resolveMut = useMutation({
    mutationFn: ({ obsId, resolved }: { obsId: string; resolved: boolean }) =>
      resolveObservation(obsId, resolved),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['activity', meta?.id, 'obs'] }),
  });

  // ── carga ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!routeId) return;
    let alive = true;
    setPhase('loading');
    loadActivity(routeId)
      .then((res) => {
        if (!alive) return;
        setMeta(res.meta);
        setDraft(res.draft);
        setPhase('ready');
        const local = readLocal(routeId);
        if (local && local.serverUpdatedAt === res.meta.updated_at && local.savedAt > Date.parse(res.meta.updated_at)) {
          // hay respaldo local más nuevo que lo último confirmado en el servidor
          setRestorable({ draft: local.draft, step: local.step });
        }
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadErr(e instanceof Error && e.message === 'NOT_FOUND' ? 'NOT_FOUND' : 'ERR');
        setPhase('error');
      });
    return () => {
      alive = false;
    };
  }, [routeId]);

  // ── respaldo local en cada cambio ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready' || !meta) return;
    if (!dirtyRef.current) return;
    saveLocal(meta.id, draft, stepIdx, meta.updated_at);
  }, [draft, stepIdx, phase, meta]);

  // ── aviso al salir con cambios sin guardar ──────────────────────────────
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const set = useCallback(<K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => {
    dirtyRef.current = true;
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const catalogs = catalogsQ.data;
  const units = unitsQ.data ?? [];
  const selectableUnits = useMemo(
    () => (units.length ? selectableUnitsFor(authz, units) : []),
    [authz, units],
  );

  // Validación del paso actual (no bloquea la navegación; solo informa).
  const validateStep = useCallback(
    (key: WizardStepKey): FieldErrors => {
      if (key === 'revision') return {};
      const schema = wizardStepSchemas[key as Exclude<WizardStepKey, 'revision'>];
      const r = schema.safeParse(draft);
      return r.success ? {} : zodErrors(r.error.issues);
    },
    [draft],
  );

  const stepStatus = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const s of WIZARD_STEPS) {
      if (s.key === 'revision') continue;
      map[s.key] = Object.keys(validateStep(s.key)).length === 0;
    }
    return map;
  }, [validateStep]);

  const completedSteps = Object.values(stepStatus).filter(Boolean).length;
  const totalDataSteps = WIZARD_STEPS.length - 1;
  const progressPct = meta?.completeness_pct ?? Math.round((completedSteps / totalDataSteps) * 100);

  // ── persistencia ────────────────────────────────────────────────────────
  async function ensureDraftId(): Promise<string> {
    if (meta) return meta.id;
    // crear a partir del paso 1
    const r = wizardStepSchemas.identificacion.safeParse(draft);
    if (!r.success) {
      setErrors(zodErrors(r.error.issues));
      throw new Error('Complete la identificación para crear el borrador.');
    }
    const created = await createDraftActivity({
      title: draft.title,
      responsible_unit_id: draft.responsible_unit_id!,
      operational_owner_name: draft.operational_owner_name,
    });
    setMeta(created);
    window.history.replaceState(null, '', `/actividades/${created.id}/editar`);
    return created.id;
  }

  async function persistCurrentStep(): Promise<void> {
    if (!catalogs) return;
    const activityId = await ensureDraftId();
    if (step.key !== 'revision' && step.key !== 'identificacion') {
      await saveStep(activityId, step.key, draft, catalogs);
    } else if (step.key === 'identificacion' && meta) {
      await saveStep(activityId, 'identificacion', draft, catalogs);
    }
    const m = await refreshMeta(activityId);
    setMeta(m);
    dirtyRef.current = false;
    clearLocal(activityId);
    setSavedAt(new Date());
  }

  async function handleSaveDraft() {
    if (!catalogs || busy) return;
    setBusy('save');
    setSaveError(null);
    try {
      const activityId = await ensureDraftId();
      await saveAllSteps(activityId, draft, catalogs);
      const m = await refreshMeta(activityId);
      setMeta(m);
      dirtyRef.current = false;
      clearLocal(activityId);
      setSavedAt(new Date());
      void qc.invalidateQueries({ queryKey: ['activities'] });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(null);
    }
  }

  async function goToStep(next: number) {
    if (busy) return;
    setErrors({});
    if (next > stepIdx && catalogs) {
      // guardar al avanzar
      setBusy('next');
      setSaveError(null);
      try {
        await persistCurrentStep();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'No se pudo guardar el paso.');
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    setErrors(next < WIZARD_STEPS.length && WIZARD_STEPS[next]!.key !== 'revision' ? {} : {});
    setStepIdx(Math.max(0, Math.min(WIZARD_STEPS.length - 1, next)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    if (!catalogs || busy || opRef.current) return;
    opRef.current = true;
    setBusy('submit');
    setSaveError(null);
    try {
      const activityId = await ensureDraftId();
      await saveAllSteps(activityId, draft, catalogs);
      const schema = makeActivitySubmitSchema({
        sensitiveDataCategoryIds: sensitiveDataCategoryIds(catalogs),
        reinforcedLegalBasisIds: reinforcedLegalBasisIds(catalogs),
      });
      const r = schema.safeParse(draft);
      if (!r.success) {
        setErrors(zodErrors(r.error.issues));
        setSaveError('Hay campos obligatorios incompletos. Revise los pasos marcados.');
        setBusy(null);
        return;
      }
      // OBSERVADO → CORREGIDO → EN_REVISION · CORREGIDO → EN_REVISION · resto → EN_REVISION
      if (meta?.status === 'OBSERVADO') {
        await transitionActivity(activityId, 'CORREGIDO', 'Correcciones aplicadas desde el asistente');
      }
      await transitionActivity(
        activityId,
        'EN_REVISION',
        isCorrection ? 'Reenviada a revisión tras correcciones' : 'Enviada a revisión desde el asistente',
      );
      dirtyRef.current = false;
      clearLocal(activityId);
      void qc.invalidateQueries({ queryKey: ['activities'] });
      void qc.invalidateQueries({ queryKey: ['review', 'queue'] });
      nav(`/actividades/${activityId}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo enviar a revisión.');
      setBusy(null);
      opRef.current = false;
    }
  }

  // ── render ──────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <>
        <PageHeader
          title={loadErr === 'NOT_FOUND' ? 'Actividad no encontrada' : 'No se pudo abrir el asistente'}
          sub={loadErr === 'NOT_FOUND' ? 'El recurso no existe o no está dentro de su alcance.' : undefined}
        />
        <button className="btn" onClick={() => nav('/actividades')}>Volver a actividades</button>
      </>
    );
  }
  if (phase === 'loading' || catalogsQ.isLoading || unitsQ.isLoading) {
    return <p className="muted">Cargando asistente…</p>;
  }
  if (catalogsQ.error || !catalogs) {
    return <div className="callout callout--crit">No se pudieron cargar los catálogos.</div>;
  }
  if (meta && !isEditableStatus) {
    return (
      <>
        <PageHeader title="Actividad bloqueada para edición"
          sub={`Su estado (${meta.status}) no permite edición. Vuelva al detalle para ver las observaciones o el historial.`} />
        <button className="btn btn--primary" onClick={() => nav(`/actividades/${meta.id}`)}>Ver detalle</button>
      </>
    );
  }

  const StepView = STEP_COMPONENTS[step.key];

  return (
    <>
      <PageHeader
        eyebrow={meta ? `${meta.ref_code} · ${meta.unit_name ?? ''}` : 'Nueva actividad de tratamiento'}
        title={draft.title || 'Actividad de tratamiento'}
        sub={`Asistente RAT · paso ${step.n} de 9 · ${step.label}`}
        actions={
          <>
            <button className="btn" disabled={!!busy} onClick={handleSaveDraft}>
              {busy === 'save' ? 'Guardando…' : 'Guardar borrador'}
            </button>
            <button className="btn btn--ghost" onClick={() => nav(meta ? `/actividades/${meta.id}` : '/actividades')}>
              Salir
            </button>
          </>
        }
      />

      {restorable && (
        <div className="callout callout--warn" style={{ marginBottom: 14, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>
            Se encontró un borrador local sin guardar más reciente que la última versión del servidor.
          </span>
          <button className="btn" onClick={() => { setDraft(restorable.draft); setStepIdx(restorable.step); setRestorable(null); dirtyRef.current = true; }}>
            Restaurar
          </button>
          <button className="btn btn--ghost" onClick={() => { if (meta) clearLocal(meta.id); setRestorable(null); }}>
            Descartar
          </button>
        </div>
      )}

      {isCorrection && (obsQ.data ?? []).length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card__h">
            <h3>Observaciones del DPD</h3>
            <span className="muted" style={{ fontSize: 12 }}>
              {openObs.length === 0 ? 'Todas resueltas' : `${openObs.length} sin resolver`}
            </span>
          </div>
          <div className="card__b" style={{ display: 'grid', gap: 8 }}>
            {(obsQ.data ?? []).map((o) => (
              <ObservationItem
                key={o.id}
                o={o}
                busy={resolveMut.isPending}
                onToggle={(resolved) => resolveMut.mutate({ obsId: o.id, resolved })}
              />
            ))}
          </div>
        </div>
      )}

      <div className="split split--wizard">
        {/* navegación de pasos */}
        <nav className="card wizard-nav" style={{ padding: 8 }}>
          <div style={{ padding: '6px 8px 10px' }}>
            <div className="bar" style={{ height: 6 }}>
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
              Completitud {progressPct}%
            </div>
          </div>
          {WIZARD_STEPS.map((s, i) => {
            const done = s.key !== 'revision' && stepStatus[s.key];
            const active = i === stepIdx;
            return (
              <button
                key={s.key}
                onClick={() => goToStep(i)}
                style={{
                  display: 'flex', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left',
                  padding: '8px 9px', border: 0, borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  background: active ? 'var(--brand-weak)' : 'transparent',
                  color: active ? 'var(--brand-ink)' : 'var(--ink)',
                  fontSize: 12.5, fontWeight: active ? 700 : 500,
                }}
              >
                <span
                  style={{
                    width: 18, height: 18, borderRadius: 100, flex: 'none',
                    display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700,
                    background: done ? 'var(--success)' : active ? 'var(--brand)' : 'var(--sunken)',
                    color: done || active ? '#fff' : 'var(--ink-muted)',
                  }}
                >
                  {done ? '✓' : s.n}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* contenido del paso */}
        <div>
          <div className="card">
            <div className="card__b">
              <StepView
                draft={draft}
                set={set}
                catalogs={catalogs}
                units={units}
                selectableUnits={selectableUnits}
                errors={errors}
              />
            </div>
          </div>

          {saveError && <div className="callout callout--crit" style={{ marginTop: 12 }}>{saveError}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" disabled={stepIdx === 0 || !!busy} onClick={() => goToStep(stepIdx - 1)}>
              ← Anterior
            </button>
            {step.key !== 'revision' ? (
              <button className="btn btn--primary" disabled={!!busy} onClick={() => goToStep(stepIdx + 1)}>
                {busy === 'next' ? 'Guardando…' : 'Guardar y continuar →'}
              </button>
            ) : (
              <button
                className="btn btn--primary"
                disabled={!!busy || (isCorrection && openObs.length > 0)}
                onClick={handleSubmit}
                title={isCorrection && openObs.length > 0 ? 'Resuelva las observaciones antes de reenviar' : undefined}
              >
                {busy === 'submit'
                  ? 'Enviando…'
                  : isCorrection
                    ? 'Reenviar a revisión'
                    : 'Enviar a revisión'}
              </button>
            )}
            <span style={{ flex: 1 }} />
            {savedAt && !dirtyRef.current && (
              <span className="muted" style={{ fontSize: 12 }}>
                Guardado {savedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {step.key === 'revision' && (
            <div className="callout" style={{ marginTop: 12, fontSize: 12.5 }}>
              {completedSteps === totalDataSteps
                ? 'Todos los pasos obligatorios están completos.'
                : `Faltan ${totalDataSteps - completedSteps} paso(s) con campos obligatorios. Complételos antes de enviar.`}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
