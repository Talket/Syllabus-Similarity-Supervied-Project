export interface TopicItem {
  unit: number;
  topic: string;
  covered: boolean;
  score: number;
  course_id?: string;
  course_title?: string;
  match?: string;
  match_unit?: number | null;
}

export interface Topics {
  total: number;
  covered: number;
  new: number;
  items: TopicItem[];
}

export interface Unit {
  order: number;
  title: string;
  status: 'NOVEL' | 'partly covered' | 'covered' | string;
  best_score?: number;
  best_course?: string;
  best_course_title?: string;
  best_unit_title?: string;
}

export interface SharedTopic {
  new: string;
  existing: string;
  sim: number;
}

export interface CoveredElsewhere {
  topic: string;
  match: string;
  match_unit: number;
}

export interface Match {
  new_order: number;
  old_order: number;
  score: number;
  band: string;
  new_text: string;
  old_text: string;
  shared_topics: SharedTopic[];
  covered_elsewhere: CoveredElsewhere[];
  only_in_new: string[];
  only_in_existing: string[];
}

export interface CourseMatch {
  course_id?: string;
  title: string;
  institution?: string;
  similarity?: number;
  coverage_new: number;
  coverage_existing: number;
  topics_covered: number;
  topics_total: number;
  matches: Match[];
  unmatched_new_units: { order: number; title: string }[];
}

export interface Report {
  title: string;
  n_units: number;
  novelty: number;
  topics: Topics;
  units: Unit[];
  courses: CourseMatch[];
  excluded_as_identical?: string[];
}

export interface VizPoint {
  id: number;
  side: 'A' | 'B';
  unit: number;
  text: string;
  x: number;
  y: number;
  covered: boolean;
}

export interface VizLink {
  a: number;
  b: number;
  score: number;
}

export interface UnitMatrix {
  a_titles: string[];
  b_titles: string[];
  sim: number[][];
}

export interface Viz {
  points: VizPoint[];
  links: VizLink[];
  unit_matrix: UnitMatrix;
}

export interface ParsedUnit {
  order: number;
  title: string;
  text: string;
}

export interface ParsedOutcome {
  id: string;
  text: string;
}

export interface ParsedDoc {
  title: string;
  code?: string;
  credits?: number;
  format?: string;
  units: ParsedUnit[];
  outcomes?: ParsedOutcome[];
  warnings?: string[];
}

export interface ComparePairResponse {
  report: Report;
  viz: Viz;
  parsed: {
    a: ParsedDoc;
    b: ParsedDoc;
  };
}

export interface LibraryCourse {
  course_id: string;
  title: string;
  institution: string;
  domain: string;
  units: number;
}

