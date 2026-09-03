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
  Check
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useAppContext } from '../context/AppContext';
import { checkKoreanPass, checkSkillPass, determineResult, getBadgeHtml, calculateAge, normalizeDate, normalizeType } from '../lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const { candidates, globalLogs, setCurrentView, setSelectedCandidateUid } = useAppContext();
  
  const [filterType, setFilterType] = useState('all');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterAgency, setFilterAgency] = useState('all');
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);
  
  const [sortCol, setSortCol] = useState('app_no');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);

  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Update date dropdown position and handle resize/scroll
  useEffect(() => {
    if (isDateOpen && dateButtonRef.current) {
      const updatePosition = () => {
        if (!dateButtonRef.current) return;
        const rect = dateButtonRef.current.getBoundingClientRect();
        const popoverWidth = Math.min(window.innerWidth - 20, 320);
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
      return true;
    });

    list.sort((a: any, b: any) => {
      let vA = a[sortCol];
      let vB = b[sortCol];
      if (sortCol === 'k_score' || sortCol === 'age') { 
        vA = Number(vA) || 0; 
        vB = Number(vB) || 0; 
      } else { 
        vA = String(vA || '').toLowerCase(); 
        vB = String(vB || '').toLowerCase(); 
      }
      if (vA < vB) return sortAsc ? -1 : 1;
      if (vA > vB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [candidates, filterType, selectedDates, filterCountry, filterAgency, sortCol, sortAsc]);

  const exportToCSV = () => {
    if (filtered.length === 0) return alert('내보낼 데이터가 없습니다.');
    const headers = ['수험번호', '성명', '생년월일', '직종', 'E9', '국가', '업체', '평가구분', '평가일', '한국어점수', '한국어등급', '용접점수', '취부점수', '실기등급(용접)', '실기등급(취부)', '통합결과', '특이사항'];
    const rows = filtered.map(c => [
      c.app_no, c.name, c.dob, c.job, c.e9, c.country, c.agency, c.eval_type, c.eval_date,
      c.k_score || 0, c.k_grade || '-', c.s_score_weld || 0, c.s_score_fit || 0, c.grade_weld || '-', c.grade_fit || '-',
      c.result || '대기', (c.memo || '').replace(/\n/g, ' ')
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HD현대삼호_평가결과_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isSkillComplete = (c: any) => {
    const isF = (c.job || '').includes('취부');
    return c.s_status === '완료' || (isF ? (c.s_score_weld > 0 && c.s_score_fit > 0) : c.s_score_weld > 0);
  };

  const total = filtered.length;
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

  const handleSubFilter = (filterName: string) => { setActiveSubFilter(prev => prev === filterName ? null : filterName); };

  let tableList = filtered.filter(c => (c.k_score || 0) > 0 || isSkillComplete(c));
  let filterBadgeText = "";
  if (activeSubFilter === 'k-comp') { tableList = filtered.filter(c => (c.k_score || 0) > 0); filterBadgeText = "한국어 평가 완료"; }
  else if (activeSubFilter === 'k-pass-pure') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && checkKoreanPass(c) === '최종 합격'); filterBadgeText = "한국어 순수 합격"; }
  else if (activeSubFilter === 'k-pass-cond') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && (checkKoreanPass(c) === '최종 합격' || checkKoreanPass(c) === '조건부 합격')); filterBadgeText = "한국어 조건부 포함 합격"; }
  else if (activeSubFilter === 's-comp') { tableList = filtered.filter(c => isSkillComplete(c)); filterBadgeText = "기량 평가 완료"; }
  else if (activeSubFilter === 's-pass') { tableList = filtered.filter(c => isSkillComplete(c) && checkSkillPass(c)); filterBadgeText = "기량 실기 통과"; }
  else if (activeSubFilter === 't-comp') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && isSkillComplete(c)); filterBadgeText = "통합 최종 판정 완료"; }
  else if (activeSubFilter === 't-pass-pure') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && isSkillComplete(c) && determineResult(c) === '최종 합격'); filterBadgeText = "통합 순수 합격"; }
  else if (activeSubFilter === 't-pass-cond') { tableList = filtered.filter(c => (c.k_score || 0) > 0 && isSkillComplete(c) && (determineResult(c) === '최종 합격' || determineResult(c) === '조건부 합격')); filterBadgeText = "통합 조건부 포함 합격"; }

  const getChartData = (pure: number, cond: number, fail: number, empty: boolean) => {
    if (empty) return { labels: ['Empty'], datasets: [{ data: [1], backgroundColor: ['#f1f5f9'], borderWidth: 0 }] };
    return {
      labels: ['순수 합격', '조건부 합격', '불합격'],
      datasets: [{ data: [pure, cond, fail], backgroundColor: ['#002c5f', '#00a859', '#ef4444'], borderWidth: 0 }]
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
        <div className="mb-3 dx-card px-2.5 sm:px-3 md:px-4 py-2 border-t-4 border-t-blue-500 relative z-30 overflow-x-auto custom-scrollbar no-scrollbar">
          <div className="flex items-center justify-between gap-2 md:gap-3 min-w-max w-full">
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 shrink-0">
              <span className="text-xs sm:text-sm md:text-base font-black text-blue-400 px-1 flex items-center gap-1.5 md:gap-2 tracking-tight whitespace-nowrap shrink-0">
                <SlidersHorizontal className="w-4 h-4 md:w-5 md:h-5 text-hd-green shrink-0" /> 데이터 필터
              </span>
              <div className="h-4 md:h-5 w-px bg-slate-700 mx-0.5 shrink-0"></div>
              
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

              {/* 4. Multi-Select Date Filter Dropdown (전체 날짜) */}
              <div className="relative shrink-0">
                <button
                  ref={dateButtonRef}
                  type="button"
                  onClick={() => setIsDateOpen(prev => !prev)}
                  className={`dx-input !w-auto cursor-pointer text-xs md:text-sm !py-1 md:!py-[7px] h-[34px] sm:h-[36px] md:h-[38px] flex items-center justify-between gap-1.5 text-left font-medium transition-all min-w-[115px] sm:min-w-[125px] shrink-0 ${
                    selectedDates.length > 0 
                      ? 'border-blue-500 bg-blue-950/40 text-blue-300 ring-1 ring-blue-500/50' 
                      : 'text-slate-200 hover:border-slate-500'
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
              {(filterType !== 'all' || selectedDates.length > 0 || filterCountry !== 'all' || filterAgency !== 'all' || activeSubFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('all');
                    setSelectedDates([]);
                    setFilterCountry('all');
                    setFilterAgency('all');
                    setActiveSubFilter(null);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 px-2 py-1 h-[34px] sm:h-[36px] md:h-[38px] rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
                  title="모든 필터 초기화"
                >
                  <X className="w-3.5 h-3.5" /> 필터 초기화
                </button>
              )}
            </div>

            {/* Action Buttons: Executive Report & Excel Download */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button 
                onClick={() => setCurrentView('report')} 
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 sm:px-3.5 md:px-4 h-[34px] sm:h-[36px] md:h-[38px] rounded-lg text-xs md:text-sm font-bold transition-all shadow-md flex items-center gap-1.5 border border-emerald-600 shrink-0 justify-center whitespace-nowrap"
                title="HD현대삼호 공식 총괄 보고서 (PDF/인쇄) 생성 및 출력"
              >
                <FileText className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>총괄 보고서 발행</span>
              </button>
              
              <button 
                onClick={exportToCSV} 
                className="bg-slate-700 hover:bg-slate-600 text-white px-3 sm:px-3.5 md:px-4 h-[34px] sm:h-[36px] md:h-[38px] rounded-lg text-xs md:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5 border border-slate-600 shrink-0 justify-center whitespace-nowrap"
                title="필터링된 평가 결과 CSV 파일 다운로드"
              >
                <Download className="w-4 h-4 text-emerald-400 shrink-0" />
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
            className="w-72 sm:w-80 bg-[#08172c] border border-blue-500/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-3 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60 mb-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-hd-green" />
                <span className="text-xs font-black text-slate-200">평가 일자 선택 (다중)</span>
              </div>
              <span className="text-[11px] font-bold text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-500/20">
                {selectedDates.length > 0 ? `${selectedDates.length}개 선택됨` : '전체 선택 상태'}
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex gap-1.5 mb-2.5">
              <button
                type="button"
                onClick={selectAllDates}
                className="flex-1 py-1 px-2 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1"
              >
                <CheckSquare className="w-3 h-3 text-blue-400" /> 전체 선택
              </button>
              <button
                type="button"
                onClick={clearAllDates}
                className="flex-1 py-1 px-2 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1"
              >
                <Square className="w-3 h-3 text-slate-400" /> 전체 해제 (전체)
              </button>
            </div>

            {/* Date Checkbox List */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {validDates.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">선택 가능한 날짜가 없습니다.</p>
              ) : (
                validDates.map(dateStr => {
                  const isChecked = selectedDates.includes(dateStr);
                  const count = dateCounts[dateStr] || 0;
                  return (
                    <label
                      key={dateStr}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDate(dateStr);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold select-none ${
                        isChecked 
                          ? 'bg-blue-900/40 border border-blue-500/40 text-slate-100' 
                          : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 bg-slate-800'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="tracking-wide">{dateStr}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isChecked ? 'bg-blue-800 text-blue-200' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {count}명
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {selectedDates.length === 0 ? '모든 날짜의 데이터 표시' : `선택된 ${selectedDates.length}개 일자만 표시`}
              </span>
              <button
                type="button"
                onClick={() => setIsDateOpen(false)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                적용 완료
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {/* 1. Korean */}
          <div className="dx-card px-4 py-3 h-auto relative overflow-hidden flex flex-col border-t-4 border-t-blue-500">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] text-blue-300 font-bold tracking-[0.1em] uppercase mb-0.5">Korean Assessment</p>
                  <h2 className="text-lg font-black text-slate-100 tracking-tight">한국어 평가 종합</h2>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-900/50 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                  <Languages className="w-5 h-5" />
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-end mb-2">
                  <div onClick={() => handleSubFilter('k-comp')} className="cursor-pointer group p-1.5 -ml-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                    <p className="text-xs text-slate-400 font-bold mb-0.5 group-hover:text-blue-400 transition-colors">평가 완료 <Search className="w-3 h-3 inline-block opacity-0 group-hover:opacity-100 ml-0.5" /></p>
                    <p className="text-3xl font-black text-slate-100 leading-none"><span>{kComp}</span><span className="text-xs font-bold text-slate-500 ml-1">/ <span>{total}</span>명</span></p>
                  </div>
                  <div className="w-14 h-14 shrink-0"><Doughnut data={getChartData(kPassPure, kPassCond - kPassPure, kComp - kPassCond, kComp === 0)} options={chartOptions as any} /></div>
                </div>
                <div className="flex justify-between items-center bg-slate-800/50 px-2 py-1.5 rounded-xl border border-slate-700/50 min-h-0">
                  <div onClick={() => handleSubFilter('k-pass-pure')} className="flex-1 text-center cursor-pointer group p-1 rounded-lg hover:bg-slate-700 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-bold mb-1 group-hover:text-blue-400 transition-colors">순수 합격 <Search className="w-2 h-2 inline-block opacity-0 group-hover:opacity-100 ml-0.5" /></p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-black text-blue-400 leading-none"><span>{kPassPure}</span><span className="text-[10px] font-bold text-slate-500 ml-0.5">명</span></p>
                      <p className="text-[10px] font-bold text-blue-300 bg-blue-900/30 border border-blue-500/20 px-1.5 py-0.5 rounded leading-none"><span>{kComp ? Math.round((kPassPure/kComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                  <div className="w-[1px] h-8 bg-slate-700 mx-1"></div>
                  <div onClick={() => handleSubFilter('k-pass-cond')} className="flex-1 text-center cursor-pointer group p-1 rounded-lg hover:bg-slate-700 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-bold mb-1 group-hover:text-hd-green transition-colors">조건부 포함 <Search className="w-2 h-2 inline-block opacity-0 group-hover:opacity-100 ml-0.5" /></p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-black text-hd-green leading-none"><span>{kPassCond}</span><span className="text-[10px] font-bold text-slate-500 ml-0.5">명</span></p>
                      <p className="text-[10px] font-bold text-hd-green bg-green-900/20 border border-green-500/20 px-1.5 py-0.5 rounded leading-none"><span>{kComp ? Math.round((kPassCond/kComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Skill */}
          <div className="dx-card px-4 py-3 h-auto relative overflow-hidden flex flex-col border-t-4 border-t-hd-green">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] text-green-400 font-bold tracking-[0.1em] uppercase mb-0.5">Skill Verification</p>
                  <h2 className="text-lg font-black text-slate-100 tracking-tight">기량 평가 종합</h2>
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-900/30 border border-green-500/30 text-hd-green flex items-center justify-center shrink-0">
                  <Hammer className="w-5 h-5" />
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-end mb-2">
                  <div onClick={() => handleSubFilter('s-comp')} className="cursor-pointer group p-1.5 -ml-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                    <p className="text-xs text-slate-400 font-bold mb-0.5 group-hover:text-hd-green transition-colors">평가 완료 <Search className="w-3 h-3 inline-block opacity-0 group-hover:opacity-100 ml-0.5" /></p>
                    <p className="text-3xl font-black text-hd-green leading-none"><span>{sComp}</span><span className="text-xs font-bold text-slate-500 ml-1">/ <span>{total}</span>명</span></p>
                  </div>
                  <div className="w-14 h-14 shrink-0"><Doughnut data={getChartData(sPass, 0, sComp - sPass, sComp === 0)} options={chartOptions as any} /></div>
                </div>
                <div className="flex justify-center items-center bg-slate-800/50 px-2 py-1.5 rounded-xl border border-slate-700/50 min-h-0">
                  <div onClick={() => handleSubFilter('s-pass')} className="flex-1 text-center cursor-pointer group p-1 rounded-lg hover:bg-slate-700 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-bold mb-1 group-hover:text-hd-green transition-colors">실기 통과 (조건부 없음) <Search className="w-2 h-2 inline-block opacity-0 group-hover:opacity-100 ml-0.5" /></p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-black text-slate-100 leading-none"><span>{sPass}</span><span className="text-[10px] font-bold text-slate-500 ml-0.5">명</span></p>
                      <p className="text-[10px] font-bold text-hd-green bg-green-900/20 border border-green-500/20 px-1.5 py-0.5 rounded leading-none"><span>{sComp ? Math.round((sPass/sComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Total */}
          <div className="dx-card px-4 py-3 h-auto relative overflow-hidden flex flex-col border-t-4 border-t-purple-500 md:col-span-2 lg:col-span-1">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] text-purple-400 font-bold tracking-[0.1em] uppercase mb-0.5">Final Result</p>
                  <h2 className="text-lg font-black text-slate-100 tracking-tight">통합 최종 결과</h2>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-900/30 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-end mb-2">
                  <div onClick={() => handleSubFilter('t-comp')} className="cursor-pointer group p-1.5 -ml-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                    <p className="text-xs text-slate-400 font-bold mb-0.5 group-hover:text-purple-400 transition-colors">최종 판정 완료 <Search className="w-3 h-3 inline-block opacity-0 group-hover:opacity-100 ml-0.5" /></p>
                    <p className="text-3xl font-black text-slate-100 leading-none"><span>{tComp}</span><span className="text-xs font-bold text-slate-500 ml-1">/ <span>{total}</span>명</span></p>
                  </div>
                  <div className="w-14 h-14 shrink-0"><Doughnut data={getChartData(tPassPure, tPassCond - tPassPure, tComp - tPassCond, tComp === 0)} options={chartOptions as any} /></div>
                </div>
                <div className="flex justify-between items-center bg-slate-800/50 px-2 py-1.5 rounded-xl border border-slate-700/50 min-h-0">
                  <div onClick={() => handleSubFilter('t-pass-pure')} className="flex-1 text-center cursor-pointer group p-1 rounded-lg hover:bg-slate-700 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-bold mb-1 group-hover:text-blue-400 transition-colors">순수 합격 <Search className="w-2 h-2 inline-block opacity-0 group-hover:opacity-100 ml-0.5" /></p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-black text-blue-400 leading-none"><span>{tPassPure}</span><span className="text-[10px] font-bold text-slate-500 ml-0.5">명</span></p>
                      <p className="text-[10px] font-bold text-blue-300 bg-blue-900/30 border border-blue-500/20 px-1.5 py-0.5 rounded leading-none"><span>{tComp ? Math.round((tPassPure/tComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                  <div className="w-[1px] h-8 bg-slate-700 mx-1"></div>
                  <div onClick={() => handleSubFilter('t-pass-cond')} className="flex-1 text-center cursor-pointer group p-1 rounded-lg hover:bg-slate-700 transition-all flex flex-col justify-center items-center">
                    <p className="text-[10px] text-slate-400 font-bold mb-1 group-hover:text-hd-green transition-colors">조건부 포함 <Search className="w-2 h-2 inline-block opacity-0 group-hover:opacity-100 ml-0.5" /></p>
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-xl font-black text-hd-green leading-none"><span>{tPassCond}</span><span className="text-[10px] font-bold text-slate-500 ml-0.5">명</span></p>
                      <p className="text-[10px] font-bold text-hd-green bg-green-900/20 border border-green-500/20 px-1.5 py-0.5 rounded leading-none"><span>{tComp ? Math.round((tPassCond/tComp)*100) : 0}</span>%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="dx-card flex-1 min-h-[400px] flex flex-col mt-2 md:mt-0 min-w-0 w-full">
        <div className="px-4 py-2 min-h-[50px] border-b border-slate-700/50 flex flex-wrap justify-between items-center gap-3 bg-[#0a1b35] z-20 rounded-t-xl shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-black text-slate-100 flex items-center gap-2 text-xl tracking-tight">
              <Zap className="w-6 h-6 text-amber-400" /> 실시간 통합 평가 현황
              <span className={`ml-2 text-sm font-bold px-3 py-1 rounded-lg border transition-colors ${activeSubFilter ? 'text-blue-400 bg-blue-900/30 border-blue-500/30' : 'text-slate-400 bg-slate-800 border-slate-600'}`}>{tableList.length}명</span>
            </h3>
            {activeSubFilter && (
              <div className="text-xs bg-blue-900/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer hover:bg-blue-900/50 transition-colors" onClick={() => setActiveSubFilter(null)} title="필터 해제">
                <Filter className="w-3.5 h-3.5" /> <span className="tracking-wide">{filterBadgeText}</span> <X className="w-3.5 h-3.5 ml-0.5 opacity-80" />
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <span className="flex h-3 w-3 relative mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
            <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-400 font-bold uppercase tracking-widest">LIVE UPDATE</span>
          </div>
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-auto dx-table-wrapper border-0 rounded-none w-full relative">
          <table className="w-full text-left border-collapse dx-table min-w-[500px] lg:min-w-full whitespace-nowrap text-xs">
            <thead className="sticky top-0 z-10 bg-[#051326] shadow-sm text-[11px] md:text-xs">
              <tr>
                <th className="text-center px-1 md:px-2">검증 구분</th>
                <th className={`sortable text-center px-1 md:px-2 ${sortCol === 'app_no' ? 'active' : ''}`} onClick={() => handleSort('app_no')}>수험번호 <ArrowUpDown /></th>
                <th className={`sortable text-center px-1 md:px-2 ${sortCol === 'name' ? 'active' : ''}`} onClick={() => handleSort('name')}>성명 <ArrowUpDown /></th>
                <th className={`sortable text-center px-1 md:px-2 ${sortCol === 'job' ? 'active' : ''}`} onClick={() => handleSort('job')}>직종 <ArrowUpDown /></th>
                <th className={`sortable text-center px-1 md:px-2 ${sortCol === 'age' ? 'active' : ''}`} onClick={() => handleSort('age')}>나이(E9) <ArrowUpDown /></th>
                <th className={`text-center sortable px-1 md:px-2 ${sortCol === 'k_score' ? 'active' : ''}`} onClick={() => handleSort('k_score')}>한국어 <ArrowUpDown /></th>
                <th className="text-center px-1 md:px-2">현장 기량</th>
                <th className={`text-center sortable px-1 md:px-2 ${sortCol === 'result' ? 'active' : ''}`} onClick={() => handleSort('result')}>최종 결과 <ArrowUpDown /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {tableList.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-500 font-bold text-base">데이터가 없습니다.</td></tr>
              ) : (
                tableList.map((c, idx) => {
                  const actualResult = determineResult(c);
                  const resClass = actualResult === '최종 합격' ? 'res-pass' : actualResult === '조건부 합격' ? 'res-cond' : actualResult === '대기' ? 'res-wait' : 'res-fail';
                  return (
                    <tr key={`${c.uid || c.app_no}_${idx}`} className="hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => setSelectedCandidate(c)}>
                      <td className="text-center px-1 md:px-2" dangerouslySetInnerHTML={{__html: getBadgeHtml(c.eval_type)}}></td>
                      <td className="font-bold text-slate-300 text-center tracking-wider text-xs md:text-sm px-1 md:px-2">{c.app_no}</td>
                      <td className="font-black text-slate-100 text-center text-xs md:text-sm px-1 md:px-2">{c.name?.toUpperCase()}</td>
                      <td className="text-slate-400 text-center font-bold text-xs md:text-sm px-1 md:px-2">{c.job}</td>
                      <td className="text-slate-400 text-xs md:text-sm text-center font-bold px-1 md:px-2">
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
                      <td className="text-center font-black text-blue-400 text-xs md:text-sm px-1 md:px-2">{(c.k_score || 0) > 0 ? c.k_score : '-'}</td>
                      <td className="text-center font-black text-hd-green tracking-tight text-xs md:text-sm px-1 md:px-2">
                        {isSkillComplete(c) ? ((c.job || '').includes('취부') ? `W:${c.grade_weld} F:${c.grade_fit}` : c.grade_weld) : '-'}
                      </td>
                      <td className="text-center px-1 md:px-2"><span className={`px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap ${resClass}`}>{actualResult}</span></td>
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
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020b16]/80 backdrop-blur-md p-2 md:p-4 animate-in fade-in">
            <div className="bg-[#08172c] border border-[#1e3a5f] rounded-2xl shadow-2xl w-full max-w-2xl max-h-full overflow-hidden flex flex-col">
              <div className="bg-[#051326] p-3 md:p-4 border-b border-[#1e3a5f] flex justify-between items-center text-slate-100 shrink-0">
                <h3 className="font-black text-base md:text-lg flex items-center gap-2 md:gap-3"><User className="w-3 h-3 md:w-4 md:h-4 text-blue-400" /> 지원자 상세 프로필</h3>
                <button onClick={() => setSelectedCandidate(null)} className="hover:bg-slate-800 p-1.5 md:p-2 rounded-xl transition-colors"><X className="w-3 h-3 md:w-4 md:h-4 text-slate-400 hover:text-slate-200" /></button>
              </div>
              
              <div className="p-4 lg:p-6 overflow-y-auto flex-1 space-y-4 md:space-y-6">
                {/* Header Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 p-3 md:p-4 rounded-xl bg-[#051326] border border-[#1e3a5f]">
                  <div>
                    <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2">
                      <h4 className="text-lg md:text-xl lg:text-2xl font-black text-slate-100">{selectedCandidate.name?.toUpperCase()}</h4>
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-xs md:text-sm font-bold text-slate-300 tracking-wider">{selectedCandidate.app_no}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold text-slate-400 mt-2 md:mt-3">
                      <span className="flex items-center gap-1 md:gap-1.5"><MapPin className="w-3 h-3 md:w-4 md:h-4 text-blue-400" /> {selectedCandidate.country} / {selectedCandidate.agency}</span>
                      <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-slate-700"></span>
                      <span>
                        {(() => {
                          const ageVal = Number(selectedCandidate.age) || calculateAge(selectedCandidate.dob);
                          const y = selectedCandidate.dob ? selectedCandidate.dob.slice(0, 4) : "";
                          const ageText = ageVal > 0 ? `${ageVal}세` : (y ? `${y}년생` : "-");
                          const subText = ageVal > 0 && y ? ` (${y}년생)` : "";
                          return `${ageText}${subText} / E-9: ${selectedCandidate.e9 === "O" ? "유경험(O)" : "신규(X)"}`;
                        })()}
                      </span>
                      <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-slate-700"></span>
                      <span className="text-blue-300 font-black px-1.5 md:px-2 py-0.5 bg-blue-900/30 rounded">{selectedCandidate.job}</span>
                    </div>
                  </div>
                  <div className="text-left md:text-right shrink-0 mt-2 md:mt-0">
                    <p className="text-[10px] md:text-xs text-slate-500 font-bold tracking-[0.2em] uppercase mb-1 md:mb-2">Final Result</p>
                    <span className={`px-4 md:px-5 py-1.5 md:py-2.5 rounded-xl text-base md:text-lg font-black border inline-block ${modalResult === '최종 합격' ? 'bg-green-900/20 text-green-400 border-green-500/30' : modalResult === '조건부 합격' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-500/30' : modalResult === '대기' ? 'bg-slate-800 text-slate-400 border-slate-600' : 'bg-red-900/20 text-red-400 border-red-500/30'}`}>{modalResult}</span>
                  </div>
                </div>

                {/* Scores Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Korean Score */}
                  <div className="p-3 md:p-4 rounded-xl bg-[#051326] border border-[#1e3a5f] flex flex-col justify-between">
                    <div>
                      <h5 className="font-black text-blue-400 text-xs md:text-sm mb-4 md:mb-6 flex items-center gap-2"><Languages className="w-3 h-3 md:w-4 md:h-4" /> 한국어 평가결과</h5>
                      <div className="flex justify-between items-end mb-3 md:mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-100">{selectedCandidate.k_score || 0}</span>
                          <span className="text-base md:text-lg font-bold text-slate-500">점</span>
                        </div>
                        <span className="text-base md:text-lg font-black text-blue-300 bg-blue-900/30 border border-blue-500/20 px-2 md:px-3 py-1 md:py-1.5 rounded-lg">{selectedCandidate.k_grade || '-'} 등급</span>
                      </div>
                    </div>
                    <div className="mt-3 md:mt-2 pt-3 md:pt-4 border-t border-[#1e3a5f]">
                      <p className="text-xs md:text-sm font-bold text-slate-400">{selectedCandidate.k_pass || '평가 대기중'}</p>
                    </div>
                  </div>
                  
                  {/* Skill Score */}
                  <div className="p-3 md:p-4 rounded-xl bg-[#051326] border border-[#1e3a5f]">
                    <h5 className="font-black text-hd-green text-xs md:text-sm mb-4 md:mb-6 flex items-center gap-2"><Hammer className="w-3 h-3 md:w-4 md:h-4" /> 실기 평가결과</h5>
                    <div className="space-y-3 md:space-y-4">
                      <div className="flex justify-between items-center bg-[#0a1b35] p-3 md:p-4 rounded-xl border border-[#1e3a5f]">
                        <span className="text-xs md:text-sm font-bold text-slate-400">용접 평가</span>
                        <div className="text-right">
                          <span className="text-xl md:text-2xl font-black text-slate-100">{selectedCandidate.s_score_weld || 0}점</span>
                          <span className="text-hd-green ml-2 md:ml-3 text-base md:text-lg font-black bg-green-900/20 px-1.5 md:px-2 py-0.5 md:py-1 rounded">등급: {selectedCandidate.grade_weld || '-'}</span>
                        </div>
                      </div>
                      {(selectedCandidate.job || '').includes('취부') && (
                        <div className="flex justify-between items-center bg-[#0a1b35] p-3 md:p-4 rounded-xl border border-[#1e3a5f]">
                          <span className="text-xs md:text-sm font-bold text-slate-400">취부 평가</span>
                          <div className="text-right">
                            <span className="text-xl md:text-2xl font-black text-slate-100">{selectedCandidate.s_score_fit || 0}점</span>
                            <span className="text-hd-green ml-2 md:ml-3 text-base md:text-lg font-black bg-green-900/20 px-1.5 md:px-2 py-0.5 md:py-1 rounded">등급: {selectedCandidate.grade_fit || '-'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Memo section */}
                {selectedCandidate.memo && (
                  <div className="p-3 md:p-4 rounded-xl bg-[#051326] border border-[#1e3a5f]">
                    <h5 className="font-black text-slate-300 text-xs md:text-sm mb-3 md:mb-4 flex items-center gap-2"><FileText className="w-3 h-3 md:w-4 md:h-4 text-slate-400" /> 특이사항 및 코멘트</h5>
                    <p className="text-xs md:text-sm font-medium text-slate-300 leading-relaxed whitespace-pre-wrap bg-[#0a1b35] p-4 md:p-5 rounded-xl border border-[#1e3a5f]">
                      {selectedCandidate.memo}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="p-3 md:p-4 bg-[#051326] border-t border-[#1e3a5f] flex justify-end gap-3 md:gap-4">
                <button onClick={() => setSelectedCandidate(null)} className="px-4 md:px-6 py-2 md:py-3 bg-[#0a1b35] hover:bg-[#1e3a5f] text-slate-300 font-bold rounded-xl transition-colors text-xs md:text-sm border border-[#1e3a5f]">닫기</button>
                <button onClick={() => { 
                  if (selectedCandidate) {
                    setSelectedCandidateUid(selectedCandidate.uid);
                  }
                  setCurrentView('evaluation'); 
                  setSelectedCandidate(null); 
                }} className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-[#003770] to-[#00a859] hover:from-[#004b99] hover:to-[#00c268] text-white font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                  해당 인원 평가하기 <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
