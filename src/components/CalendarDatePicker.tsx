import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Check, 
  CheckSquare, 
  Square, 
  List, 
  CalendarDays, 
  X,
  RotateCcw
} from 'lucide-react';
import { formatPeople } from '../lib/utils';

interface CalendarDatePickerProps {
  selectedDates: string[];
  onSelectDates: (dates: string[]) => void;
  validDates: string[];
  dateCounts: Record<string, number>;
  onClose: () => void;
}

export default function CalendarDatePicker({
  selectedDates,
  onSelectDates,
  validDates,
  dateCounts,
  onClose
}: CalendarDatePickerProps) {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Determine initial year and month
  const initialYearMonth = useMemo(() => {
    if (selectedDates.length > 0 && selectedDates[0]) {
      const parts = selectedDates[0].split('-');
      if (parts.length === 3) {
        return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1 };
      }
    }
    if (validDates.length > 0 && validDates[0]) {
      const parts = validDates[0].split('-');
      if (parts.length === 3) {
        return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1 };
      }
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [selectedDates, validDates]);

  const [currentYear, setCurrentYear] = useState<number>(initialYearMonth.year);
  const [currentMonth, setCurrentMonth] = useState<number>(initialYearMonth.month); // 0-indexed

  // Months with available evaluation data
  const availableMonths = useMemo(() => {
    const monthMap: Record<string, { year: number; month: number; label: string; count: number }> = {};
    validDates.forEach(d => {
      const parts = d.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const count = dateCounts[d] || 0;
        if (!monthMap[key]) {
          monthMap[key] = {
            year: y,
            month: m,
            label: `${y}년 ${m + 1}월`,
            count: 0
          };
        }
        monthMap[key].count += count;
      }
    });
    return Object.values(monthMap).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [validDates, dateCounts]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleJumpToMonth = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // Calendar days grid computation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      hasData: boolean;
      count: number;
    }> = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        hasData: Boolean(dateCounts[dateStr]),
        count: dateCounts[dateStr] || 0
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        hasData: Boolean(dateCounts[dateStr]),
        count: dateCounts[dateStr] || 0
      });
    }

    // Next month leading days (fill row up to 35 or 42)
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        hasData: Boolean(dateCounts[dateStr]),
        count: dateCounts[dateStr] || 0
      });
    }

    return days;
  }, [currentYear, currentMonth, dateCounts]);

  const toggleDate = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      onSelectDates(selectedDates.filter(d => d !== dateStr));
    } else {
      onSelectDates([...selectedDates, dateStr]);
    }
  };

  const handleSelectOnly = (dateStr: string) => {
    onSelectDates([dateStr]);
  };

  const handleSelectAllInCurrentMonth = () => {
    const monthDates = calendarDays
      .filter(d => d.isCurrentMonth && d.hasData)
      .map(d => d.dateStr);
    
    // Add all month dates to current selection
    const combined = Array.from(new Set([...selectedDates, ...monthDates]));
    onSelectDates(combined);
  };

  const handleResetToAll = () => {
    onSelectDates([]); // empty array means "All Dates"
  };

  return (
    <div className="w-[330px] sm:w-[360px] bg-[#081526] border border-slate-700/80 rounded-xl shadow-2xl p-3.5 select-none text-slate-100 flex flex-col gap-2.5 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-100 leading-tight">평가 일자 캘린더</h4>
            <p className="text-[10px] text-slate-400">날짜를 클릭하여 원하는 평가 일정 선택</p>
          </div>
        </div>

        {/* View mode toggle & close */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#05101d] p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'calendar' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="달력 보기"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="목록 보기"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Available month jump pills */}
      {availableMonths.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {availableMonths.map(m => {
            const isCurrentViewing = m.year === currentYear && m.month === currentMonth;
            return (
              <button
                key={`${m.year}-${m.month}`}
                type="button"
                onClick={() => handleJumpToMonth(m.year, m.month)}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold whitespace-nowrap shrink-0 transition-all border ${
                  isCurrentViewing 
                    ? 'bg-slate-200 text-slate-900 border-white shadow-sm font-bold' 
                    : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                {m.label} ({m.count}명)
              </button>
            );
          })}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="space-y-2">
          {/* Month Navigation Bar */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="이전 달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-100">
              <span>{currentYear}년</span>
              <span className="text-blue-300">{currentMonth + 1}월</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="다음 달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 py-1 border-y border-slate-800">
            <span className="text-rose-400">일</span>
            <span>월</span>
            <span>화</span>
            <span>수</span>
            <span>목</span>
            <span>금</span>
            <span className="text-blue-400">토</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d, index) => {
              const isSelected = selectedDates.includes(d.dateStr);
              const isSunday = index % 7 === 0;
              const isSaturday = index % 7 === 6;

              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => {
                    toggleDate(d.dateStr);
                  }}
                  className={`relative h-11 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer p-0.5 border ${
                    isSelected
                      ? 'bg-blue-600 border-blue-400 text-white shadow-sm z-10 font-bold'
                      : d.hasData
                        ? 'bg-slate-800/80 border-slate-700 text-white hover:bg-slate-700 hover:border-slate-500'
                        : d.isCurrentMonth
                          ? 'bg-[#05101d]/50 border-transparent text-slate-500 hover:bg-slate-800/40'
                          : 'bg-transparent border-transparent text-slate-700 pointer-events-none'
                  }`}
                  title={d.hasData ? `${d.dateStr}: ${d.count}명 응시` : d.dateStr}
                >
                  <span className={`text-xs leading-none font-semibold ${
                    isSelected 
                      ? 'text-white' 
                      : !d.isCurrentMonth 
                        ? 'text-slate-700' 
                        : isSunday 
                          ? 'text-rose-400' 
                          : isSaturday 
                            ? 'text-blue-400' 
                            : 'text-slate-200'
                  }`}>
                    {d.dayNumber}
                  </span>

                  {/* Candidate Count Badge / Dot */}
                  {d.hasData && (
                    <span className={`mt-0.5 text-[9px] font-semibold leading-tight px-1 rounded-sm whitespace-nowrap ${
                      isSelected 
                        ? 'bg-white text-blue-900 font-bold' 
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/30'
                    }`}>
                      {d.count}명
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
          {validDates.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">선택 가능한 날짜가 없습니다.</p>
          ) : (
            validDates.map(dateStr => {
              const isChecked = selectedDates.includes(dateStr);
              const count = dateCounts[dateStr] || 0;
              return (
                <div
                  key={dateStr}
                  onClick={() => toggleDate(dateStr)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold select-none border ${
                    isChecked 
                      ? 'bg-blue-900/40 border-blue-500/50 text-slate-100' 
                      : 'hover:bg-slate-800/80 text-slate-300 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                      isChecked ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-600 bg-slate-900'
                    }`}>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="font-mono tracking-wide">{dateStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOnly(dateStr);
                      }}
                      className="text-[10px] text-slate-400 hover:text-blue-300 px-1 py-0.5 rounded hover:bg-slate-700/60"
                      title="이 날짜만 선택"
                    >
                      단독선택
                    </button>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isChecked ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {formatPeople(count)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quick Select Actions */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700/60 text-xs">
        <button
          type="button"
          onClick={handleResetToAll}
          className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all border ${
            selectedDates.length === 0
              ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title="날짜 필터를 해제하여 전체 날짜 데이터 조회"
        >
          <RotateCcw className="w-3 h-3" />
          <span>전체 날짜 (전체)</span>
        </button>

        {viewMode === 'calendar' && (
          <button
            type="button"
            onClick={handleSelectAllInCurrentMonth}
            className="flex-1 py-1.5 px-2 rounded-lg font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1 transition-all"
            title="현재 달에 응시 데이터가 있는 모든 일자 일괄 선택"
          >
            <CheckSquare className="w-3 h-3 text-blue-400" />
            <span>이 달 전체</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="py-1.5 px-3 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shrink-0"
        >
          선택 완료
        </button>
      </div>

      {/* Selected Status Text */}
      <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
        <span>
          {selectedDates.length === 0 ? (
            <span className="text-emerald-400 font-bold">● 전체 날짜 데이터 표시 중</span>
          ) : (
            <span className="text-blue-300 font-bold">
              ● {selectedDates.length}개 일자 선택됨 ({selectedDates.slice(0, 2).join(', ')}{selectedDates.length > 2 ? ` 외 ${selectedDates.length - 2}건` : ''})
            </span>
          )}
        </span>
        {selectedDates.length > 0 && (
          <button
            type="button"
            onClick={handleResetToAll}
            className="text-slate-400 hover:text-white underline text-[10px]"
          >
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
