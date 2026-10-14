import React, { useState } from 'react';
import { 
  X, 
  CalendarCheck, 
  CalendarX, 
  PlaneTakeoff, 
  PlaneLanding, 
  Building2, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Calendar,
  HelpCircle
} from 'lucide-react';
import { Candidate, DEPARTMENTS, DepartmentType } from '../types';
import { useAppContext } from '../context/AppContext';
import { computeAgencyTrack } from '../lib/utils';
import { GasUpdateModal } from './GasUpdateModal';

interface BatchManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCandidates: Candidate[];
  onSuccess?: () => void;
}

export const BatchManagementModal: React.FC<BatchManagementModalProps> = ({
  isOpen,
  onClose,
  selectedCandidates,
  onSuccess
}) => {
  const { batchUpdateManagement, isGasOutdated } = useAppContext();
  const [showGasGuide, setShowGasGuide] = useState(false);
  
  // Tab: 'result' (합격/탈락) | 'entry' (입국 일정) | 'dept' (부서 배정)
  const [activeTab, setActiveTab] = useState<'result' | 'entry' | 'dept'>('result');
  
  // Date inputs (default: today's date in YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];
  const [resultDate, setResultDate] = useState(todayStr);
  const [entryDate, setEntryDate] = useState(todayStr);
  const [selectedDept, setSelectedDept] = useState<DepartmentType>('가공');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);

  if (!isOpen) return null;

  const showNotification = (text: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const totalCount = selectedCandidates.length;
  const preCandidates = selectedCandidates.filter(c => (c.eval_type || '').includes('사전'));
  const mainCandidates = selectedCandidates.filter(c => (c.eval_type || '').includes('본기량'));

  // Eligible for entry date (must have main evaluation pass date registered)
  const eligibleForEntry = mainCandidates.filter(c => c.pass_date && c.pass_date.trim() !== '');

  // 1. 합격일자 일괄 등록
  const handleBatchPassDate = async () => {
    if (totalCount === 0) return;
    if (!resultDate) {
      showNotification('합격일자를 선택해주세요.', 'warn');
      return;
    }
    setIsSubmitting(true);
    const uids = selectedCandidates.map(c => c.uid);
    const res = await batchUpdateManagement(uids, { pass_date: resultDate });
    setIsSubmitting(false);
    if (res.success) {
      showNotification(`${res.updatedCount}명의 합격일자가 [${resultDate}]로 일괄 등록되었습니다.`, 'success');
      if (onSuccess) onSuccess();
    } else {
      showNotification(`등록 실패: ${res.message || '오류 발생'}`, 'error');
    }
  };

  // 2. 탈락일자 일괄 등록
  const handleBatchFailDate = async () => {
    if (totalCount === 0) return;
    if (!resultDate) {
      showNotification('탈락일자를 선택해주세요.', 'warn');
      return;
    }
    setIsSubmitting(true);
    const uids = selectedCandidates.map(c => c.uid);
    const res = await batchUpdateManagement(uids, { fail_date: resultDate });
    setIsSubmitting(false);
    if (res.success) {
      showNotification(`${res.updatedCount}명의 탈락일자가 [${resultDate}]로 일괄 등록되었습니다.`, 'success');
      if (onSuccess) onSuccess();
    } else {
      showNotification(`등록 실패: ${res.message || '오류 발생'}`, 'error');
    }
  };

  // 3. 합격/탈락 일자 일괄 초기화(삭제)
  const handleClearResultDates = async () => {
    if (totalCount === 0) return;
    if (!window.confirm(`선택한 ${totalCount}명의 합격 및 탈락 일자를 초기화(삭제)하시겠습니까?`)) {
      return;
    }
    setIsSubmitting(true);
    const uids = selectedCandidates.map(c => c.uid);
    const res = await batchUpdateManagement(uids, { pass_date: '', fail_date: '' });
    setIsSubmitting(false);
    if (res.success) {
      showNotification(`${res.updatedCount}명의 합격/탈락 일자가 초기화(삭제)되었습니다.`, 'success');
      if (onSuccess) onSuccess();
    } else {
      showNotification(`초기화 실패: ${res.message || '오류 발생'}`, 'error');
    }
  };

  // 4. 입국일자 일괄 등록
  const handleBatchEntryDate = async () => {
    if (mainCandidates.length === 0) {
      showNotification('선택된 인원 중 대상자가 없습니다.', 'warn');
      return;
    }
    if (eligibleForEntry.length === 0) {
      showNotification('입국일자는 합격이 확정된 대상자만 등록할 수 있습니다.', 'warn');
      return;
    }
    if (!entryDate) {
      showNotification('입국일자를 선택해주세요.', 'warn');
      return;
    }

    setIsSubmitting(true);
    const uids = eligibleForEntry.map(c => c.uid);
    const res = await batchUpdateManagement(uids, { entry_date: entryDate });
    setIsSubmitting(false);

    if (res.success) {
      const skippedCount = mainCandidates.length - eligibleForEntry.length;
      const skipMsg = skippedCount > 0 ? ` (합격일자 미등록자 ${skippedCount}명 자동 제외)` : '';
      showNotification(`대상자 ${res.updatedCount}명의 입국일자가 [${entryDate}]로 등록되었습니다.${skipMsg}`, 'success');
      if (onSuccess) onSuccess();
    } else {
      showNotification(`입국일자 등록 실패: ${res.message || '오류 발생'}`, 'error');
    }
  };

  // 5. 입국 탈락일자 일괄 등록
  const handleBatchEntryFailDate = async () => {
    if (mainCandidates.length === 0) {
      showNotification('선택된 인원 중 대상자가 없습니다.', 'warn');
      return;
    }
    if (!entryDate) {
      showNotification('입국 탈락일자를 선택해주세요.', 'warn');
      return;
    }

    setIsSubmitting(true);
    const uids = mainCandidates.map(c => c.uid);
    const res = await batchUpdateManagement(uids, { entry_fail_date: entryDate });
    setIsSubmitting(false);

    if (res.success) {
      showNotification(`대상자 ${res.updatedCount}명의 입국 탈락일자가 [${entryDate}]로 등록되었습니다.`, 'success');
      if (onSuccess) onSuccess();
    } else {
      showNotification(`입국 탈락일자 등록 실패: ${res.message || '오류 발생'}`, 'error');
    }
  };

  // 6. 입국 일정 초기화(삭제)
  const handleClearEntryDates = async () => {
    if (mainCandidates.length === 0) {
      showNotification('선택된 인원 중 대상자가 없습니다.', 'warn');
      return;
    }
    if (!window.confirm(`선택한 대상자 ${mainCandidates.length}명의 입국일자 및 입국 탈락일자를 초기화(삭제)하시겠습니까?`)) {
      return;
    }

    setIsSubmitting(true);
    const uids = mainCandidates.map(c => c.uid);
    const res = await batchUpdateManagement(uids, { entry_date: '', entry_fail_date: '' });
    setIsSubmitting(false);

    if (res.success) {
      showNotification(`대상자 ${res.updatedCount}명의 입국 일정이 초기화(삭제)되었습니다.`, 'success');
      if (onSuccess) onSuccess();
    } else {
      showNotification(`입국 일정 초기화 실패: ${res.message || '오류 발생'}`, 'error');
    }
  };

  // 7. 부서 일괄 등록
  const handleBatchDepartment = async () => {
    if (mainCandidates.length === 0) {
      showNotification('선택된 인원 중 대상자가 없습니다.', 'warn');
      return;
    }
    if (!selectedDept) {
      showNotification('배정할 부서를 선택해주세요.', 'warn');
      return;
    }

    setIsSubmitting(true);
    const uids = mainCandidates.map(c => c.uid);
    const res = await batchUpdateManagement(uids, { department: selectedDept });
    setIsSubmitting(false);

    if (res.success) {
      showNotification(`대상자 ${res.updatedCount}명의 배정 부서가 [${selectedDept}]로 일괄 등록되었습니다.`, 'success');
      if (onSuccess) onSuccess();
    } else {
      showNotification(`부서 배정 실패: ${res.message || '오류 발생'}`, 'error');
    }
  };

  // 8. 부서 배정 초기화(삭제)
  const handleClearDepartment = async () => {
    if (mainCandidates.length === 0) {
      showNotification('선택된 인원 중 본기량검증 대상자가 없습니다.', 'warn');
      return;
    }
    if (!window.confirm(`선택한 본기량 대상자 ${mainCandidates.length}명의 배정 부서를 초기화(삭제)하시겠습니까?`)) {
      return;
    }

    setIsSubmitting(true);
    const uids = mainCandidates.map(c => c.uid);
    const res = await batchUpdateManagement(uids, { department: '' });
    setIsSubmitting(false);

    if (res.success) {
      showNotification(`본기량 대상자 ${res.updatedCount}명의 배정 부서가 초기화(삭제)되었습니다.`, 'success');
      if (onSuccess) onSuccess();
    } else {
      showNotification(`부서 초기화 실패: ${res.message || '오류 발생'}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 md:p-6 animate-in fade-in">
      <div className="bg-[#081526] border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-[#06111f] px-5 py-4 border-b border-slate-800 flex justify-between items-center text-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-blue-400 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base md:text-lg flex items-center gap-2 text-slate-100">
                일정 및 부서 일괄 관리
              </h3>
              <p className="text-[11px] text-slate-400">
                선택된 <strong className="text-amber-400">{totalCount}명</strong>의 일정과 배정 부서를 일괄 등록 및 관리합니다.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="hover:bg-slate-800 p-2 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Notification inside modal */}
        {toastMessage && (
          <div className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-950/90 text-emerald-300 border-b border-emerald-700/50' 
              : toastMessage.type === 'warn'
              ? 'bg-amber-950/90 text-amber-300 border-b border-amber-700/50'
              : 'bg-red-950/90 text-red-300 border-b border-red-700/50'
          }`}>
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Selected Candidates Summary Bar */}
        <div className="bg-[#0b1b2d] px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              선택 인원: <strong className="text-white text-sm">{totalCount}명</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              사전기량: <strong className="text-blue-300">{preCandidates.length}명</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              본기량: <strong className="text-emerald-300">{mainCandidates.length}명</strong>
            </span>
          </div>
        </div>

        {/* Outdated GAS Warning inside Batch Modal */}
        {isGasOutdated && (
          <div className="mx-5 my-2 p-2.5 bg-amber-950/70 border border-amber-500/50 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-200 shrink-0">
            <span className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>구글 시트 연동을 위해 Apps Script 최신 버전 배포가 필요합니다.</span>
            </span>
            <button
              type="button"
              onClick={() => setShowGasGuide(true)}
              className="text-amber-300 underline hover:text-white font-bold ml-2 text-[11px] shrink-0 cursor-pointer"
            >
              연동 가이드 보기
            </button>
          </div>
        )}

        {/* Candidate Chips Preview (Scrollable) */}
        <div className="px-5 py-2.5 bg-[#06111f]/60 border-b border-slate-800 max-h-24 overflow-y-auto flex flex-wrap gap-1.5 shrink-0 text-[11px]">
          {selectedCandidates.map(c => {
            const tr = c.track || computeAgencyTrack(c.agency);
            const isMain = (c.eval_type || '').includes('본기량');
            return (
              <span 
                key={c.uid}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-200"
                title={`${c.app_no} ${c.name} (${c.job}, ${c.agency})`}
              >
                <span className="font-mono text-blue-400 font-bold">{c.app_no}</span>
                <span className="font-bold">{c.name}</span>
                <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${isMain ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-blue-950 text-blue-300 border border-blue-800'}`}>
                  {isMain ? '본기량' : '사전기량'}
                </span>
                <span className="text-[9px] text-slate-400">({tr})</span>
                {c.pass_date && <span className="text-[9px] text-emerald-400 font-bold">합격:{c.pass_date}</span>}
                {c.fail_date && <span className="text-[9px] text-red-400 font-bold">탈락:{c.fail_date}</span>}
                {c.department && <span className="text-[9px] text-amber-300 font-bold">부서:{c.department}</span>}
              </span>
            );
          })}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-[#06111f] shrink-0 text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('result')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'result'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>1. 합격 / 탈락 일자</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('entry')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'entry'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PlaneTakeoff className="w-4 h-4" />
            <span>2. 입국 일정</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dept')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'dept'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>3. 부서 배정</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">

          {/* TAB 1: 합격 / 탈락 일자 등록 */}
          {activeTab === 'result' && (
            <div className="space-y-4">
              <div className="bg-[#06111f] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" /> 합격 / 탈락 일자 지정
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      선택한 대상자에게 합격 또는 탈락 일자를 일괄 등록합니다.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    적용 일자 선택
                  </label>
                  <input
                    type="date"
                    value={resultDate}
                    onChange={(e) => setResultDate(e.target.value)}
                    onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                    className="w-full sm:w-64 bg-[#081526] border border-slate-700 text-slate-100 px-3.5 py-2 rounded-xl text-sm font-mono focus:border-blue-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons for Tab 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSubmitting || totalCount === 0}
                  onClick={handleBatchPassDate}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>선택 {totalCount}명 [합격일자] 등록</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || totalCount === 0}
                  onClick={handleBatchFailDate}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-red-300 border border-red-500/40 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <CalendarX className="w-4 h-4 text-red-400" />
                  <span>선택 {totalCount}명 [탈락일자] 등록</span>
                </button>
              </div>

              {/* Clear / Reset button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isSubmitting || totalCount === 0}
                  onClick={handleClearResultDates}
                  className="text-xs text-slate-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-950/30 border border-slate-700 hover:border-red-700/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>선택 인원 합격/탈락 일자 초기화</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 입국 일정 관리 */}
          {activeTab === 'entry' && (
            <div className="space-y-4">
              <div className="bg-[#06111f] p-4 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <PlaneTakeoff className="w-4 h-4 text-blue-400" /> 입국일자 / 탈락일자 관리
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    선택한 대상자의 입국일자 및 입국 취소 일자를 등록합니다.
                  </p>
                </div>

                {/* Constraint note */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-300 flex items-center justify-between gap-2.5">
                  <span className="flex items-center gap-2 text-slate-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>합격이 확정된 대상자에게 입국일자가 등록됩니다.</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-200 bg-slate-700/50 px-2 py-0.5 rounded border border-slate-600">
                    합격 확인: {eligibleForEntry.length}명
                  </span>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    적용 일자 선택
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                    className="w-full sm:w-64 bg-[#081526] border border-slate-700 text-slate-100 px-3.5 py-2 rounded-xl text-sm font-mono focus:border-blue-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons for Tab 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSubmitting || mainCandidates.length === 0 || eligibleForEntry.length === 0}
                  onClick={handleBatchEntryDate}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                  title={eligibleForEntry.length === 0 ? "합격일자 등록 인원이 없습니다." : `${eligibleForEntry.length}명 입국일자 등록`}
                >
                  <PlaneTakeoff className="w-4 h-4" />
                  <span>합격자 {eligibleForEntry.length}명 [입국일자] 등록</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || mainCandidates.length === 0}
                  onClick={handleBatchEntryFailDate}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/40 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <PlaneLanding className="w-4 h-4 text-amber-400" />
                  <span>선택 {mainCandidates.length}명 [입국 탈락일자] 등록</span>
                </button>
              </div>

              {/* Clear / Reset button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isSubmitting || mainCandidates.length === 0}
                  onClick={handleClearEntryDates}
                  className="text-xs text-slate-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-950/30 border border-slate-700 hover:border-red-700/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>선택 인원 입국 일정 초기화</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: 부서 배정 */}
          {activeTab === 'dept' && (
            <div className="space-y-4">
              <div className="bg-[#06111f] p-4 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" /> 부서 일괄 배정
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    선택한 대상자에게 배치 부서를 일괄 지정합니다.
                  </p>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    배정할 부서 선택
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value as DepartmentType)}
                    className="w-full sm:w-64 bg-[#081526] border border-slate-700 text-slate-100 px-3.5 py-2.5 rounded-xl text-sm font-bold focus:border-blue-500 focus:outline-none"
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Button for Tab 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSubmitting || mainCandidates.length === 0}
                  onClick={handleBatchDepartment}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                >
                  <Building2 className="w-4 h-4" />
                  <span>선택 {mainCandidates.length}명 [{selectedDept}] 부서 배정</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || mainCandidates.length === 0}
                  onClick={handleClearDepartment}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                  <span>선택 인원 부서 배정 초기화</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#06111f] border-t border-slate-800 flex justify-between items-center text-xs shrink-0">
          <div className="text-slate-400 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>등록 즉시 화면에 반영되며 구글 시트와 자동 동기화됩니다.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>

      {/* GAS Update Guide Modal */}
      <GasUpdateModal
        isOpen={showGasGuide}
        onClose={() => setShowGasGuide(false)}
      />
    </div>
  );
};
