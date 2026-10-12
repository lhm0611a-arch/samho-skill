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
  memo?: string; // 한국어 인터뷰 종합 의견 및 특이사항
  interview_memo?: string; // 한국어 인터뷰 특이사항
  skill_memo?: string; // 기량 검증 특이사항 (추가 열)
  starred?: boolean; // 별표 (특이사항/관심 인원 표시)
  
  result: string;
  k_vals?: number[];
  k_scores_actual?: number[];
  avg_detailed?: number[];
  
  // Media Links (Google Drive)
  video_url?: string; // 영상 공유 링크 (AF열)
  test_url?: string;  // 인성검사 보고서 링크 (AG열)
}

export interface Log {
  app_no: string;
  evaluator: string;
  score: number;
  timestamp?: string;
  eval_date?: string;
  details: string;
  name: string;
  eval_type: string;
  uid?: string;
}

export type UserRole = 'admin' | 'evaluator' | 'interviewer' | null;

export type ViewType = 'dashboard' | 'evaluation' | 'admin' | 'report';
