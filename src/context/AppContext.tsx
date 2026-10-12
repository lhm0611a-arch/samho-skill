import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Candidate, Log, UserRole, ViewType } from '../types';
import { 
  normalizeType, 
  normalizeDate,
  getKoreanGrade, 
  getKoreanPassText, 
  checkKoreanPass, 
  determineResult, 
  getSkillGradeByScore,
  normalizeAppNo,
  normalizeName,
  normalizeJob,
  normalizeDob,
  calculateAge,
  normalizeE9
} from '../lib/utils';

interface AppContextType {
  candidates: Candidate[];
  setCandidates: React.Dispatch<React.SetStateAction<Candidate[]>>;
  globalLogs: Log[];
  setGlobalLogs: React.Dispatch<React.SetStateAction<Log[]>>;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  evaluatorName: string;
  setEvaluatorName: (name: string) => void;
  gasUrl: string;
  setGasUrl: (url: string) => void;
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  selectedCandidateUid: string | null;
  setSelectedCandidateUid: (uid: string | null) => void;
  confCountry: string;
  setConfCountry: (country: string) => void;
  confAgency: string;
  setConfAgency: (agency: string) => void;
  fetchData: () => Promise<void>;
  isLoading: boolean;
  logout: () => void;
  updateCandidateMedia: (uid: string, videoUrl?: string, testUrl?: string) => Promise<boolean>;
  batchUpdateCandidateMedia: (updates: Array<{ uid?: string; app_no: string; eval_type?: string; eval_date?: string; video_url?: string; test_url?: string }>) => Promise<{ success: boolean; updatedCount: number; message?: string }>;
  toggleCandidateStar: (uid: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [globalLogs, setGlobalLogs] = useState<Log[]>([]);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [evaluatorName, setEvaluatorName] = useState('');
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxrCq-QC62HtmBYF4C5gibdCHb53D8dUvhwY4vXbFCPk_8TruwZ34eF00GmV1pRUjDD/exec';
  const [gasUrl, setGasUrlState] = useState<string>(DEFAULT_GAS_URL);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedCandidateUid, setSelectedCandidateUid] = useState<string | null>(null);
  const [confCountry, setConfCountryState] = useState('');
  const [confAgency, setConfAgencyState] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('gasUrl') || localStorage.getItem('hd_gas_url');
    const oldUrl = 'https://script.google.com/macros/s/AKfycbyGi7nLuyFz_DIuEYdBu_4bWWa0VWU93zVnsUQi9SDLi9r7lU0c1a_j6gNigPoyhuf5/exec';
    
    if (savedUrl && savedUrl !== oldUrl && savedUrl.trim().startsWith('https://script.google.com')) {
      setGasUrlState(savedUrl);
    } else {
      setGasUrlState(DEFAULT_GAS_URL);
      localStorage.setItem('gasUrl', DEFAULT_GAS_URL);
      localStorage.setItem('hd_gas_url', DEFAULT_GAS_URL);
    }
    const savedCountry = localStorage.getItem('confCountry');
    if (savedCountry) setConfCountryState(savedCountry);
    const savedAgency = localStorage.getItem('confAgency');
    if (savedAgency) setConfAgencyState(savedAgency);

    try {
      const savedLogsStr = localStorage.getItem('hd_logs');
      let loadedLogs: Log[] = [];
      if (savedLogsStr) {
        try {
          loadedLogs = JSON.parse(savedLogsStr);
          setGlobalLogs(loadedLogs);
        } catch (e) {}
      }

      const savedCandidates = localStorage.getItem('hd_candidates');
      if (savedCandidates) {
        const parsed = JSON.parse(savedCandidates);
        const seen = new Map<string, number>();
        const sanitized = parsed.map((c: any, idx: number) => {
          let eDate = normalizeDate(c.eval_date);
          if (!eDate && loadedLogs.length > 0) {
            const mLog = loadedLogs.find((l: any) => String(l.app_no).trim() === String(c.app_no).trim() && (normalizeType(l.eval_type) === normalizeType(c.eval_type) || !l.eval_type) && l.eval_date);
            if (mLog && mLog.eval_date) eDate = normalizeDate(mLog.eval_date);
          }
          const rawBase = c.uid ? c.uid.replace(/_\d+$/, '') : `${c.app_no}_${c.name}_${eDate}_${c.eval_type}`;
          const base = rawBase || `candidate_${idx}`;
          const count = seen.get(base) || 0;
          seen.set(base, count + 1);
          const uid = count === 0 ? base : `${base}_${count}`;
          return { ...c, eval_date: eDate, uid };
        });
        setCandidates(sanitized);
      }
    } catch (e) {
      console.error("Failed to load local data", e);
    }
  }, []);

  useEffect(() => {
    if (candidates.length > 0) {
      try {
        localStorage.setItem('hd_candidates', JSON.stringify(candidates));
      } catch (e) {}
    }
  }, [candidates]);

  useEffect(() => {
    if (globalLogs.length > 0) {
      try {
        localStorage.setItem('hd_logs', JSON.stringify(globalLogs));
      } catch (e) {}
    }
  }, [globalLogs]);

  const setGasUrl = (url: string) => {
    setGasUrlState(url);
    localStorage.setItem('gasUrl', url);
    localStorage.setItem('hd_gas_url', url);
  };

  const setConfCountry = (country: string) => {
    setConfCountryState(country);
    localStorage.setItem('confCountry', country);
  };

  const setConfAgency = (agency: string) => {
    setConfAgencyState(agency);
    localStorage.setItem('confAgency', agency);
  };

  const fetchData = async () => {
    if (!gasUrl) return;
    setIsLoading(true);
    try {
      const res = await fetch(gasUrl, { redirect: 'follow' });
      const text = await res.text();
      const data = JSON.parse(text);
      
      let logs = (data.logs || []).filter((l: any) => l && String(l.app_no || '').trim() !== '');
      
      // Group candidate rows by unique applicant key to prevent duplicate listings
      const rawCandidates = data.candidates || [];
      const deduplicatedMap = new Map<string, any>();

      rawCandidates.forEach((d: any, index: number) => {
        const eType = normalizeType(d.eval_type);
        const appNo = normalizeAppNo(d.app_no || index);
        const country = String(d.country || '').trim();
        const agency = String(d.agency || '').trim();
        // Candidate key: combination of app_no, eval_type, country, agency
        const candKey = `${appNo}_${eType}_${country}_${agency}`;

        if (!deduplicatedMap.has(candKey)) {
          deduplicatedMap.set(candKey, { ...d, app_no: appNo, _index: index });
        } else {
          // Merge: if existing has no date or lower score, prefer the more informative row
          const existing = deduplicatedMap.get(candKey);
          const preferNew = (!existing.eval_date && d.eval_date) ||
                            ((Number(d.k_score) || 0) > (Number(existing.k_score) || 0)) ||
                            ((Number(d.s_score_weld) || 0) > (Number(existing.s_score_weld) || 0));
          if (preferNew) {
            deduplicatedMap.set(candKey, { ...existing, ...d, app_no: appNo, _index: existing._index });
          } else {
            deduplicatedMap.set(candKey, { ...d, ...existing, app_no: appNo });
          }
        }
      });

      const uniqueCandidateList = Array.from(deduplicatedMap.values());
      const seenUids = new Map<string, number>();

      const mappedCandidates = uniqueCandidateList.map((d: any) => {
        const eType = normalizeType(d.eval_type);
        let fDate = normalizeDate(d.eval_date);
        if (!fDate && logs.length > 0) {
          const mLog = logs.find((l: any) => String(l.app_no).trim() === String(d.app_no).trim() && (normalizeType(l.eval_type) === eType || !l.eval_type) && l.eval_date);
          if (mLog && mLog.eval_date) fDate = normalizeDate(mLog.eval_date);
        }
        const appNo = normalizeAppNo(d.app_no);
        const candName = normalizeName(d.name);
        const job = normalizeJob(d.job);
        let dob = normalizeDob(d.dob);
        const rawE9 = d.e9 ?? d['E-9'] ?? d['e-9'] ?? d.e_9 ?? d['e9_exp'] ?? d['E-9출신여부'] ?? d['E-9 여부'] ?? d['E-9_출신여부'] ?? d['비자'] ?? d.visa;
        const e9 = normalizeE9(rawE9);
        let age = calculateAge(dob);
        if (age === 0 && d.age) {
          const parsedAge = parseInt(String(d.age).replace(/[^0-9]/g, ''), 10);
          if (!isNaN(parsedAge) && parsedAge >= 10 && parsedAge <= 90) {
            age = parsedAge;
          }
        }
        if (age > 0 && (!dob || dob.length < 10)) {
          dob = `${new Date().getFullYear() - age}-01-01`;
        }
        
        let k = Number(d.k_score) || 0;
        let s_w = Number(d.s_score_weld) || 0;
        let s_f = Number(d.s_score_fit) || 0;
        
        // Group valid logs by evaluator (ignoring corrupted/empty evaluator entries)
        const applicantLogsAll = logs.filter(
          (l: any) =>
            normalizeAppNo(l.app_no) === appNo &&
            normalizeType(l.eval_type) === eType &&
            l.evaluator && String(l.evaluator).trim() !== ''
        );
        const latestByEvaluator = new Map<string, any>();
        applicantLogsAll.forEach((l: any) => {
          const evalKey = String(l.evaluator).trim();
          latestByEvaluator.set(evalKey, l);
        });
        const applicantLogs = Array.from(latestByEvaluator.values());

        if (applicantLogs.length > 0) {
          let sum = 0;
          applicantLogs.forEach((l: any) => (sum += Number(l.score) || 0));
          k = Math.round(sum / applicantLogs.length);
        }

        let s_stat = d.s_status;
        if (!s_stat || s_stat !== '완료') {
            if (s_w > 0 || s_f > 0) s_stat = '완료';
            else s_stat = '대기';
        }
        
        let k_stat = d.k_status;
        if (!k_stat || k_stat !== '완료') {
            if (k > 0) k_stat = '완료';
            else k_stat = '대기';
        }
        
        const tempP = {
            ...d, 
            app_no: appNo,
            job: job, 
            name: candName,
            dob: dob,
            age: age, 
            e9: e9, 
            eval_type: eType,
            k_score: k, 
            s_score_weld: s_w, 
            s_score_fit: s_f, 
            s_status: s_stat
        };
        
        let k_g = k > 0 ? getKoreanGrade(k) : (d.k_grade && d.k_grade !== '-' ? d.k_grade : '-');
        let k_p = k > 0 ? getKoreanPassText(checkKoreanPass(tempP)) : (d.k_pass && d.k_pass !== '대기' && d.k_pass !== '' ? d.k_pass : '대기');
        const res = determineResult(tempP);

        const baseUid = `${appNo}_${candName}_${eType}`;
        const count = seenUids.get(baseUid) || 0;
        seenUids.set(baseUid, count + 1);
        const uniqueUid = count === 0 ? baseUid : `${baseUid}_${count}`;

        const videoUrl = String(d.video_url || d['영상'] || d['동영상'] || d['video'] || d['AF'] || '').trim();
        const testUrl = String(d.test_url || d['인성검사'] || d['인성'] || d['test'] || d['AG'] || '').trim();
        const isStarred = Boolean(d.starred || d['별표'] || d['star'] || d['AH'] === '★' || d['AH'] === 'O' || d['AH'] === '1' || d['AH'] === true);
        const interviewMemo = String(d.interview_memo || d.memo || d['특이사항'] || d['면접특이사항'] || d['AI'] || '').trim();
        const skillMemo = String(d.skill_memo || d['기량특이사항'] || d['AJ'] || '').trim();
        const combinedMemo = interviewMemo || skillMemo || '';

        return {
            ...d,
            app_no: appNo,
            name: candName,
            raw_name: candName,
            job: job,
            dob: dob,
            age: age,
            e9: e9,
            id: appNo, 
            uid: uniqueUid, 
            eval_type: eType,
            eval_date: fDate,
            k_score: k,
            k_grade: k_g,
            k_pass: k_p,
            s_score_weld: s_w,
            grade_weld: s_w > 0 ? getSkillGradeByScore(s_w) : '-',
            s_score_fit: s_f,
            grade_fit: s_f > 0 ? getSkillGradeByScore(s_f) : '-',
            k_status: k_stat,
            s_status: s_stat,
            result: res,
            video_url: videoUrl,
            test_url: testUrl,
            memo: combinedMemo,
            interview_memo: interviewMemo,
            skill_memo: skillMemo,
            starred: isStarred
        };
      });

      logs.forEach((l: any) => {
        if (!l.eval_type) l.eval_type = '사전기량검증'; 
        if (!l.uid) {
            let matches = mappedCandidates.filter((c: any) => String(c.app_no) === String(l.app_no) && c.eval_type === l.eval_type);
            if (matches.length > 0) l.uid = matches[0].uid;
        }
      });

      setGlobalLogs(logs);
      localStorage.setItem('hd_logs', JSON.stringify(logs));
      setCandidates(mappedCandidates);
      localStorage.setItem('hd_candidates', JSON.stringify(mappedCandidates));
      alert("클라우드 데이터 연동이 완료되었습니다.");
    } catch (e) {
      console.error(e);
      alert("서버 데이터 로드 실패. 앱스 스크립트 연결을 확인하세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateCandidateMedia = async (uid: string, videoUrl?: string, testUrl?: string): Promise<boolean> => {
    try {
      const target = candidates.find(c => c.uid === uid);
      if (!target) return false;

      const nextCandidates = candidates.map(c => {
        if (c.uid === uid) {
          return {
            ...c,
            video_url: videoUrl !== undefined ? videoUrl : c.video_url,
            test_url: testUrl !== undefined ? testUrl : c.test_url
          };
        }
        return c;
      });

      setCandidates(nextCandidates);
      localStorage.setItem('hd_candidates', JSON.stringify(nextCandidates));

      // Sync to Google Apps Script if URL configured
      if (gasUrl) {
        try {
          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              type: 'update_media',
              app_no: target.app_no,
              eval_type: target.eval_type,
              name: target.name,
              video_url: videoUrl !== undefined ? videoUrl : target.video_url,
              test_url: testUrl !== undefined ? testUrl : target.test_url
            })
          });
        } catch (gasErr) {
          console.warn('Google Sheet GAS single update sync warning:', gasErr);
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to update candidate media:', err);
      return false;
    }
  };

  const batchUpdateCandidateMedia = async (
    updates: Array<{ uid?: string; app_no: string; eval_type?: string; eval_date?: string; video_url?: string; test_url?: string }>
  ): Promise<{ success: boolean; updatedCount: number; message?: string }> => {
    if (!updates || updates.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    try {
      // Map for quick matching
      const updateMap = new Map<string, typeof updates[0]>();
      updates.forEach(u => {
        const key = `${normalizeAppNo(u.app_no)}_${normalizeType(u.eval_type || '')}`;
        updateMap.set(key, u);
      });

      let updatedCount = 0;
      const nextCandidates = candidates.map(c => {
        const key = `${normalizeAppNo(c.app_no)}_${normalizeType(c.eval_type || '')}`;
        const match = (c.uid && updates.find(u => u.uid === c.uid)) || updateMap.get(key);
        if (match) {
          let changed = false;
          let newV = c.video_url;
          let newT = c.test_url;
          if (match.video_url !== undefined && match.video_url !== c.video_url) {
            newV = match.video_url;
            changed = true;
          }
          if (match.test_url !== undefined && match.test_url !== c.test_url) {
            newT = match.test_url;
            changed = true;
          }
          if (changed) {
            updatedCount++;
            return { ...c, video_url: newV, test_url: newT };
          }
        }
        return c;
      });

      setCandidates(nextCandidates);
      localStorage.setItem('hd_candidates', JSON.stringify(nextCandidates));

      // Sync to Google Sheets via GAS
      if (gasUrl) {
        try {
          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              type: 'batch_update_media',
              updates: updates.map(u => ({
                app_no: normalizeAppNo(u.app_no),
                eval_type: normalizeType(u.eval_type || ''),
                eval_date: normalizeDate(u.eval_date || ''),
                video_url: u.video_url || '',
                test_url: u.test_url || ''
              }))
            })
          });
        } catch (gasErr) {
          console.warn('Google Sheet GAS batch sync warning:', gasErr);
        }
      }

      return { success: true, updatedCount };
    } catch (err: any) {
      console.error('Batch media update error:', err);
      return { success: false, updatedCount: 0, message: err.message };
    }
  };

  const toggleCandidateStar = async (uid: string): Promise<boolean> => {
    try {
      const target = candidates.find(c => c.uid === uid);
      if (!target) return false;

      const nextStarred = !target.starred;
      const nextCandidates = candidates.map(c => {
        if (c.uid === uid) {
          return { ...c, starred: nextStarred };
        }
        return c;
      });

      setCandidates(nextCandidates);
      localStorage.setItem('hd_candidates', JSON.stringify(nextCandidates));

      if (gasUrl) {
        try {
          fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              type: 'toggle_star',
              app_no: target.app_no,
              eval_type: target.eval_type,
              name: target.name,
              starred: nextStarred
            })
          }).catch(e => console.warn('GAS toggle_star warning:', e));
        } catch (gasErr) {
          console.warn('Google Sheet GAS toggle star sync warning:', gasErr);
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to toggle star:', err);
      return false;
    }
  };

  useEffect(() => {
    if (userRole && gasUrl) {
      fetchData();
    }
  }, [userRole]);

  const logout = () => {
    setUserRole(null);
    setEvaluatorName('');
    setCurrentView('dashboard');
  };

  return (
    <AppContext.Provider value={{
      candidates, setCandidates, globalLogs, setGlobalLogs, userRole, setUserRole,
      evaluatorName, setEvaluatorName, gasUrl, setGasUrl, currentView, setCurrentView,
      selectedCandidateUid, setSelectedCandidateUid,
      confCountry, setConfCountry, confAgency, setConfAgency, fetchData, isLoading, logout,
      updateCandidateMedia, batchUpdateCandidateMedia, toggleCandidateStar
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
