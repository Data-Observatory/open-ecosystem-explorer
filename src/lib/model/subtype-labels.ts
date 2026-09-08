// Localised labels for subtype enum values (Opus evaluation report §A6 —
// `humanizeSubtype` in subtypes.ts is explicitly documented as un-localised,
// which leaked the English string "Bibliographic" into the Spanish-locale
// map UI and was a direct contributor to the OpenAlex classification
// complaint). Map2-only for now (`/map` keeps using the un-localised
// `humanizeSubtype` per this task's explicit map2-only scope) — every value
// from every `*Kind` enum in model/types.ts is covered so this can be
// promoted as a straight swap later without gaps.
import type { LocaleCode } from '../../i18n/locales.js';

const LABELS: Record<string, Record<LocaleCode, string>> = {
  // IndexKind
  bibliographic: { es: 'Bibliográfico', en: 'Bibliographic' },
  citation: { es: 'Citas', en: 'Citation' },
  registry: { es: 'Registro', en: 'Registry' },
  directory: { es: 'Directorio', en: 'Directory' },
  // CrisKind
  commercial: { es: 'Comercial', en: 'Commercial' },
  'open-source': { es: 'Código abierto', en: 'Open source' },
  national: { es: 'Nacional', en: 'National' },
  // RepositoryKind
  'software-platform': { es: 'Software (autoalojado)', en: 'Software platform (self-hosted)' },
  'hosted-service': { es: 'Servicio alojado', en: 'Hosted service' },
  'institutional-instance': { es: 'Instancia institucional', en: 'Institutional instance' },
  // AggregatorKind
  'harvesting-network': { es: 'Red de cosecha', en: 'Harvesting network' },
  'linking-service': { es: 'Servicio de enlace', en: 'Linking service' },
  federation: { es: 'Federación', en: 'Federation' },
  // PlatformKind
  'journal-programme': { es: 'Programa de revistas', en: 'Journal programme' },
  'preprint-server': { es: 'Servidor de preprints', en: 'Preprint server' },
  'books-programme': { es: 'Programa de libros', en: 'Books programme' },
  // StandardKind
  principles: { es: 'Principios', en: 'Principles' },
  'metadata-schema': { es: 'Esquema de metadatos', en: 'Metadata schema' },
  protocol: { es: 'Protocolo', en: 'Protocol' },
  'certification-criteria': { es: 'Criterios de certificación', en: 'Certification criteria' },
  framework: { es: 'Marco', en: 'Framework' },
  'governance-criteria': { es: 'Criterios de gobernanza', en: 'Governance criteria' },
  serialisation: { es: 'Serialización', en: 'Serialisation' },
  // CommunityKind
  'standards-body': { es: 'Organismo de normalización', en: 'Standards body' },
  'technical-community': { es: 'Comunidad técnica', en: 'Technical community' },
  'certification-body': { es: 'Organismo certificador', en: 'Certification body' },
  confederation: { es: 'Confederación', en: 'Confederation' },
  // CoalitionKind
  declaration: { es: 'Declaración', en: 'Declaration' },
  'reform-movement': { es: 'Movimiento de reforma', en: 'Reform movement' },
  'funding-initiative': { es: 'Iniciativa de financiamiento', en: 'Funding initiative' },
  network: { es: 'Red', en: 'Network' },
  // PolicyKind
  law: { es: 'Ley', en: 'Law' },
  mandate: { es: 'Mandato', en: 'Mandate' },
  guideline: { es: 'Directriz', en: 'Guideline' },
  'funder-requirement': { es: 'Requisito de financiador', en: 'Funder requirement' },
  strategy: { es: 'Estrategia', en: 'Strategy' },
  recommendation: { es: 'Recomendación', en: 'Recommendation' },
  // OrgKind
  company: { es: 'Empresa', en: 'Company' },
  nonprofit: { es: 'Sin fines de lucro', en: 'Nonprofit' },
  foundation: { es: 'Fundación', en: 'Foundation' },
  university: { es: 'Universidad', en: 'University' },
  'research-institute': { es: 'Instituto de investigación', en: 'Research institute' },
  'government-agency': { es: 'Agencia gubernamental', en: 'Government agency' },
  intergovernmental: { es: 'Intergubernamental', en: 'Intergovernmental' },
  library: { es: 'Biblioteca', en: 'Library' },
};

/** Localised subtype label, falling back to the un-localised humanised form
 *  (dash -> space, capitalised) for any value not in the table above, so a
 *  future new enum value degrades gracefully instead of rendering blank. */
export function localizedSubtypeLabel(value: string, locale: LocaleCode): string {
  const entry = LABELS[value];
  if (entry) return entry[locale];
  const spaced = value.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
