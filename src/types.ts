export interface Candidate {
  id: string;
  uid: string;
  no: number;
  app_no: string;
  job: string;
  name: string;
  dob: string;
  age: number;
  e9: string;
  country: string;
  agency: string;
  eval_type: string;
  eval_date: string;
  
  k_score: number;
  k_grade: string;
  k_pass: string;
  k_status: string;
  
  s_score_fit: number;
  grade_fit: string;
  s_score_weld: number;
  grade_weld: string;
  s_status: string;
  memo?: string;
  
  result: string;
  k_vals?: number[];
  k_scores_actual?: number[];
  avg_detailed?: number[];
}

export interface Log {
  app_no: string;
  evaluator: string;
  score: number;
  timestamp: string;
  details: string;
  name: string;
  eval_type: string;
  uid?: string;
}

export type UserRole = 'admin' | 'evaluator' | 'interviewer' | null;

export type ViewType = 'dashboard' | 'evaluation' | 'admin';
