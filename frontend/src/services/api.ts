import { ComparePairResponse, LibraryCourse } from '../types/api';
import pairFixtureData from '../fixtures/pair_response.json';
import landingFixtureData from '../fixtures/landing_response.json';
import { buildDynamicReportFromFile } from './clientParser';

const API_BASE = import.meta.env.VITE_API || '';

export class ApiError extends Error {
  statusCode?: number;
  isUnreachable?: boolean;

  constructor(message: string, statusCode?: number, isUnreachable: boolean = false) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isUnreachable = isUnreachable;
  }
}

export function isFixtureMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const f = params.get('fixture');
  return f === '1' || f === 'landing';
}

export function getActiveFixture(): ComparePairResponse {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fixture') === '1') {
      return pairFixtureData as unknown as ComparePairResponse;
    }
  }
  return landingFixtureData as unknown as ComparePairResponse;
}

export function setFixtureModeUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('fixture', 'landing');
  window.history.replaceState({}, '', url.toString());
}

export async function fetchHealth(): Promise<{ ok: boolean; courses: number; calibration: any }> {
  if (isFixtureMode()) {
    return { ok: true, courses: 90, calibration: { t_low: 0.38, t_high: 0.508, t_phrase: 0.75 } };
  }
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new ApiError(`Health check failed: ${res.statusText}`, res.status);
    return res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Backend health service unreachable', undefined, true);
  }
}

export async function fetchPairFixture(): Promise<ComparePairResponse> {
  return getActiveFixture();
}

export function cleanTitleFromFile(file: File): string {
  const base = file.name.replace(/\.[^/.]+$/, '');
  const cleaned = base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Uploaded Syllabus';
}

export function cleanCodeFromFile(file: File): string {
  const match = file.name.match(/[A-Za-z]{2,5}[-_ ]?\d{3,4}/);
  if (match) return match[0].toUpperCase().replace(/[-_ ]/, '_');
  const base = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
  return base.slice(0, 10).replace(/[^A-Z0-9]/g, '_') || 'COURSE_DOC';
}

export function generateClientLibraryResponse(file: File): ComparePairResponse {
  const baseFixture = getActiveFixture();
  const titleA = cleanTitleFromFile(file);
  const codeA = cleanCodeFromFile(file);

  return {
    ...baseFixture,
    report: {
      ...baseFixture.report,
      title: titleA,
    },
    parsed: {
      a: {
        ...baseFixture.parsed.a,
        title: titleA,
        code: codeA,
      },
      b: {
        title: 'Curriculum Reference Topics',
        code: '90 COURSES BENCHMARK',
        credits: undefined,
        format: 'matrix',
        units: baseFixture.parsed.b?.units || baseFixture.parsed.a.units,
      },
    },
  };
}

export function generateClientPairResponse(fileA: File, fileB: File): ComparePairResponse {
  const baseFixture = getActiveFixture();
  const titleA = cleanTitleFromFile(fileA);
  const codeA = cleanCodeFromFile(fileA);
  const titleB = cleanTitleFromFile(fileB);
  const codeB = cleanCodeFromFile(fileB);

  return {
    ...baseFixture,
    report: {
      ...baseFixture.report,
      title: `${titleA} vs ${titleB}`,
    },
    parsed: {
      a: {
        ...baseFixture.parsed.a,
        title: titleA,
        code: codeA,
      },
      b: {
        ...(baseFixture.parsed.b || baseFixture.parsed.a),
        title: titleB,
        code: codeB,
      },
    },
  };
}

export async function comparePair(
  fileA: File,
  fileB: File,
  tPhrase?: number
): Promise<ComparePairResponse> {
  if (isFixtureMode()) {
    // Return fixture after a realistic delay for demo
    await new Promise((r) => setTimeout(r, 800));
    return generateClientPairResponse(fileA, fileB);
  }

  const formData = new FormData();
  formData.append('file_a', fileA);
  formData.append('file_b', fileB);
  if (tPhrase !== undefined && tPhrase !== null) {
    formData.append('t_phrase', tPhrase.toString());
  }

  try {
    const res = await fetch(`${API_BASE}/api/compare/pair`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      // 405 Method Not Allowed or 404 on static hosting means no live Python backend is deployed
      if (res.status === 405 || res.status === 404) {
        console.info('Static hosting detected (HTTP 405/404). Running dynamic client syllabus parser.');
        return await buildDynamicReportFromFile(fileA, fileB);
      }
      let detail = `Comparison request failed with HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {
        detail = `${res.status} ${res.statusText}`;
      }
      throw new ApiError(detail, res.status);
    }

    return res.json();
  } catch (err: any) {
    if (err instanceof ApiError && err.statusCode && err.statusCode !== 405 && err.statusCode !== 404) {
      throw err;
    }
    console.info('Backend unreachable or static hosting. Running dynamic client syllabus parser.');
    return await buildDynamicReportFromFile(fileA, fileB);
  }
}

export async function compareLibrary(
  file: File,
  topK: number = 3,
  tPhrase?: number
): Promise<{ report: any; parsed: any; viz?: any }> {
  if (isFixtureMode()) {
    await new Promise((r) => setTimeout(r, 800));
    const full = await buildDynamicReportFromFile(file);
    return {
      report: full.report,
      parsed: full.parsed.a,
      viz: full.viz,
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('top_k', topK.toString());
  if (tPhrase !== undefined && tPhrase !== null) {
    formData.append('t_phrase', tPhrase.toString());
  }

  try {
    const res = await fetch(`${API_BASE}/api/compare/library`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      // 405 Method Not Allowed or 404 on static hosting means no live Python backend is deployed
      if (res.status === 405 || res.status === 404) {
        console.info('Static hosting detected (HTTP 405/404). Running dynamic client syllabus parser.');
        const full = await buildDynamicReportFromFile(file);
        return {
          report: full.report,
          parsed: full.parsed.a,
          viz: full.viz,
        };
      }
      let detail = `Library comparison failed with HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {
        detail = `${res.status} ${res.statusText}`;
      }
      throw new ApiError(detail, res.status);
    }

    return res.json();
  } catch (err: any) {
    if (err instanceof ApiError && err.statusCode && err.statusCode !== 405 && err.statusCode !== 404) {
      throw err;
    }
    console.info('Backend unreachable or static hosting. Running dynamic client syllabus parser.');
    const full = await buildDynamicReportFromFile(file);
    return {
      report: full.report,
      parsed: full.parsed.a,
      viz: full.viz,
    };
  }
}

export async function compareJson(reqPayload: any): Promise<any> {
  if (isFixtureMode()) {
    await new Promise((r) => setTimeout(r, 600));
    return getActiveFixture();
  }

  try {
    const res = await fetch(`${API_BASE}/api/compare/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqPayload),
    });

    if (!res.ok) {
      let detail = `JSON comparison failed with HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {
        detail = `${res.status} ${res.statusText}`;
      }
      throw new ApiError(detail, res.status);
    }

    return res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      'Cannot reach NLP backend on http://localhost:8000 to re-evaluate edited units.',
      undefined,
      true
    );
  }
}

