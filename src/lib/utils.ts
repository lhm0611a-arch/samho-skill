import { Candidate } from '../types';

export function normalizeType(t: string): string {
  if (!t) return '사전기량검증';
  const str = String(t).replace(/\s/g, ''); 
  if (str.includes('본')) return '본기량검증';
  return '사전기량검증';
}

export function formatYYYYMMDD(str: string): string {
  if (!str) return '';
  const s = String(str).trim();
  const match = s.match(/(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/);
  if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  return s.split(/[ T]/)[0].replace(/\./g, '-'); 
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
