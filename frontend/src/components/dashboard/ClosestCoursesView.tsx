import React from 'react';
import { CourseMatch } from '../../types/api';

interface ClosestCoursesViewProps {
  courses: CourseMatch[];
  selectedCourseIndex: number;
  onSelectCourse: (index: number) => void;
  excludedCourses?: string[];
}

export const ClosestCoursesView: React.FC<ClosestCoursesViewProps> = ({
  courses,
  selectedCourseIndex,
  onSelectCourse,
  excludedCourses = [],
}) => {
  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-section" aria-label="Library Comparison Results">
      <div className="section-header-row">
        <div>
          <div className="section-tag num">
            <span className="accent">(Library Search) 6.2</span> Closest 90-Course Library Counterparts
          </div>
          <h3 className="dashboard-subheading">Ranked Curriculum Overlaps Across Institutional Library</h3>
        </div>
        <div className="num text-xs text-[#8c8b88]">
          <span>{courses.length} Closest Matches Identified</span>
        </div>
      </div>

      <div className="closest-courses-grid">
        {courses.map((course, idx) => {
          const isSelected = selectedCourseIndex === idx;
          const simPct = Math.round((course.similarity || 0) * 100);
          const coveragePct = Math.round((course.coverage_new || 0) * 100);

          return (
            <div
              key={course.course_id || idx}
              onClick={() => onSelectCourse(idx)}
              className={`closest-course-card ${isSelected ? 'is-selected' : ''}`}
            >
              {/* Top Row: Rank & Similarity */}
              <div>
                <div className="closest-course-top-row num">
                  <span className="closest-course-rank">
                    #{String(idx + 1).padStart(2, '0')} CLOSEST MATCH
                  </span>
                  <span className="closest-course-institution">
                    {course.institution || 'ACADEMIC REPOSITORY'}
                  </span>
                </div>

                <h4 className="closest-course-title">
                  {course.title}
                </h4>

                {course.course_id && (
                  <div className="closest-course-code num">
                    Course Code: <span className="text-[#eceff4]">{course.course_id}</span>
                  </div>
                )}
              </div>

              {/* Metrics Grid */}
              <div>
                <div className="closest-course-metrics-row num">
                  {/* Metric 1: Overall Similarity */}
                  <div>
                    <span className="closest-course-metric-label">
                      Cosine Affinity
                    </span>
                    <span className="closest-course-metric-val text-cyan">
                      {simPct}%
                    </span>
                    <div className="closest-course-meter-bar">
                      <div
                        className="closest-course-meter-fill bg-cyan"
                        style={{ width: `${Math.min(100, simPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metric 2: Proposal Coverage */}
                  <div>
                    <span className="closest-course-metric-label">
                      Proposal Covered
                    </span>
                    <span className="closest-course-metric-val text-yellow">
                      {coveragePct}%
                    </span>
                    <div className="closest-course-meter-bar">
                      <div
                        className="closest-course-meter-fill bg-yellow"
                        style={{ width: `${Math.min(100, coveragePct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Match summary stats */}
                <div className="flex justify-between text-xs num text-[#8c8b88] mb-3">
                  <span>
                    Topics: <strong className="text-[#eceff4]">{course.topics_covered}</strong> / {course.topics_total}
                  </span>
                  <span>
                    Modules: <strong className="text-[#eceff4]">{course.matches?.length || 0}</strong>
                  </span>
                </div>

                <button
                  type="button"
                  className={`closest-course-select-btn ${isSelected ? 'is-active' : ''}`}
                >
                  {isSelected ? '✓ Active Inspection Target' : 'Select for Deep Alignment'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {excludedCourses.length > 0 && (
        <div className="p-3 rounded bg-[rgba(242,241,237,0.03)] border border-[rgba(242,241,237,0.08)] num text-xs text-[#8c8b88] flex items-center gap-2">
          <span className="text-yellow">ℹ Note:</span>
          <span>
            {excludedCourses.length} verbatim duplicate course(s) were automatically filtered out as identical copies: {excludedCourses.join(', ')}.
          </span>
        </div>
      )}
    </section>
  );
};
