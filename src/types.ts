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

  // 일정 및 배정 관리 (Z ~ AE열)
  pass_date?: string;       // 합격일자 (사전기량: Z열 / 본기량: Z열)
  fail_date?: string;       // 탈락일자 (사전기량: AA열 / 본기량: AA열)
  entry_date?: string;      // 입국일자 (본기량 전용: AB열)
  entry_fail_date?: string; // 입국 탈락일자 (본기량 전용: AC열)
  track?: string;           // 트랙 (사전기량: AB열 / 본기량: AD열) - '공공기관' | '민간업체'
  department?: string;      // 부서명 (본기량 전용: AE열)
}

export const DEPARTMENTS = [
  '가공',
  '대조',
  '판넬',
  '의장1',
  '의장2',
  '의장3',
  '건조1',
  '건조2',
  '건조3',
  '선실생산',
  '선박커미셔닝',
  '선행의장'
] as const;

export type DepartmentType = typeof DEPARTMENTS[number];

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
