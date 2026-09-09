import { z } from 'zod';
import { ACTIVITY_STATUS, UNIT_RAT_STATUS } from './domain.js';

/** Validación compartida entre el wizard del cliente y las Edge Functions. */

export const uuid = z.string().uuid();

export const activityIdentificationSchema = z.object({
  title: z.string().trim().min(3, 'Nombre demasiado corto').max(300),
  responsible_unit_id: uuid,
  operational_owner_name: z.string().trim().max(200).optional().or(z.literal('')),
});

export const activityPurposeSchema = z.object({
  purpose: z.string().trim().min(10, 'Describa la finalidad'),
  description: z.string().trim().min(10, 'Describa cómo opera el proceso'),
  data_source: z.string().trim().min(3, 'Indique el origen de los datos'),
});

export const activitySubjectsDataSchema = z.object({
  subject_category_ids: z.array(uuid).min(1, 'Seleccione al menos una categoría de titulares'),
  data_category_ids: z.array(uuid).min(1, 'Seleccione al menos una categoría de datos'),
  includes_nna: z.boolean().default(false),
});

export const activityLegalBasisSchema = z.object({
  legal_bases: z
    .array(z.object({ legal_basis_id: uuid, justification: z.string().trim().max(2000).optional() }))
    .min(1, 'Indique al menos una base de licitud'),
});

export const activityRecipientsSchema = z.object({
  recipients: z.array(
    z.object({
      recipient_type_id: uuid,
      name: z.string().trim().max(300).optional(),
      is_processor: z.boolean().default(false),
      detail: z.string().trim().max(2000).optional(),
    }),
  ),
  transfers: z
    .array(
      z.object({
        country: z.string().trim().min(2),
        guarantee_type_id: uuid.optional(),
        detail: z.string().trim().max(2000).optional(),
      }),
    )
    .default([]),
});

export const activityRetentionSchema = z.object({
  retention_criterion_id: uuid,
  retention_value: z.number().int().positive().optional(),
  retention_unit: z.enum(['dias', 'meses', 'anios', 'indefinido']).optional(),
  retention_text: z.string().trim().max(1000).optional(),
});

export const activityAutomationSchema = z.object({
  has_automated_decision: z.boolean().default(false),
  uses_ai: z.boolean().default(false),
  automated_decisions: z
    .array(
      z.object({
        description: z.string().trim().min(3),
        stage: z.string().trim().optional(),
        human_in_the_loop: z.boolean().default(true),
        produces_profiling: z.boolean().default(false),
      }),
    )
    .default([]),
  own_systems_text: z.string().trim().max(2000).optional(),
});

export const activitySecuritySchema = z.object({
  security_measure_ids: z.array(uuid).min(1, 'Indique al menos una medida de seguridad'),
});

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
