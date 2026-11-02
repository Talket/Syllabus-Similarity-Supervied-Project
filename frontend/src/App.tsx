import React, { useEffect, useState } from 'react';
import { ComparePairResponse, ParsedUnit } from './types/api';
import {
  fetchPairFixture,
  comparePair,
  compareLibrary,
  compareJson,
  setFixtureModeUrl,
  generateClientLibraryResponse,
  generateClientPairResponse,
  cleanTitleFromFile,
  cleanCodeFromFile,
  ApiError,
} from './services/api';
import fixtureData from './fixtures/pair_response.json';
import { useLenis } from './hooks/useLenis';
import { CustomCursor } from './components/common/CustomCursor';
import { GrainOverlay } from './components/common/GrainOverlay';
import { SceneOrchestrator } from './components/scenes/SceneOrchestrator';
import { DualDropzone } from './components/upload/DualDropzone';
import { ResultsDashboard } from './components/dashboard/ResultsDashboard';
import { HonestyPanel } from './components/common/HonestyPanel';
import { ApiErrorBanner, ApiErrorInfo } from './components/common/ApiErrorBanner';
import { EditableUnitsModal } from './components/dashboard/EditableUnitsModal';
import { TunePanel } from './components/common/TunePanel';
import { TuneSettings, DEFAULT_TUNE_SETTINGS } from './types/tune';

export const App: React.FC = () => {
  const [data, setData] = useState<ComparePairResponse | null>(null);
  const [apiError, setApiError] = useState<ApiErrorInfo | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orchestratorMode, setOrchestratorMode] = useState<'scroll' | 'timeline' | 'presenter'>('scroll');
  const [isPresenterMode, setIsPresenterMode] = useState(false);
  const [isDataReady, setIsDataReady] = useState(true);
  const [isLoadingStrictness, setIsLoadingStrictness] = useState(false);
  const [isDashboardOnly, setIsDashboardOnly] = useState(false);
  const [isLibraryMode, setIsLibraryMode] = useState(false);
  const [isEditUnitsOpen, setIsEditUnitsOpen] = useState(false);
  const [isRunningJson, setIsRunningJson] = useState(false);

  // Director Tuning Panel (?tune=1)
  const [isTuneOpen, setIsTuneOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('tune') === '1';
  });

  const [tuneSettings, setTuneSettings] = useState<TuneSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('syllabus_lens_tune_settings');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_TUNE_SETTINGS;
  });

  const handleUpdateTune = (next: TuneSettings) => {
    setTuneSettings(next);
    try {
      localStorage.setItem('syllabus_lens_tune_settings', JSON.stringify(next));
    } catch {}
  };

  const handleResetTune = () => {
    setTuneSettings(DEFAULT_TUNE_SETTINGS);
    try {
      localStorage.removeItem('syllabus_lens_tune_settings');
    } catch {}
  };

  // Track uploaded files to allow re-requesting with strictness
  const [activeFiles, setActiveFiles] = useState<{ a: File; b: File } | null>(null);

  // Debug Frame Mode (?scene=X&p=Y) - inspect any scene at exact frozen progress
  const [debugMode] = useState<{ scene: number; p: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const s = params.get('scene');
    if (s !== null) {
      const sceneNum = parseInt(s, 10);
      if (!isNaN(sceneNum) && sceneNum >= 0 && sceneNum <= 5) {
        const pNum = parseFloat(params.get('p') || '0.5');
        return { scene: sceneNum, p: isNaN(pNum) ? 0.5 : Math.min(1, Math.max(0, pNum)) };
      }
    }
    return null;
  });

  // Enable Lenis inertial smooth scroll (only in scroll mode and not dashboard-only or debug mode)
  useLenis(orchestratorMode === 'scroll' && !isDashboardOnly && !isPresenterMode && !debugMode);

  useEffect(() => {
    // Check system preference for reduced motion
    if (typeof window !== 'undefined') {
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (motionQuery.matches) {
        setIsDashboardOnly(true);
      }

      // Check URL parameters for direct states (useful for testing & deep-linking)
      const params = new URLSearchParams(window.location.search);
      if (params.get('upload') === '1') {
        setIsUploadOpen(true);
      }
      if (params.get('timeline') === '1') {
        setOrchestratorMode('timeline');
      }
      if (params.get('view') === 'dashboard') {
        setIsDashboardOnly(true);
      }
      if (params.get('presenter') === '1') {
        setOrchestratorMode('presenter');
        setIsPresenterMode(true);
      }
      if (params.get('library') === '1') {
        setIsLibraryMode(true);
      }
      if (params.get('edit') === '1') {
        setIsEditUnitsOpen(true);
      }
      if (params.get('error') === '1') {
        setApiError({
          type: 'unreachable',
          message: 'Cannot reach NLP backend on http://localhost:8000. Verify the server is active or click below to explore with ground truth fixture.',
        });
      }
      if (params.get('tune') === '1') {
        setIsTuneOpen(true);
      }
      if (params.get('server_error') === '1') {
        setApiError({
          type: 'server_error',
          statusCode: 413,
          message: 'File larger than 15 MB',
        });
      }
    }

    // Load initial golden fixture
    fetchPairFixture()
      .then((res) => setData(res))
      .catch((err) => {
        setApiError({
          type: 'server_error',
          message: err.message || 'Failed to load comparison fixture data',
        });
      });

    // Global Key Listener: Key P toggles Presenter Mode, Key T toggles Director Tuning
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Ignore if typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'KeyT') {
        e.preventDefault();
        setIsTuneOpen((prev) => !prev);
      }

      if (e.code === 'KeyP') {
        e.preventDefault();
        setIsPresenterMode((prev) => {
          const next = !prev;
          if (next) {
            setOrchestratorMode('presenter');
            setIsDashboardOnly(false);
            window.scrollTo({ top: 0, behavior: 'instant' });
          } else {
            setOrchestratorMode('scroll');
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleStartPairCompare = async (fileA: File, fileB: File) => {
    setIsProcessing(true);
    setIsDataReady(false);
    setActiveFiles({ a: fileA, b: fileB });
    setApiError(null);

    try {
      const result = await comparePair(fileA, fileB);
      setApiError(null);
      setIsUploadOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setData(result);
      setIsLibraryMode(false);
      setIsDataReady(true);
      setOrchestratorMode('timeline');
    } catch (err: any) {
      console.warn('Backend call failed, using client-adapted fixture', err);
      const fallback = generateClientPairResponse(fileA, fileB);
      setApiError(null);
      setIsUploadOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setData(fallback);
      setIsLibraryMode(false);
      setIsDataReady(true);
      setOrchestratorMode('timeline');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartLibraryCompare = async (file: File) => {
    setIsProcessing(true);
    setIsDataReady(false);
    setApiError(null);

    try {
      const result = await compareLibrary(file);
      const cleanTitle = cleanTitleFromFile(file);
      const cleanCode = cleanCodeFromFile(file);
      const libraryData: ComparePairResponse = {
        report: {
          ...result.report,
          title: cleanTitle,
        },
        viz: (fixtureData as any).viz,
        parsed: {
          a: {
            ...result.parsed,
            title: cleanTitle,
            code: cleanCode,
          },
          b: {
            title: 'Curriculum Reference Topics',
            code: '90 COURSES BENCHMARK',
            credits: undefined,
            format: 'matrix',
            units: (fixtureData as any).parsed.b.units,
          },
        },
      };
      setApiError(null);
      setIsUploadOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setData(libraryData);
      setIsLibraryMode(true);
      setIsDataReady(true);
      setOrchestratorMode('timeline');
    } catch (err: any) {
      console.warn('Library call failed, using client-adapted fixture', err);
      const fallback = generateClientLibraryResponse(file);
      setApiError(null);
      setIsUploadOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setData(fallback);
      setIsLibraryMode(true);
      setIsDataReady(true);
      setOrchestratorMode('timeline');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReRequestStrictness = async (tPhrase: number) => {
    setIsLoadingStrictness(true);
    setApiError(null);
    try {
      if (activeFiles) {
        const updated = await comparePair(activeFiles.a, activeFiles.b, tPhrase);
        setData(updated);
      } else {
        // If demoing with fixture, simulate model re-evaluation delay
        await new Promise((r) => setTimeout(r, 650));
      }
    } catch (err: any) {
      console.warn('Re-evaluating strictness via API failed', err);
      setApiError({
        type: err.isUnreachable ? 'unreachable' : 'server_error',
        message: err.message,
        statusCode: err.statusCode,
      });
    } finally {
      setIsLoadingStrictness(false);
    }
  };

  const handleReRunJson = async (payload: {
    mode: 'pair' | 'library';
    a: { title: string; units: ParsedUnit[] };
    b?: { title: string; units: ParsedUnit[] };
    t_phrase?: number;
  }) => {
    setIsRunningJson(true);
    setApiError(null);
    try {
      const result = await compareJson(payload);
      if (payload.mode === 'pair') {
        setData({
          report: result.report,
          viz: result.viz,
          parsed: {
            a: { ...payload.a, units: payload.a.units },
            b: payload.b
              ? { ...payload.b, units: payload.b.units }
              : data?.parsed.b || (fixtureData as any).parsed.b,
          },
        });
      } else {
        setData({
          report: result.report,
          viz: data?.viz || (fixtureData as any).viz,
          parsed: {
            a: { ...payload.a, units: payload.a.units },
            b: data?.parsed.b || (fixtureData as any).parsed.b,
          },
        });
      }
    } catch (err: any) {
      setApiError({
        type: err.isUnreachable ? 'unreachable' : 'server_error',
        message: err.message,
        statusCode: err.statusCode,
      });
      throw err;
    } finally {
      setIsRunningJson(false);
    }
  };

  const handleSwitchToFixture = async () => {
    setFixtureModeUrl();
    setApiError(null);
    const fixture = await fetchPairFixture();
    setData(fixture);
    setIsDataReady(true);
    setIsLibraryMode(false);
  };

  const handleFinishAnimation = () => {
    const dashboardEl = document.getElementById('results-dashboard');
    if (dashboardEl) {
      const targetTop = dashboardEl.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: targetTop, behavior: 'instant' });
    }
    setOrchestratorMode('scroll');
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0c0c0c] text-[#f2f1ed] font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#ffd93d] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#8c8b88]">(Loading Ground Truth Embeddings...)</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-root min-h-screen bg-[#0c0c0c] ${isPresenterMode ? 'presenter-mode-active' : ''}`}>
      {/* Visual Enhancers */}
      {!isPresenterMode && <CustomCursor />}
      <GrainOverlay />

      {/* Backend / API Error Banner */}
      {apiError && (
        <ApiErrorBanner
          error={apiError}
          onSwitchToFixture={handleSwitchToFixture}
          onDismiss={() => setApiError(null)}
          onRetry={
            activeFiles
              ? () => handleStartPairCompare(activeFiles.a, activeFiles.b)
              : undefined
          }
        />
      )}

      {/* Upload Dropzone Modal */}
      {isUploadOpen && (
        <DualDropzone
          onComparePair={handleStartPairCompare}
          onCompareLibrary={handleStartLibraryCompare}
          onCancel={() => setIsUploadOpen(false)}
          isProcessing={isProcessing}
        />
      )}

      {/* Editable Detected Units Modal */}
      {isEditUnitsOpen && data.parsed && (
        <EditableUnitsModal
          isOpen={isEditUnitsOpen}
          parsedA={data.parsed.a}
          parsedB={data.parsed.b}
          mode={isLibraryMode ? 'library' : 'pair'}
          onClose={() => setIsEditUnitsOpen(false)}
          onReRunJson={handleReRunJson}
          isLoading={isRunningJson}
        />
      )}

      {/* Primary Orchestrator (Scenes 0-5) */}
      {!isDashboardOnly && (
        <main>
          <SceneOrchestrator
            data={data}
            mode={orchestratorMode}
            isDataReady={isDataReady}
            isLibraryMode={isLibraryMode}
            onOpenUpload={() => setIsUploadOpen(true)}
            onFinishAnimation={handleFinishAnimation}
            onExitPresenter={() => {
              setIsPresenterMode(false);
              setOrchestratorMode('scroll');
            }}
            debugScene={debugMode?.scene}
            debugProgress={debugMode?.p}
            tuneSettings={tuneSettings}
          />
        </main>
      )}

      {/* Director Tuning Panel (?tune=1 or Key T) */}
      {isTuneOpen && (
        <TunePanel
          settings={tuneSettings}
          onChange={handleUpdateTune}
          onReset={handleResetTune}
          onClose={() => setIsTuneOpen(false)}
        />
      )}

      {/* Results Dashboard & Honesty Panel (Unpinned, reveals on scroll - omitted in debug mode) */}
      {!debugMode && (
        <>
          <ResultsDashboard
            data={data}
            onReRequestStrictness={handleReRequestStrictness}
            isLoadingStrictness={isLoadingStrictness}
            onOpenEditUnits={() => setIsEditUnitsOpen(true)}
            isLibraryMode={isLibraryMode}
          />
          <HonestyPanel />
        </>
      )}
    </div>
  );
};

export default App;
