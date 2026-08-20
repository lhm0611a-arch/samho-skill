import { Candidate } from '../types';

export function normalizeType(t: string): string {
  if (!t) return '사전기량검증';
  const str = String(t).replace(/\s/g, ''); 
  if (str.includes('본')) return '본기량검증';
  return '사전기량검증';
}

/**
 * 응시번호 정규화:
 * - 영문 대문자화
 * - 영문과 숫자 사이에 하이픈('-') 무조건 삽입
 * - 숫자는 3자리(001, 002, 010, 100 등)로 패딩
 * 예: TM01 -> TM-001, TM-1 -> TM-001, C1 -> C-001, D-04 -> D-004, d18 -> D-018
 */
export function normalizeAppNo(raw: any): string {
  if (raw === undefined || raw === null) return '';
  let str = String(raw).trim().toUpperCase();
  if (!str) return '';
  // 공백 및 언더바 제거
  str = str.replace(/[\s_]+/g, '');
  
  // 영문 접두사 + (선택적 기호) + 숫자 + (선택적 접미사)
  const match = str.match(/^([A-Z]+)[-_.]*(\d+)(.*)$/);
  if (match) {
    const prefix = match[1];
    const digits = match[2];
    const suffix = match[3] || '';
    const padded = digits.padStart(3, '0');
    return `${prefix}-${padded}${suffix}`;
  }

  // 숫자만으로 시작하는 경우
  const numMatch = str.match(/^(\d+)(.*)$/);
  if (numMatch) {
    const digits = numMatch[1];
    const suffix = numMatch[2] || '';
    const padded = digits.padStart(3, '0');
    return `${padded}${suffix}`;
  }

  return str;
}

/**
 * 성명 정규화:
 * - 모든 영문 소문자를 대문자로 변환
 * - 연속 공백 및 앞뒤 공백 제거
 * 예: "phan huu cuong" -> "PHAN HUU CUONG"
 */
export function normalizeName(raw: any): string {
  if (raw === undefined || raw === null) return '이름없음';
  const s = String(raw).toUpperCase().replace(/\s+/g, ' ').trim();
  return s || '이름없음';
}

/**
 * 직종 정규화:
 * - 용접, 선각취부, 의장취부 등으로 표준화
 */
export function normalizeJob(raw: any): string {
  if (raw === undefined || raw === null) return '선각취부';
  const s = String(raw).trim().replace(/\s+/g, '');
  if (!s) return '선각취부';
  if (s.includes('선각')) return '선각취부';
  if (s.includes('의장')) return '의장취부';
  if (s.includes('취부')) return '선각취부';
  if (s.includes('용접')) return '용접';
  return s;
}

/**
 * 생년월일 정규화:
 * - 19820611, 820611, 1982-06-11, 82-06-11, 1982.06.11, 82.06.11, 1982/06/11 등
 * - 모든 형태를 YYYY-MM-DD (예: 1982-06-11) 형식으로 변환
 * - 엑셀 시리얼 날짜 숫자도 자동 변환
 */
export function normalizeDob(raw: any): string {
  if (raw === undefined || raw === null) return '';

  const currentYear = new Date().getFullYear();

  // 1. 숫자형 또는 5자리 숫자 문자열 (엑셀 시리얼 날짜: 15000~50000 은 1941년~2036년 해당)
  const numVal = typeof raw === 'number' ? raw : (typeof raw === 'string' && /^\d{5}$/.test(raw.trim()) ? Number(raw.trim()) : null);
  if (numVal !== null && numVal >= 15000 && numVal <= 50000) {
    const date = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      if (y >= 1950 && y <= currentYear) {
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return '';

  // 2. 8자리 숫자 (YYYYMMDD) 예: 19820611, 20060304
  if (/^\d{8}$/.test(s)) {
    const y = parseInt(s.substring(0, 4), 10);
    const m = s.substring(4, 6);
    const d = s.substring(6, 8);
    if (y >= 1940 && y <= currentYear) {
      return `${y}-${m}-${d}`;
    }
  }

  // 3. 6자리 숫자 (YYMMDD) 예: 820611, 060304, 951130
  if (/^\d{6}$/.test(s)) {
    const yy = parseInt(s.substring(0, 2), 10);
    const m = s.substring(2, 4);
    const d = s.substring(4, 6);
    const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
    if (fullYear >= 1940 && fullYear <= currentYear) {
      return `${fullYear}-${m}-${d}`;
    }
  }

  // 4. 5자리 숫자 중 앞자리 0이 누락된 YYMMDD (예: 50616 -> 050616 -> 2005-06-16)
  if (/^\d{5}$/.test(s)) {
    const padded = '0' + s;
    const yy = parseInt(padded.substring(0, 2), 10);
    const m = parseInt(padded.substring(2, 4), 10);
    const d = parseInt(padded.substring(4, 6), 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const fullYear = 2000 + yy;
      if (fullYear <= currentYear) {
        return `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  // 5. 구분자가 있는 4자리 연도: YYYY[./-]MM[./-]DD, YYYY[./-]M[./-]D
  const match4 = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (match4) {
    const y = parseInt(match4[1], 10);
    const m = match4[2].padStart(2, '0');
    const d = match4[3].padStart(2, '0');
    if (y >= 1940 && y <= currentYear) {
      return `${y}-${m}-${d}`;
    }
  }

  // 6. 구분자가 있는 2자리 연도: YY[./-]MM[./-]DD, YY[./-]M[./-]D (예: 82-06-11, 82.06.11)
  const match2 = s.match(/^(\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
  if (match2) {
    const yy = parseInt(match2[1], 10);
    const m = match2[2].padStart(2, '0');
    const d = match2[3].padStart(2, '0');
    const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
    if (fullYear >= 1940 && fullYear <= currentYear) {
      return `${fullYear}-${m}-${d}`;
    }
  }

  // 7. 유럽/영미식 DD.MM.YYYY or DD/MM/YYYY
  const matchEuro = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (matchEuro) {
    const d = matchEuro[1].padStart(2, '0');
    const m = matchEuro[2].padStart(2, '0');
    const y = parseInt(matchEuro[3], 10);
    if (y >= 1940 && y <= currentYear) {
      return `${y}-${m}-${d}`;
    }
  }

  // 8. 4자리 출생연도만 입력된 경우 (예: 1986)
  if (/^\d{4}$/.test(s)) {
    const y = parseInt(s, 10);
    if (y >= 1940 && y <= currentYear) {
      return `${y}-01-01`;
    }
  }

  // 9. 일반 Date 파싱 (1940 ~ 현재연도 범위만 인정)
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 1940 && y <= currentYear) {
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // 유효하지 않은 날짜(예: 56166, 전화번호, 텍스트 등)는 빈 문자열로 정돈
  return '';
}

/**
 * 생년월일(YYYY-MM-DD) 기반 만 나이(International Age) 정확 계산
 */
export function calculateAge(dobStr: string, refDate: Date = new Date()): number {
  if (!dobStr) return 0;
  const normalized = normalizeDob(dobStr);
  if (!normalized) return 0;
  const parts = normalized.split('-');
  if (parts.length < 3) return 0;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10);
  const birthDay = parseInt(parts[2], 10);
  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return 0;

  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth() + 1;
  const currentDay = refDate.getDate();

  let age = currentYear - birthYear;
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age--;
  }
  return (age >= 10 && age <= 90) ? age : 0;
}

/**
 * E-9 여부 정규화 (O 또는 X)
 */
export function normalizeE9(raw: any): string {
  if (raw === undefined || raw === null) return 'X';
  const s = String(raw).toUpperCase().trim();
  if (['O', '0', 'YES', 'Y', 'TRUE', '○', '유', '1'].some(k => s === k || s.includes(k))) {
    return 'O';
  }
  return 'X';
}

export function formatYYYYMMDD(str: string): string {
  return normalizeDob(str);
}

export function getSkillGradeByScore(val: number): string {
  if (!val || val === 0) return '-';
  if (val >= 91) return "S";
  if (val >= 76) return "A";
  if (val >= 61) return "B";
  if (val >= 51) return "C";
  return "D";
}

export function getKoreanGrade(score: number): string {
  if (!score || score === 0) return '-';
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'E';
}

export function getKoreanPassText(result: string): string {
  if (result === '최종 합격') return '합격';
  if (result === '조건부 합격') return '조건부';
  if (result === '불합격') return '불합격';
  return '대기';
}

export function checkKoreanPass(p: Partial<Candidate>): string {
  const kScore = p.k_score || 0;
  const age = p.age || 0; 
  const isPre = (p.eval_type === '사전기량검증' || p.eval_type === '사전');
  
  if (!kScore) return '대기';
  
  if (isPre) {
      if (age >= 40) {
          return kScore >= 60 ? '최종 합격' : '불합격';
      } else if (age >= 30 && age <= 39) {
          return kScore >= 50 ? '최종 합격' : '불합격';
      } else if (age >= 24 && age <= 29) {
          if (kScore >= 50) return '최종 합격'; 
          if (kScore >= 45) return '조건부 합격';
          return '불합격';
      } else { // 23세 이하
          if (kScore >= 50) return '최종 합격'; 
          if (kScore >= 40) return '조건부 합격';
          return '불합격';
      }
  } else {
      if (age >= 40) {
          return kScore >= 70 ? '최종 합격' : '불합격';
      } else if (age >= 30 && age <= 39) {
          return kScore >= 60 ? '최종 합격' : '불합격';
      } else if (age >= 24 && age <= 29) {
          if (kScore >= 60) return '최종 합격'; 
          if (kScore >= 50) return '조건부 합격';
          return '불합격';
      } else { // 23세 이하
          if (kScore >= 60) return '최종 합격'; 
          if (kScore >= 45) return '조건부 합격';
          return '불합격';
      }
  }
}

export function checkSkillPass(p: Partial<Candidate>): boolean {
  const sWeld = p.s_score_weld || 0;
  const sFit = p.s_score_fit || 0;
  const isFit = (p.job || '').includes('취부');
  
  const isPre = (p.eval_type === '사전기량검증' || p.eval_type === '사전');
  const passFit = isPre ? 41 : 51;
  const passWeld = isPre ? 51 : 61;
  
  if (isFit) {
      if (sWeld === 0 || sFit === 0) return false;
      return (sFit >= passFit) && (sWeld >= passWeld);
  } else {
      if (sWeld === 0) return false;
      return (sWeld >= passWeld);
  }
}

export function determineResult(p: Partial<Candidate>): string {
  const isFit = (p.job || '').includes('취부');
  const isSkillDone = isFit ? (p.s_score_weld! > 0 && p.s_score_fit! > 0) : (p.s_score_weld! > 0);
  const isKoreanDone = p.k_score! > 0;

  if (isSkillDone && !checkSkillPass(p)) return '불합격';
  if (!isSkillDone || !isKoreanDone) return '대기';
  
  return checkKoreanPass(p); 
}

export async function hashPassword(pwd: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function getBadgeHtml(type: string): string {
  if (type === '사전기량검증' || type === '사전') {
    return `<span class="badge-pre type-badge font-kor font-bold text-[10px]">사전기량</span>`;
  }
  if (type === '본기량검증' || type === '본') {
    return `<span class="badge-main type-badge font-kor font-bold text-[10px]">본기량</span>`;
  }
  return '';
}
