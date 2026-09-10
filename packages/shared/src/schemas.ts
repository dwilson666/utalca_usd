import { z } from 'zod';
import { ACTIVITY_STATUS, RETENTION_UNITS, UNIT_RAT_STATUS, type WizardStepKey } from './domain.js';

/** Validación compartida entre el asistente RAT del cliente y las Edge Functions. */

export const uuid = z.string().uuid();

// ── piezas reutilizables ────────────────────────────────────────────────────
export const legalBasisEntry = z.object({
  legal_basis_id: uuid,
  justification: z.string().trim().max(2000).optional().default(''),
});

export const recipientEntry = z.object({
  recipient_type_id: uuid,
  name: z.string().trim().max(300).optional().default(''),
  is_processor: z.boolean().default(false),
  detail: z.string().trim().max(2000).optional().default(''),
});

export const transferEntry = z.object({
  country: z.string().trim().min(2, 'Indique el país de destino').max(120),
  guarantee_type_id: uuid.optional(),
  detail: z.string().trim().max(2000).optional().default(''),
});

export const automatedDecisionEntry = z.object({
  description: z.string().trim().min(3, 'Describa la decisión automatizada'),
  stage: z.string().trim().max(300).optional().default(''),
  human_in_the_loop: z.boolean().default(true),
  produces_profiling: z.boolean().default(false),
});

// ── esquema del borrador completo (todos los campos, tolerante) ──────────────
// Se usa para el guardado parcial: nada es obligatorio, solo se validan tipos y
// longitudes. La obligatoriedad se comprueba con `wizardStepSchemas` (por paso)
// y con `activitySubmitSchema` (al enviar a revisión).
export const wizardDraftSchema = z.object({
  // 1 · identificación
  title: z.string().trim().max(300).default(''),
  responsible_unit_id: uuid.nullable().default(null),
  operational_owner_name: z.string().trim().max(200).default(''),
  // 2 · finalidad
  purpose: z.string().trim().max(4000).default(''),
  description: z.string().trim().max(8000).default(''),
  data_source: z.string().trim().max(2000).default(''),
  // 3 · titulares y datos
  subject_category_ids: z.array(uuid).default([]),
  data_category_ids: z.array(uuid).default([]),
  // 4 · base jurídica
  legal_bases: z.array(legalBasisEntry).default([]),
  // 5 · destinatarios y transferencias
  recipients: z.array(recipientEntry).default([]),
  transfers: z.array(transferEntry).default([]),
  // 6 · conservación
  retention_criterion_id: uuid.nullable().default(null),
  retention_value: z.number().int().positive().max(1000).nullable().default(null),
  retention_unit: z.enum(RETENTION_UNITS).nullable().default(null),
  retention_text: z.string().trim().max(2000).default(''),
  // 7 · automatización
  has_automated_decision: z.boolean().default(false),
  uses_ai: z.boolean().default(false),
  automated_decisions: z.array(automatedDecisionEntry).default([]),
  own_systems_text: z.string().trim().max(2000).default(''),
  // 8 · seguridad
  security_measure_ids: z.array(uuid).default([]),
});
export type WizardDraft = z.infer<typeof wizardDraftSchema>;

export const EMPTY_WIZARD_DRAFT: WizardDraft = wizardDraftSchema.parse({});

// ── validación por paso (define qué hace a un paso "completo") ───────────────
const stepIdentificacion = z.object({
  title: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(300),
  responsible_unit_id: uuid,
  operational_owner_name: z.string().trim().min(3, 'Indique la persona responsable interna').max(200),
});

const stepFinalidad = z.object({
  purpose: z.string().trim().min(10, 'Describa la finalidad del tratamiento'),
  description: z.string().trim().min(10, 'Describa cómo opera el proceso'),
  data_source: z.string().trim().min(3, 'Indique el origen de los datos'),
});

const stepTitulares = z.object({
  subject_category_ids: z.array(uuid).min(1, 'Seleccione al menos una categoría de titulares'),
  data_category_ids: z.array(uuid).min(1, 'Seleccione al menos una categoría de datos'),
});

const stepBaseJuridica = z.object({
  legal_bases: z.array(legalBasisEntry).min(1, 'Indique al menos una base de licitud'),
});

const stepDestinatarios = z.object({
  recipients: z.array(recipientEntry).min(1, 'Indique al menos un destinatario (puede ser "uso interno")'),
  transfers: z.array(transferEntry),
});

const stepConservacion = z.object({
  retention_criterion_id: uuid.refine((v) => !!v, 'Seleccione un criterio de conservación'),
});

// La automatización siempre es válida: basta con declarar sí/no. Si hay decisión
// automatizada, cada entrada debe estar descrita.
const stepAutomatizacion = z
  .object({
    has_automated_decision: z.boolean(),
    automated_decisions: z.array(automatedDecisionEntry),
  })
  .superRefine((v, ctx) => {
    if (v.has_automated_decision && v.automated_decisions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['automated_decisions'],
        message: 'Describa al menos una decisión automatizada',
      });
    }
  });

const stepSeguridad = z.object({
  security_measure_ids: z.array(uuid).min(1, 'Indique al menos una medida de seguridad'),
});

export const wizardStepSchemas: Record<Exclude<WizardStepKey, 'revision'>, z.ZodTypeAny> = {
  identificacion: stepIdentificacion,
  finalidad: stepFinalidad,
  titulares: stepTitulares,
  base_juridica: stepBaseJuridica,
  destinatarios: stepDestinatarios,
  conservacion: stepConservacion,
  automatizacion: stepAutomatizacion,
  seguridad: stepSeguridad,
};

/**
 * Esquema fuerte para "Enviar a revisión": une todos los pasos y añade las
 * reglas transversales de la Ley 21.719 que el backend también verifica
 * (dato sensible ⇒ base de licitud reforzada; transferencia ⇒ garantía).
 * `sensitiveDataCategoryIds` / `reinforcedLegalBasisIds` los aporta el cliente
 * desde el catálogo cargado.
 */
export function makeActivitySubmitSchema(opts: {
  sensitiveDataCategoryIds: string[];
  reinforcedLegalBasisIds: string[];
}) {
  const sensitive = new Set(opts.sensitiveDataCategoryIds);
  const reinforced = new Set(opts.reinforcedLegalBasisIds);
  return wizardDraftSchema.superRefine((d, ctx) => {
    for (const [key, schema] of Object.entries(wizardStepSchemas)) {
      const r = schema.safeParse(d);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: [key, ...issue.path] });
        }
      }
    }
    const hasSensitive = d.data_category_ids.some((id) => sensitive.has(id));
    if (hasSensitive && !d.legal_bases.some((b) => reinforced.has(b.legal_basis_id))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['base_juridica', 'legal_bases'],
        message:
          'Trata datos sensibles: debe declarar una base de licitud reforzada (consentimiento explícito o fines estadísticos).',
      });
    }
    for (let i = 0; i < d.transfers.length; i++) {
      if (!d.transfers[i]?.guarantee_type_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinatarios', 'transfers', i, 'guarantee_type_id'],
          message: 'Cada transferencia internacional debe indicar su garantía.',
        });
      }
    }
  });
}

// ── transiciones ────────────────────────────────────────────────────────────
export const transitionActivitySchema = z.object({
  activity_id: uuid,
  to: z.enum(ACTIVITY_STATUS),
  comment: z.string().trim().max(4000).optional(),
});

export const transitionUnitSchema = z.object({
  unit_id: uuid,
  to: z.enum(UNIT_RAT_STATUS),
  comment: z.string().trim().max(4000).optional(),
});

// ── invitación de usuarios (consola de administración / Edge Function) ───────
export const inviteUserSchema = z.object({
  email: z.string().email().endsWith('@utalca.cl', 'Debe ser un correo institucional @utalca.cl'),
  full_name: z.string().trim().min(2),
  role_code: z.enum(['superadmin', 'dpd_admin', 'auditor', 'unit_manager', 'collaborator']),
  scope: z.enum(['global', 'unit']),
  unit_assignments: z
    .array(
      z.object({
        unit_id: uuid,
        unit_role: z.enum(['jefe', 'colaborador', 'consulta']),
        includes_descendants: z.boolean().default(false),
      }),
    )
    .default([]),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
