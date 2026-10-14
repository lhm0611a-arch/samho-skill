import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { LATEST_GAS_SCRIPT } from '../lib/gasTemplate';
import { useAppContext } from '../context/AppContext';

interface GasUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GasUpdateModal: React.FC<GasUpdateModalProps> = ({ isOpen, onClose }) => {
  const { gasUrl, isGasOutdated, fetchData } = useAppContext();
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    passCount?: number;
    failCount?: number;
    entryCount?: number;
    total?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(LATEST_GAS_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestConnection = async () => {
    if (!gasUrl) {
      setTestResult({
        tested: true,
        success: false,
        message: 'Google Apps Script URL이 설정되지 않았습니다. 관리자 화면에서 URL을 확인해주세요.'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(gasUrl, { redirect: 'follow' });
      const text = await res.text();
      const data = JSON.parse(text);

      const rawCandidates = data.candidates || [];
      const hasPassKey = rawCandidates.length > 0 && ('pass_date' in rawCandidates[0]);
      
      const passCount = rawCandidates.filter((c: any) => c.pass_date && String(c.pass_date).trim() !== '').length;
      const failCount = rawCandidates.filter((c: any) => c.fail_date && String(c.fail_date).trim() !== '').length;
      const entryCount = rawCandidates.filter((c: any) => c.entry_date && String(c.entry_date).trim() !== '').length;

      if (!hasPassKey) {
        setTestResult({
          tested: true,
          success: false,
          total: rawCandidates.length,
          message: '현재 배포된 Google Apps Script가 이전 버전입니다. 최신 버전으로 1회 배포하시면 일정이 실시간 연동됩니다.'
        });
      } else {
        setTestResult({
          tested: true,
          success: true,
          total: rawCandidates.length,
          passCount,
          failCount,
          entryCount,
          message: `최신 스크립트 연동 확인 완료! 구글 시트에서 합격일자 ${passCount}건, 탈락일자 ${failCount}건, 입국일자 ${entryCount}건이 실시간 정상 인식되었습니다.`
        });
        // 대시보드 데이터 동기화
        await fetchData();
      }
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        message: `연동 테스트 중 오류가 발생했습니다: ${err.message || '네트워크 오류'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-fade-in">
      <div className="bg-[#08172c] border border-blue-500/40 rounded-2xl w-full max-w-4xl shadow-2xl relative my-6 flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1e3a5f] bg-[#051326] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                구글 시트 일정 연동 안내
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600">
                  실시간 연동
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                구글 스프레드시트에 작성된 합격·탈락·입국 일자가 시스템에 실시간 반영되도록 Apps Script 최신 코드를 배포합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed flex-1 custom-scrollbar">
          
          {/* Status Box */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isGasOutdated 
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-200' 
              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
          }`}>
            <div className="flex items-start gap-3">
              {isGasOutdated ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <strong className="block text-sm font-black mb-0.5">
                  {isGasOutdated 
                    ? '구글 시트 합격/탈락 일자 미연동 원인: 구글 Apps Script 업데이트 필요' 
                    : '구글 Apps Script 최신 스크립트 연동 상태'}
                </strong>
                <p className="text-xs opacity-90">
                  {isGasOutdated 
                    ? '구글 스프레드시트에 이미 날짜가 작성되어 있어도, 현재 배포된 Google Apps Script(웹 앱)가 합격/탈락/입국일자 데이터를 전송하지 않는 구버전일 수 있습니다. 아래 최신 코드로 1회 배포하시면 즉시 연동됩니다.'
                    : '구글 시트의 합격/탈락 일자, 입국 일정 및 부서 정보를 실시간으로 읽어와 대시보드에 표기합니다.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="shrink-0 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{isTesting ? '연동 점검 중...' : '실시간 연동 상태 점검'}</span>
            </button>
          </div>

          {/* Test Result Alert if run */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border animate-in fade-in flex items-start gap-2.5 ${
              testResult.success 
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                : 'bg-red-950/60 border-red-500/60 text-red-200'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-bold">{testResult.message}</p>
                {testResult.success && (
                  <p className="text-[11px] text-emerald-300 mt-1">
                    총 응시자 {testResult.total}명 중 합격일자 {testResult.passCount}명 / 탈락일자 {testResult.failCount}명 / 입국일자 {testResult.entryCount}명이 시스템에 즉시 반영되었습니다.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 30-Second Step Guide */}
          <div className="bg-[#0c1f38] border border-[#1e3a5f] rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-black text-blue-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              30초 만에 끝나는 Google Apps Script 최신 버전 배포 방법
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Step 1 */}
              <div className="p-3 rounded-lg bg-[#051326] border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 font-black text-amber-400 text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[11px]">1</span>
                  <span>Apps Script 열기</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  구글 스프레드시트 상단 메뉴에서 <br />
                  <strong className="text-white bg-slate-800 px-1 rounded">[확장 프로그램]</strong> ➔ <strong className="text-white bg-slate-800 px-1 rounded">[Apps Script]</strong>를 클릭합니다.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3 rounded-lg bg-[#051326] border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 font-black text-amber-400 text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[11px]">2</span>
                  <span>최신 코드 붙여넣기</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  아래 <strong className="text-emerald-400">[최신 코드 복사]</strong> 버튼을 누른 뒤, Apps Script의 <code className="text-amber-300 font-mono">코드.gs</code> 전체를 지우고 붙여넣고 <strong className="text-white">[저장(Ctrl+S)]</strong>합니다.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3 rounded-lg bg-[#051326] border border-blue-500/40 space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2 font-black text-emerald-400 text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center text-[11px]">3</span>
                  <span>[새 버전]으로 배포 (필수 ⭐)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-normal">
                  우측 상단 <strong className="text-blue-300">[배포]</strong> ➔ <strong className="text-blue-300">[배포 관리]</strong> 클릭 ➔ 우측 상단 ✏️(연필) 클릭 ➔ 버전에서 <strong className="text-emerald-300 bg-emerald-950/80 px-1 rounded border border-emerald-600">[새 버전]</strong> 선택 후 <strong className="text-white">[배포]</strong> 완료!
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center gap-2 text-[11px] text-blue-200">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong>중요 포인트:</strong> 기존 배포 관리에서 <strong>[새 버전]</strong>을 선택하여 배포하셔야 기존 웹 앱 URL이 그대로 유지되면서 즉시 최신 코드가 실행됩니다!
              </span>
            </div>
          </div>

          {/* Code Copy Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                <span>최신 통합 Google Apps Script 코드</span>
                <span className="text-[10px] text-slate-500 font-mono">(일정/부서/미디어 통합 지원)</span>
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '복사 완료! (Apps Script에 붙여넣으세요)' : '최신 Code.gs 전체 코드 원클릭 복사'}</span>
              </button>
            </div>

            <div className="relative rounded-xl border border-[#1e3a5f] bg-[#030f1c] overflow-hidden">
              <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-y-auto max-h-[220px] custom-scrollbar select-all leading-relaxed whitespace-pre">
                {LATEST_GAS_SCRIPT}
              </pre>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#1e3a5f] bg-[#051326] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>배포 완료 후</span>
            <button
              type="button"
              onClick={handleTestConnection}
              className="text-blue-400 hover:underline font-bold"
            >
              [실시간 연동 상태 점검]
            </button>
            <span>을 누르면 구글 시트의 날짜가 즉시 반영됩니다.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>코드 복사</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
            >
              닫기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
