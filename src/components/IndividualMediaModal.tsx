import React, { useState, useEffect } from 'react';
import { 
  X, 
  Video, 
  FileText, 
  ExternalLink, 
  Check, 
  Copy, 
  Save, 
  FolderSync, 
  User, 
  Calendar, 
  Briefcase, 
  Eye, 
  EyeOff, 
  Trash2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getDriveFileId, getDrivePreviewUrl, getDriveViewUrl, getBadgeHtml } from '../lib/utils';

interface IndividualMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: any | null;
  initialFocus?: 'video' | 'test' | 'all';
  onUpdated?: (updatedCandidate: any) => void;
}

export const IndividualMediaModal: React.FC<IndividualMediaModalProps> = ({
  isOpen,
  onClose,
  candidate,
  initialFocus = 'all',
  onUpdated
}) => {
  const { updateCandidateMedia } = useAppContext();

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [testUrl, setTestUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [showVideoPreview, setShowVideoPreview] = useState<boolean>(false);
  const [showTestPreview, setShowTestPreview] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<'video' | 'test' | null>(null);

  // Sync inputs when candidate changes or modal opens
  useEffect(() => {
    if (candidate) {
      setVideoUrl(candidate.video_url || '');
      setTestUrl(candidate.test_url || '');
      setStatusMessage(null);
      // Auto open preview if url exists and specific focus requested
      setShowVideoPreview(initialFocus === 'video' && !!candidate.video_url);
      setShowTestPreview(initialFocus === 'test' && !!candidate.test_url);
    }
  }, [candidate, initialFocus, isOpen]);

  if (!isOpen || !candidate) return null;

  const videoFileId = getDriveFileId(videoUrl);
  const testFileId = getDriveFileId(testUrl);

  const handleCopy = (text: string, field: 'video' | 'test') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePasteFromClipboard = async (field: 'video' | 'test') => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (field === 'video') setVideoUrl(text.trim());
        if (field === 'test') setTestUrl(text.trim());
      }
    } catch {
      // Clipboard access denied in browser, user can paste with Ctrl+V
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    const cleanVideo = videoUrl.trim();
    const cleanTest = testUrl.trim();

    try {
      const success = await updateCandidateMedia(candidate.uid, cleanVideo, cleanTest);
      if (success) {
        setStatusMessage({
          type: 'success',
          text: `[${candidate.name}] 지원자의 영상/인성 미디어 링크가 성공적으로 저장 및 구글 시트에 즉시 동기화되었습니다.`
        });
        if (onUpdated) {
          onUpdated({
            ...candidate,
            video_url: cleanVideo,
            test_url: cleanTest
          });
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setStatusMessage({
          type: 'error',
          text: '저장 처리 중 오류가 발생했습니다. 다시 시도해 주세요.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `저장 실패: ${err?.message || '알 수 없는 오류'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 animate-in fade-in overflow-y-auto">
      <div className="bg-[#08172c] border border-blue-500/50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#051326] px-5 py-4 border-b border-[#1e3a5f] flex justify-between items-center text-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg text-slate-100 flex items-center gap-2">
                개인별 미디어 등록 및 링크 관리
              </h3>
              <p className="text-xs text-slate-400">
                구글 드라이브의 개별 파일 공유 링크를 각 지원자에게 1:1로 직접 지정합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Candidate Profile Summary Banner */}
          <div className="p-3.5 bg-[#0a1b35] rounded-xl border border-blue-500/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span dangerouslySetInnerHTML={{ __html: getBadgeHtml(candidate.eval_type) }}></span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-100 tracking-wider">
                    {candidate.name?.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700">
                    {candidate.app_no}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" /> {candidate.job}
                  </span>
                  {candidate.eval_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> {candidate.eval_date.split(' ')[0]}
                    </span>
                  )}
                  <span>{candidate.country} / {candidate.agency}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-1 rounded font-bold ${
                candidate.video_url ? 'bg-blue-950/80 text-blue-300 border border-blue-500/30' : 'bg-slate-800 text-slate-500'
              }`}>
                영상 {candidate.video_url ? '등록됨' : '미등록'}
              </span>
              <span className={`px-2 py-1 rounded font-bold ${
                candidate.test_url ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-500'
              }`}>
                인성 {candidate.test_url ? '등록됨' : '미등록'}
              </span>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold animate-in fade-in ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' 
                : 'bg-red-950/60 text-red-300 border-red-500/40'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* SECTION 1: Video Registration */}
          <div className={`p-4 rounded-xl border transition-all ${
            initialFocus === 'video' ? 'bg-[#061833] border-blue-500/60 ring-1 ring-blue-500/30' : 'bg-[#051326] border-[#1e3a5f]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-900/60 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Video className="w-3.5 h-3.5" />
                </div>
                <label className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                  1. 면접 / 실기 영상 링크 등록
                </label>
              </div>

              {videoFileId ? (
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <Check className="w-3 h-3" /> 드라이브 파일 인식됨 (ID: {videoFileId.slice(0, 10)}...)
                </span>
              ) : videoUrl.trim() ? (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
                  일반 링크
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                  미등록
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                autoFocus={initialFocus === 'video'}
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  setStatusMessage(null);
                }}
                placeholder="예: https://drive.google.com/file/d/1A3Psq.../view?usp=sharing"
                className="w-full bg-[#0a1b35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-28"
              />
              <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => setVideoUrl('')}
                    title="입력 내용 지우기"
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePasteFromClipboard('video')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors border border-slate-700"
                >
                  붙여넣기
                </button>
              </div>
            </div>

            {/* Quick Actions & Guide for Video */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/80 text-xs">
              <p className="text-[11px] text-slate-400">
                💡 구글 드라이브 영상 파일 우클릭 → <strong>[공유]</strong> → <strong>[링크 복사]</strong> 후 붙여넣으세요.
              </p>
              <div className="flex items-center gap-1.5">
                {videoUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopy(videoUrl, 'video')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors flex items-center gap-1 border border-slate-700"
                    >
                      {copiedField === 'video' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'video' ? '복사됨' : '링크 복사'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVideoPreview(!showVideoPreview)}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 border ${
                        showVideoPreview 
                          ? 'bg-blue-600 text-white border-blue-400' 
                          : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border-slate-700'
                      }`}
                    >
                      {showVideoPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showVideoPreview ? '미리보기 닫기' : '영상 미리보기'}</span>
                    </button>
                    <a
                      href={getDriveViewUrl(videoUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-blue-900/40 hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-bold transition-colors flex items-center gap-1 border border-blue-500/30"
                    >
                      <ExternalLink className="w-3 h-3" /> 새 창 열기
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Embedded Live Video Preview */}
            {showVideoPreview && videoUrl && (
              <div className="mt-3 rounded-lg overflow-hidden border border-blue-500/40 bg-black aspect-video relative">
                <iframe
                  src={getDrivePreviewUrl(videoUrl)}
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  title="영상 미리보기"
                />
              </div>
            )}
          </div>

          {/* SECTION 2: Personality Test Registration */}
          <div className={`p-4 rounded-xl border transition-all ${
            initialFocus === 'test' ? 'bg-[#0c1333] border-indigo-500/60 ring-1 ring-indigo-500/30' : 'bg-[#051326] border-[#1e3a5f]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-indigo-900/60 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <label className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                  2. 인성검사 결과지 링크 등록
                </label>
              </div>

              {testFileId ? (
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <Check className="w-3 h-3" /> 드라이브 파일 인식됨 (ID: {testFileId.slice(0, 10)}...)
                </span>
              ) : testUrl.trim() ? (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
                  일반 문서 링크
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                  미등록
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                autoFocus={initialFocus === 'test'}
                value={testUrl}
                onChange={(e) => {
                  setTestUrl(e.target.value);
                  setStatusMessage(null);
                }}
                placeholder="예: https://drive.google.com/file/d/... 또는 인성검사 결과지 링크"
                className="w-full bg-[#0a1b35] border border-[#1e3a5f] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none pr-28"
              />
              <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                {testUrl && (
                  <button
                    type="button"
                    onClick={() => setTestUrl('')}
                    title="입력 내용 지우기"
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlePasteFromClipboard('test')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors border border-slate-700"
                >
                  붙여넣기
                </button>
              </div>
            </div>

            {/* Quick Actions & Guide for Test */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/80 text-xs">
              <p className="text-[11px] text-slate-400">
                💡 인성검사 전용 폴더의 PDF/보고서 파일 우클릭 → <strong>[공유]</strong> → <strong>[링크 복사]</strong> 후 붙여넣으세요.
              </p>
              <div className="flex items-center gap-1.5">
                {testUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopy(testUrl, 'test')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors flex items-center gap-1 border border-slate-700"
                    >
                      {copiedField === 'test' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'test' ? '복사됨' : '링크 복사'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTestPreview(!showTestPreview)}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 border ${
                        showTestPreview 
                          ? 'bg-indigo-600 text-white border-indigo-400' 
                          : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700'
                      }`}
                    >
                      {showTestPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showTestPreview ? '미리보기 닫기' : '문서 미리보기'}</span>
                    </button>
                    <a
                      href={getDriveViewUrl(testUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-indigo-900/40 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-bold transition-colors flex items-center gap-1 border border-indigo-500/30"
                    >
                      <ExternalLink className="w-3 h-3" /> 새 창 열기
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Embedded Live Test Preview */}
            {showTestPreview && testUrl && (
              <div className="mt-3 rounded-lg overflow-hidden border border-indigo-500/40 bg-black h-80 relative">
                <iframe
                  src={getDrivePreviewUrl(testUrl)}
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  title="인성검사 문서 미리보기"
                />
              </div>
            )}
          </div>

          {/* Guide Box */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 안내 사항
            </p>
            <p>• 영상과 인성검사 폴더가 따로 분리되어 있어도, 각 파일의 공유 링크를 복사하여 개별 등록하면 스프레드시트에 영구 보존됩니다.</p>
            <p>• 구글 드라이브 파일의 공유 권한이 <strong>'링크가 있는 모든 사용자'</strong>로 설정되어 있어야 심사관 및 대시보드에서 즉시 열람할 수 있습니다.</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#051326] px-5 py-3.5 border-t border-[#1e3a5f] flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors border border-slate-700"
          >
            닫기
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-black shadow-lg shadow-blue-900/50 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>스프레드시트에 저장 중...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>저장 및 구글 시트 동기화</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
