/**
 * Servicio Bedrock — llama a la Lambda de análisis IA.
 * Convierte el PDF a base64 y lo envía a Claude 3 Sonnet.
 */

const BEDROCK_URL = import.meta.env.VITE_BEDROCK_URL as string;

export interface IAObservation {
  id: string;
  category: 'LEGAL' | 'NUTRICIONAL' | 'MARCA' | 'REDACCION';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  ruleReference?: string;
  suggestion?: string;
}

export interface IAResult {
  score: number;
  observations: IAObservation[];
}

/** Convierte un File a base64 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Quita el prefijo "data:application/pdf;base64,"
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analizarConBedrock(
  pdfFile: File,
  solicitudInfo: { brand: string; product: string; channel: string; contentType: string; description: string },
  promptIA: string
): Promise<IAResult> {
  if (!BEDROCK_URL) {
    throw new Error('VITE_BEDROCK_URL no configurado');
  }

  const pdfBase64 = await fileToBase64(pdfFile);
  const token = localStorage.getItem('alpina_id_token');

  const res = await fetch(BEDROCK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ pdfBase64, prompt: promptIA, solicitudInfo }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} al analizar con Bedrock`);
  }

  return res.json();
}
