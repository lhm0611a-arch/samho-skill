import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Video, 
  FileText, 
  FolderSync, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Loader2, 
  Save, 
  Link2, 
  Calendar, 
  ShieldCheck, 
  Filter,
  Check,
  RefreshCw,
  ExternalLink,
  Info,
  Code2,
  Copy,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FolderCheck,
  ArrowRight
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { 
  normalizeAppNo, 
  normalizeDate, 
  normalizeType, 
  extractAppNoKey, 
  isVideoFilename, 
  isPdfFilename,
  getDriveFolderId,
  formatCount,
  formatPeople
} from '../lib/utils';
import { Candidate } from '../types';
import { LATEST_GAS_SCRIPT } from '../lib/gasTemplate';

interface MediaLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultType?: string;
}

interface MatchCandidateItem {
  candidate: Candidate;
  origVideo: string;
  origTest: string;
  matchedVideo: string;
  matchedTest: string;
  videoStatus: 'existing' | 'matched' | 'empty';
  testStatus: 'existing' | 'matched' | 'empty';
}

interface StatusNotice {
  type: 'error' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  detail?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const MediaLinkModal: React.FC<MediaLinkModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  defaultType
}) => {
  const { candidates, gasUrl, fetchData, batchUpdateCandidateMedia } = useAppContext();

  // 1. Selection states
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate || 'all');
  const [selectedType, setSelectedType] = useState<string>(defaultType || 'all');
  const [activeTab, setActiveTab] = useState<'folder' | 'paste'>('folder');

  // 2. Folder URLs
  const [videoFolderUrl, setVideoFolderUrl] = useState<string>('');
  const [testFolderUrl, setTestFolderUrl] = useState<string>('');
  const [useSeparateTestFolder, setUseSeparateTestFolder] = useState<boolean>(false);

  // 3. Paste Text
  const [pasteText, setPasteText] = useState<string>('');

  // 4. Options
  const [skipExisting, setSkipExisting] = useState<boolean>(true); // 기본: 기존 링크 유지!
  const [smartNormalize, setSmartNormalize] = useState<boolean>(true); // 기본: 응시번호 정규화

  // 5. Processing & Notice states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [showGasGuide, setShowGasGuide] = useState<boolean>(false);
  const [copiedGasCode, setCopiedGasCode] = useState<boolean>(false);

  // 6. Match Preview Result
  const [matchResult, setMatchResult] = useState<{
    matchedVideoCount: number;
    matchedTestCount: number;
    keptExistingCount: number;
    items: MatchCandidateItem[];
  } | null>(null);

  // Available dates list
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => {
      const d = normalizeDate(c.eval_date);
      if (d) set.add(d);
    });
    return Array.from(set).sort().reverse();
  }, [candidates]);

  // Set default date if not set
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate('all');
    }
  }, [selectedDate]);

  // Candidates on selected date & type
  const targetCandidates = useMemo(() => {
    return candidates.filter(c => {
      const dMatch = !selectedDate || selectedDate === 'all' || normalizeDate(c.eval_date) === selectedDate;
      const tMatch = selectedType === 'all' || normalizeType(c.eval_type) === normalizeType(selectedType);
      return dMatch && tMatch;
    });
  }, [candidates, selectedDate, selectedType]);

  // Existing counts
  const stats = useMemo(() => {
    const total = targetCandidates.length;
    const hasVideo = targetCandidates.filter(c => !!c.video_url && c.video_url.trim() !== '').length;
    const hasTest = targetCandidates.filter(c => !!c.test_url && c.test_url.trim() !== '').length;
    return {
      total,
      hasVideo,
      noVideo: total - hasVideo,
      hasTest,
      noTest: total - hasTest
    };
  }, [targetCandidates]);

  // Real-time extracted folder ID
  const detectedVideoFolderId = useMemo(() => {
    return getDriveFolderId(videoFolderUrl);
  }, [videoFolderUrl]);

  const detectedTestFolderId = useMemo(() => {
    return getDriveFolderId(testFolderUrl);
  }, [testFolderUrl]);

  if (!isOpen) return null;

  // Run Folder Matching via Google Apps Script
  const handleRunFolderMatching = async () => {
    setStatusNotice(null);

    if (!selectedDate) {
      setStatusNotice({
        type: 'warning',
        title: '평가 일자 선택 필요',
        message: '자동 매칭할 평가 일자를 선택해 주세요.'
      });
      return;
    }

    const cleanVideoId = detectedVideoFolderId || videoFolderUrl.trim();
    const cleanTestId = detectedTestFolderId || testFolderUrl.trim();
    if (!cleanVideoId && !cleanTestId) {
      setStatusNotice({
        type: 'warning',
        title: '구글 드라이브 폴더 주소 입력 필요',
        message: '영상 또는 인성검사 구글 드라이브 폴더 주소(공유 링크 또는 브라우저 주소)를 하나 이상 입력해 주세요.'
      });
      return;
    }

    if (!gasUrl) {
      setStatusNotice({
        type: 'error',
        title: 'Google Apps Script URL 미설정',
        message: 'Google Apps Script URL이 설정되지 않았습니다. [관리자] 화면에서 GAS URL을 먼저 설정해 주세요.'
      });
      return;
    }

    setIsProcessing(true);
    setProgressMsg(`구글 드라이브 폴더 파일 스캔 및 응시번호 자동 매칭 중...`);

    try {
      // 구글 시트 셀의 날짜 서식(Date 객체 vs 텍스트) 불일치로 인한 0건 누락을 방지하기 위해,
      // 드라이브 폴더 내 수험번호 파일명(K-107, KE-031 등)을 시트 전체에서 1:1로 정확하게 매칭하도록 빈 문자열(전체 대상)을 전송합니다.
      const payload = {
        type: 'match_drive_media',
        eval_date: '',
        eval_type: selectedType,
        folder_url_video: videoFolderUrl.trim(),
        folder_id: cleanVideoId,
        folder_url_test: testFolderUrl.trim(),
        skip_existing: skipExisting
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const rawText = await res.text();
      if (rawText.trim().startsWith('<') || rawText.includes('<!DOCTYPE html>')) {
        throw new Error('GAS_HTML_ERROR');
      }

      let data: any = JSON.parse(rawText);

      if (data.status === 'success') {
        setProgressMsg('매칭 완료! 최신 데이터를 시트에서 다시 불러오는 중...');
        await fetchData();

        const vCount = data.matched_video || 0;
        const tCount = data.matched_test || 0;
        const sCount = data.skipped_existing || 0;

        if (vCount === 0 && tCount === 0) {
          setStatusNotice({
            type: 'warning',
            title: '매칭된 파일 없음 (0건)',
            message: `구글 드라이브 폴더 내 파일명과 응시자 수험번호(예: K-107, KE-031 등)가 일치하는 항목을 찾지 못했습니다.`,
            detail: '• 기존에 이미 링크가 등록되어 있어 보존되었거나 (기존 유지 보호),\n• 구글 드라이브 폴더의 파일명이 응시번호 형식과 다른지 확인해 주세요.\n\n💡 [방법 B: 간편 목록 붙여넣기]를 사용하시면 미리보기를 확인하며 즉시 등록하실 수 있습니다.'
          });
        } else {
          setStatusNotice({
            type: 'success',
            title: '🎬 구글 드라이브 미디어 자동 연결 완료!',
            message: `• 대상 일자: ${selectedDate === 'all' || !selectedDate ? '전체 일자' : selectedDate}\n• 영상 연결 성공: ${vCount}건\n• 인성검사 연결 성공: ${tCount}건\n• 기존 링크 유지(보호): ${sCount}건`,
            detail: '스프레드시트에 실시간으로 안전하게 저장되었습니다.'
          });
        }
      } else {
        setStatusNotice({
          type: 'error',
          title: '매칭 처리 실패',
          message: data.message || '구글 시트 처리 중 오류가 발생했습니다.',
          detail: '스프레드시트 권한 또는 폴더 접근 권한을 확인해 주세요.'
        });
      }
    } catch (err: any) {
      console.error('Drive match error:', err);

      setStatusNotice({
        type: 'error',
        title: '⚠️ 구글 시트 연동(GAS) 응답 오류 발생',
        message: '구글 스프레드시트의 Apps Script가 아직 구글 드라이브 접근 코드로 업데이트되지 않았거나, 권한 승인이 필요합니다.',
        detail: '구글 웹 앱 배포 시 [모든 사용자(Anyone)] 권한으로 배포되어 있어야 외부 호출이 가능합니다.\n\n💡 복잡한 시트 재배포 없이 지금 바로 매칭하시려면 상단의 [방법 B: 링크 목록 붙여넣기]를 사용하시면 1초 만에 즉시 연결하실 수 있습니다!',
        action: {
          label: '👉 [방법 B: 간편 목록 붙여넣기 매칭]으로 바로 이동',
          onClick: () => {
            setActiveTab('paste');
            setStatusNotice(null);
          }
        }
      });
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Run Client-Side Parse & Preview from pasted text
  const handleParsePastedText = () => {
    setStatusNotice(null);

    if (!pasteText.trim()) {
      setStatusNotice({
        type: 'warning',
        title: '목록 입력 필요',
        message: '매칭할 파일명 및 링크 목록을 입력창에 붙여넣어 주세요.'
      });
      return;
    }

    const lines = pasteText.split('\n');
    const parsedFiles: Array<{ name: string; url: string; key: string | null; isVideo: boolean; isTest: boolean }> = [];

    // Extract all lines or URL matches
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Extract URL
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
      const url = urlMatch ? urlMatch[1] : '';
      const textWithoutUrl = urlMatch ? line.replace(urlMatch[1], '').trim() : line;

      // Find filename or exam number in line
      const namePart = textWithoutUrl || line;
      const key = extractAppNoKey(namePart);

      const isVid = isVideoFilename(namePart) || line.includes('.mp4') || line.includes('.mov') || line.includes('.MOV') || (!line.includes('.pdf') && !line.includes('인성'));
      const isTst = isPdfFilename(namePart) || line.includes('.pdf') || line.includes('인성') || line.includes('보고서');

      if (url && key) {
        parsedFiles.push({
          name: namePart,
          url,
          key,
          isVideo: isVid,
          isTest: isTst
        });
      }
    }

    if (parsedFiles.length === 0) {
      setStatusNotice({
        type: 'error',
        title: '유효한 파일 및 링크 목록을 찾지 못했습니다',
        message: '입력된 내용에서 응시번호와 구글 드라이브 링크를 감지하지 못했습니다.',
        detail: '입력 예시:\nK-107 WASKITA EDUARD.MOV https://drive.google.com/file/d/1...\nKE-11.pdf https://drive.google.com/file/d/2...'
      });
      return;
    }

    // Map to target candidates
    let matchedVCount = 0;
    let matchedTCount = 0;
    let keptCount = 0;

    const items: MatchCandidateItem[] = targetCandidates.map(c => {
      const cKey = extractAppNoKey(c.app_no);
      const origV = c.video_url || '';
      const origT = c.test_url || '';

      let newV = origV;
      let newT = origT;
      let vStat: 'existing' | 'matched' | 'empty' = origV ? 'existing' : 'empty';
      let tStat: 'existing' | 'matched' | 'empty' = origT ? 'existing' : 'empty';

      // Match video
      if (!origV || !skipExisting) {
        const foundVid = parsedFiles.find(f => f.key === cKey && f.isVideo);
        if (foundVid) {
          newV = foundVid.url;
          vStat = 'matched';
          matchedVCount++;
        }
      } else if (origV) {
        keptCount++;
      }

      // Match test
      if (!origT || !skipExisting) {
        const foundTest = parsedFiles.find(f => f.key === cKey && f.isTest);
        if (foundTest) {
          newT = foundTest.url;
          tStat = 'matched';
          matchedTCount++;
        }
      }

      return {
        candidate: c,
        origVideo: origV,
        origTest: origT,
        matchedVideo: newV,
        matchedTest: newT,
        videoStatus: vStat,
        testStatus: tStat
      };
    });

    setMatchResult({
      matchedVideoCount: matchedVCount,
      matchedTestCount: matchedTCount,
      keptExistingCount: keptCount,
      items
    });

    setStatusNotice({
      type: 'info',
      title: '미리보기 분석 완료',
      message: `총 ${parsedFiles.length}개 파일 파싱됨 → 영상 매칭: ${matchedVCount}건, 인성검사 매칭: ${matchedTCount}건. 아래 표를 확인 후 [스프레드시트에 최종 반영 저장] 버튼을 눌러주세요.`
    });
  };

  // Save Previewed Matches to Google Sheets and Local State
  const handleSaveMatches = async () => {
    if (!matchResult) return;

    setIsProcessing(true);
    setProgressMsg('스프레드시트에 미디어 링크 반영 저장 중...');

    try {
      const updates = matchResult.items
        .filter(item => item.videoStatus === 'matched' || item.testStatus === 'matched')
        .map(item => ({
          uid: item.candidate.uid,
          app_no: item.candidate.app_no,
          eval_type: item.candidate.eval_type,
          eval_date: item.candidate.eval_date,
          video_url: item.matchedVideo,
          test_url: item.matchedTest
        }));

      if (updates.length === 0) {
        setStatusNotice({
          type: 'warning',
          title: '신규 매칭 링크 없음',
          message: '신규로 매칭된 링크가 없습니다. 이미 모든 인원의 링크가 등록되어 있거나 일치하는 응시번호가 없습니다.'
        });
        setIsProcessing(false);
        return;
      }

      const res = await batchUpdateCandidateMedia(updates);
      if (res.success) {
        setStatusNotice({
          type: 'success',
          title: '✅ 스프레드시트 반영 저장 완료!',
          message: `• 신규 영상 및 인성검사 연결: ${formatPeople(updates.length)}\n• 기존 링크 보호 유지: ${formatCount(matchResult.keptExistingCount)}건`,
          detail: '대시보드 및 평가 화면에서 즉시 [▶ 영상] 및 [📄 인성] 버튼으로 열람하실 수 있습니다.'
        });
      } else {
        setStatusNotice({
          type: 'error',
          title: '저장 처리 실패',
          message: res.message || '네트워크 오류가 발생했습니다.'
        });
      }
    } catch (e: any) {
      setStatusNotice({
        type: 'error',
        title: '저장 중 오류 발생',
        message: e.message
      });
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const copyGasScript = () => {
    navigator.clipboard.writeText(LATEST_GAS_SCRIPT);
    setCopiedGasCode(true);
    setTimeout(() => setCopiedGasCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-in fade-in overflow-y-auto">
      <div className="bg-[#08172c] border border-blue-500/40 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="bg-[#051326] px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#1e3a5f] flex justify-between items-center text-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <FolderSync className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base md:text-lg text-slate-100 truncate">
                구글 드라이브 영상 및 인성검사 결과 자동 연결
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate sm:whitespace-normal">
                구글 드라이브 폴더의 응시번호(예: K-107, KE-031 등)와 미디어를 실시간 자동 연결합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">

          {/* Interactive In-Modal Status Notice Banner */}
          {statusNotice && (
            <div className={`p-3.5 sm:p-4 rounded-xl border animate-in slide-in-from-top-2 flex flex-col gap-2 ${
              statusNotice.type === 'error'
                ? 'bg-red-950/40 border-red-500/40 text-red-200'
                : statusNotice.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : statusNotice.type === 'warning'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-blue-950/40 border-blue-500/40 text-blue-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {statusNotice.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                  {statusNotice.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
                  {statusNotice.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
                  {statusNotice.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
                  <div>
                    <h5 className="font-black text-sm">{statusNotice.title}</h5>
                    <p className="text-xs mt-1 whitespace-pre-line leading-relaxed font-medium">
                      {statusNotice.message}
                    </p>
                    {statusNotice.detail && (
                      <p className="text-[11px] mt-2 p-2 bg-black/30 rounded-lg text-slate-300 whitespace-pre-line font-mono leading-relaxed border border-white/5">
                        {statusNotice.detail}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setStatusNotice(null)}
                  className="text-slate-400 hover:text-white p-1 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {statusNotice.action && (
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={statusNotice.action.onClick}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5"
                  >
                    <span>{statusNotice.action.label}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Simple Target Scope Selector */}
          <div className="bg-[#051326] p-3.5 sm:p-4 rounded-xl border border-[#1e3a5f] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  평가 일자
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setMatchResult(null);
                    setStatusNotice(null);
                  }}
                  className="w-full bg-[#0a1b35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-xs sm:text-sm font-bold text-slate-100 focus:border-blue-500 outline-none"
                >
                  <option value="all">⚡ 전체 일자 (날짜 무관 자동 매칭 - 권장)</option>
                  {availableDates.map(d => (
                    <option key={d} value={d}>
                      {d} ({formatPeople(candidates.filter(c => normalizeDate(c.eval_date) === d).length)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  검증 구분
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setMatchResult(null);
                    setStatusNotice(null);
                  }}
                  className="w-full bg-[#0a1b35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-xs sm:text-sm font-bold text-slate-100 focus:border-blue-500 outline-none"
                >
                  <option value="본기량검증">본기량검증</option>
                  <option value="사전기량검증">사전기량검증</option>
                  <option value="all">전체 (사전 + 본기량)</option>
                </select>
              </div>
            </div>

            {/* Current Media Registration Stats */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs">
              <span className="font-bold text-slate-300">
                대상: <strong className="text-blue-400">{formatPeople(stats.total)}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-blue-400" />
                영상 등록: <strong className="text-emerald-400">{formatPeople(stats.hasVideo)}</strong>
                <span className="text-slate-500 font-normal">/ 미등록 {formatPeople(stats.noVideo)}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                인성검사 등록: <strong className="text-emerald-400">{formatPeople(stats.hasTest)}</strong>
                <span className="text-slate-500 font-normal">/ 미등록 {formatPeople(stats.noTest)}</span>
              </span>
            </div>
          </div>

          {/* Clean Matching Method Tabs */}
          <div>
            <div className="flex border-b border-[#1e3a5f] gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('folder');
                  setStatusNotice(null);
                }}
                className={`pb-2 px-3 text-xs font-black transition-all flex items-center gap-1.5 border-b-2 ${
                  activeTab === 'folder'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FolderSync className="w-4 h-4" />
                방법 A: 구글 드라이브 폴더 주소 연동
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('paste');
                  setStatusNotice(null);
                }}
                className={`pb-2 px-3 text-xs font-black transition-all flex items-center gap-1.5 border-b-2 ${
                  activeTab === 'paste'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Link2 className="w-4 h-4" />
                방법 B: 파일/링크 목록 붙여넣기 매칭
              </button>
            </div>

            {/* TAB A: Folder URL */}
            {activeTab === 'folder' && (
              <div className="space-y-3.5 bg-[#051326] p-3.5 sm:p-4 rounded-xl border border-[#1e3a5f]">
                {/* 1. Video Folder Input */}
                <div className="p-3 sm:p-3.5 bg-[#08182f] rounded-xl border border-blue-500/30 space-y-2">
                  <label className="block text-xs font-black text-blue-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-blue-400" />
                      1. 영상 구글 드라이브 폴더 주소 (폴더 주소 또는 공유 링크)
                    </span>
                    {detectedVideoFolderId && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        ✓ ID: {detectedVideoFolderId}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={videoFolderUrl}
                    onChange={(e) => {
                      setVideoFolderUrl(e.target.value);
                      setStatusNotice(null);
                    }}
                    placeholder="https://drive.google.com/drive/folders/... (영상 폴더 주소)"
                    className="w-full bg-[#0a1b35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:border-blue-500 outline-none"
                  />
                  {detectedVideoFolderId && (
                    <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <FolderCheck className="w-3.5 h-3.5" /> 폴더 주소 인식 완료
                    </p>
                  )}
                </div>

                {/* 2. Personality Test Folder Input */}
                <div className="p-3 sm:p-3.5 bg-[#0d1733] rounded-xl border border-indigo-500/30 space-y-2">
                  <label className="block text-xs font-black text-indigo-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      2. 인성검사 구글 드라이브 폴더 주소 (선택 사항)
                    </span>
                    {detectedTestFolderId && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        ✓ ID: {detectedTestFolderId}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={testFolderUrl}
                    onChange={(e) => {
                      setTestFolderUrl(e.target.value);
                      setStatusNotice(null);
                    }}
                    placeholder="https://drive.google.com/drive/folders/... (인성검사 PDF 폴더 주소, 없으면 비워두기)"
                    className="w-full bg-[#0a1b35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:border-indigo-500 outline-none"
                  />
                  {detectedTestFolderId && (
                    <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <FolderCheck className="w-3.5 h-3.5" /> 인성검사 폴더 주소 인식 완료
                    </p>
                  )}
                </div>

                {/* Action button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRunFolderMatching}
                    disabled={isProcessing}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs md:text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{progressMsg || '매칭 처리 중...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>구글 드라이브 자동 매칭 시작</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB B: Paste Text */}
            {activeTab === 'paste' && (
              <div className="space-y-4 bg-[#051326] p-4 rounded-xl border border-[#1e3a5f]">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-200">
                      파일명 및 구글 드라이브 공유 링크 목록 붙여넣기
                    </label>
                    <span className="text-[11px] text-blue-400 font-bold">
                      💡 브라우저 즉시 분석
                    </span>
                  </div>
                  <textarea
                    rows={7}
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value);
                      setStatusNotice(null);
                    }}
                    placeholder={`구글 드라이브에서 파일 링크들을 복사하여 붙여넣으세요:\n\n예시 1: K-107 WASKITA EDUARD RASWANA.MOV https://drive.google.com/file/d/1a2b3c4d5e/view\n예시 2: KE-11.pdf https://drive.google.com/file/d/2f3g4h5i6j/view\n예시 3: TM22 https://drive.google.com/file/d/3k4l5m6n7o/view`}
                    className="w-full bg-[#0a1b35] border border-[#1e3a5f] rounded-lg p-3 text-xs font-mono text-slate-200 focus:border-blue-500 custom-scrollbar leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    💡 파일명 뒤에 성명이 붙어있거나 오타가 있어도 맨 앞의 응시번호(예: K-107, KE-11, TM22)만 시스템이 알아서 찾아냅니다.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>매칭 미리보기 분석 시작</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 4: Match Preview Result Table (if parsed) */}
          {matchResult && (
            <div className="bg-[#051326] p-4 rounded-xl border border-blue-500/40 space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-blue-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    매칭 분석 결과 미리보기 ({selectedDate})
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    신규 영상 매칭: <strong className="text-blue-400">{formatCount(matchResult.matchedVideoCount)}건</strong> | 
                    신규 인성검사 매칭: <strong className="text-indigo-400">{formatCount(matchResult.matchedTestCount)}건</strong> | 
                    기존 링크 유지: <strong className="text-emerald-400">{formatCount(matchResult.keptExistingCount)}건</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveMatches}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>스프레드시트에 최종 반영 저장</span>
                </button>
              </div>

              {/* Preview Table */}
              <div className="max-h-60 overflow-y-auto border border-[#1e3a5f] rounded-lg custom-scrollbar">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-[#0a1b35] text-slate-300 font-bold sticky top-0 border-b border-[#1e3a5f]">
                    <tr>
                      <th className="p-2 text-center w-16">응시번호</th>
                      <th className="p-2 w-28">성명</th>
                      <th className="p-2">영상 매칭 상태</th>
                      <th className="p-2">인성검사 매칭 상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {matchResult.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 font-mono text-[11px]">
                        <td className="p-2 text-center font-bold text-blue-300">
                          {item.candidate.app_no}
                        </td>
                        <td className="p-2 font-bold text-slate-200">
                          {item.candidate.name}
                        </td>
                        <td className="p-2">
                          {item.videoStatus === 'matched' ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-bold">
                              <Check className="w-3.5 h-3.5" /> 신규 매칭됨
                              <span className="text-slate-500 text-[10px] truncate max-w-[200px]">({item.matchedVideo})</span>
                            </span>
                          ) : item.videoStatus === 'existing' ? (
                            <span className="text-slate-400 flex items-center gap-1">
                              기존 등록 유지 (보호)
                            </span>
                          ) : (
                            <span className="text-slate-600">미등록</span>
                          )}
                        </td>
                        <td className="p-2">
                          {item.testStatus === 'matched' ? (
                            <span className="text-indigo-400 flex items-center gap-1 font-bold">
                              <Check className="w-3.5 h-3.5" /> 신규 매칭됨
                              <span className="text-slate-500 text-[10px] truncate max-w-[200px]">({item.matchedTest})</span>
                            </span>
                          ) : item.testStatus === 'existing' ? (
                            <span className="text-slate-400 flex items-center gap-1">
                              기존 등록 유지 (보호)
                            </span>
                          ) : (
                            <span className="text-slate-600">미등록</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-[#051326] px-5 py-3.5 border-t border-[#1e3a5f] flex justify-end items-center gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
