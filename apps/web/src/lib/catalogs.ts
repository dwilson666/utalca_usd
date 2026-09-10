import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

/** Un valor de catálogo (vocabulario controlado). `status='active'` visible. */
export interface CatalogItem {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
}
export interface LegalBasisItem extends CatalogItem {
  requires_reinforced: boolean;
}
export interface DataCategoryItem extends CatalogItem {
  is_sensitive: boolean;
}
export interface SubjectCategoryItem extends CatalogItem {
  is_protected_group: boolean;
}
export interface RecipientTypeItem extends CatalogItem {
  is_processor: boolean;
}

export interface Catalogs {
  legalBases: LegalBasisItem[];
  dataCategories: DataCategoryItem[];
  subjectCategories: SubjectCategoryItem[];
  recipientTypes: RecipientTypeItem[];
  securityMeasures: CatalogItem[];
  transferGuaranteeTypes: CatalogItem[];
  retentionCriteria: CatalogItem[];
}

async function fetchActive<T>(table: string, extra = ''): Promise<T[]> {
  const cols = `id,code,label,description,sort_order${extra ? ',' + extra : ''}`;
  const { data, error } = await supabase
    .from(table)
    .select(cols)
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchCatalogs(): Promise<Catalogs> {
  const [
    legalBases,
    dataCategories,
    subjectCategories,
    recipientTypes,
    securityMeasures,
    transferGuaranteeTypes,
    retentionCriteria,
  ] = await Promise.all([
    fetchActive<LegalBasisItem>('legal_bases', 'requires_reinforced'),
    fetchActive<DataCategoryItem>('data_categories', 'is_sensitive'),
    fetchActive<SubjectCategoryItem>('subject_categories', 'is_protected_group'),
    fetchActive<RecipientTypeItem>('recipient_types', 'is_processor'),
    fetchActive<CatalogItem>('security_measures'),
    fetchActive<CatalogItem>('transfer_guarantee_types'),
    fetchActive<CatalogItem>('retention_criteria'),
  ]);
  return {
    legalBases,
    dataCategories,
    subjectCategories,
    recipientTypes,
    securityMeasures,
    transferGuaranteeTypes,
    retentionCriteria,
  };
}

/** Catálogos: cambian rara vez → caché larga. */
export function useCatalogs() {
  return useQuery({
    queryKey: ['catalogs'],
    queryFn: fetchCatalogs,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
  });
}

export function sensitiveDataCategoryIds(c: Catalogs): string[] {
  return c.dataCategories.filter((d) => d.is_sensitive).map((d) => d.id);
}
export function reinforcedLegalBasisIds(c: Catalogs): string[] {
  return c.legalBases.filter((b) => b.requires_reinforced).map((b) => b.id);
}
