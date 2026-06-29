import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Candidate, Log, UserRole, ViewType } from '../types';
import { normalizeType, formatYYYYMMDD, getKoreanGrade, getKoreanPassText, checkKoreanPass, determineResult, getSkillGradeByScore } from '../lib/utils';

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [globalLogs, setGlobalLogs] = useState<Log[]>([]);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [evaluatorName, setEvaluatorName] = useState('');
  const [gasUrl, setGasUrlState] = useState<string>('https://script.google.com/macros/s/AKfycbyGi7nLuyFz_DIuEYdBu_4bWWa0VWU93zVnsUQi9SDLi9r7lU0c1a_j6gNigPoyhuf5/exec');
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedCandidateUid, setSelectedCandidateUid] = useState<string | null>(null);
  const [confCountry, setConfCountryState] = useState('');
  const [confAgency, setConfAgencyState] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedUrl = localStorage.getItem('gasUrl');
    if (savedUrl) setGasUrlState(savedUrl);
    const savedCountry = localStorage.getItem('confCountry');
    if (savedCountry) setConfCountryState(savedCountry);
    const savedAgency = localStorage.getItem('confAgency');
    if (savedAgency) setConfAgencyState(savedAgency);

    try {
      const savedCandidates = localStorage.getItem('hd_candidates');
      if (savedCandidates) setCandidates(JSON.parse(savedCandidates));
      const savedLogs = localStorage.getItem('hd_logs');
      if (savedLogs) setGlobalLogs(JSON.parse(savedLogs));
    } catch (e) {
      console.error("Failed to load local data", e);
    }
  }, []);

  const setGasUrl = (url: string) => {
    setGasUrlState(url);
    localStorage.setItem('gasUrl', url);
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
      
      let logs = data.logs || [];
      
      const mappedCandidates = (data.candidates || []).map((d: any) => {
        const eType = normalizeType(d.eval_type);
        const fDate = formatYYYYMMDD(d.eval_date);
        
        let k = Number(d.k_score) || 0;
        let s_w = Number(d.s_score_weld) || 0;
        let s_f = Number(d.s_score_fit) || 0;
        
        if (k === 0) {
            const applicantLogs = logs.filter((l: any) => String(l.app_no) === String(d.app_no) && normalizeType(l.eval_type) === eType);
            if (applicantLogs.length > 0) {
                let sum = 0;
                applicantLogs.forEach((l: any) => sum += (Number(l.score)||0));
                k = Math.round(sum / applicantLogs.length);
            }
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
            ...d, job: d.job, age: Number(d.age)||0, e9: d.e9, eval_type: eType,
            k_score: k, s_score_weld: s_w, s_score_fit: s_f, s_status: s_stat
        };
        
        let k_g = d.k_grade && d.k_grade !== '-' ? d.k_grade : (k > 0 ? getKoreanGrade(k) : '-');
        let k_p = d.k_pass && d.k_pass !== '대기' && d.k_pass !== '' ? d.k_pass : (k > 0 ? getKoreanPassText(checkKoreanPass(tempP)) : '대기');
        const res = (d.result && d.result !== '대기' && d.result !== '') ? d.result : determineResult(tempP);

        return {
            ...d,
            name: (d.name || '').toUpperCase(),
            id: String(d.app_no), 
            uid: d.app_no+'_'+d.name+'_'+fDate+'_'+eType, 
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
            result: res
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
      confCountry, setConfCountry, confAgency, setConfAgency, fetchData, isLoading, logout
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
