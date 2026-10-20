/**
 * Previsualización READ-ONLY de nomenclatura. La fuente de verdad es el backend
 * (`generarNomenclatura` en index.js): 5 segmentos cancha_marca_campana_canal_formato,
 * en minúsculas, sin versión (§6.3). Aquí solo reproducimos el formato para mostrar
 * un preview antes de guardar; nunca se persiste lo calculado en el cliente.
 */

/** Normaliza a slug: minúsculas, sin tildes, colapsa a '_', sin caracteres especiales. */
export function slug(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/** Preview de nomenclatura de 5 segmentos (igual que el backend). */
export function previewNomenclatura(parts: {
  cancha?: string;
  marca?: string;
  campana?: string;
  canal?: string;
  formato?: string;
}): string {
  return [parts.cancha, parts.marca, parts.campana, parts.canal, parts.formato]
    .map(slug)
    .join('_');
}
