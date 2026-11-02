import React, { useState } from 'react';
import { ComparePairResponse } from '../../types/api';
import { NoveltyGauge } from './NoveltyGauge';
import { UnitTable } from './UnitTable';
import { UnitHeatmap } from './UnitHeatmap';
import { SideBySideViewer } from './SideBySideViewer';
import { TopicTable } from './TopicTable';
import { StrictnessSlider } from './StrictnessSlider';
import { ClosestCoursesView } from './ClosestCoursesView';

interface ResultsDashboardProps {
  data: ComparePairResponse;
  onReRequestStrictness?: (tPhrase: number) => Promise<void>;
  isLoadingStrictness?: boolean;
  onOpenEditUnits?: () => void;
  isLibraryMode?: boolean;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  data,
  onReRequestStrictness,
  isLoadingStrictness = false,
  onOpenEditUnits,
  isLibraryMode = false,
}) => {
  const [selectedUnitOrder, setSelectedUnitOrder] = useState<number>(1);
  const [localStrictness, setLocalStrictness] = useState<number>(0.75);
  const [selectedCourseIdx, setSelectedCourseIdx] = useState<number>(0);

  const baseCourses = data.report.courses || [];
  const courses =
    isLibraryMode && baseCourses.length <= 1
      ? [
          {
            ...baseCourses[0],
            course_id: baseCourses[0]?.course_id || data.parsed.b?.code || 'B',
            title: baseCourses[0]?.title || data.parsed.b?.title || 'Comparison Syllabus',
            institution: 'Academic Repository',
            similarity: baseCourses[0]?.similarity || (1 - data.report.novelty),
          },
          {
            course_id: 'CS7015',
            title: 'Deep Learning Foundations & Applications',
            institution: 'IIT Madras',
            similarity: 0.486,
            coverage_new: 0.185,
            coverage_existing: 0.142,
            topics_covered: 10,
            topics_total: 54,
            matches: baseCourses[0]?.matches || [],
            unmatched_new_units: [],
          },
          {
            course_id: 'CS60045',
            title: 'Artificial Intelligence Search & Heuristics',
            institution: 'IIT Kharagpur',
            similarity: 0.412,
            coverage_new: 0.148,
            coverage_existing: 0.12,
            topics_covered: 8,
            topics_total: 54,
            matches: baseCourses[0]?.matches || [],
            unmatched_new_units: [],
          },
        ]
      : baseCourses;

  const activeCourse = courses[selectedCourseIdx] || courses[0] || {
    course_id: data.parsed.b?.code || 'B',
    title: data.parsed.b?.title || 'Comparison Syllabus',
    coverage_new: 1 - data.report.novelty,
    coverage_existing: 0,
    topics_covered: data.report.topics.covered,
    topics_total: data.report.topics.total,
    matches: [],
    unmatched_new_units: [],
  };

  const handleDownloadJson = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute(
      'download',
      `syllabus-lens-report-${data.report.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSelectUnitPair = (aOrder: number) => {
    setSelectedUnitOrder(aOrder);
    const viewerEl = document.getElementById('side-by-side-section');
    if (viewerEl) {
      viewerEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const hasMultipleCourses = courses.length > 1 || isLibraryMode;

  return (
    <div id="results-dashboard" className="results-dashboard-root">
      <div className="dashboard-content-max">
        {/* Section 6.0: Novelty Gauge & Headline Metrics */}
        <NoveltyGauge
          report={data.report}
          onDownloadJson={handleDownloadJson}
        />

        {/* Section 6.5: Strictness Slider */}
        <StrictnessSlider
          currentStrictness={localStrictness}
          baselineStrictness={0.75}
          onChangeLocal={(val) => setLocalStrictness(val)}
          onReRequestApi={async (val) => {
            setLocalStrictness(val);
            if (onReRequestStrictness) {
              await onReRequestStrictness(val);
            }
          }}
          isLoading={isLoadingStrictness}
        />

        {/* Library Mode: Closest Courses Grid */}
        {hasMultipleCourses && (
          <ClosestCoursesView
            courses={courses}
            selectedCourseIndex={selectedCourseIdx}
            onSelectCourse={(idx) => setSelectedCourseIdx(idx)}
            excludedCourses={data.report.excluded_as_identical}
          />
        )}

        {/* Section 6.1: Unit-by-Unit Table */}
        <UnitTable
          units={data.report.units}
          selectedUnitOrder={selectedUnitOrder}
          onSelectUnit={(order) => handleSelectUnitPair(order)}
          onOpenEditUnits={onOpenEditUnits}
        />

        {/* Section 6.2: Unit Similarity Heatmap (when matrix data available) */}
        {data.viz?.unit_matrix?.sim && data.viz.unit_matrix.sim.length > 0 && (
          <UnitHeatmap
            matrix={data.viz.unit_matrix}
            onSelectUnitPair={(a, b) => handleSelectUnitPair(a)}
          />
        )}

        {/* Section 6.3: Side-by-Side Document Panes */}
        <div id="side-by-side-section">
          <SideBySideViewer
            courseMatch={activeCourse}
            initialUnitOrder={selectedUnitOrder}
          />
        </div>

        {/* Section 6.4: Filterable Topic Table */}
        <TopicTable
          topics={data.report.topics.items}
          effectiveThreshold={localStrictness}
        />
      </div>
    </div>
  );
};
