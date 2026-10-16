import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  SlidersHorizontal, 
  Search,
  Languages, 
  Hammer, 
  ClipboardCheck, 
  Filter,
  X, 
  Zap, 
  ArrowUpDown, 
  Download, 
  FileText, 
  User, 
  MapPin, 
  ChevronRight,
  Calendar,
  ChevronDown,
  CheckSquare,
  Square,
  Check,
  Video,
  FolderSync,
  Play,
  ExternalLink,
  Edit2,
  Star,
  CalendarCheck,
  CalendarX,
  PlaneTakeoff,
  PlaneLanding,
  Building2,
  CheckCircle2,
  RotateCcw,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useAppContext } from '../context/AppContext';
import { checkKoreanPass, checkSkillPass, determineResult, getBadgeHtml, calculateAge, normalizeDate, normalizeType, getDrivePreviewUrl, formatCount, formatPeople, computeAgencyTrack } from '../lib/utils';
import { DEPARTMENTS, DepartmentType } from '../types';
import { MediaLinkModal } from './MediaLinkModal';
import { MediaViewerModal } from './MediaViewerModal';
import { IndividualMediaModal } from './IndividualMediaModal';
import { BatchManagementModal } from './BatchManagementModal';
import CalendarDatePicker from './CalendarDatePicker';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const { 
    candidates, 
    globalLogs, 
    setCurrentView, 
    setSelectedCandidateUid, 
    updateCandidateMedia, 
    toggleCandidateStar,
    batchUpdateManagement,
    updateCandidateManagement,
    isGasOutdated,
    syncStats
  } = useAppContext();

  const [filterType, setFilterType] = useState('all');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterAgency, setFilterAgency] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [passFailSortMode, setPassFailSortMode] = useState<'pass' | 'fail'>('pass');
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);
  
  const [sortCol, setSortCol] = useState('app_no');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  // Batch Management Modal state & selected candidate UIDs (checkboxes)
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Individual Candidate Schedule/Dept edit state inside Candidate Detail Modal
  const [candPassDate, setCandPassDate] = useState('');
  const [candFailDate, setCandFailDate] = useState('');
  const [candEntryDate, setCandEntryDate] = useState('');
  const [candEntryFailDate, setCandEntryFailDate] = useState('');
  const [candDept, setCandDept] = useState('');
  const [isSavingCandMgmt, setIsSavingCandMgmt] = useState(false);

  // Google Drive Media Link & Viewer Modals
  const [showMediaLinkModal, setShowMediaLinkModal] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{
    isOpen: boolean;
    title: string;
    candidateName?: string;
    appNo?: string;
    mediaType: 'video' | 'test';
    url: string;
  } | null>(null);
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editTestUrl, setEditTestUrl] = useState('');
  const [isSavingMedia, setIsSavingMedia] = useState(false);

  // Individual Candidate Media Registration Modal state
  const [individualModal, setIndividualModal] = useState<{
    isOpen: boolean;
    candidate: any | null;
    focus: 'video' | 'test' | 'all';
  }>({
    isOpen: false,
    candidate: null,
    focus: 'all'
  });

  // Sync selectedCandidate edit fields when candidate is opened
  useEffect(() => {
    if (selectedCandidate) {
      setCandPassDate(selectedCandidate.pass_date || '');
      setCandFailDate(selectedCandidate.fail_date || '');
      setCandEntryDate(selectedCandidate.entry_date || '');
      setCandEntryFailDate(selectedCandidate.entry_fail_date || '');
      setCandDept(selectedCandidate.department || '');
    }
  }, [selectedCandidate]);

  // Keep selectedCandidate synced if candidates array updates
  useEffect(() => {
    if (selectedCandidate) {
      const updated = candidates.find(c => c.uid === selectedCandidate.uid);
      if (updated) {
        setSelectedCandidate(updated);
      }
    }
  }, [candidates]);

  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Update date dropdown position and handle resize/scroll
  useEffect(() => {
    if (isDateOpen && dateButtonRef.current) {
      const updatePosition = () => {
        if (!dateButtonRef.current) return;
        const rect = dateButtonRef.current.getBoundingClientRect();
        const popoverWidth = Math.min(window.innerWidth - 20, 360);
        let left = rect.left;
        if (left + popoverWidth > window.innerWidth - 10) {
          left = Math.max(10, window.innerWidth - popoverWidth - 10);
        }
        setDropdownPos({
          top: rect.bottom + 6,
          left: Math.max(8, left)
        });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [isDateOpen]);

  // Close date dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dateDropdownRef.current && 
        !dateDropdownRef.current.contains(event.target as Node) &&
        dateButtonRef.current &&
        !dateButtonRef.current.contains(event.target as Node)
      ) {
        setIsDateOpen(false);
      }
    }
    if (isDateOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDateOpen]);

  // Helper to reliably resolve evaluation date
  const getCandidateDate = (c: any): string => {
    if (c.eval_date && String(c.eval_date).trim() !== '') {
      const n = normalizeDate(c.eval_date);
      if (n) return n;
    }
    const matchLog = globalLogs.find(l => 
      String(l.app_no).trim() === String(c.app_no).trim() && 
      (normalizeType(l.eval_type) === normalizeType(c.eval_type) || !l.eval_type) && 
      l.eval_date
    );
    if (matchLog && matchLog.eval_date) {
      return normalizeDate(matchLog.eval_date);
    }
    return '';
  };

  // Dynamic filter lists
  const availableCandidatesForDate = useMemo(() => {
    return candidates.filter(c => 
      (filterType === 'all' || c.eval_type === filterType) &&
      (filterCountry === 'all' || c.country === filterCountry) &&
      (filterAgency === 'all' || c.agency === filterAgency)
    );
  }, [candidates, filterType, filterCountry, filterAgency]);

  const validDates = useMemo(() => {
    const dates = Array.from(
      new Set(
        availableCandidatesForDate
          .map(c => getCandidateDate(c))
          .filter(Boolean)
      )
    ).sort().reverse();
    return dates;
  }, [availableCandidatesForDate, globalLogs]);

  // Date count map
  const dateCounts = useMemo(() => {
    const map: Record<string, number> = {};
    availableCandidatesForDate.forEach(c => {
      const d = getCandidateDate(c);
      if (d) map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [availableCandidatesForDate, globalLogs]);

  const validCountries = useMemo(() => {
    return Array.from(
      new Set(
        candidates
          .filter(c => {
            if (filterType !== 'all' && c.eval_type !== filterType) return false;
            const cDate = getCandidateDate(c);
            if (selectedDates.length > 0 && !selectedDates.includes(cDate)) return false;
            if (filterAgency !== 'all' && c.agency !== filterAgency) return false;
            return true;
          })
          .map(c => c.country)
          .filter(Boolean)
      )
    ).sort();
  }, [candidates, filterType, selectedDates, filterAgency, globalLogs]);

  const validAgencies = useMemo(() => {
    return Array.from(
      new Set(
        candidates
          .filter(c => {
            if (filterType !== 'all' && c.eval_type !== filterType) return false;
            const cDate = getCandidateDate(c);
            if (selectedDates.length > 0 && !selectedDates.includes(cDate)) return false;
            if (filterCountry !== 'all' && c.country !== filterCountry) return false;
            return true;
          })
          .map(c => c.agency)
          .filter(Boolean)
      )
    ).sort();
  }, [candidates, filterType, selectedDates, filterCountry, globalLogs]);

  const validDepartments = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => {
      if (c.department && String(c.department).trim()) {
        set.add(String(c.department).trim());
      }
    });
    return Array.from(set).sort();
  }, [candidates]);

  // Toggle date in multi-select
  const toggleDate = (date: string) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) {
        return prev.filter(d => d !== date);
      } else {
        return [...prev, date];
      }
    });
  };

  const selectAllDates = () => {
    setSelectedDates([...validDates]);
  };

  const clearAllDates = () => {
    setSelectedDates([]);
  };

  // Main filtered list
  const filtered = useMemo(() => {
    let list = candidates.filter(c => {
      if (filterType !== 'all' && c.eval_type !== filterType) return false;
      const cDate = getCandidateDate(c);
      if (selectedDates.length > 0 && !selectedDates.includes(cDate)) return false;
      if (filterCountry !== 'all' && c.country !== filterCountry) return false;
      if (filterAgency !== 'all' && c.agency !== filterAgency) return false;
      if (filterDept !== 'all' && String(c.department || '').trim() !== filterDept) return false;
      return true;
    });

    list.sort((a: any, b: any) => {
      if (sortCol === 'starred') {
        const vA = a.starred ? 1 : 0;
        const vB = b.starred ? 1 : 0;
        return sortAsc ? vB - vA : vA - vB;
      }
      if (sortCol === 'pass_fail_date' || sortCol === 'pass_date') {
        if (passFailSortMode === 'pass') {
          const hasA = Boolean(a.pass_date);
          const hasB = Boolean(b.pass_date);
          if (hasA && !hasB) return -1;
          if (!hasA && hasB) return 1;
          if (hasA && hasB) {
            return sortAsc 
              ? String(a.pass_date).localeCompare(String(b.pass_date))
              : String(b.pass_date).localeCompare(String(a.pass_date));
          }
          return 0;
        } else {
          const hasA = Boolean(a.fail_date);
          const hasB = Boolean(b.fail_date);
          if (hasA && !hasB) return -1;
          if (!hasA && hasB) return 1;
          if (hasA && hasB) {
            return sortAsc 
              ? String(a.fail_date).localeCompare(String(b.fail_date))
              : String(b.fail_date).localeCompare(String(a.fail_date));
          }
          return 0;
        }
      }
      if (sortCol === 'entry_date') {
        const hasA = Boolean(a.entry_date);
        const hasB = Boolean(b.entry_date);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (hasA && hasB) {
          return sortAsc 
            ? String(a.entry_date).localeCompare(String(b.entry_date))
            : String(b.entry_date).localeCompare(String(a.entry_date));
        }
        return 0;
      }
      if (sortCol === 'department') {
        const hasA = Boolean(a.department);
        const hasB = Boolean(b.department);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        return sortAsc 
          ? String(a.department).localeCompare(String(b.department))
          : String(b.department).localeCompare(String(a.department));
      }
      if (sortCol === 'k_score' || sortCol === 'age') { 
        const vA = Number(a[sortCol]) || 0; 
        const vB = Number(b[sortCol]) || 0; 
        return sortAsc ? vA - vB : vB - vA;
      }
      const vA = String(a[sortCol] || '').toLowerCase(); 
      const vB = String(b[sortCol] || '').toLowerCase(); 
      if (vA < vB) return sortAsc ? -1 : 1;
      if (vA > vB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [candidates, filterType, selectedDates, filterCountry, filterAgency, filterDept, sortCol, sortAsc, passFailSortMode]);

  const exportToCSV = () => {
    if (filtered.length === 0) return alert('내보낼 데이터가 없습니다.');
    const headers = [
      '수험번호', '성명', '별표(★)', '생년월일', '직종', 'E9', '국가', '업체', '트랙',
      '평가구분', '평가일', '한국어점수', '한국어등급', '용접점수', '취부점수', '실기등급(용접)', '실기등급(취부)',
      '통합결과', '합격일자', '탈락일자', '입국일자', '입국탈락일자', '배정부서',
      '한국어특이사항', '기량특이사항', '종합의견'
    ];
    const rows = filtered.map(c => [
      c.app_no, c.name, c.starred ? '★' : '', c.dob, c.job, c.e9, c.country, c.agency, c.track || computeAgencyTrack(c.agency),
      c.eval_type, c.eval_date,
      c.k_score || 0, c.k_grade || '-', c.s_score_weld || 0, c.s_score_fit || 0, c.grade_weld || '-', c.grade_fit || '-',
      c.result || '대기', c.pass_date || '', c.fail_date || '', c.entry_date || '', c.entry_fail_date || '', c.department || '',
      (c.interview_memo || '').replace(/\n/g, ' '), (c.skill_memo || '').replace(/\n/g, ' '), (c.memo || '').replace(/\n/g, ' ')
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HD현대삼호_평가및일정관리_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatShortDate = (d?: string | null): string => {
    if (!d) return '';
    const s = String(d).trim();
    const m = s.match(/^(?:20)?(\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) {
      const yy = m[1];
      const mm = m[2].padStart(2, '0');
      const dd = m[3].padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    return s.length > 8 ? s.slice(2, 10) : s;
  };

  const isSkillComplete = (c: any) => {
    const isF = (c.job || '').includes('취부');
    return c.s_status === '완료' || (isF ? (c.s_score_weld > 0 && c.s_score_fit > 0) : c.s_score_weld > 0);
  };

  const total = filtered.length;
  const starredTotal = filtered.filter(c => c.starred).length;
  const kList = filtered.filter(c => (c.k_score || 0) > 0);
  const kComp = kList.length;
  const kPassPure = kList.filter(c => checkKoreanPass(c) === '최종 합격').length;
  const kPassCond = kList.filter(c => checkKoreanPass(c) === '최종 합격' || checkKoreanPass(c) === '조건부 합격').length;

  const sList = filtered.filter(c => isSkillComplete(c));
  const sComp = sList.length;
  const sPass = sList.filter(c => checkSkillPass(c)).length;

  const tList = filtered.filter(c => (c.k_score || 0) > 0 && isSkillComplete(c));
  const tComp = tList.length;
  const tPassPure = tList.filter(c => determineResult(c) === '최종 합격').length;
  const tPassCond = tList.filter(c => determineResult(c) === '최종 합격' || determineResult(c) === '조건부 합격').length;

  const passDateTotal = filtered.filter(c => Boolean(c.pass_date)).length;
  const failDateTotal = filtered.filter(c => Boolean(c.fail_date)).length;
  const entryDateTotal = filtered.filter(c => Boolean(c.entry_date)).length;
  const deptTotal = filtered.filter(c => Boolean(c.department)).length;

  const handleSubFilter = (filterName: string) => { setActiveSubFilter(prev => prev === filterName ? null : filterName); };

  let tableList = filtered.filter(c => (c.k_score || 0) > 0 || isSkillComplete(c) || Boolean(c.pass_date) || Boolean(c.fail_date) || Boolean(c.entry_date) || selectedDates.length > 0);
  let filterBadgeText = "";
  if (activeSubFilter === 'k-comp') { tableList = filtered.filter(c => (c.k_score || 0) > 0); filterBadgeText = "한국어 평가 완료"; }
  else if (activeSubFilter === 'k-pass-pure') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && checkKoreanPass(c) === '최종 합격'); filterBadgeText = "한국어 순수 합격"; }
  else if (activeSubFilter === 'k-pass-cond') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && (checkKoreanPass(c) === '최종 합격' || checkKoreanPass(c) === '조건부 합격')); filterBadgeText = "한국어 조건부 포함 합격"; }
  else if (activeSubFilter === 's-comp') { tableList = filtered.filter(c => isSkillComplete(c)); filterBadgeText = "기량 평가 완료"; }
  else if (activeSubFilter === 's-pass') { tableList = filtered.filter(c => isSkillComplete(c) && checkSkillPass(c)); filterBadgeText = "기량 실기 통과"; }
  else if (activeSubFilter === 't-comp') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && isSkillComplete(c)); filterBadgeText = "통합 최종 판정 완료"; }
  else if (activeSubFilter === 't-pass-pure') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && isSkillComplete(c) && determineResult(c) === '최종 합격'); filterBadgeText = "통합 순수 합격"; }
  else if (activeSubFilter === 't-pass-cond') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && isSkillComplete(c) && (determineResult(c) === '최종 합격' || determineResult(c) === '조건부 합격')); filterBadgeText = "통합 조건부 포함 합격"; }
  else if (activeSubFilter === 'starred') { tableList = filtered.filter(c => c.starred); filterBadgeText = "★ 별표 대상자"; }
  else if (activeSubFilter === 'pass-date') { tableList = filtered.filter(c => Boolean(c.pass_date)); filterBadgeText = `합격일자 등록자 (${passDateTotal}명)`; }
  else if (activeSubFilter === 'fail-date') { tableList = filtered.filter(c => Boolean(c.fail_date)); filterBadgeText = `탈락일자 등록자 (${failDateTotal}명)`; }
  else if (activeSubFilter === 'entry-date') { tableList = filtered.filter(c => Boolean(c.entry_date)); filterBadgeText = `입국일자 등록자 (${entryDateTotal}명)`; }
  else if (activeSubFilter === 'dept') { tableList = filtered.filter(c => Boolean(c.department)); filterBadgeText = `부서배정 완료자 (${deptTotal}명)`; }

  const selectedCandidatesForBatch = useMemo(() => {
    const uidSet = new Set(selectedUids);
    return tableList.filter(c => uidSet.has(c.uid));
  }, [tableList, selectedUids]);

  const toggleSelectAll = () => {
    if (selectedUids.length === tableList.length && tableList.length > 0) {
      setSelectedUids([]);
    } else {
      setSelectedUids(tableList.map(c => c.uid));
    }
  };

  const toggleSelectCandidate = (uid: string) => {
    setSelectedUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const getChartData = (pure: number, cond: number, fail: number, empty: boolean) => {
    if (empty) return { labels: ['Empty'], datasets: [{ data: [1], backgroundColor: ['#1e293b'], borderWidth: 0 }] };
    return {
      labels: ['순수 합격', '조건부 합격', '불합격'],
      datasets: [{ data: [pure, cond, fail], backgroundColor: ['#2563eb', '#10b981', '#f43f5e'], borderWidth: 0 }]
    };
  };

  const chartOptions = { responsive: true, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: true } }, animation: { animateScale: true, animateRotate: true } };

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  // Date filter label helper
  const getDateLabel = () => {
    if (selectedDates.length === 0) return '전체 날짜';
    if (selectedDates.length === 1) return selectedDates[0];
    if (selectedDates.length === validDates.length && validDates.length > 0) return `전체 (${validDates.length}개 일자)`;
    return `${selectedDates[0]} 외 ${selectedDates.length - 1}일 (${selectedDates.length}개 선택)`;
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-2 lg:p-4 animate-in fade-in max-w-[1600px] mx-auto w-full relative z-10">
      <div className="shrink-0 relative z-30">
        {/* Filters Bar - Fixed 1-line responsive layout */}
        <div className="mb-3 dx-card px-2.5 sm:px-3 md:px-4 py-2 border border-slate-800 bg-[#081526] relative z-30 overflow-x-auto custom-scrollbar no-scrollbar">
          <div className="flex items-center justify-between gap-2 md:gap-3 min-w-max w-full">
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 shrink-0">
              <span className="text-xs sm:text-sm md:text-base font-bold text-slate-200 px-1 flex items-center gap-1.5 md:gap-2 tracking-tight whitespace-nowrap shrink-0">
                <SlidersHorizontal className="w-4 h-4 md:w-5 md:h-5 text-slate-400 shrink-0" /> 데이터 필터
              </span>
              <div className="h-4 md:h-5 w-px bg-slate-800 mx-0.5 shrink-0"></div>
              
              {/* 1. Evaluation Type (전체 검증) */}
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)} 
                className="dx-input !w-auto cursor-pointer text-xs md:text-sm !py-1 md:!py-[7px] h-[34px] sm:h-[36px] md:h-[38px] font-medium shrink-0 min-w-[95px] sm:min-w-[105px]"
              >
                <option value="all">전체 검증</option>
                <option value="사전기량검증">사전기량검증</option>
                <option value="본기량검증">본기량검증</option>
              </select>

              {/* 2. Country Filter (전체 국가) */}
              <select 
                value={filterCountry} 
                onChange={e => setFilterCountry(e.target.value)} 
                className="dx-input !w-auto cursor-pointer text-xs md:text-sm !py-1 md:!py-[7px] h-[34px] sm:h-[36px] md:h-[38px] font-medium shrink-0 min-w-[90px] sm:min-w-[100px]"
              >
                <option value="all">전체 국가</option>
                {validCountries.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              {/* 3. Agency Filter (전체 업체) */}
              <select 
                value={filterAgency} 
                onChange={e => setFilterAgency(e.target.value)} 
                className="dx-input !w-auto cursor-pointer text-xs md:text-sm !py-1 md:!py-[7px] h-[34px] sm:h-[36px] md:h-[38px] font-medium shrink-0 min-w-[90px] sm:min-w-[100px]"
              >
                <option value="all">전체 업체</option>
                {validAgencies.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              {/* 4. Department Filter (전체 부서) */}
              <select 
                value={filterDept} 
                onChange={e => setFilterDept(e.target.value)} 
                className="dx-input !w-auto cursor-pointer text-xs md:text-sm !py-1 md:!py-[7px] h-[34px] sm:h-[36px] md:h-[38px] font-medium shrink-0 min-w-[90px] sm:min-w-[100px]"
                title="배치 부서 필터"
              >
                <option value="all">전체 부서</option>
                {validDepartments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              {/* 5. Multi-Select Date Filter Dropdown (전체 날짜) */}
              <div className="relative shrink-0">
                <button
                  ref={dateButtonRef}
                  type="button"
                  onClick={() => setIsDateOpen(prev => !prev)}
                  className={`dx-input !w-auto cursor-pointer text-xs md:text-sm !py-1 md:!py-[7px] h-[34px] sm:h-[36px] md:h-[38px] flex items-center justify-between gap-1.5 text-left font-medium transition-all min-w-[115px] sm:min-w-[125px] shrink-0 ${
                    selectedDates.length > 0 
                      ? 'border-blue-500 bg-blue-950/40 text-blue-300 ring-1 ring-blue-500/40' 
                      : 'text-slate-200 hover:border-slate-600'
                  }`}
                  title="평가 일자 다중 선택"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-[170px]">
                    <Calendar className={`w-3.5 h-3.5 shrink-0 ${selectedDates.length > 0 ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className="truncate">{getDateLabel()}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isDateOpen ? 'rotate-180 text-blue-400' : ''}`} />
                </button>
              </div>

              {/* Reset filter button if any active */}
              {(filterType !== 'all' || selectedDates.length > 0 || filterCountry !== 'all' || filterAgency !== 'all' || filterDept !== 'all' || activeSubFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('all');
                    setSelectedDates([]);
                    setFilterCountry('all');
                    setFilterAgency('all');
                    setFilterDept('all');
                    setActiveSubFilter(null);
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-2 py-1 h-[34px] sm:h-[36px] md:h-[38px] rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
                  title="모든 필터 초기화"
                >
                  <X className="w-3.5 h-3.5" /> 필터 초기화
                </button>
              )}
            </div>

            {/* Action Buttons: Media Link & Excel Download (Report button is already in global Header) */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button 
                onClick={() => setShowMediaLinkModal(true)} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 sm:px-3.5 md:px-4 h-[34px] sm:h-[36px] md:h-[38px] rounded-lg text-xs md:text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 border border-slate-700 shrink-0 justify-center whitespace-nowrap cursor-pointer"
                title="특정 평가일자 영상 및 인성검사 결과 구글 드라이브 일괄 연결"
              >
                <FolderSync className="w-4 h-4 text-slate-400 shrink-0" />
                <span>영상/인성 드라이브 연결</span>
              </button>
              
              <button 
                onClick={exportToCSV} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 sm:px-3.5 md:px-4 h-[34px] sm:h-[36px] md:h-[38px] rounded-lg text-xs md:text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 border border-slate-700 shrink-0 justify-center whitespace-nowrap cursor-pointer"
                title="필터링된 평가 결과 CSV 파일 다운로드"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0" />
                <span>엑셀 다운로드</span>
              </button>
            </div>
          </div>
        </div>

        {/* Date Dropdown Popover using createPortal to prevent clipping on all screens */}
        {isDateOpen && typeof document !== 'undefined' && createPortal(
          <div 
            ref={dateDropdownRef}
            style={{
              position: 'fixed',
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              zIndex: 99999
            }}
          >
            <CalendarDatePicker
              selectedDates={selectedDates}
              onSelectDates={setSelectedDates}
              validDates={validDates}
              dateCounts={dateCounts}
              onClose={() => setIsDateOpen(false)}
            />
          </div>,
          document.body
        )}

        {/* Summary Cards - Vivid High-Resolution Authentic Real Photography */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {/* 1. Korean Assessment: Authentic Korean Traditional Hanok Architecture Photography */}
          <div 
            className="dx-card px-4 py-3 h-auto relative overflow-hidden flex flex-col border border-amber-600/40 shadow-lg group transition-all bg-[#071322]"
          >
            {/* Real Photograph Layer: Traditional Korean Hanok Giwa Roofs & Eaves with 1-tone brighter vivid presentation */}
            <div 
              className="absolute inset-0 bg-cover bg-no-repeat transition-transform duration-700 ease-out group-hover:scale-105 pointer-events-none"
              style={{
                backgroundImage: "url('/photo-korean.jpg')",
                backgroundPosition: "right 40%",
                opacity: 0.82,
                filter: "contrast(1.15) brightness(1.12) saturate(1.2)"
              }}
            />
            {/* Left text-protection gradient: ensures metrics remain crystal-clear while showcasing vivid Hanok photography on right */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#071322] via-[#071322]/75 via-45% to-transparent pointer-events-none z-0" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase mb-0.5">Korean Assessment</p>
                  <h2 className="text-base md:text-lg font-bold text-slate-100 tracking-tight flex items-center gap-1.5 drop-shadow-sm">
                    <span>한국어 평가 종합</span>
                  </h2>
                </div>
                <div className="w-9 h-9 rounded-lg bg-slate-900/80 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 shadow-sm backdrop-blur-sm">
                  <Languages className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-end mb-2">
                  <div onClick={() => handleSubFilter('k-comp')} className="cursor-pointer group p-1 -ml-1 rounded-lg hover:bg-slate-900/60 transition-colors">
                    <p className="text-xs text-slate-300 font-medium mb-0.5">평가 완료</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-white leading-none drop-shadow-sm">
                      <span>{formatCount(kComp)}</span>
                      <span className="text-xs font-normal text-slate-300 ml-1">/ <span>{formatCount(total)}</span>명</span>
                    </p>
                  </div>
                  <div className="w-13 h-13 shrink-0"><Doughnut data={getChartData(kPassPure, kPassCond - kPassPure, kComp - kPassCond, kComp === 0)} options={chartOptions as any} /></div>
                </div>
                <div className="flex justify-between items-center bg-[#050e1a]/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-800/80 min-h-0">
                  <div onClick={() => handleSubFilter('k-pass-pure')} className="flex-1 text-center cursor-pointer group p-1 rounded-md hover:bg-slate-800/50 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-medium mb-1">순수 합격</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-extrabold text-blue-400 leading-none"><span>{formatCount(kPassPure)}</span><span className="text-[10px] font-normal text-slate-400 ml-0.5">명</span></p>
                      <p className="text-[10px] font-medium text-slate-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded leading-none"><span>{kComp ? Math.round((kPassPure/kComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                  <div className="w-[1px] h-7 bg-slate-800 mx-1"></div>
                  <div onClick={() => handleSubFilter('k-pass-cond')} className="flex-1 text-center cursor-pointer group p-1 rounded-md hover:bg-slate-800/50 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-medium mb-1">조건부 포함</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-extrabold text-emerald-400 leading-none"><span>{formatCount(kPassCond)}</span><span className="text-[10px] font-normal text-slate-400 ml-0.5">명</span></p>
                      <p className="text-[10px] font-medium text-slate-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded leading-none"><span>{kComp ? Math.round((kPassCond/kComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Skill Verification: Authentic Industrial Shipyard Welding & Sparks Photography */}
          <div 
            className="dx-card px-4 py-3 h-auto relative overflow-hidden flex flex-col border border-cyan-600/40 shadow-lg group transition-all bg-[#051722]"
          >
            {/* Real Photograph Layer: Skilled Industrial Welder Working on Steel with Sparks */}
            <div 
              className="absolute inset-0 bg-cover bg-no-repeat transition-transform duration-700 ease-out group-hover:scale-105 pointer-events-none"
              style={{
                backgroundImage: "url('/photo-welding.jpg')",
                backgroundPosition: "right 30%",
                opacity: 0.82,
                filter: "contrast(1.15) brightness(1.12) saturate(1.2)"
              }}
            />
            {/* Left text-protection gradient: ensures metrics remain crystal-clear while showcasing glowing welding sparks */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#051722] via-[#051722]/75 via-45% to-transparent pointer-events-none z-0" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase mb-0.5">Skill Verification</p>
                  <h2 className="text-base md:text-lg font-bold text-slate-100 tracking-tight flex items-center gap-1.5 drop-shadow-sm">
                    <span>기량 평가 종합</span>
                  </h2>
                </div>
                <div className="w-9 h-9 rounded-lg bg-slate-900/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0 shadow-sm backdrop-blur-sm">
                  <Hammer className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-end mb-2">
                  <div onClick={() => handleSubFilter('s-comp')} className="cursor-pointer group p-1 -ml-1 rounded-lg hover:bg-slate-900/60 transition-colors">
                    <p className="text-xs text-slate-300 font-medium mb-0.5">평가 완료</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-white leading-none drop-shadow-sm">
                      <span>{formatCount(sComp)}</span>
                      <span className="text-xs font-normal text-slate-300 ml-1">/ <span>{formatCount(total)}</span>명</span>
                    </p>
                  </div>
                  <div className="w-13 h-13 shrink-0"><Doughnut data={getChartData(sPass, 0, sComp - sPass, sComp === 0)} options={chartOptions as any} /></div>
                </div>
                <div className="flex justify-center items-center bg-[#050e1a]/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-800/80 min-h-0">
                  <div onClick={() => handleSubFilter('s-pass')} className="flex-1 text-center cursor-pointer group p-1 rounded-md hover:bg-slate-800/50 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-medium mb-1">실기 통과 (조건부 없음)</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-extrabold text-slate-100 leading-none"><span>{formatCount(sPass)}</span><span className="text-[10px] font-normal text-slate-400 ml-0.5">명</span></p>
                      <p className="text-[10px] font-medium text-slate-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded leading-none"><span>{sComp ? Math.round((sPass/sComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Final Result: Authentic Airplane Cabin Window & Clouds Photography */}
          <div 
            className="dx-card px-4 py-3 h-auto relative overflow-hidden flex flex-col border border-indigo-600/40 md:col-span-2 lg:col-span-1 shadow-lg group transition-all bg-[#061224]"
          >
            {/* Real Photograph Layer: Looking Out Airplane Window at Wing and Clouds in Flight */}
            <div 
              className="absolute inset-0 bg-cover bg-no-repeat transition-transform duration-700 ease-out group-hover:scale-105 pointer-events-none"
              style={{
                backgroundImage: "url('/photo-airplane.jpg')",
                backgroundPosition: "right 45%",
                opacity: 0.82,
                filter: "contrast(1.15) brightness(1.12) saturate(1.2)"
              }}
            />
            {/* Left text-protection gradient: ensures metrics remain crystal-clear while showcasing glowing airplane wing and sunset clouds */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#061224] via-[#061224]/75 via-45% to-transparent pointer-events-none z-0" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase mb-0.5">Final Result</p>
                  <h2 className="text-base md:text-lg font-bold text-slate-100 tracking-tight flex items-center gap-1.5 drop-shadow-sm">
                    <span>통합 최종 결과</span>
                  </h2>
                </div>
                <div className="w-9 h-9 rounded-lg bg-slate-900/80 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 shadow-sm backdrop-blur-sm">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-end mb-2">
                  <div onClick={() => handleSubFilter('t-comp')} className="cursor-pointer group p-1 -ml-1 rounded-lg hover:bg-slate-900/60 transition-colors">
                    <p className="text-xs text-slate-300 font-medium mb-0.5">최종 판정 완료</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-white leading-none drop-shadow-sm">
                      <span>{formatCount(tComp)}</span>
                      <span className="text-xs font-normal text-slate-300 ml-1">/ <span>{formatCount(total)}</span>명</span>
                    </p>
                  </div>
                  <div className="w-13 h-13 shrink-0"><Doughnut data={getChartData(tPassPure, tPassCond - tPassPure, tComp - tPassCond, tComp === 0)} options={chartOptions as any} /></div>
                </div>
                <div className="flex justify-between items-center bg-[#050e1a]/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-800/80 min-h-0">
                  <div onClick={() => handleSubFilter('t-pass-pure')} className="flex-1 text-center cursor-pointer group p-1 rounded-md hover:bg-slate-800/50 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-medium mb-1">순수 합격</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-extrabold text-blue-400 leading-none"><span>{formatCount(tPassPure)}</span><span className="text-[10px] font-normal text-slate-400 ml-0.5">명</span></p>
                      <p className="text-[10px] font-medium text-slate-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded leading-none"><span>{tComp ? Math.round((tPassPure/tComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                  <div className="w-[1px] h-7 bg-slate-800 mx-1"></div>
                  <div onClick={() => handleSubFilter('t-pass-cond')} className="flex-1 text-center cursor-pointer group p-1 rounded-md hover:bg-slate-800/50 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-medium mb-1">조건부 포함</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-extrabold text-emerald-400 leading-none"><span>{formatCount(tPassCond)}</span><span className="text-[10px] font-normal text-slate-400 ml-0.5">명</span></p>
                      <p className="text-[10px] font-medium text-slate-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded leading-none"><span>{tComp ? Math.round((tPassCond/tComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Data Table */}
      <div className="dx-card flex-1 min-h-[400px] flex flex-col mt-2 md:mt-0 min-w-0 w-full border border-slate-800">
        <div className="px-3 py-1.5 min-h-[44px] border-b border-slate-800 flex flex-nowrap items-center justify-between gap-1.5 md:gap-2 bg-[#06111f] z-20 rounded-t-xl shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <h3 className="font-bold text-slate-100 flex items-center gap-1.5 text-sm md:text-base tracking-tight shrink-0 whitespace-nowrap">
              <ClipboardCheck className="w-4 h-4 text-slate-400 shrink-0" /> 평가 대상 명단
              <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded border transition-colors ${activeSubFilter ? 'text-blue-300 bg-slate-800 border-blue-500/40' : 'text-slate-400 bg-slate-900 border-slate-700'}`}>{formatPeople(tableList.length)}</span>
            </h3>
            
            {/* Quick Star Filter Button */}
            <button
              type="button"
              onClick={() => handleSubFilter('starred')}
              className={`text-[11px] px-2 py-1 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-all border shrink-0 whitespace-nowrap ${
                activeSubFilter === 'starred'
                  ? 'bg-slate-200 text-slate-900 border-white font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/60'
              }`}
              title="별표(★) 대상자만 모아보기"
            >
              <Star className={`w-3 h-3 ${activeSubFilter === 'starred' ? 'fill-slate-900 text-slate-900' : 'fill-amber-400 text-amber-400'}`} />
              <span>별표 {formatPeople(starredTotal)}</span>
            </button>

            {/* Quick Pass Date Filter Button */}
            <button
              type="button"
              onClick={() => handleSubFilter('pass-date')}
              className={`text-[11px] px-2 py-1 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-all border shrink-0 whitespace-nowrap ${
                activeSubFilter === 'pass-date'
                  ? 'bg-slate-200 text-slate-900 border-white font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/60'
              }`}
              title="합격일자 등록 대상자 필터링"
            >
              <CheckCircle2 className={`w-3 h-3 ${activeSubFilter === 'pass-date' ? 'text-slate-900' : 'text-emerald-400'}`} />
              <span>합격일자 {formatPeople(passDateTotal)}</span>
            </button>

            {/* Quick Fail Date Filter Button */}
            <button
              type="button"
              onClick={() => handleSubFilter('fail-date')}
              className={`text-[11px] px-2 py-1 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-all border shrink-0 whitespace-nowrap ${
                activeSubFilter === 'fail-date'
                  ? 'bg-slate-200 text-slate-900 border-white font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/60'
              }`}
              title="탈락일자 등록 대상자 필터링"
            >
              <X className={`w-3 h-3 ${activeSubFilter === 'fail-date' ? 'text-slate-900' : 'text-rose-400'}`} />
              <span>탈락일자 {formatPeople(failDateTotal)}</span>
            </button>

            {/* Quick Entry Date Filter Button */}
            <button
              type="button"
              onClick={() => handleSubFilter('entry-date')}
              className={`text-[11px] px-2 py-1 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-all border shrink-0 whitespace-nowrap ${
                activeSubFilter === 'entry-date'
                  ? 'bg-slate-200 text-slate-900 border-white font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/60'
              }`}
              title="입국일자 등록 대상자 필터링"
            >
              <PlaneLanding className={`w-3 h-3 ${activeSubFilter === 'entry-date' ? 'text-slate-900' : 'text-blue-400'}`} />
              <span>입국 {formatPeople(entryDateTotal)}</span>
            </button>

            {/* Quick Dept Filter Button */}
            <button
              type="button"
              onClick={() => handleSubFilter('dept')}
              className={`text-[11px] px-2 py-1 rounded-md font-medium flex items-center gap-1 cursor-pointer transition-all border shrink-0 whitespace-nowrap ${
                activeSubFilter === 'dept'
                  ? 'bg-slate-200 text-slate-900 border-white font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/60'
              }`}
              title="배치 부서 지정 완료자 필터링"
            >
              <Building2 className={`w-3 h-3 ${activeSubFilter === 'dept' ? 'text-slate-900' : 'text-slate-400'}`} />
              <span>부서 {formatPeople(deptTotal)}</span>
            </button>

            {activeSubFilter && (
              <button
                type="button"
                className="text-[11px] bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded-md font-medium flex items-center gap-1 cursor-pointer hover:bg-slate-700 transition-colors shrink-0 whitespace-nowrap"
                onClick={() => setActiveSubFilter(null)}
                title="필터 해제"
              >
                <Filter className="w-3 h-3 text-slate-400" /> <span className="tracking-wide">{filterBadgeText}</span> <X className="w-3 h-3 ml-0.5 opacity-70" />
              </button>
            )}
          </div>
          {/* Streamlined, single batch action button with selection badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedUids.length > 0 && (
              <span className="text-[11px] px-2 py-1 rounded-md font-bold bg-blue-950/90 text-blue-300 border border-blue-500/50 shrink-0">
                {selectedUids.length}명 선택
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (selectedUids.length === 0) {
                  setSelectedUids(tableList.map(c => c.uid));
                }
                setIsBatchModalOpen(true);
              }}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-all border shadow-sm shrink-0 whitespace-nowrap ${
                selectedUids.length > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-blue-900/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title={selectedUids.length > 0 ? `선택된 ${selectedUids.length}명의 일정 및 부서 일괄 관리` : "전체 목록 대상자의 일정 및 부서 일괄 관리"}
            >
              <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
              <span>일정·부서 일괄 관리</span>
            </button>
            {selectedUids.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedUids([])}
                className="text-[11px] px-2 py-1 rounded-md font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 cursor-pointer whitespace-nowrap transition-colors"
                title="선택 해제"
              >
                선택 해제
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-auto dx-table-wrapper border-0 rounded-none w-full relative">
          <table className="w-full text-left border-collapse dx-table min-w-[700px] lg:min-w-full whitespace-nowrap text-xs">
            <thead className="sticky top-0 z-10 bg-[#051326] shadow-sm text-[11px] md:text-xs">
              <tr>
                {/* 1. Selection Checkbox Column */}
                <th className="text-center px-0.5 w-5 min-w-[20px] max-w-[20px]">
                  <input 
                    type="checkbox" 
                    checked={tableList.length > 0 && selectedUids.length === tableList.length} 
                    onChange={toggleSelectAll} 
                    className="w-3.5 h-3.5 rounded text-blue-500 bg-slate-900 border-slate-700 cursor-pointer"
                    title={tableList.length > 0 && selectedUids.length === tableList.length ? "전체 선택 해제" : "목록 전체 선택"}
                  />
                </th>
                <th 
                  className={`sortable text-center px-0.5 w-5 min-w-[20px] max-w-[20px] cursor-pointer ${sortCol === 'starred' ? 'active' : ''}`} 
                  onClick={() => handleSort('starred')}
                  title="별표(★) 순으로 정렬"
                >
                  <span className="flex items-center justify-center gap-0.5 text-amber-400">
                    ★<ArrowUpDown className="w-2 h-2 opacity-70" />
                  </span>
                </th>
                <th className="text-center px-0.5 w-12 min-w-[42px] max-w-[46px] text-[11px]">검증 구분</th>
                <th className={`sortable text-center px-0.5 w-12 min-w-[42px] max-w-[48px] text-[11px] ${sortCol === 'app_no' ? 'active' : ''}`} onClick={() => handleSort('app_no')}>수험번호 <ArrowUpDown className="w-2 h-2" /></th>
                <th className={`sortable text-center px-1 w-20 min-w-[70px] max-w-[88px] text-[11px] ${sortCol === 'name' ? 'active' : ''}`} onClick={() => handleSort('name')}>성명 <ArrowUpDown className="w-2 h-2" /></th>
                <th className={`sortable text-center px-0.5 w-11 min-w-[38px] max-w-[44px] text-[11px] ${sortCol === 'job' ? 'active' : ''}`} onClick={() => handleSort('job')}>직종 <ArrowUpDown className="w-2 h-2" /></th>
                <th className={`sortable text-center px-0.5 w-12 min-w-[46px] max-w-[52px] text-[11px] ${sortCol === 'age' ? 'active' : ''}`} onClick={() => handleSort('age')}>나이(E9) <ArrowUpDown className="w-2 h-2" /></th>
                <th className={`text-center sortable px-0.5 w-10 min-w-[34px] max-w-[40px] text-[11px] ${sortCol === 'k_score' ? 'active' : ''}`} onClick={() => handleSort('k_score')}>한국어 <ArrowUpDown className="w-2 h-2" /></th>
                <th className="text-center px-0.5 w-12 min-w-[44px] max-w-[52px] text-[11px]">현장 기량</th>
                <th className={`text-center sortable px-0.5 w-14 min-w-[54px] max-w-[62px] text-[11px] ${sortCol === 'result' ? 'active' : ''}`} onClick={() => handleSort('result')}>최종 결과 <ArrowUpDown className="w-2 h-2" /></th>
                
                {/* 11. Pass/Fail Date Column Header with streamlined compact width */}
                <th className="text-center px-0.5 w-[84px] min-w-[80px] max-w-[88px] text-[11px]">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <div 
                      className={`flex items-center justify-center gap-0.5 cursor-pointer font-bold select-none text-[10px] ${sortCol === 'pass_fail_date' || sortCol === 'pass_date' ? (passFailSortMode === 'pass' ? 'text-emerald-400' : 'text-red-400') : 'text-slate-200 hover:text-white'}`}
                      onClick={() => {
                        if (sortCol === 'pass_fail_date') {
                          setSortAsc(!sortAsc);
                        } else {
                          setSortCol('pass_fail_date');
                          setSortAsc(false);
                        }
                      }}
                      title={passFailSortMode === 'pass' ? "합격일자 기준 정렬 (최신순 / 과거순)" : "탈락일자 기준 정렬 (최신순 / 과거순)"}
                    >
                      <span className="whitespace-nowrap">{passFailSortMode === 'pass' ? '합격순' : '탈락순'}</span>
                      <ArrowUpDown className="w-2.5 h-2.5 shrink-0" />
                    </div>
                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setPassFailSortMode('pass');
                          setSortCol('pass_fail_date');
                          setSortAsc(false);
                        }}
                        className={`px-1 py-0.2 rounded text-[9px] font-bold transition-all cursor-pointer ${
                          passFailSortMode === 'pass' && (sortCol === 'pass_fail_date' || sortCol === 'pass_date')
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-emerald-300 border border-slate-700'
                        }`}
                        title="합격일자 기준 정렬"
                      >
                        합격
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPassFailSortMode('fail');
                          setSortCol('pass_fail_date');
                          setSortAsc(false);
                        }}
                        className={`px-1 py-0.2 rounded text-[9px] font-bold transition-all cursor-pointer ${
                          passFailSortMode === 'fail' && (sortCol === 'pass_fail_date' || sortCol === 'pass_date')
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-red-300 border border-slate-700'
                        }`}
                        title="탈락일자 기준 정렬"
                      >
                        탈락
                      </button>
                    </div>
                  </div>
                </th>

                {/* 12. Entry / Dept Column Header with compact width & left-aligned label */}
                <th className="text-left px-1.5 w-[124px] min-w-[120px] max-w-[130px] text-[11px]">
                  <div className="flex flex-col items-start justify-center gap-0.5">
                    <div 
                      className={`flex items-center gap-1 cursor-pointer font-bold select-none text-[10px] ${sortCol === 'entry_date' ? 'text-blue-400' : 'text-slate-200 hover:text-white'}`}
                      onClick={() => {
                        if (sortCol === 'entry_date') {
                          setSortAsc(!sortAsc);
                        } else {
                          setSortCol('entry_date');
                          setSortAsc(false);
                        }
                      }}
                      title="입국일자 기준 정렬 (최신순 / 과거순)"
                    >
                      <span className="whitespace-nowrap">입국일자 정렬</span>
                      <ArrowUpDown className="w-2.5 h-2.5 shrink-0" />
                    </div>
                    <select
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-[#030d1a] border border-slate-700 text-slate-300 text-[9.5px] font-bold rounded px-1 py-0.5 w-[114px] cursor-pointer hover:border-blue-500 focus:outline-none"
                      title="부서 선택하여 모아보기"
                    >
                      <option value="all">부서: 전체</option>
                      {validDepartments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </th>

                {/* 13. Media Column Header */}
                <th className="text-center px-1 w-20 min-w-[80px] max-w-[88px] text-[11px]">미디어</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {tableList.length === 0 ? (
                <tr><td colSpan={13} className="p-10 text-center text-slate-500 font-bold text-base">데이터가 없습니다.</td></tr>
              ) : (
                tableList.map((c, idx) => {
                  const isPre = (c.eval_type || '').includes('사전');
                  const actualResult = determineResult(c);
                  const resClass = actualResult === '최종 합격' ? 'res-pass' : actualResult === '조건부 합격' ? 'res-cond' : actualResult === '대기' ? 'res-wait' : 'res-fail';
                  const isSelected = selectedUids.includes(c.uid);
                  return (
                    <tr 
                      key={`${c.uid || c.app_no}_${idx}`} 
                      className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-950/20' : ''}`} 
                      onClick={() => setSelectedCandidate(c)}
                    >
                      {/* Checkbox */}
                      <td className="text-center px-0.5 w-5 min-w-[20px] max-w-[20px]" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelectCandidate(c.uid)} 
                          className="w-3.5 h-3.5 rounded text-blue-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      </td>

                      {/* Star */}
                      <td className="text-center px-0.5 w-5 min-w-[20px] max-w-[20px]" onClick={(e) => {
                        e.stopPropagation();
                        toggleCandidateStar(c.uid);
                      }}>
                        <button
                          type="button"
                          className={`p-0.5 rounded-md transition-all cursor-pointer ${
                            c.starred 
                              ? 'text-amber-400 bg-amber-400/15 border border-amber-400/40 shadow-sm' 
                              : 'text-slate-600 hover:text-amber-400 hover:bg-slate-800'
                          }`}
                          title={c.starred ? "별표 해제" : "별표 등록"}
                        >
                          <Star className={`w-3.5 h-3.5 ${c.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                      </td>

                      {/* Eval Type */}
                      <td className="text-center px-0.5 w-12 min-w-[42px] max-w-[46px] text-[10px]" dangerouslySetInnerHTML={{__html: getBadgeHtml(c.eval_type)}}></td>

                      {/* App No */}
                      <td className="font-bold text-slate-300 text-center tracking-normal text-[11px] font-mono px-0.5 w-12 min-w-[42px] max-w-[48px]">{c.app_no}</td>

                      {/* Name */}
                      <td className="font-black text-slate-100 text-center text-[11px] px-1 w-20 min-w-[70px] max-w-[88px] truncate" title={c.name?.toUpperCase()}>
                        <span className="inline-flex items-center gap-0.5 justify-center truncate">
                          <span className="truncate">{c.name?.toUpperCase()}</span>
                          {c.starred && (
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0 inline" />
                          )}
                        </span>
                      </td>

                      {/* Job */}
                      <td className="text-slate-400 text-center font-bold text-[11px] px-0.5 w-11 min-w-[38px] max-w-[44px]">{c.job}</td>

                      {/* Age / E9 */}
                      <td className="text-slate-400 text-[11px] text-center font-bold px-0.5 w-12 min-w-[46px] max-w-[52px]">
                        {(() => {
                          const ageVal = Number(c.age) || calculateAge(c.dob);
                          const ageText = ageVal > 0 ? `${ageVal}세` : (c.dob ? `${c.dob.slice(0, 4)}년` : "-");
                          return (
                            <span>
                              {ageText} / <span className={c.e9 === "O" ? "text-emerald-400 font-black" : "text-slate-500 font-bold"}>{c.e9 || "X"}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Korean Score */}
                      <td className="text-center font-bold text-slate-200 text-[11px] px-0.5 w-10 min-w-[34px] max-w-[40px]">{(c.k_score || 0) > 0 ? c.k_score : '-'}</td>

                      {/* Skill Score */}
                      <td className="text-center font-bold text-slate-200 tracking-tight text-[11px] px-0.5 w-12 min-w-[44px] max-w-[52px]">
                        {isSkillComplete(c) ? ((c.job || '').includes('취부') ? `W:${c.grade_weld} F:${c.grade_fit}` : c.grade_weld) : '-'}
                      </td>

                      {/* Final Result */}
                      <td className="text-center px-0.5 w-14 min-w-[54px] max-w-[62px] text-[11px]">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${resClass}`}>{actualResult}</span>
                      </td>

                      {/* Pass / Fail Date with streamlined compact width */}
                      <td className="text-center px-0.5 w-[84px] min-w-[80px] max-w-[88px] font-mono text-[11px]">
                        {c.pass_date ? (
                          <span className="inline-flex items-center justify-center gap-1 text-[11px] font-mono text-emerald-400 font-medium whitespace-nowrap" title={`합격일자: ${c.pass_date}`}>
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400/80 shrink-0" />
                            {formatShortDate(c.pass_date)}
                          </span>
                        ) : c.fail_date ? (
                          <span className="inline-flex items-center justify-center gap-1 text-[11px] font-mono text-rose-400 font-medium whitespace-nowrap" title={`탈락일자: ${c.fail_date}`}>
                            <X className="w-2.5 h-2.5 text-rose-400/80 shrink-0" />
                            {formatShortDate(c.fail_date)}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>

                      {/* Entry Date & Dept: Compact width, left-aligned date and uniform-width department badge */}
                      <td className="text-left px-1.5 w-[124px] min-w-[120px] max-w-[130px] text-[11px]">
                        {isPre ? (
                          <span className="text-slate-600 text-[10px] pl-2">-</span>
                        ) : (
                          <div className="flex items-center justify-start gap-1 flex-nowrap">
                            {c.entry_date ? (
                              <span className="text-[11px] font-medium text-blue-300 font-mono whitespace-nowrap w-[54px] min-w-[54px] shrink-0 text-left" title={`입국일자: ${c.entry_date}`}>
                                {formatShortDate(c.entry_date)}
                              </span>
                            ) : c.entry_fail_date ? (
                              <span className="text-[11px] font-medium text-slate-400 font-mono whitespace-nowrap w-[54px] min-w-[54px] shrink-0 text-left" title={`입국 탈락일자: ${c.entry_fail_date}`}>
                                {formatShortDate(c.entry_fail_date)}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[10px] font-mono whitespace-nowrap w-[54px] min-w-[54px] shrink-0 text-left pl-1">
                                -
                              </span>
                            )}

                            {/* Department Badge with fixed uniform width for exact horizontal alignment */}
                            {c.department ? (
                              <span 
                                className="w-[48px] min-w-[48px] text-center px-1 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/80 whitespace-nowrap truncate shrink-0" 
                                title={`배정 부서: ${c.department}`}
                              >
                                {c.department}
                              </span>
                            ) : (
                              <span className="w-[48px] min-w-[48px] shrink-0" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-center px-1 w-20 min-w-[80px] max-w-[88px]" onClick={(e) => e.stopPropagation()}>
                        {/* 사전기량검증 명단은 영상/인성 파일이 원래 없으므로 아무 버튼도 표시하지 않음 */}
                        {isPre ? (
                          <span className="text-[10px] text-slate-600 font-sans select-none">-</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {/* 영상 버튼 */}
                            {c.video_url ? (
                              <button
                                type="button"
                                onClick={() => setMediaViewer({
                                  isOpen: true,
                                  title: `면접 영상`,
                                  candidateName: c.name,
                                  appNo: c.app_no,
                                  mediaType: 'video',
                                  url: c.video_url!
                                })}
                                className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-[10px] font-medium transition-all flex items-center gap-0.5 shadow-sm active:scale-95 shrink-0"
                                title="면접 영상 재생하기"
                              >
                                <Play className="w-2.5 h-2.5 fill-current shrink-0" />
                                <span>영상</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIndividualModal({
                                  isOpen: true,
                                  candidate: c,
                                  focus: 'video'
                                })}
                                className="px-1.5 py-0.5 rounded bg-slate-900/40 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-800/60 text-[10px] opacity-40 hover:opacity-100 transition-all flex items-center gap-0.5 shrink-0"
                                title="영상 미등록 (클릭하여 등록)"
                              >
                                <Video className="w-2.5 h-2.5 shrink-0" />
                                <span>영상</span>
                              </button>
                            )}

                            {/* 인성검사 버튼 */}
                            {c.test_url ? (
                              <button
                                type="button"
                                onClick={() => setMediaViewer({
                                  isOpen: true,
                                  title: `인성검사 결과 보고서`,
                                  candidateName: c.name,
                                  appNo: c.app_no,
                                  mediaType: 'test',
                                  url: c.test_url!
                                })}
                                className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 text-[10px] font-medium transition-all flex items-center gap-0.5 shadow-sm active:scale-95 shrink-0"
                                title="인성검사 보고서 열람"
                              >
                                <FileText className="w-2.5 h-2.5 shrink-0" />
                                <span>인성</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIndividualModal({
                                  isOpen: true,
                                  candidate: c,
                                  focus: 'test'
                                })}
                                className="px-1.5 py-0.5 rounded bg-slate-900/40 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-800/60 text-[10px] opacity-40 hover:opacity-100 transition-all flex items-center gap-0.5 shrink-0"
                                title="인성검사 미등록 (클릭하여 등록)"
                              >
                                <FileText className="w-2.5 h-2.5 shrink-0" />
                                <span>인성</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (() => {
        const modalResult = determineResult(selectedCandidate);
        const modalResClass = modalResult === '최종 합격' ? 'res-pass' : modalResult === '조건부 합격' ? 'res-cond' : modalResult === '대기' ? 'res-wait' : 'res-fail';
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020b16]/80 backdrop-blur-md p-2 md:p-4 animate-in fade-in">
            <div className="bg-[#081526] border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-full overflow-hidden flex flex-col">
              <div className="bg-[#06111f] p-3 md:p-4 border-b border-slate-800 flex justify-between items-center text-slate-100 shrink-0">
                <h3 className="font-bold text-base md:text-lg flex items-center gap-2 md:gap-3 text-slate-200"><User className="w-4 h-4 text-slate-400" /> 지원자 상세 프로필</h3>
                <button onClick={() => setSelectedCandidate(null)} className="hover:bg-slate-800 p-1.5 md:p-2 rounded-lg transition-colors"><X className="w-4 h-4 text-slate-400 hover:text-slate-200" /></button>
              </div>
              
              <div className="p-4 lg:p-6 overflow-y-auto flex-1 space-y-4 md:space-y-6">
                {/* Header Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 p-3 md:p-4 rounded-xl bg-[#06111f] border border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2">
                      <h4 className="text-lg md:text-xl font-bold text-slate-100">{selectedCandidate.name?.toUpperCase()}</h4>
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs font-semibold text-slate-300 tracking-wider font-mono">{selectedCandidate.app_no}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await toggleCandidateStar(selectedCandidate.uid);
                          setSelectedCandidate({
                            ...selectedCandidate,
                            starred: !selectedCandidate.starred
                          });
                        }}
                        className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                          selectedCandidate.starred
                            ? "bg-slate-800 text-amber-300 border-amber-500/40"
                            : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
                        }`}
                        title="별표 표시 토글"
                      >
                        <Star className={`w-3.5 h-3.5 ${selectedCandidate.starred ? "fill-amber-400 text-amber-400" : "text-slate-400"}`} />
                        <span>{selectedCandidate.starred ? "★ 별표 등록됨" : "☆ 별표 등록"}</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm font-medium text-slate-400 mt-2 md:mt-3">
                      <span className="flex items-center gap-1 md:gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedCandidate.country} / {selectedCandidate.agency}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                      <span>
                        {(() => {
                          const ageVal = Number(selectedCandidate.age) || calculateAge(selectedCandidate.dob);
                          const y = selectedCandidate.dob ? selectedCandidate.dob.slice(0, 4) : "";
                          const ageText = ageVal > 0 ? `${ageVal}세` : (y ? `${y}년생` : "-");
                          const subText = ageVal > 0 && y ? ` (${y}년생)` : "";
                          return `${ageText}${subText} / E-9: ${selectedCandidate.e9 === "O" ? "유경험(O)" : "신규(X)"}`;
                        })()}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                      <span className="text-slate-200 font-semibold px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">{selectedCandidate.job}</span>
                    </div>
                  </div>
                  <div className="text-left md:text-right shrink-0 mt-2 md:mt-0">
                    <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase mb-1">Final Result</p>
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold inline-block ${modalResClass}`}>{modalResult}</span>
                  </div>
                </div>

                {/* Scores Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Korean Score */}
                  <div className="p-3 md:p-4 rounded-xl bg-[#06111f] border border-slate-800 flex flex-col justify-between">
                    <div>
                      <h5 className="font-semibold text-slate-300 text-xs md:text-sm mb-3 flex items-center gap-2"><Languages className="w-4 h-4 text-slate-400" /> 한국어 평가결과</h5>
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl md:text-3xl font-extrabold text-slate-100">{selectedCandidate.k_score || 0}</span>
                          <span className="text-sm font-medium text-slate-400">점</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-200 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded">{selectedCandidate.k_grade || '-'} 등급</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-3 border-t border-slate-800">
                      <p className="text-xs font-medium text-slate-400">{selectedCandidate.k_pass || '평가 대기중'}</p>
                    </div>
                  </div>
                  
                  {/* Skill Score */}
                  <div className="p-3 md:p-4 rounded-xl bg-[#06111f] border border-slate-800">
                    <h5 className="font-semibold text-slate-300 text-xs md:text-sm mb-3 flex items-center gap-2"><Hammer className="w-4 h-4 text-slate-400" /> 실기 평가결과</h5>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center bg-[#081526] p-2.5 rounded-lg border border-slate-800">
                        <span className="text-xs font-medium text-slate-400">용접 평가</span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-slate-100">{selectedCandidate.s_score_weld || 0}점</span>
                          <span className="text-slate-300 ml-2 text-xs font-semibold bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">등급: {selectedCandidate.grade_weld || '-'}</span>
                        </div>
                      </div>
                      {(selectedCandidate.job || '').includes('취부') && (
                        <div className="flex justify-between items-center bg-[#081526] p-2.5 rounded-lg border border-slate-800">
                          <span className="text-xs font-medium text-slate-400">취부 평가</span>
                          <div className="text-right">
                            <span className="text-lg font-bold text-slate-100">{selectedCandidate.s_score_fit || 0}점</span>
                            <span className="text-slate-300 ml-2 text-xs font-semibold bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">등급: {selectedCandidate.grade_fit || '-'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Media Links Section (Google Drive Video & Personality Test) */}
                <div className="p-3 md:p-4 rounded-xl bg-[#06111f] border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="font-semibold text-slate-200 text-xs md:text-sm flex items-center gap-2">
                      <FolderSync className="w-4 h-4 text-slate-400" />
                      구글 드라이브 평가 영상 및 인성검사 결과
                    </h5>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIndividualModal({
                          isOpen: true,
                          candidate: selectedCandidate,
                          focus: 'all'
                        })}
                        className="text-[11px] font-semibold text-slate-200 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Edit2 className="w-3 h-3" /> 개인별 등록창 열기
                      </button>
                      {!isEditingMedia ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditVideoUrl(selectedCandidate.video_url || '');
                            setEditTestUrl(selectedCandidate.test_url || '');
                            setIsEditingMedia(true);
                          }}
                          className="text-[11px] font-bold text-slate-400 hover:text-blue-400 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1"
                        >
                          간편 수정
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsEditingMedia(false)}
                            className="text-[11px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 transition-colors"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={isSavingMedia}
                            onClick={async () => {
                              setIsSavingMedia(true);
                              await updateCandidateMedia(selectedCandidate.uid, editVideoUrl.trim(), editTestUrl.trim());
                              setSelectedCandidate({
                                ...selectedCandidate,
                                video_url: editVideoUrl.trim(),
                                test_url: editTestUrl.trim()
                              });
                              setIsSavingMedia(false);
                              setIsEditingMedia(false);
                            }}
                            className="text-[11px] font-black text-white px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> 저장
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditingMedia ? (
                    <div className="space-y-2.5 p-3 rounded-lg bg-[#081526] border border-slate-700">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Video className="w-3.5 h-3.5 text-slate-400" /> 면접 영상 구글 드라이브 링크
                        </label>
                        <input
                          type="text"
                          value={editVideoUrl}
                          onChange={(e) => setEditVideoUrl(e.target.value)}
                          placeholder="https://drive.google.com/file/d/.../view"
                          className="w-full bg-[#06111f] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400" /> 인성검사 결과 보고서 링크
                        </label>
                        <input
                          type="text"
                          value={editTestUrl}
                          onChange={(e) => setEditTestUrl(e.target.value)}
                          placeholder="https://drive.google.com/file/d/.../view"
                          className="w-full bg-[#06111f] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Video card */}
                      <div className="p-3 rounded-lg bg-[#081526] border border-slate-800 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-slate-400" />
                            면접 인터뷰 영상
                          </span>
                          {selectedCandidate.video_url ? (
                            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-600/30 px-1.5 py-0.5 rounded">
                              연결됨
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                              미등록
                            </span>
                          )}
                        </div>
                        {selectedCandidate.video_url ? (
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => setMediaViewer({
                                isOpen: true,
                                title: `면접 영상`,
                                candidateName: selectedCandidate.name,
                                appNo: selectedCandidate.app_no,
                                mediaType: 'video',
                                url: selectedCandidate.video_url
                              })}
                              className="flex-1 py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm border border-slate-600"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>영상 바로 재생</span>
                            </button>
                            <a
                              href={selectedCandidate.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                              title="구글 드라이브 새창"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditVideoUrl('');
                              setEditTestUrl(selectedCandidate.test_url || '');
                              setIsEditingMedia(true);
                            }}
                            className="py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700 text-center"
                          >
                            + 영상 링크 등록
                          </button>
                        )}
                      </div>

                      {/* Test card */}
                      <div className="p-3 rounded-lg bg-[#081526] border border-slate-800 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            인성검사 보고서
                          </span>
                          {selectedCandidate.test_url ? (
                            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-600/30 px-1.5 py-0.5 rounded">
                              연결됨
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                              미등록
                            </span>
                          )}
                        </div>
                        {selectedCandidate.test_url ? (
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => setMediaViewer({
                                isOpen: true,
                                title: `인성검사 보고서`,
                                candidateName: selectedCandidate.name,
                                appNo: selectedCandidate.app_no,
                                mediaType: 'test',
                                url: selectedCandidate.test_url
                              })}
                              className="flex-1 py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm border border-slate-600"
                            >
                              <FileText className="w-3 h-3" />
                              <span>보고서 열람</span>
                            </button>
                            <a
                              href={selectedCandidate.test_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                              title="구글 드라이브 새창"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditVideoUrl(selectedCandidate.video_url || '');
                              setEditTestUrl('');
                              setIsEditingMedia(true);
                            }}
                            className="py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700 text-center"
                          >
                            + 보고서 링크 등록
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Schedule & Department Management */}
                <div className="p-3 md:p-4 rounded-xl bg-[#06111f] border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="font-semibold text-slate-200 text-xs md:text-sm flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-slate-400" />
                      일정 및 부서 관리
                    </h5>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400">구분:</span>
                      {(() => {
                        const tr = selectedCandidate.track || computeAgencyTrack(selectedCandidate.agency);
                        return tr === '공공기관' ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-200 border border-slate-700">
                            공공기관 ({selectedCandidate.agency || '미지정'})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            민간업체 ({selectedCandidate.agency || '일반'})
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* 1. 합격일자 */}
                    <div className="p-2.5 rounded-lg bg-[#081526] border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 합격일자
                        </label>
                        {selectedCandidate.pass_date && (
                          <button
                            type="button"
                            disabled={isSavingCandMgmt}
                            onClick={async () => {
                              setIsSavingCandMgmt(true);
                              await updateCandidateManagement(selectedCandidate.uid, { pass_date: '' });
                              setCandPassDate('');
                              setSelectedCandidate({ ...selectedCandidate, pass_date: '' });
                              setIsSavingCandMgmt(false);
                            }}
                            className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5 cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> 삭제
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={candPassDate}
                          onChange={(e) => setCandPassDate(e.target.value)}
                          onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          className="flex-1 bg-[#06111f] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:border-emerald-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          disabled={isSavingCandMgmt || !candPassDate || candPassDate === selectedCandidate.pass_date}
                          onClick={async () => {
                            setIsSavingCandMgmt(true);
                            await updateCandidateManagement(selectedCandidate.uid, { pass_date: candPassDate });
                            setCandFailDate('');
                            setSelectedCandidate({ ...selectedCandidate, pass_date: candPassDate, fail_date: '' });
                            setIsSavingCandMgmt(false);
                          }}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer border border-slate-600"
                        >
                          저장
                        </button>
                      </div>
                    </div>

                    {/* 2. 탈락일자 */}
                    <div className="p-2.5 rounded-lg bg-[#081526] border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
                          <CalendarX className="w-3 h-3 text-rose-400" /> 탈락일자
                        </label>
                        {selectedCandidate.fail_date && (
                          <button
                            type="button"
                            disabled={isSavingCandMgmt}
                            onClick={async () => {
                              setIsSavingCandMgmt(true);
                              await updateCandidateManagement(selectedCandidate.uid, { fail_date: '' });
                              setCandFailDate('');
                              setSelectedCandidate({ ...selectedCandidate, fail_date: '' });
                              setIsSavingCandMgmt(false);
                            }}
                            className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5 cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> 삭제
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={candFailDate}
                          onChange={(e) => setCandFailDate(e.target.value)}
                          onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                          className="flex-1 bg-[#06111f] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:border-rose-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          disabled={isSavingCandMgmt || !candFailDate || candFailDate === selectedCandidate.fail_date}
                          onClick={async () => {
                            setIsSavingCandMgmt(true);
                            await updateCandidateManagement(selectedCandidate.uid, { fail_date: candFailDate });
                            setCandPassDate('');
                            setSelectedCandidate({ ...selectedCandidate, fail_date: candFailDate, pass_date: '' });
                            setIsSavingCandMgmt(false);
                          }}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer border border-slate-600"
                        >
                          저장
                        </button>
                      </div>
                    </div>

                    {/* 입국 및 부서 관리 항목 */}
                    {selectedCandidate.eval_type?.includes('본기량') && (
                      <>
                        {/* 3. 입국일자 */}
                        <div className="p-2.5 rounded-lg bg-[#081526] border border-slate-800">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-blue-300 flex items-center gap-1">
                              <PlaneTakeoff className="w-3 h-3 text-slate-400" /> 입국일자
                            </label>
                            {selectedCandidate.entry_date && (
                              <button
                                type="button"
                                disabled={isSavingCandMgmt}
                                onClick={async () => {
                                  setIsSavingCandMgmt(true);
                                  await updateCandidateManagement(selectedCandidate.uid, { entry_date: '' });
                                  setCandEntryDate('');
                                  setSelectedCandidate({ ...selectedCandidate, entry_date: '' });
                                  setIsSavingCandMgmt(false);
                                }}
                                className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5 cursor-pointer"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> 삭제
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              value={candEntryDate}
                              disabled={!selectedCandidate.pass_date && !candPassDate}
                              onChange={(e) => setCandEntryDate(e.target.value)}
                              onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              className="flex-1 bg-[#06111f] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:border-blue-500 disabled:opacity-40 cursor-pointer"
                            />
                            <button
                              type="button"
                              disabled={isSavingCandMgmt || !candEntryDate || (!selectedCandidate.pass_date && !candPassDate) || candEntryDate === selectedCandidate.entry_date}
                              onClick={async () => {
                                setIsSavingCandMgmt(true);
                                await updateCandidateManagement(selectedCandidate.uid, { entry_date: candEntryDate });
                                setCandEntryFailDate('');
                                setSelectedCandidate({ ...selectedCandidate, entry_date: candEntryDate, entry_fail_date: '' });
                                setIsSavingCandMgmt(false);
                              }}
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer border border-slate-600"
                            >
                              저장
                            </button>
                          </div>
                          {!selectedCandidate.pass_date && !candPassDate && (
                            <p className="text-[10px] text-amber-400/90 mt-1">※ 합격일자 등록 후 입력 가능</p>
                          )}
                        </div>

                        {/* 4. 입국 탈락일자 */}
                        <div className="p-2.5 rounded-lg bg-[#081526] border border-slate-800">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                              <PlaneLanding className="w-3 h-3 text-slate-400" /> 입국 탈락일자
                            </label>
                            {selectedCandidate.entry_fail_date && (
                              <button
                                type="button"
                                disabled={isSavingCandMgmt}
                                onClick={async () => {
                                  setIsSavingCandMgmt(true);
                                  await updateCandidateManagement(selectedCandidate.uid, { entry_fail_date: '' });
                                  setCandEntryFailDate('');
                                  setSelectedCandidate({ ...selectedCandidate, entry_fail_date: '' });
                                  setIsSavingCandMgmt(false);
                                }}
                                className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5 cursor-pointer"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> 삭제
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              value={candEntryFailDate}
                              onChange={(e) => setCandEntryFailDate(e.target.value)}
                              onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                              className="flex-1 bg-[#06111f] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:border-slate-500 cursor-pointer"
                            />
                            <button
                              type="button"
                              disabled={isSavingCandMgmt || !candEntryFailDate || candEntryFailDate === selectedCandidate.entry_fail_date}
                              onClick={async () => {
                                setIsSavingCandMgmt(true);
                                await updateCandidateManagement(selectedCandidate.uid, { entry_fail_date: candEntryFailDate });
                                setCandEntryDate('');
                                setSelectedCandidate({ ...selectedCandidate, entry_fail_date: candEntryFailDate, entry_date: '' });
                                setIsSavingCandMgmt(false);
                              }}
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer border border-slate-600"
                            >
                              저장
                            </button>
                          </div>
                        </div>

                        {/* 5. 배정 부서 */}
                        <div className="p-2.5 rounded-lg bg-[#081526] border border-slate-800 sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" /> 배정 부서
                            </label>
                            {selectedCandidate.department && (
                              <button
                                type="button"
                                disabled={isSavingCandMgmt}
                                onClick={async () => {
                                  setIsSavingCandMgmt(true);
                                  await updateCandidateManagement(selectedCandidate.uid, { department: '' });
                                  setCandDept('');
                                  setSelectedCandidate({ ...selectedCandidate, department: '' });
                                  setIsSavingCandMgmt(false);
                                }}
                                className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5 cursor-pointer"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> 배정 삭제
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={candDept}
                              onChange={(e) => setCandDept(e.target.value)}
                              className="flex-1 bg-[#06111f] border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-200 focus:border-slate-500"
                            >
                              <option value="">부서 미지정</option>
                              {DEPARTMENTS.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={isSavingCandMgmt || candDept === selectedCandidate.department}
                              onClick={async () => {
                                setIsSavingCandMgmt(true);
                                await updateCandidateManagement(selectedCandidate.uid, { department: candDept });
                                setSelectedCandidate({ ...selectedCandidate, department: candDept });
                                setIsSavingCandMgmt(false);
                              }}
                              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer border border-slate-600"
                            >
                              부서 반영
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Memo section */}
                {(selectedCandidate.interview_memo || selectedCandidate.memo || selectedCandidate.skill_memo) && (
                  <div className="p-3 md:p-4 rounded-xl bg-[#06111f] border border-slate-800 space-y-3">
                    <h5 className="font-semibold text-slate-200 text-xs md:text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" /> 특이사항 및 인터뷰 코멘트
                    </h5>
                    {(selectedCandidate.interview_memo || selectedCandidate.memo) && (
                      <div className="bg-[#081526] p-3 rounded-lg border border-slate-800">
                        <p className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Languages className="w-3.5 h-3.5 text-slate-400" /> 한국어 면접 특이사항
                        </p>
                        <p className="text-xs md:text-sm font-normal text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {selectedCandidate.interview_memo || selectedCandidate.memo}
                        </p>
                      </div>
                    )}
                    {selectedCandidate.skill_memo && (
                      <div className="bg-[#081526] p-3 rounded-lg border border-slate-800">
                        <p className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Hammer className="w-3.5 h-3.5 text-slate-400" /> 기량 검증 특이사항
                        </p>
                        <p className="text-xs md:text-sm font-normal text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {selectedCandidate.skill_memo}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="p-3 md:p-4 bg-[#06111f] border-t border-slate-800 flex justify-end gap-3">
                <button onClick={() => {
                  setSelectedCandidate(null);
                  setIsEditingMedia(false);
                }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors text-xs md:text-sm border border-slate-700">닫기</button>
                <button onClick={() => { 
                  if (selectedCandidate) {
                    setSelectedCandidateUid(selectedCandidate.uid);
                  }
                  setCurrentView('evaluation'); 
                  setSelectedCandidate(null); 
                  setIsEditingMedia(false);
                }} className="px-4 py-2 bg-[#002c5f] hover:bg-[#00387a] text-white font-semibold rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-xs md:text-sm border border-blue-400/30">
                  해당 인원 평가하기 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Batch Schedule & Department Management Modal */}
      <BatchManagementModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        selectedCandidates={selectedCandidatesForBatch.length > 0 ? selectedCandidatesForBatch : tableList}
        onSuccess={() => {
          setSelectedUids([]);
        }}
      />

      {/* Google Drive Media Auto-Sync Modal */}
      <MediaLinkModal
        isOpen={showMediaLinkModal}
        onClose={() => setShowMediaLinkModal(false)}
        defaultDate={selectedDates.length === 1 ? selectedDates[0] : undefined}
      />

      {/* Media Player / Document Viewer Modal */}
      {mediaViewer && (
        <MediaViewerModal
          isOpen={mediaViewer.isOpen}
          onClose={() => setMediaViewer(null)}
          title={mediaViewer.title}
          candidateName={mediaViewer.candidateName}
          appNo={mediaViewer.appNo}
          mediaType={mediaViewer.mediaType}
          url={mediaViewer.url}
        />
      )}

      {/* Individual Candidate Media Registration Modal */}
      {individualModal.candidate && (
        <IndividualMediaModal
          isOpen={individualModal.isOpen}
          onClose={() => setIndividualModal({ isOpen: false, candidate: null, focus: 'all' })}
          candidate={individualModal.candidate}
          initialFocus={individualModal.focus}
          onUpdated={(updated) => {
            if (selectedCandidate && (selectedCandidate.uid === updated.uid || selectedCandidate.app_no === updated.app_no)) {
              setSelectedCandidate(updated);
            }
          }}
        />
      )}
    </div>
  );
}
