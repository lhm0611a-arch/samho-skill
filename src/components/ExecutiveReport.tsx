import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Printer, 
  ArrowLeft, 
  Calendar, 
  Building, 
  Users, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  HardHat, 
  Languages, 
  BookOpen, 
  Layers, 
  Check, 
  ChevronDown, 
  X, 
  ShieldCheck, 
  TrendingUp, 
  UserCheck,
  UserX,
  FileSpreadsheet,
  BarChart3
} from 'lucide-react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  PointElement, 
  LineElement, 
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { useAppContext } from '../context/AppContext';
import { Candidate } from '../types';
import { 
  normalizeType,
  normalizeDate, 
  checkKoreanPass, 
  checkSkillPass, 
  determineResult, 
  getKoreanGrade, 
  getSkillGradeByScore,
  isE9Candidate
} from '../lib/utils';

// Register ChartJS components
ChartJS.register(
  PointElement, 
  LineElement, 
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement, 
  Tooltip, 
  Legend
);

// Custom Chart.js Plugin for displaying numbers on top of bars during print/view
const barDataLabelsPlugin = {
  id: 'barDataLabels',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    ctx.save();
    chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta.hidden) {
        meta.data.forEach((element: any, index: number) => {
          const val = dataset.data[index];
          if (val !== undefined && val !== null) {
            const { x, y } = element.tooltipPosition();
            ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#0f172a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${val}명`, x, Math.max(14, y - 3));
          }
        });
      }
    });
    ctx.restore();
  }
};

// Official HD Hyundai Samho CI Logo Component
export function HdHyundaiCiLogo({ className = "h-9" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img 
        src="/ci1.png" 
        alt="HD현대삼호" 
        className="h-full w-auto object-contain max-h-12" 
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
      <div className="hidden flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <svg className="h-6 w-auto aspect-[1.1/1]" viewBox="0 0 45 40" fill="none">
            <path d="M0 20L22.5 0L45 20L22.5 40L0 20Z" fill="#00A859" />
            <path d="M22.5 0L45 20L31 20L15.5 5L22.5 0Z" fill="#008F4C" />
          </svg>
          <span className="font-black tracking-tighter text-[#0f2744] text-xl leading-none">
            HD<span className="font-bold text-[#0f2744] ml-0.5">현대삼호</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ExecutiveReport() {
  const { candidates, setCurrentView } = useAppContext();

  // 1. Report Assessment Type Filter: 'all' | '본기량검증' | '사전기량검증'
  const [reportType, setReportType] = useState<'all' | '본기량검증' | '사전기량검증'>('all');

  // 2. Multi-date selection state (Applied state & Temp draft state for confirmation)
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [tempSelectedDates, setTempSelectedDates] = useState<string[]>([]);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // 3. Multi-agency selection state (Applied state & Temp draft state for confirmation)
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [tempSelectedAgencies, setTempSelectedAgencies] = useState<string[]>([]);
  const [isAgencyMenuOpen, setIsAgencyMenuOpen] = useState(false);
  const agencyDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedJob, setSelectedJob] = useState<string>('all');

  // 4. Report Mode Toggle: Details (with appendix) - Default: true (세부 명단 기본 포함)
  const [includeDetails, setIncludeDetails] = useState<boolean>(true);

  // 5. Report Cover Page Toggle: Cover Page on/off - Default: true (표지 기본 포함)
  const [includeCover, setIncludeCover] = useState<boolean>(true);

  // 6. Report Issue Date
  const [issueDate, setIssueDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  });

  // Close multi-select dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setIsDateMenuOpen(false);
      }
      if (agencyDropdownRef.current && !agencyDropdownRef.current.contains(e.target as Node)) {
        setIsAgencyMenuOpen(false);
      }
    }
    if (isDateMenuOpen || isAgencyMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDateMenuOpen, isAgencyMenuOpen]);

  // 1. First cascade: filter candidates by Report Assessment Type ('all' | '본기량검증' | '사전기량검증')
  const candidatesByType = useMemo(() => {
    if (reportType === 'all') return candidates;
    return candidates.filter(c => normalizeType(c.eval_type) === reportType);
  }, [candidates, reportType]);

  // 2. Candidates filtered by Type AND selected Agencies (to compute available dates)
  const candidatesForDates = useMemo(() => {
    if (selectedAgencies.length === 0) return candidatesByType;
    return candidatesByType.filter(c => {
      const ag = (c.agency || '').trim();
      return ag && selectedAgencies.includes(ag);
    });
  }, [candidatesByType, selectedAgencies]);

  // Extract unique evaluation dates with counts based on active type and active agency filters
  const dateListWithCount = useMemo(() => {
    const map = new Map<string, number>();
    candidatesForDates.forEach(c => {
      const d = normalizeDate(c.eval_date);
      if (d) {
        map.set(d, (map.get(d) || 0) + 1);
      }
    });
    const dates = Array.from(map.keys()).sort().reverse();
    return dates.map(d => ({ date: d, count: map.get(d) || 0 }));
  }, [candidatesForDates]);

  const dateList = useMemo(() => dateListWithCount.map(item => item.date), [dateListWithCount]);

  // 3. Candidates filtered by Type AND selected Dates (to compute available agencies)
  const candidatesForAgencies = useMemo(() => {
    if (selectedDates.length === 0) return candidatesByType;
    return candidatesByType.filter(c => {
      const d = normalizeDate(c.eval_date);
      return d && selectedDates.includes(d);
    });
  }, [candidatesByType, selectedDates]);

  // Extract unique agencies with counts based on active type and active date filters
  const agencyListWithCount = useMemo(() => {
    const map = new Map<string, number>();
    candidatesForAgencies.forEach(c => {
      if (c.agency && c.agency.trim()) {
        const ag = c.agency.trim();
        map.set(ag, (map.get(ag) || 0) + 1);
      }
    });
    const agencies = Array.from(map.keys()).sort();
    return agencies.map(ag => ({ agency: ag, count: map.get(ag) || 0 }));
  }, [candidatesForAgencies]);

  const agencyList = useMemo(() => agencyListWithCount.map(item => item.agency), [agencyListWithCount]);

  // Synchronize and clean up selected dates / agencies if they no longer exist in available pool
  useEffect(() => {
    if (selectedDates.length > 0) {
      const availableDateSet = new Set(dateList);
      const validDates = selectedDates.filter(d => availableDateSet.has(d));
      if (validDates.length !== selectedDates.length) {
        setSelectedDates(validDates);
      }
    }
  }, [dateList, selectedDates]);

  useEffect(() => {
    if (selectedAgencies.length > 0) {
      const availableAgencySet = new Set(agencyList);
      const validAgencies = selectedAgencies.filter(a => availableAgencySet.has(a));
      if (validAgencies.length !== selectedAgencies.length) {
        setSelectedAgencies(validAgencies);
      }
    }
  }, [agencyList, selectedAgencies]);

  // Extract unique jobs
  const jobList = useMemo(() => {
    const set = new Set<string>();
    candidatesByType.forEach(c => {
      if (c.job && c.job.trim()) set.add(c.job.trim());
      else if (c.eval_type && c.eval_type.trim()) set.add(c.eval_type.trim());
    });
    return Array.from(set).sort();
  }, [candidatesByType]);

  // Toggle individual temp date selection
  const toggleTempDate = (date: string) => {
    setTempSelectedDates(prev => {
      if (prev.includes(date)) {
        return prev.filter(d => d !== date);
      } else {
        return [...prev, date];
      }
    });
  };

  const applyDateSelection = () => {
    setSelectedDates(tempSelectedDates);
    setIsDateMenuOpen(false);
  };

  const cancelDateSelection = () => {
    setIsDateMenuOpen(false);
  };

  // Toggle individual temp agency selection
  const toggleTempAgency = (agency: string) => {
    setTempSelectedAgencies(prev => {
      if (prev.includes(agency)) {
        return prev.filter(a => a !== agency);
      } else {
        return [...prev, agency];
      }
    });
  };

  const applyAgencySelection = () => {
    setSelectedAgencies(tempSelectedAgencies);
    setIsAgencyMenuOpen(false);
  };

  const cancelAgencySelection = () => {
    setIsAgencyMenuOpen(false);
  };

  // Filtered candidate list based on all selected dimensions
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (reportType !== 'all' && normalizeType(c.eval_type) !== reportType) {
        return false;
      }
      const cDate = normalizeDate(c.eval_date);
      if (selectedDates.length > 0) {
        if (!cDate || !selectedDates.includes(cDate)) {
          return false;
        }
      }
      if (selectedAgencies.length > 0) {
        const ag = (c.agency || '').trim();
        if (!ag || !selectedAgencies.includes(ag)) {
          return false;
        }
      }
      const cJob = (c.job || c.eval_type || '').trim();
      if (selectedJob !== 'all' && cJob !== selectedJob) {
        return false;
      }
      return true;
    });
  }, [candidates, reportType, selectedDates, selectedAgencies, selectedJob]);

  // Sort candidates by Agency, then App No for clean grouping in appendix
  const sortedCandidates = useMemo(() => {
    return [...filteredCandidates].sort((a, b) => {
      const agA = (a.agency || '').trim();
      const agB = (b.agency || '').trim();
      if (agA !== agB) return agA.localeCompare(agB);
      const noA = a.app_no || '';
      const noB = b.app_no || '';
      return noA.localeCompare(noB, undefined, { numeric: true });
    });
  }, [filteredCandidates]);

  // Date Range string display for report
  // 사용자의 명확한 요구: 날짜 1개면 1개만(from~to 쓰지 않음), 복수면 from ~ to 만 쓰고 괄호 표현 삭제
  const dateRangeDisplay = useMemo(() => {
    const dates = selectedDates.length > 0 ? selectedDates : dateList;
    if (dates.length === 0) return '검증 일정 미지정';
    if (dates.length === 1) return dates[0];
    const sorted = [...dates].sort();
    return `${sorted[0]} ~ ${sorted[sorted.length - 1]}`;
  }, [selectedDates, dateList]);

  // 검증 일정 줄바꿈 전용 파트 (xxxx-xx-xx ~ 줄바꿈 xxxx-xx-xx)
  const dateRangeParts = useMemo(() => {
    const dates = selectedDates.length > 0 ? selectedDates : dateList;
    if (dates.length === 0) return { start: '검증 일정 미지정', end: '', isRange: false };
    if (dates.length === 1) return { start: dates[0], end: '', isRange: false };
    const sorted = [...dates].sort();
    return { start: sorted[0], end: sorted[sorted.length - 1], isRange: true };
  }, [selectedDates, dateList]);

  // Agency List display for report (개별 협력사 단위 리스트)
  const activeAgencyList = useMemo(() => {
    const list = selectedAgencies.length > 0 ? selectedAgencies : agencyList;
    return list;
  }, [selectedAgencies, agencyList]);

  // Agency List string display for tooltip & print fallback
  const agencyDisplay = useMemo(() => {
    if (activeAgencyList.length === 0) return '협력사 미지정';
    return activeAgencyList.join(', ');
  }, [activeAgencyList]);

  // Report Title configurations (정갈한 공식 명칭 적용)
  const reportInfo = useMemo(() => {
    if (reportType === '본기량검증') {
      return {
        titleKr: '외국인 근로자 본 기량 검증 결과 보고서',
        badge: '본 기량 검증',
        badgeColor: 'bg-blue-900 text-white border-blue-600',
        coverAccent: 'bg-[#002c5f]',
        criteriaSkill: '기량 B등급(61점↑)',
        criteriaKorean: '어학 C등급(60점↑)'
      };
    }
    if (reportType === '사전기량검증') {
      return {
        titleKr: '외국인 근로자 사전 기량 검증 결과 보고서',
        badge: '사전 기량 검증',
        badgeColor: 'bg-emerald-900 text-white border-emerald-600',
        coverAccent: 'bg-[#00a859]',
        criteriaSkill: '기량 C등급(51점↑)',
        criteriaKorean: '어학 C등급(60점↑)'
      };
    }
    return {
      titleKr: '외국인 근로자 기량 검증 종합 결과 보고서',
      badge: '기량 검증 통합 보고서',
      badgeColor: 'bg-slate-900 text-white border-slate-700',
      coverAccent: 'bg-[#0f2744]',
      criteriaSkill: '기량 C등급(51점↑)',
      criteriaKorean: '어학 C등급(60점↑)'
    };
  }, [reportType]);

  // 🏢 Agency Comparison Statistics (현황 비교 요약 데이터)
  const agencyStats = useMemo(() => {
    const map = new Map<string, {
      name: string;
      candidates: Candidate[];
    }>();

    filteredCandidates.forEach(c => {
      const agName = (c.agency && c.agency.trim()) || '미지정';
      if (!map.has(agName)) {
        map.set(agName, { name: agName, candidates: [] });
      }
      map.get(agName)!.candidates.push(c);
    });

    const list = Array.from(map.values()).map(({ name, candidates: cList }) => {
      const total = cList.length;
      let sumWeld = 0;
      let countWeld = 0;
      let sumFit = 0;
      let countFit = 0;
      let sumKorean = 0;
      let countKorean = 0;

      let passPure = 0;
      let passCond = 0;
      let fail = 0;
      let skillPass = 0;

      const jobSet = new Set<string>();

      cList.forEach(c => {
        const j = (c.job || '').trim();
        if (j) jobSet.add(j);

        const sw = Number(c.s_score_weld) || 0;
        if (sw > 0) {
          sumWeld += sw;
          countWeld++;
        }
        const sf = Number(c.s_score_fit) || 0;
        if (sf > 0) {
          sumFit += sf;
          countFit++;
        }
        const ks = Number(c.k_score) || 0;
        if (ks > 0) {
          sumKorean += ks;
          countKorean++;
        }

        if (checkSkillPass(c)) {
          skillPass++;
        }

        const res = determineResult(c);
        if (res === '최종 합격') passPure++;
        else if (res === '조건부 합격') passCond++;
        else if (res === '불합격') fail++;
      });

      const avgWeld = countWeld > 0 ? Math.round((sumWeld / countWeld) * 10) / 10 : 0;
      const avgFit = countFit > 0 ? Math.round((sumFit / countFit) * 10) / 10 : 0;
      const avgKorean = countKorean > 0 ? Math.round((sumKorean / countKorean) * 10) / 10 : 0;

      const passTotal = passPure + passCond;
      const passTotalRate = total > 0 ? Math.round((passTotal / total) * 1000) / 10 : 0;
      const passPureRate = total > 0 ? Math.round((passPure / total) * 1000) / 10 : 0;
      const passCondRate = total > 0 ? Math.round((passCond / total) * 1000) / 10 : 0;
      const failRate = total > 0 ? Math.round((fail / total) * 1000) / 10 : 0;
      const skillPassRate = total > 0 ? Math.round((skillPass / total) * 1000) / 10 : 0;

      // Action Recommendation for this agency
      let recommendation = '정상 수급 (즉시 현장 배치)';
      let statusLevel: 'excellent' | 'good' | 'warning' = 'good';

      if (passPureRate >= 70 && skillPassRate >= 85) {
        recommendation = '우수 인력 확보 (현장 즉시 투입 적합)';
        statusLevel = 'excellent';
      } else if (passCondRate >= 30) {
        recommendation = '한국어 집중 교육 후 현장 배치';
        statusLevel = 'good';
      } else if (failRate >= 30 || passTotalRate < 65) {
        recommendation = '인력 충원 미달 (추가 검증 요망)';
        statusLevel = 'warning';
      }

      // Clean up jobs representation
      const rawJobs = Array.from(jobSet);
      let jobsDisplay = '용접';
      if (rawJobs.length === 0) {
        jobsDisplay = '용접';
      } else if (rawJobs.length === 1) {
        jobsDisplay = rawJobs[0];
      } else {
        const hasWeld = rawJobs.some(j => j.includes('용접'));
        const hasFit = rawJobs.some(j => j.includes('취부'));
        if (hasWeld && hasFit) {
          jobsDisplay = '용접 · 취부';
        } else {
          jobsDisplay = rawJobs.join(', ');
        }
      }

      return {
        name,
        total,
        jobs: jobsDisplay,
        jobsList: rawJobs.length > 0 ? rawJobs : ['용접'],
        avgWeld,
        avgFit,
        avgKorean,
        passPure,
        passPureRate,
        passCond,
        passCondRate,
        fail,
        failRate,
        passTotal,
        passTotalRate,
        skillPass,
        skillPassRate,
        recommendation,
        statusLevel
      };
    });

    return list.sort((a, b) => b.total - a.total);
  }, [filteredCandidates]);

  // Overall Statistics for the selected filter set
  const stats = useMemo(() => {
    const total = filteredCandidates.length;
    if (total === 0) {
      return {
        total: 0,
        passPureCount: 0,
        passPureRate: 0,
        passCondCount: 0,
        passCondRate: 0,
        passTotalCount: 0,
        passTotalRate: 0,
        failCount: 0,
        failRate: 0,
        
        avgKorean: 0,
        avgWeld: 0,
        avgFit: 0,
        
        skillPassCount: 0,
        skillPassRate: 0,
        koreanPassCount: 0,
        koreanPassRate: 0,
        koreanCondCount: 0,

        weldTotal: 0,
        weldPassCount: 0,
        weldPassRate: 0,

        fitTotal: 0,
        fitPassCount: 0,
        fitPassRate: 0,

        skillGrades: { S: 0, A: 0, B: 0, C: 0, D: 0 }
      };
    }

    let passPureCount = 0;
    let passCondCount = 0;
    let failCount = 0;
    let skillPassCount = 0;
    let koreanPassCount = 0;
    let koreanCondCount = 0;

    let sumKorean = 0;
    let countKorean = 0;
    let sumWeld = 0;
    let countWeld = 0;
    let sumFit = 0;
    let countFit = 0;

    let weldPassCount = 0;
    let fitPassCount = 0;
    let weldTotal = 0;
    let fitTotal = 0;

    const skillGrades = { S: 0, A: 0, B: 0, C: 0, D: 0 };

    filteredCandidates.forEach(c => {
      const res = determineResult(c);
      if (res === '최종 합격') passPureCount++;
      else if (res === '조건부 합격') passCondCount++;
      else if (res === '불합격') failCount++;

      if (checkSkillPass(c)) skillPassCount++;
      
      const kRes = checkKoreanPass(c);
      if (kRes === '최종 합격' || kRes === '합격') {
        koreanPassCount++;
      } else if (kRes === '조건부 합격') {
        koreanCondCount++;
      }

      const ks = Number(c.k_score) || 0;
      if (ks > 0) {
        sumKorean += ks;
        countKorean++;
      }

      const sw = Number(c.s_score_weld) || 0;
      const sf = Number(c.s_score_fit) || 0;
      const isPre = (c.eval_type === '사전기량검증' || c.eval_type === '사전');
      const passWeldCut = isPre ? 51 : 61;
      const passFitCut = isPre ? 41 : 51;

      const isFitCandidate = (c.job || '').includes('취부');
      if (isFitCandidate) {
        fitTotal++;
        if (sf >= passFitCut) fitPassCount++;
      } else {
        weldTotal++;
        if (sw >= passWeldCut) weldPassCount++;
      }

      if (sw > 0) {
        sumWeld += sw;
        countWeld++;
      }

      if (sf > 0) {
        sumFit += sf;
        countFit++;
      }

      const grade = (c.grade_weld || getSkillGradeByScore(sw)) as keyof typeof skillGrades;
      if (skillGrades[grade] !== undefined) {
        skillGrades[grade]++;
      }
    });

    const passTotalCount = passPureCount + passCondCount;
    const passPureRate = Math.round((passPureCount / total) * 1000) / 10;
    const passCondRate = Math.round((passCondCount / total) * 1000) / 10;
    const passTotalRate = Math.round((passTotalCount / total) * 1000) / 10;
    const failRate = Math.round((failCount / total) * 1000) / 10;

    const avgKorean = countKorean > 0 ? Math.round((sumKorean / countKorean) * 10) / 10 : 0;
    const avgWeld = countWeld > 0 ? Math.round((sumWeld / countWeld) * 10) / 10 : 0;
    const avgFit = countFit > 0 ? Math.round((sumFit / countFit) * 10) / 10 : 0;

    const skillPassRate = Math.round((skillPassCount / total) * 1000) / 10;
    const koreanPassRate = Math.round((koreanPassCount / total) * 1000) / 10;

    const weldPassRate = weldTotal > 0 ? Math.round((weldPassCount / weldTotal) * 1000) / 10 : 0;
    const fitPassRate = fitTotal > 0 ? Math.round((fitPassCount / fitTotal) * 1000) / 10 : 0;

    return {
      total,
      passPureCount,
      passPureRate,
      passCondCount,
      passCondRate,
      passTotalCount,
      passTotalRate,
      failCount,
      failRate,
      
      avgKorean,
      avgWeld,
      avgFit,
      
      skillPassCount,
      skillPassRate,
      koreanPassCount,
      koreanPassRate,
      koreanCondCount,

      weldTotal,
      weldPassCount,
      weldPassRate,

      fitTotal,
      fitPassCount,
      fitPassRate,

      skillGrades
    };
  }, [filteredCandidates]);

  // 1) 직종(용접/선각취부)별 실기 기량 등급 상세 집계 (PDF 5-4 항목 참조)
  const skillGradeDetail = useMemo(() => {
    const weld = { S: 0, A: 0, B: 0, C: 0, D: 0, total: 0 };
    const fit = { S: 0, A: 0, B: 0, C: 0, D: 0, total: 0 };

    filteredCandidates.forEach(c => {
      const sw = Number(c.s_score_weld) || 0;
      const sf = Number(c.s_score_fit) || 0;
      
      const gw = (c.grade_weld || (sw > 0 ? getSkillGradeByScore(sw) : '')) as keyof typeof weld;
      const gf = (c.grade_fit || (sf > 0 ? getSkillGradeByScore(sf) : '')) as keyof typeof fit;

      if (sw > 0 || (c.job || '').includes('용접')) {
        if (weld[gw] !== undefined) weld[gw]++;
        weld.total++;
      }
      if (sf > 0 || (c.job || '').includes('취부')) {
        if (fit[gf] !== undefined) fit[gf]++;
        fit.total++;
      }
    });

    const total = {
      S: weld.S + fit.S,
      A: weld.A + fit.A,
      B: weld.B + fit.B,
      C: weld.C + fit.C,
      D: weld.D + fit.D,
      total: weld.total + fit.total
    };

    return { weld, fit, total };
  }, [filteredCandidates]);

  // 2) 한국어 말하기 평가 등급 집계 (직종별 및 전체 집계 - A, B, C 합격 / D 조건부 / E 탈락)
  const koreanGradeDetail = useMemo(() => {
    const initGrade = () => ({ A: 0, B: 0, C: 0, D: 0, E: 0, passSubtotal: 0, total: 0 });
    const weld = initGrade();
    const fit = initGrade();
    const total = initGrade();

    filteredCandidates.forEach(c => {
      let kg = (c.k_grade || '').trim().toUpperCase();
      if (!['A', 'B', 'C', 'D', 'E'].includes(kg)) {
        const ks = Number(c.k_score) || 0;
        if (ks >= 80) kg = 'A';
        else if (ks >= 70) kg = 'B';
        else if (ks >= 60) kg = 'C';
        else if (ks >= 40) kg = 'D';
        else kg = 'E';
      }

      const isPass = kg === 'A' || kg === 'B' || kg === 'C';
      const key = kg as 'A' | 'B' | 'C' | 'D' | 'E';

      const updateTarget = (target: ReturnType<typeof initGrade>) => {
        target[key]++;
        if (isPass) target.passSubtotal++;
        target.total++;
      };

      updateTarget(total);

      const jobStr = c.job || c.eval_type || '';
      if (jobStr.includes('취부') || Number(c.s_score_fit) > 0) {
        updateTarget(fit);
      } else {
        updateTarget(weld);
      }
    });

    return { weld, fit, total };
  }, [filteredCandidates]);

  // 3) 합격자 연령대 및 E-9 비자 경력 분포 집계 (직종별 및 전체 집계)
  const ageAndE9Detail = useMemo(() => {
    const initAge = () => ({
      g19_24: 0,
      g25_29: 0,
      g30_34: 0,
      g35_39: 0,
      g40_plus: 0,
      passTotal: 0,
      e9Total: 0,
      e9Pass: 0
    });

    const weld = initAge();
    const fit = initAge();
    const total = initAge();

    filteredCandidates.forEach(c => {
      const res = determineResult(c);
      const isPass = res === '최종 합격' || res === '조건부 합격';
      const isE9 = isE9Candidate(c);
      const age = Number(c.age) || 0;

      const jobStr = c.job || c.eval_type || '';
      const isFit = jobStr.includes('취부') || Number(c.s_score_fit) > 0;
      const target = isFit ? fit : weld;

      if (isE9) {
        total.e9Total++;
        target.e9Total++;
      }

      if (isPass) {
        const addAge = (t: ReturnType<typeof initAge>) => {
          if (age >= 19 && age <= 24) t.g19_24++;
          else if (age >= 25 && age <= 29) t.g25_29++;
          else if (age >= 30 && age <= 34) t.g30_34++;
          else if (age >= 35 && age <= 39) t.g35_39++;
          else if (age >= 40) t.g40_plus++;
          else t.g25_29++;

          t.passTotal++;
          if (isE9) t.e9Pass++;
        };

        addAge(total);
        addAge(target);
      }
    });

    return { weld, fit, total };
  }, [filteredCandidates]);

  // 4) E-9 경력자 및 수급 현황 (PDF 1페이지 및 5-5 항목 참조)
  const e9Detail = useMemo(() => {
    let e9Count = 0;
    let e9Pass = 0;
    let nonE9Count = 0;
    let nonE9Pass = 0;

    filteredCandidates.forEach(c => {
      const isE9 = isE9Candidate(c);
      const res = determineResult(c);
      const isPass = res === '최종 합격' || res === '조건부 합격';

      if (isE9) {
        e9Count++;
        if (isPass) e9Pass++;
      } else {
        nonE9Count++;
        if (isPass) nonE9Pass++;
      }
    });

    return {
      e9Count,
      e9Pass,
      e9PassRate: e9Count > 0 ? Math.round((e9Pass / e9Count) * 1000) / 10 : 0,
      nonE9Count,
      nonE9Pass,
      nonE9PassRate: nonE9Count > 0 ? Math.round((nonE9Pass / nonE9Count) * 1000) / 10 : 0
    };
  }, [filteredCandidates]);

  // Appendix candidate pages: 30 per page to maximize candidate list per page
  const candidatePages = useMemo(() => {
    if (!includeDetails) return [];
    const pageSize = 30;
    const pages = [];
    for (let i = 0; i < sortedCandidates.length; i += pageSize) {
      pages.push(sortedCandidates.slice(i, i + pageSize));
    }
    return pages.length > 0 ? pages : [[]];
  }, [sortedCandidates, includeDetails]);

  const totalPages = (includeCover ? 1 : 0) + 2 + (includeDetails ? candidatePages.length : 0);

  // Doughnut Chart: Final Decision Breakdown
  const doughnutData = {
    labels: ['최종 합격 (즉시 투입)', '조건부 합격 (교육 후 투입)', '불합격 (탈락)'],
    datasets: [
      {
        data: [stats.passPureCount, stats.passCondCount, stats.failCount],
        backgroundColor: ['#002c5f', '#00a859', '#ef4444'],
        hoverBackgroundColor: ['#001a38', '#008a48', '#dc2626'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 8,
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 12 }
      }
    }
  };

  // Bar Chart: Skill Grade Distribution
  const skillBarData = {
    labels: ['S (91~100점)', 'A (81~90점)', 'B (61~80점)', 'C (51~60점)', 'D (50점 이하)'],
    datasets: [
      {
        label: '인원수(명)',
        data: [
          stats.skillGrades.S,
          stats.skillGrades.A,
          stats.skillGrades.B,
          stats.skillGrades.C,
          stats.skillGrades.D
        ],
        backgroundColor: [
          '#002c5f', // Navy
          '#1d4ed8', // Blue
          '#3b82f6', // Light Blue
          '#f59e0b', // Amber/Yellow
          '#ef4444'  // Red
        ],
        borderRadius: 4,
        barThickness: 18
      }
    ]
  };

  const skillBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 16,
        bottom: 2
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 6,
        bodyFont: { size: 11 }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grace: '15%',
        ticks: { font: { size: 10 }, stepSize: 5 },
        grid: { color: '#f1f5f9' }
      },
      x: {
        ticks: { font: { size: 10, weight: 'bold' as const } },
        grid: { display: false }
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-800 overflow-y-auto print:overflow-visible print:bg-white print:p-0 print:m-0 print:text-black">
      {/* Print Specific CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .no-print, header, nav {
            display: none !important;
          }
          .report-page {
            width: 210mm !important;
            min-height: 297mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 14mm 15mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background-color: #ffffff !important;
            page-break-after: always !important;
            break-after: page !important;
            position: relative !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .report-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}} />

      {/* Control Action Bar (Screen Only) */}
      <div className="no-print sticky top-0 z-40 bg-[#0a1b2d] border-b border-[#1e3a5f] px-4 py-3 shadow-lg shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Back Button & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> 대시보드
            </button>
            <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-2.5">
              <img src="/ci.png" alt="HD현대삼호" className="h-6 object-contain brightness-0 invert opacity-90 hidden sm:inline" />
              <h2 className="text-white font-black text-sm sm:text-base tracking-tight">
                {reportInfo.titleKr}
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider hidden md:inline ${reportInfo.badgeColor}`}>
                {reportInfo.badge}
              </span>
            </div>
          </div>

          {/* Filtering Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Report Type Selector */}
            <div className="bg-slate-800 p-0.5 rounded-lg border border-slate-700 flex items-center">
              <button
                onClick={() => setReportType('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  reportType === 'all' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                전체 통합
              </button>
              <button
                onClick={() => setReportType('본기량검증')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  reportType === '본기량검증' 
                    ? 'bg-[#002c5f] text-white shadow-xs border border-blue-400' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                본 기량검증
              </button>
              <button
                onClick={() => setReportType('사전기량검증')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  reportType === '사전기량검증' 
                    ? 'bg-[#00a859] text-white shadow-xs' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                사전 기량검증
              </button>
            </div>

            {/* 2. Multi-date Selector */}
            <div className="relative" ref={dateDropdownRef}>
              <button
                onClick={() => {
                  if (!isDateMenuOpen) {
                    setTempSelectedDates(selectedDates);
                    setIsAgencyMenuOpen(false);
                  }
                  setIsDateMenuOpen(!isDateMenuOpen);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  selectedDates.length > 0 
                    ? 'bg-blue-900/60 border-blue-500 text-blue-200' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {selectedDates.length === 0 
                    ? `전체 기간 (${dateList.length}일)` 
                    : selectedDates.length === 1 
                      ? selectedDates[0] 
                      : `${selectedDates.length}개 일자 선택`}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isDateMenuOpen && (
                <div className="absolute right-0 mt-1 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-3 text-slate-200 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700 px-1">
                    <span className="font-bold text-white flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" /> 일자 선택
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setTempSelectedDates(dateList)}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold"
                      >
                        전체 선택
                      </button>
                      <span className="text-slate-600">|</span>
                      <button 
                        type="button"
                        onClick={() => setTempSelectedDates([])}
                        className="text-[11px] text-slate-400 hover:underline font-semibold"
                      >
                        해제
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1.5 space-y-1 my-1">
                    {dateListWithCount.map(({ date, count }) => {
                      const isChecked = tempSelectedDates.includes(date);
                      return (
                        <label 
                          key={date}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            isChecked ? 'bg-blue-600/30 text-white font-bold border border-blue-500/50' : 'hover:bg-slate-700/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTempDate(date)}
                              className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                            />
                            <span>{date}</span>
                          </div>
                          <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                            {count}명
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700 px-1">
                    <span className="text-[11px] text-slate-400">
                      {tempSelectedDates.length === 0 ? '전체 기간' : `${tempSelectedDates.length}개 일자 선택`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={cancelDateSelection}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-semibold text-[11px] transition-colors"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={applyDateSelection}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-[11px] shadow-xs transition-colors"
                      >
                        확인 (적용)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Multi-Agency Selector */}
            <div className="relative" ref={agencyDropdownRef}>
              <button
                onClick={() => {
                  if (!isAgencyMenuOpen) {
                    setTempSelectedAgencies(selectedAgencies);
                    setIsDateMenuOpen(false);
                  }
                  setIsAgencyMenuOpen(!isAgencyMenuOpen);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  selectedAgencies.length > 0 
                    ? 'bg-blue-900/60 border-blue-500 text-blue-200' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span className="max-w-[140px] truncate">
                  {selectedAgencies.length === 0 
                    ? `전체 협력사 (${agencyList.length})` 
                    : selectedAgencies.length === 1 
                      ? selectedAgencies[0] 
                      : `${selectedAgencies.length}개사 선택`}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {isAgencyMenuOpen && (
                <div className="absolute right-0 mt-1 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-3 text-slate-200 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700 px-1">
                    <span className="font-bold text-white flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-blue-400" /> 협력사 선택
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setTempSelectedAgencies(agencyList)}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold"
                      >
                        전체 선택
                      </button>
                      <span className="text-slate-600">|</span>
                      <button 
                        type="button"
                        onClick={() => setTempSelectedAgencies([])}
                        className="text-[11px] text-slate-400 hover:underline font-semibold"
                      >
                        해제
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1.5 space-y-1 my-1">
                    {agencyListWithCount.map(({ agency, count }) => {
                      const isChecked = tempSelectedAgencies.includes(agency);
                      return (
                        <label 
                          key={agency}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            isChecked ? 'bg-blue-600/30 text-white font-bold border border-blue-500/50' : 'hover:bg-slate-700/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTempAgency(agency)}
                              className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                            />
                            <span className="truncate">{agency}</span>
                          </div>
                          <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                            {count}명
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700 px-1">
                    <span className="text-[11px] text-slate-400">
                      {tempSelectedAgencies.length === 0 ? '전체 협력사' : `${tempSelectedAgencies.length}개사 선택`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={cancelAgencySelection}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-semibold text-[11px] transition-colors"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={applyAgencySelection}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-[11px] shadow-xs transition-colors"
                      >
                        확인 (적용)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Cover Page Toggle (Default: Included, Click to Skip) */}
            <button
              onClick={() => setIncludeCover(!includeCover)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                includeCover 
                  ? 'bg-blue-900/50 border-blue-500 text-blue-200 hover:bg-blue-900/80 shadow-2xs' 
                  : 'bg-slate-800/80 border-red-500/40 text-slate-400 line-through decoration-red-400 hover:text-white'
              }`}
              title={includeCover ? '클릭 시 보고서 표지를 제외(SKIP)합니다' : '클릭 시 보고서 표지를 다시 포함합니다'}
            >
              <FileText className={`w-3.5 h-3.5 ${includeCover ? 'text-blue-400' : 'text-slate-500'}`} />
              <span>{includeCover ? '📄 표지 제외 (출력 중)' : '📄 표지 SKIP됨 (포함하기)'}</span>
            </button>

            {/* 5. Report Mode Toggle: Detailed Appendix (Default: Included, Click to Skip) */}
            <button
              onClick={() => setIncludeDetails(!includeDetails)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                includeDetails 
                  ? 'bg-amber-900/50 border-amber-500 text-amber-200 hover:bg-amber-900/80 shadow-2xs' 
                  : 'bg-slate-800/80 border-red-500/40 text-slate-400 line-through decoration-red-400 hover:text-white'
              }`}
              title={includeDetails ? '클릭 시 개인별 세부 명단을 제외(SKIP)합니다' : '클릭 시 개인별 세부 명단을 다시 포함합니다'}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${includeDetails ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{includeDetails ? '📑 세부 명단 제외 (출력 중)' : '📑 세부 명단 SKIP됨 (포함하기)'}</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-lg shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>보고서 인쇄 / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="py-8 px-4 flex flex-col items-center gap-8 print:p-0 print:gap-0">

        {/* ========================================================= */}
        {/* COVER PAGE (보고서 표지) */}
        {/* ========================================================= */}
        {includeCover && (
          <div className="report-page bg-white w-[210mm] min-h-[297mm] p-[20mm] shadow-2xl rounded-sm flex flex-col justify-between font-sans border border-slate-200 print:border-none print:shadow-none">
            
            {/* Top Header */}
            <div>
              <div className="flex justify-between items-center pb-5 border-b-2 border-[#002c5f]">
                <HdHyundaiCiLogo className="h-12" />
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-extrabold bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded tracking-wider">
                    사내 대외비
                  </span>
                  <span className={`text-xs font-extrabold px-3.5 py-1.5 rounded border ${reportInfo.badgeColor}`}>
                    {reportInfo.badge}
                  </span>
                </div>
              </div>
            </div>

            {/* Main Center Title & Description */}
            <div className="my-auto text-center space-y-8 py-8">
              <div className="inline-block bg-blue-50 text-[#002c5f] border border-blue-200 px-5 py-2 rounded-full text-xs font-extrabold tracking-wider">
                외국인 기능인력 기량 검증 및 선발 평가 체계
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl sm:text-[34px] font-black text-[#002c5f] tracking-tight leading-snug">
                  {reportInfo.titleKr}
                </h1>
              </div>

              <div className="w-28 h-1.5 bg-gradient-to-r from-[#002c5f] via-[#00a859] to-[#002c5f] mx-auto rounded-full"></div>

              <p className="text-sm text-slate-600 max-w-xl mx-auto font-medium leading-relaxed">
                조선업 현장 맞춤형 외국인 기능인력의 <strong className="text-slate-900 font-bold">실기 기량(용접, 취부)</strong> 및 <strong className="text-slate-900 font-bold">한국어 말하기 평가</strong>를 종합 검증하여 최적의 생산 투입 인력을 선발한 결과 보고서입니다.
              </p>

              {/* Cover Metadata Overview Table (Clean, Centered, Spacious & High-Readability) */}
              <div className="max-w-xl mx-auto mt-8 border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <th className="w-1/3 bg-slate-100 text-slate-800 font-bold py-3 px-4 text-center border-r border-slate-200">
                        검증 일정
                      </th>
                      <td className="w-2/3 py-3 px-4 text-center font-semibold text-slate-900">
                        {dateRangeDisplay}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-100 text-slate-800 font-bold py-3 px-4 text-center border-r border-slate-200">
                        검증 직종
                      </th>
                      <td className="py-3 px-4 text-center font-semibold text-slate-900">
                        용접 (CO2 / FCAW) 및 취부 (선체 조립)
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-100 text-slate-800 font-bold py-3 px-4 text-center border-r border-slate-200">
                        대상 협력사
                      </th>
                      <td className="py-3 px-4 text-center font-semibold text-slate-900 leading-relaxed">
                        {activeAgencyList.length > 0 ? (
                          <div className="flex flex-wrap justify-center items-center gap-x-1.5 gap-y-0.5 max-w-lg mx-auto">
                            {activeAgencyList.map((ag, idx) => (
                              <span key={ag} className="inline-block whitespace-nowrap">
                                {ag}{idx < activeAgencyList.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '협력사 미지정'
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-100 text-slate-800 font-bold py-3 px-4 text-center border-r border-slate-200">
                        총 검증 인원
                      </th>
                      <td className="py-3 px-4 text-center font-semibold text-slate-900 leading-normal">
                        <span className="font-mono font-bold text-base text-slate-900">총 {stats.total}명</span>
                        {agencyStats.length > 0 && (
                          <span className="text-xs font-semibold text-slate-600 ml-2 font-sans">
                            ({agencyStats.map(ag => `${ag.name} ${ag.total}명`).join(', ')})
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-100 text-slate-800 font-bold py-3 px-4 text-center border-r border-slate-200">
                        합격인원
                      </th>
                      <td className="py-3 px-4 text-center font-bold text-blue-900">
                        총 {stats.passTotalCount}명 <span className="text-xs font-semibold text-slate-600">(최종 {stats.passPureCount}명 + 조건부 {stats.passCondCount}명)</span>
                      </td>
                    </tr>
                    <tr>
                      <th className="bg-slate-100 text-slate-800 font-bold py-3 px-4 text-center border-r border-slate-200">
                        종합 선발률
                      </th>
                      <td className="py-3 px-4 text-center font-mono font-black text-emerald-700 text-base">
                        {stats.passTotalRate}% <span className="text-xs font-medium text-slate-500">(실기 기량 통과율 {stats.skillPassRate}%)</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="border-t-2 border-[#002c5f] pt-5 text-center space-y-1 pb-2">
              <div className="text-lg font-black text-[#002c5f] tracking-wider">
                HD현대삼호
              </div>
              <div className="text-sm font-bold text-slate-800">
                동반성장부 동반성장인력지원과
              </div>
              <div className="text-xs text-slate-400 font-mono">
                보고일자: {issueDate}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PAGE 1: 종합 결과 및 핵심 지표 (용접, 취부, 한국어) */}
        {/* ========================================================= */}
        <div className="report-page bg-white w-[210mm] min-h-[297mm] p-[16mm] shadow-2xl rounded-sm flex flex-col justify-between font-sans border border-slate-200 print:border-none print:shadow-none">
          
          {/* Header */}
          <div>
            <div className="flex justify-between items-center pb-3 border-b-2 border-[#002c5f]">
              <HdHyundaiCiLogo className="h-10" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded tracking-wider">
                  사내 대외비
                </span>
                <span className={`text-xs font-extrabold px-2.5 py-1 rounded border ${reportInfo.badgeColor}`}>
                  {reportInfo.badge}
                </span>
              </div>
            </div>

            {/* Main Document Title */}
            <div className="mt-4 text-center space-y-1">
              <h1 className="text-2xl sm:text-[25px] font-black text-[#002c5f] tracking-tight">
                {reportInfo.titleKr}
              </h1>
            </div>

            {/* I. 기량 검증 개요 */}
            <div className="mt-3.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm sm:text-[15px] font-black text-[#002c5f] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> I. 기량 검증 개요
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  발행일자: <span className="font-mono text-slate-800">{issueDate}</span>
                </span>
              </div>

              {/* Overview Grid */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center flex flex-col justify-center items-center min-h-[64px]">
                  <span className="text-slate-500 font-bold block text-xs whitespace-nowrap">검증 일정</span>
                  {dateRangeParts.isRange ? (
                    <span className="font-extrabold text-slate-900 text-[11.5px] sm:text-xs mt-1 block leading-tight whitespace-nowrap">
                      <span>{dateRangeParts.start} ~</span>
                      <span className="block mt-0.5">{dateRangeParts.end}</span>
                    </span>
                  ) : (
                    <span className="font-extrabold text-slate-900 text-xs sm:text-[12.5px] mt-1 block whitespace-nowrap leading-tight">
                      {dateRangeParts.start}
                    </span>
                  )}
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center flex flex-col justify-center items-center min-h-[64px]">
                  <span className="text-slate-500 font-bold block text-xs whitespace-nowrap">대상 협력사</span>
                  <div className="text-slate-900 text-[11px] sm:text-xs mt-1 leading-snug flex flex-wrap justify-center items-center gap-x-1 gap-y-0.5" title={agencyDisplay}>
                    {activeAgencyList.map((ag, idx) => (
                      <span key={ag} className="font-extrabold inline-block whitespace-nowrap">
                        {ag}{idx < activeAgencyList.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center flex flex-col justify-center items-center min-h-[64px]">
                  <span className="text-slate-500 font-bold block text-xs whitespace-nowrap">검증 직종</span>
                  <span className="font-extrabold text-slate-900 text-xs sm:text-[12.5px] mt-1 block whitespace-nowrap leading-tight">
                    {selectedJob === 'all' ? '용접 및 취부' : selectedJob}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center flex flex-col justify-center items-center min-h-[64px]">
                  <span className="text-slate-500 font-bold block text-xs whitespace-nowrap">합격 판정 기준</span>
                  <div className="font-extrabold text-blue-900 text-[11px] sm:text-[11.5px] mt-0.5 leading-tight">
                    <span className="block whitespace-nowrap">{reportInfo.criteriaSkill}</span>
                    <span className="block whitespace-nowrap text-slate-700 mt-0.5">{reportInfo.criteriaKorean}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* II. 핵심 성과 지표 */}
            <div className="mt-3.5 space-y-1.5">
              <h3 className="text-sm sm:text-[15px] font-black text-[#002c5f] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" /> II. 핵심 성과 지표
              </h3>
              
              <div className="grid grid-cols-4 gap-3">
                {/* 1. 총 검증인원 */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center flex flex-col justify-between">
                  <div className="text-xs font-bold text-slate-700 whitespace-nowrap">총 검증인원</div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 my-1">
                    {stats.total} <span className="text-sm font-bold text-slate-500">명</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-semibold space-y-0.5 leading-tight">
                    <div className="whitespace-nowrap">응시 총원 {stats.total}명 ({agencyStats.length}개사)</div>
                    <div className="text-slate-500 font-medium whitespace-nowrap">
                      용접 {stats.weldTotal}명 / 취부 {stats.fitTotal}명
                    </div>
                  </div>
                </div>

                {/* 2. 합격인원 */}
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 text-center flex flex-col justify-between">
                  <div className="text-xs font-bold text-emerald-900 whitespace-nowrap">합격인원</div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 my-1">
                    {stats.passTotalCount} <span className="text-sm font-bold text-emerald-600">명</span>
                  </div>
                  <div className="text-[11px] text-emerald-800 font-bold space-y-0.5 leading-tight">
                    <div className="whitespace-nowrap text-emerald-900 font-black">선발률 {stats.passTotalRate}%</div>
                    <div className="text-emerald-700 font-medium whitespace-nowrap">최종 {stats.passPureCount} + 조건부 {stats.passCondCount}</div>
                  </div>
                </div>

                {/* 3. 기량평가 합격인원 */}
                <div className="bg-blue-50/80 border border-blue-300 rounded-xl p-3 text-center flex flex-col justify-between">
                  <div className="text-xs font-bold text-blue-900 whitespace-nowrap">기량평가 합격인원</div>
                  <div className="text-2xl sm:text-3xl font-black text-blue-800 my-1">
                    {stats.skillPassCount} <span className="text-sm font-bold text-blue-600">명</span>
                  </div>
                  <div className="text-[11px] text-blue-800 font-bold space-y-0.5 leading-tight">
                    <div className="whitespace-nowrap text-blue-900 font-black">기량 통과율 {stats.skillPassRate}%</div>
                    <div className="text-blue-700 font-medium whitespace-nowrap">용접 {stats.avgWeld}점 / 취부 {stats.avgFit > 0 ? `${stats.avgFit}점` : '-'}</div>
                  </div>
                </div>

                {/* 4. 한국어 말하기 합격인원 */}
                <div className="bg-purple-50/80 border border-purple-300 rounded-xl p-3 text-center flex flex-col justify-between">
                  <div className="text-xs font-bold text-purple-900 whitespace-nowrap">한국어 말하기 합격인원</div>
                  <div className="text-2xl sm:text-3xl font-black text-purple-800 my-1">
                    {stats.koreanPassCount} <span className="text-sm font-bold text-purple-600">명</span>
                  </div>
                  <div className="text-[11px] text-purple-800 font-bold space-y-0.5 leading-tight">
                    <div className="whitespace-nowrap text-purple-900 font-black">소통 적격률 {stats.koreanPassRate}%</div>
                    <div className="text-purple-700 font-medium whitespace-nowrap">구술평균 {stats.avgKorean}점</div>
                  </div>
                </div>
              </div>
            </div>

            {/* III. 종합 판정 요약 */}
            <div className="mt-3.5 space-y-1.5">
              <h3 className="text-sm sm:text-[15px] font-black text-[#002c5f] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-700" /> III. 종합 판정 요약
              </h3>

              {/* Verdict Callout - Objective Fact-based Summary */}
              <div className="p-3.5 bg-blue-50/90 border-l-4 border-blue-700 rounded-r-lg text-xs sm:text-[13px] leading-relaxed text-slate-800 space-y-2">
                <div className="font-black text-blue-950 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">📌 종합 선발 판정 결과:</span>
                  <span className="text-emerald-700 font-black bg-emerald-100/80 px-2.5 py-0.5 rounded border border-emerald-300">
                    총 {stats.total}명 중 가용 인력 {stats.passTotalCount}명 확보 ({stats.passTotalRate}%)
                  </span>
                </div>
                <div className="text-slate-700 space-y-1 text-xs sm:text-[13px] leading-relaxed break-keep">
                  <div className="flex items-start gap-1.5">
                    <span className="text-blue-700 font-bold shrink-0">•</span>
                    <span><strong>실기 기량(용접·취부):</strong> 용접 평균 <strong>{stats.avgWeld}점</strong>(통과 {stats.weldPassCount}명 / {stats.weldPassRate}%), 취부 평균 <strong>{stats.avgFit > 0 ? `${stats.avgFit}점` : '해당직종'}</strong>(통과 {stats.fitPassCount}명)으로 현장 표준 작업 기준을 충족함.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-purple-700 font-bold shrink-0">•</span>
                    <span><strong>한국어 소통 능력:</strong> 한국어 말하기 평가 구술 평균 <strong>{stats.avgKorean}점</strong>, 현장 안전 수칙 및 기초 직무 소통 적격자는 <strong>{stats.koreanPassCount}명({stats.koreanPassRate}%)</strong>임.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-700 font-bold shrink-0">•</span>
                    {reportInfo.isFinal ? (
                      <span><strong>사증 신청 및 인력 배치 방안:</strong> <strong>최종 선발자 {stats.passPureCount}명</strong>은 법무부 E-7 사증 발급 인정서 신청 후 현장 투입하며, <strong>조건부 합격자 {stats.passCondCount}명</strong>은 입국 전 한국어(40h) 보완 교육 이수 및 입국 후 1:1 멘토링 결연을 추진함.</span>
                    ) : (
                      <span><strong>본 기량검증 및 육성 방안:</strong> <strong>최종 선발자 {stats.passPureCount}명</strong>은 조선협회 본 기량검증 응시를 추진하며(통과 시 E-7 비자 신청), <strong>조건부 합격자 {stats.passCondCount}명</strong>은 본 검증 전까지(약 1~2개월) 송출 협력사를 통해 입국 전 한국어 집중 교육 및 기량 보완 육성을 공식 요청함.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* IV. 종합 선발 결과 분포 및 분야별 기량 분석 */}
            <div className="mt-3.5 space-y-1.5">
              <h3 className="text-sm sm:text-[15px] font-black text-[#002c5f] flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" /> IV. 종합 선발 결과 분포 및 실기 기량 등급 분석
              </h3>

              <div className="grid grid-cols-12 gap-3">
                {/* Left: Decision Doughnut Chart */}
                <div className="col-span-5 border border-slate-200 rounded-xl p-3 bg-slate-50/70 flex flex-col justify-between">
                  <div className="text-xs font-bold text-slate-700 text-center">종합 판정 결과 비중</div>
                  
                  <div className="h-32 relative flex items-center justify-center my-1">
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-bold text-slate-400">선발합격률</span>
                      <span className="text-lg font-black text-emerald-700">{stats.passTotalRate}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-xs text-center font-bold">
                    <div className="bg-blue-50 text-[#002c5f] py-1.5 px-0.5 rounded-lg border-2 border-[#002c5f] flex flex-col justify-center items-center">
                      <div className="text-[11px] font-extrabold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#002c5f]"></span>최종
                      </div>
                      <div className="text-xs font-black mt-0.5">{stats.passPureCount}명</div>
                      <div className="text-[10px] font-medium text-slate-500">({stats.passPureRate}%)</div>
                    </div>
                    <div className="bg-emerald-50 text-[#00a859] py-1.5 px-0.5 rounded-lg border-2 border-[#00a859] flex flex-col justify-center items-center">
                      <div className="text-[11px] font-extrabold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00a859]"></span>조건부
                      </div>
                      <div className="text-xs font-black mt-0.5">{stats.passCondCount}명</div>
                      <div className="text-[10px] font-medium text-emerald-700">({stats.passCondRate}%)</div>
                    </div>
                    <div className="bg-red-50 text-red-700 py-1.5 px-0.5 rounded-lg border-2 border-[#ef4444] flex flex-col justify-center items-center">
                      <div className="text-[11px] font-extrabold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></span>불합격
                      </div>
                      <div className="text-xs font-black mt-0.5">{stats.failCount}명</div>
                      <div className="text-[10px] font-medium text-red-500">({stats.failRate}%)</div>
                    </div>
                  </div>
                </div>

                {/* Right: Skill Level Bar & Analysis */}
                <div className="col-span-7 border border-slate-200 rounded-xl p-3 bg-slate-50/70 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">기량 실기 등급별 인원 분포</span>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      실기 통과 {stats.skillPassCount}명 / 탈락 {stats.total - stats.skillPassCount}명
                    </span>
                  </div>

                  <div className="h-28 w-full my-1">
                    <Bar data={skillBarData} options={skillBarOptions} plugins={[barDataLabelsPlugin]} />
                  </div>

                  <div className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200 leading-relaxed space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      <span><strong className="text-[#002c5f]">S:</strong> {stats.skillGrades.S}명</span>
                      <span><strong className="text-blue-700">A:</strong> {stats.skillGrades.A}명</span>
                      <span><strong className="text-blue-500">B:</strong> {stats.skillGrades.B}명</span>
                      <span><strong className="text-amber-600">C:</strong> {stats.skillGrades.C}명</span>
                      <span><strong className="text-red-600">D:</strong> {stats.skillGrades.D}명</span>
                    </div>
                    <div className="text-[11.5px] leading-tight text-slate-700">
                      <strong className="text-slate-900">분야별 기량 현황:</strong> 용접 평균 <strong>{stats.avgWeld}점</strong> (B등급 이상 {Math.round(((stats.skillGrades.S + stats.skillGrades.A + stats.skillGrades.B) / (stats.total || 1)) * 100)}%), 취부 평균 <strong>{stats.avgFit > 0 ? `${stats.avgFit}점` : '해당직종'}</strong>, 한국어 구술 평균 <strong>{stats.avgKorean}점</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page 1 Footer */}
          <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-400 tracking-wider">
            <span>HD현대삼호 동반성장부 동반성장인력지원과 • 외국인 근로자 기량 검증 종합 결과 보고서</span>
            <span className="font-mono text-slate-500">P. {includeCover ? 2 : 1} / {totalPages}</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PAGE 2: 협력사별 수급 현황 및 세부 기량·어학 데이터 분석 */}
        {/* ========================================================= */}
        <div className="report-page bg-white w-[210mm] min-h-[297mm] p-[16mm] shadow-2xl rounded-sm flex flex-col justify-between font-sans border border-slate-200 print:border-none print:shadow-none">
          
          <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
              <div className="min-w-0 pr-2">
                <h2 className="text-base sm:text-[17px] font-black text-[#002c5f] tracking-tight leading-snug break-keep">
                  {reportInfo.titleKr} : 협력사별 현황 및 세부 분석
                </h2>
              </div>
              <HdHyundaiCiLogo className="h-7 shrink-0" />
            </div>

            {/* V. 🏢 협력사(업체)별 인력 확보 및 기량 현황 (Clean, Professional Table) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <h3 className="text-sm sm:text-[15px] font-black text-[#002c5f] flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-blue-700" /> V. 협력사별 인력 수급 및 기량·어학 현황
                </h3>
              </div>

              {/* Clean High-Contrast Table with Focused Highlights */}
              <div className="overflow-hidden border border-slate-300 rounded-lg shadow-xs">
                <table className="w-full table-fixed text-center text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#002c5f] text-white font-bold text-xs">
                      <th className="py-2 px-1 text-center border-r border-blue-900/60 w-[14%] whitespace-nowrap">협력사명</th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 w-[11%] whitespace-nowrap">직종</th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 w-[8%] whitespace-nowrap">응시인원</th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 w-[8%] whitespace-nowrap">최종합격</th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 w-[8%] whitespace-nowrap">조건부</th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 bg-blue-900 w-[8%] whitespace-nowrap font-black">
                        합격소계
                      </th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 bg-[#001f44] w-[8.5%] font-black">
                        <div>선발률</div>
                        <div className="text-[10px] font-normal text-slate-300 leading-tight">(%)</div>
                      </th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 w-[7.5%] whitespace-nowrap">불합격</th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 w-[8%] whitespace-nowrap">용접평균</th>
                      <th className="py-2 px-0.5 text-center border-r border-blue-900/60 w-[8%] whitespace-nowrap">취부평균</th>
                      <th className="py-2 px-0.5 text-center w-[9%]">
                        <div>한국어</div>
                        <div className="text-[10px] font-normal text-slate-300 leading-tight">말하기</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                    {agencyStats.map((ag, idx) => (
                      <tr key={ag.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        {/* 1. Agency Name */}
                        <td className="py-1.5 px-1 font-bold text-slate-900 text-center border-r border-slate-200 text-xs truncate overflow-hidden" title={ag.name}>
                          {ag.name}
                        </td>

                        {/* 2. Job */}
                        <td className="py-1.5 px-0.5 text-slate-600 text-center border-r border-slate-200 font-medium text-[11px] leading-tight break-keep overflow-hidden">
                          {ag.jobs}
                        </td>

                        {/* 3. Total Candidates */}
                        <td className="py-1.5 px-0.5 font-mono text-slate-700 text-center border-r border-slate-200 whitespace-nowrap overflow-hidden">
                          {ag.total}명
                        </td>

                        {/* 4. Final / Pure Pass */}
                        <td className="py-1.5 px-0.5 font-mono text-slate-800 text-center border-r border-slate-200 whitespace-nowrap overflow-hidden">
                          {ag.passPure}명
                        </td>

                        {/* 5. Conditional Pass */}
                        <td className="py-1.5 px-0.5 font-mono text-slate-800 text-center border-r border-slate-200 whitespace-nowrap overflow-hidden">
                          {ag.passCond}명
                        </td>

                        {/* 6. Pass Subtotal (Highlighted) */}
                        <td className="py-1.5 px-0.5 font-mono font-black text-[#002c5f] text-center border-r border-slate-200 bg-blue-50/50 whitespace-nowrap overflow-hidden">
                          {ag.passPure + ag.passCond}명
                        </td>

                        {/* 7. Total Pass Rate (Highlighted) */}
                        <td className="py-1.5 px-0.5 font-mono font-black text-emerald-700 text-center border-r border-slate-200 bg-emerald-50/40 text-xs whitespace-nowrap overflow-hidden">
                          {ag.passTotalRate}%
                        </td>

                        {/* 8. Fail */}
                        <td className={`py-1.5 px-0.5 font-mono text-center border-r border-slate-200 whitespace-nowrap overflow-hidden ${ag.fail > 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                          {ag.fail}명
                        </td>

                        {/* 9. Weld Score Average */}
                        <td className="py-1.5 px-0.5 font-mono text-slate-700 text-center border-r border-slate-200 whitespace-nowrap overflow-hidden">
                          {ag.avgWeld > 0 ? `${ag.avgWeld}점` : '-'}
                        </td>

                        {/* 10. Fit Score Average */}
                        <td className="py-1.5 px-0.5 font-mono text-slate-700 text-center border-r border-slate-200 whitespace-nowrap overflow-hidden">
                          {ag.avgFit > 0 ? `${ag.avgFit}점` : '-'}
                        </td>

                        {/* 11. Korean Speaking Average */}
                        <td className="py-1.5 px-0.5 font-mono text-slate-700 text-center whitespace-nowrap overflow-hidden">
                          {ag.avgKorean > 0 ? `${ag.avgKorean}점` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Summary Total Row */}
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
                      <td className="py-2 px-1 text-center border-r border-slate-300 font-black whitespace-nowrap overflow-hidden">
                        [전체 합계]
                      </td>
                      <td className="py-2 px-0.5 text-center border-r border-slate-300 text-slate-600 font-medium whitespace-nowrap overflow-hidden">
                        전 직종
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-slate-900 border-r border-slate-300 font-bold whitespace-nowrap overflow-hidden">
                        {stats.total}명
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-slate-900 border-r border-slate-300 font-bold whitespace-nowrap overflow-hidden">
                        {stats.passPureCount}명
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-slate-900 border-r border-slate-300 font-bold whitespace-nowrap overflow-hidden">
                        {stats.passCondCount}명
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-[#002c5f] border-r border-slate-300 bg-blue-100/60 font-black whitespace-nowrap overflow-hidden">
                        {stats.passTotalCount}명
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-emerald-800 border-r border-slate-300 bg-emerald-100/70 text-xs font-black whitespace-nowrap overflow-hidden">
                        {stats.passTotalRate}%
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-slate-700 border-r border-slate-300 font-medium whitespace-nowrap overflow-hidden">
                        {stats.failCount}명
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-slate-900 border-r border-slate-300 font-bold whitespace-nowrap overflow-hidden">
                        {stats.avgWeld}점
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-slate-900 border-r border-slate-300 font-bold whitespace-nowrap overflow-hidden">
                        {stats.avgFit > 0 ? `${stats.avgFit}점` : '-'}
                      </td>
                      <td className="py-2 px-0.5 font-mono text-center text-slate-900 font-bold whitespace-nowrap overflow-hidden">
                        {stats.avgKorean}점
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* VI. 세부 기량·어학 등급 및 인력 분포 현황 (데이터 집계 표 최적화: 100% 동일 폭 규격 표 3개) */}
            <div className="space-y-3 pt-1">
              <h3 className="text-sm sm:text-[15px] font-black text-[#002c5f] flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-700" /> VI. 세부 기량·어학 등급 및 인력 분석 현황 (데이터 집계)
              </h3>

              {/* 1) 직종별 실기 기량 등급 분포 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-blue-700 rounded-full"></span> 1) 직종별 실기 기량 등급 분포
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">단위: 명</span>
                </div>
                <div className="overflow-hidden border border-slate-300 rounded-lg shadow-xs">
                  <table className="w-full table-fixed text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[12%] whitespace-nowrap">구분</th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[11%]">
                          <div className="font-bold text-slate-800">S등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(91~100점)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[11%]">
                          <div className="font-bold text-slate-800">A등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(81~90점)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[11%]">
                          <div className="font-bold text-slate-800">B등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(61~80점)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[11%]">
                          <div className="font-bold text-slate-800">C등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(51~60점)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[11%]">
                          <div className="font-bold text-slate-800">D등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(50점 이하)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 bg-slate-200/60 font-black text-slate-900 w-[13%]">
                          <div className="font-black">합계</div>
                          <div className="text-[10px] text-slate-600 font-normal leading-tight">(실기 응시)</div>
                        </th>
                        <th className="py-1.5 px-1 bg-emerald-50 text-emerald-900 font-black w-[20%]">
                          <div className="font-black">기량 합격률</div>
                          <div className="text-[10px] text-emerald-700 font-normal leading-tight">(C등급 이상)</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                      <tr>
                        <td className="py-1.5 px-1 font-bold text-slate-900 border-r border-slate-200 bg-slate-50/60 whitespace-nowrap">용접</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.weld.S}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.weld.A}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.weld.B}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.weld.C}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.weld.D}</td>
                        <td className="py-1.5 px-1 font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-50">{skillGradeDetail.weld.total}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-emerald-800 bg-emerald-50/50">{stats.weldPassRate}%</td>
                      </tr>
                      {skillGradeDetail.fit.total > 0 && (
                        <tr>
                          <td className="py-1.5 px-1 font-bold text-slate-900 border-r border-slate-200 bg-slate-50/60 whitespace-nowrap">취부</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.fit.S}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.fit.A}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.fit.B}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.fit.C}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{skillGradeDetail.fit.D}</td>
                          <td className="py-1.5 px-1 font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-50">{skillGradeDetail.fit.total}</td>
                          <td className="py-1.5 px-1 font-mono font-black text-emerald-800 bg-emerald-50/50">{stats.fitPassRate}%</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  * 취부 응시자의 용접 실기 의무 수검으로 직종별 응시 인원에 중복 집계 포함됨.
                </p>
              </div>

              {/* 2) 한국어 말하기 평가 등급 분포 (심플하고 정갈한 하이라이트 적용) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-purple-700 rounded-full"></span> 2) 한국어 말하기 평가 등급 분포
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">단위: 명</span>
                </div>
                <div className="overflow-hidden border border-slate-300 rounded-lg shadow-xs">
                  <table className="w-full table-fixed text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[11%] whitespace-nowrap">구분</th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[10%]">
                          <div className="font-bold text-slate-800">A등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(80점↑)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[10%]">
                          <div className="font-bold text-slate-800">B등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(70~79점)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[10%]">
                          <div className="font-bold text-slate-800">C등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(60~69점)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 bg-blue-50/90 text-[#002c5f] font-black w-[13%]">
                          <div className="font-black">합격 소계</div>
                          <div className="text-[10px] text-blue-700 font-normal leading-tight">(A~C등급)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[10%]">
                          <div className="font-bold text-slate-800">D등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(40~59점)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[10%]">
                          <div className="font-bold text-slate-800">E등급</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">(40점 미만)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 bg-slate-200/60 font-black text-slate-900 w-[11%]">
                          <div className="font-black">평가 합계</div>
                          <div className="text-[10px] text-slate-600 font-normal leading-tight">(구술 응시)</div>
                        </th>
                        <th className="py-1.5 px-1 bg-purple-50 text-purple-950 font-black w-[15%]">
                          <div className="font-black">소통 적격률</div>
                          <div className="text-[10px] text-purple-700 font-normal leading-tight">(A~C 비율)</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                      <tr>
                        <td className="py-1.5 px-1 font-bold text-slate-900 border-r border-slate-200 bg-slate-50/60 whitespace-nowrap">용접</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.weld.A}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.weld.B}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.weld.C}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-[#002c5f] border-r border-slate-200 bg-blue-50/50">{koreanGradeDetail.weld.passSubtotal}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.weld.D}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.weld.E}</td>
                        <td className="py-1.5 px-1 font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-50">{koreanGradeDetail.weld.total}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-purple-800 bg-purple-50/40">
                          {koreanGradeDetail.weld.total > 0 ? `${Math.round((koreanGradeDetail.weld.passSubtotal / koreanGradeDetail.weld.total) * 1000) / 10}%` : '0%'}
                        </td>
                      </tr>
                      {koreanGradeDetail.fit.total > 0 && (
                        <tr>
                          <td className="py-1.5 px-1 font-bold text-slate-900 border-r border-slate-200 bg-slate-50/60 whitespace-nowrap">취부</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.fit.A}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.fit.B}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.fit.C}</td>
                          <td className="py-1.5 px-1 font-mono font-black text-[#002c5f] border-r border-slate-200 bg-blue-50/50">{koreanGradeDetail.fit.passSubtotal}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.fit.D}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{koreanGradeDetail.fit.E}</td>
                          <td className="py-1.5 px-1 font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-50">{koreanGradeDetail.fit.total}</td>
                          <td className="py-1.5 px-1 font-mono font-black text-purple-800 bg-purple-50/40">
                            {koreanGradeDetail.fit.total > 0 ? `${Math.round((koreanGradeDetail.fit.passSubtotal / koreanGradeDetail.fit.total) * 1000) / 10}%` : '0%'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td className="py-1.5 px-1 border-r border-slate-300 font-black whitespace-nowrap">[한국어 합계]</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-300">{koreanGradeDetail.total.A}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-300">{koreanGradeDetail.total.B}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-300">{koreanGradeDetail.total.C}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-[#002c5f] border-r border-slate-300 bg-blue-100/60">{koreanGradeDetail.total.passSubtotal}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-300">{koreanGradeDetail.total.D}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-300">{koreanGradeDetail.total.E}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-slate-900 border-r border-slate-300 bg-slate-200/60">{koreanGradeDetail.total.total}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-purple-900 bg-purple-100/70">{stats.koreanPassRate}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  * A~C등급: 직무 소통 적격(최종 합격) / D등급: 20대 청년층 연령 기준 조건부 합격(본 기량검증 추가 기회 부여) / E등급: 소통 불가(불합격)
                </p>
              </div>

              {/* 3) 합격자 연령대 분포 및 E-9 비자 경력 현황 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-700 rounded-full"></span> 3) 합격자 연령대 분포 및 E-9 비자 경력 현황
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">단위: 명</span>
                </div>
                <div className="overflow-hidden border border-slate-300 rounded-lg shadow-xs">
                  <table className="w-full table-fixed text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="py-1.5 px-1 border-r border-slate-300 w-[12%] whitespace-nowrap">구분</th>
                        <th className="py-1.5 px-0.5 border-r border-slate-300 w-[9%] whitespace-nowrap">19~24세</th>
                        <th className="py-1.5 px-0.5 border-r border-slate-300 w-[9%] whitespace-nowrap">25~29세</th>
                        <th className="py-1.5 px-0.5 border-r border-slate-300 w-[9%] whitespace-nowrap">30~34세</th>
                        <th className="py-1.5 px-0.5 border-r border-slate-300 w-[9%] whitespace-nowrap">35~39세</th>
                        <th className="py-1.5 px-0.5 border-r border-slate-300 w-[9%] whitespace-nowrap">40세 이상</th>
                        <th className="py-1.5 px-1 border-r border-slate-300 bg-emerald-50 text-emerald-950 font-black w-[12%]">
                          <div className="font-black">선발 소계</div>
                          <div className="text-[10px] text-emerald-700 font-normal leading-tight">(최종+조건부)</div>
                        </th>
                        <th className="py-1.5 px-1 border-r border-slate-300 font-bold text-slate-800 w-[10%] whitespace-nowrap">E-9 응시</th>
                        <th className="py-1.5 px-1 border-r border-slate-300 font-bold text-slate-800 w-[10%] whitespace-nowrap">E-9 선발</th>
                        <th className="py-1.5 px-1 bg-blue-50 text-[#002c5f] font-black w-[11%] whitespace-nowrap">E-9 선발률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                      <tr>
                        <td className="py-1.5 px-1 font-bold text-slate-900 border-r border-slate-200 bg-slate-50/60 whitespace-nowrap">용접</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.weld.g19_24}</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.weld.g25_29}</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.weld.g30_34}</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.weld.g35_39}</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.weld.g40_plus}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-emerald-900 border-r border-slate-200 bg-emerald-50/50">{ageAndE9Detail.weld.passTotal}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-200">{ageAndE9Detail.weld.e9Total}</td>
                        <td className="py-1.5 px-1 font-mono font-bold text-slate-900 border-r border-slate-200">{ageAndE9Detail.weld.e9Pass}</td>
                        <td className="py-1.5 px-1 font-mono font-bold text-blue-900 bg-blue-50/40">
                          {ageAndE9Detail.weld.e9Total > 0 ? `${Math.round((ageAndE9Detail.weld.e9Pass / ageAndE9Detail.weld.e9Total) * 1000) / 10}%` : '0%'}
                        </td>
                      </tr>
                      {ageAndE9Detail.fit.passTotal > 0 && (
                        <tr>
                          <td className="py-1.5 px-1 font-bold text-slate-900 border-r border-slate-200 bg-slate-50/60 whitespace-nowrap">취부</td>
                          <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.fit.g19_24}</td>
                          <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.fit.g25_29}</td>
                          <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.fit.g30_34}</td>
                          <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.fit.g35_39}</td>
                          <td className="py-1.5 px-0.5 font-mono border-r border-slate-200">{ageAndE9Detail.fit.g40_plus}</td>
                          <td className="py-1.5 px-1 font-mono font-black text-emerald-900 border-r border-slate-200 bg-emerald-50/50">{ageAndE9Detail.fit.passTotal}</td>
                          <td className="py-1.5 px-1 font-mono border-r border-slate-200">{ageAndE9Detail.fit.e9Total}</td>
                          <td className="py-1.5 px-1 font-mono font-bold text-slate-900 border-r border-slate-200">{ageAndE9Detail.fit.e9Pass}</td>
                          <td className="py-1.5 px-1 font-mono font-bold text-blue-900 bg-blue-50/40">
                            {ageAndE9Detail.fit.e9Total > 0 ? `${Math.round((ageAndE9Detail.fit.e9Pass / ageAndE9Detail.fit.e9Total) * 1000) / 10}%` : '0%'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td className="py-1.5 px-1 border-r border-slate-300 font-black whitespace-nowrap">[선발 합계]</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-300">{ageAndE9Detail.total.g19_24}</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-300">{ageAndE9Detail.total.g25_29}</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-300">{ageAndE9Detail.total.g30_34}</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-300">{ageAndE9Detail.total.g35_39}</td>
                        <td className="py-1.5 px-0.5 font-mono border-r border-slate-300">{ageAndE9Detail.total.g40_plus}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-emerald-950 border-r border-slate-300 bg-emerald-100/70">{ageAndE9Detail.total.passTotal}</td>
                        <td className="py-1.5 px-1 font-mono border-r border-slate-300">{ageAndE9Detail.total.e9Total}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-slate-900 border-r border-slate-300">{ageAndE9Detail.total.e9Pass}</td>
                        <td className="py-1.5 px-1 font-mono font-black text-[#002c5f] bg-blue-100/70">
                          {ageAndE9Detail.total.e9Total > 0 ? `${Math.round((ageAndE9Detail.total.e9Pass / ageAndE9Detail.total.e9Total) * 1000) / 10}%` : '0%'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  * 최종 및 조건부 합격자 기준 통계이며, E-9 비자 경력자 현황을 포함함.
                </p>
              </div>
            </div>
          </div>

          {/* Page 2 Footer */}
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-400 tracking-wider">
            <span>HD현대삼호 동반성장부 동반성장인력지원과 • 외국인 근로자 기량 검증 종합 결과 보고서</span>
            <span className="font-mono text-slate-500">P. {includeCover ? 3 : 2} / {totalPages}</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* OPTIONAL ATTACHMENT: 개인별 세부 성적 명단 (별첨) */}
        {/* ========================================================= */}
        {includeDetails && candidatePages.map((pageCandidates, pageIdx) => {
          const currentPageNum = (includeCover ? 4 : 3) + pageIdx;

          return (
            <div 
              key={pageIdx}
              className="report-page bg-white w-[210mm] min-h-[297mm] py-[10mm] px-[12mm] shadow-2xl rounded-sm flex flex-col justify-between font-sans border border-slate-200 print:border-none print:shadow-none"
            >
              <div>
                {/* Attachment Page Header */}
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <div className="min-w-0 pr-2">
                    <h2 className="text-[17px] font-black text-[#002c5f] tracking-tight whitespace-nowrap">
                      [별첨] 개인별 기량(용접·취부) 및 한국어 평가 세부 결과표
                    </h2>
                  </div>
                  <HdHyundaiCiLogo className="h-6 shrink-0" />
                </div>

                {/* Candidate Table - Perfectly Proportioned table-fixed w-full */}
                <div className="mt-2.5 overflow-hidden border border-slate-300 rounded-lg shadow-xs">
                  <table className="w-full table-fixed text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#002c5f] text-white font-extrabold text-xs">
                        <th className="py-2 px-0.5 w-[5%] text-center border-r border-blue-900 whitespace-nowrap">연번</th>
                        <th className="py-2 px-1 w-[12%] text-center border-r border-blue-900 whitespace-nowrap">협력사</th>
                        <th className="py-2 px-0.5 w-[8.5%] text-center border-r border-blue-900 whitespace-nowrap">수험번호</th>
                        <th className="py-2 px-1 w-[18%] text-center border-r border-blue-900 whitespace-nowrap">성명</th>
                        <th className="py-2 px-1 w-[12%] text-center border-r border-blue-900 whitespace-nowrap">직종</th>
                        <th className="py-2 px-0.5 w-[6%] text-center border-r border-blue-900 whitespace-nowrap">나이</th>
                        <th className="py-2 px-0.5 w-[9.5%] text-center border-r border-blue-900 bg-blue-800/80 whitespace-nowrap">용접점수</th>
                        <th className="py-2 px-0.5 w-[9.5%] text-center border-r border-blue-900 bg-blue-800/80 whitespace-nowrap">취부점수</th>
                        <th className="py-2 px-0.5 w-[9.5%] text-center border-r border-blue-900 bg-purple-900/80 whitespace-nowrap">한국어총점</th>
                        <th className="py-2 px-0.5 w-[10%] text-center bg-[#001f44] whitespace-nowrap">최종판정</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                      {pageCandidates.map((c, idx) => {
                        const globalIndex = pageIdx * 30 + idx + 1;
                        const kScore = Number(c.k_score) || 0;
                        const sWeld = Number(c.s_score_weld) || 0;
                        const sFit = Number(c.s_score_fit) || 0;
                        const kGrade = c.k_grade || getKoreanGrade(kScore);
                        const wGrade = c.grade_weld || getSkillGradeByScore(sWeld);
                        const fGrade = c.grade_fit || getSkillGradeByScore(sFit);
                        const finalResult = determineResult(c);

                        return (
                          <tr key={c.uid || `${c.app_no}_${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className="py-1 px-0.5 text-slate-400 font-mono text-center border-r border-slate-200 whitespace-nowrap text-[11px] overflow-hidden">{globalIndex}</td>
                            <td className="py-1 px-1 text-center font-bold text-slate-900 border-r border-slate-200 truncate text-[11.5px] overflow-hidden" title={c.agency || '-'}>{c.agency || '-'}</td>
                            <td className="py-1 px-0.5 font-mono font-bold text-slate-800 text-center border-r border-slate-200 whitespace-nowrap text-[11px] overflow-hidden">{c.app_no}</td>
                            <td className="py-1 px-1 text-center font-bold text-slate-900 border-r border-slate-200 truncate text-[11.5px] overflow-hidden" title={c.name}>{c.name}</td>
                            <td className="py-1 px-1 text-center border-r border-slate-200 font-bold text-slate-800 whitespace-nowrap text-[11.5px] overflow-hidden">{c.job || c.eval_type || '용접'}</td>
                            <td className="py-1 px-0.5 font-mono text-slate-700 text-center border-r border-slate-200 whitespace-nowrap text-[11px] overflow-hidden">{c.age ? `${c.age}세` : '-'}</td>
                            <td className="py-1 px-0.5 text-center border-r border-slate-200 font-mono font-bold text-blue-900 bg-blue-50/20 whitespace-nowrap text-[11px] overflow-hidden">
                              {sWeld > 0 ? `${sWeld}점(${wGrade})` : '-'}
                            </td>
                            <td className="py-1 px-0.5 text-center border-r border-slate-200 font-mono text-slate-700 bg-blue-50/20 whitespace-nowrap text-[11px] overflow-hidden">
                              {sFit > 0 ? `${sFit}점(${fGrade})` : '-'}
                            </td>
                            <td className="py-1 px-0.5 text-center border-r border-slate-200 font-mono font-bold text-purple-900 bg-purple-50/20 whitespace-nowrap text-[11px] overflow-hidden">
                              {kScore > 0 ? `${kScore}점(${kGrade})` : '-'}
                            </td>
                            <td className="py-1 px-0.5 text-center whitespace-nowrap overflow-hidden">
                              <div className="flex items-center justify-center">
                                {finalResult === '최종 합격' && (
                                  <span className="w-[58px] py-0.5 rounded-full bg-blue-100 text-blue-900 font-black text-[10.5px] border border-blue-300 text-center tracking-tight shadow-2xs">
                                    최종합격
                                  </span>
                                )}
                                {finalResult === '조건부 합격' && (
                                  <span className="w-[58px] py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-black text-[10.5px] border border-emerald-300 text-center tracking-tight shadow-2xs">
                                    조건부합격
                                  </span>
                                )}
                                {finalResult === '불합격' && (
                                  <span className="w-[58px] py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10.5px] border border-red-300 text-center tracking-tight shadow-2xs">
                                    불합격
                                  </span>
                                )}
                                {finalResult !== '최종 합격' && finalResult !== '조건부 합격' && finalResult !== '불합격' && (
                                  <span className="w-[58px] py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-[10.5px] border border-slate-300 text-center tracking-tight shadow-2xs">
                                    평가대기
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attachment Page Footer */}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-400 tracking-wider">
                <span>HD현대삼호 동반성장부 동반성장인력지원과 • 개인별 세부 검증 결과 별첨</span>
                <span className="font-mono text-slate-500">P. {currentPageNum} / {totalPages}</span>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
