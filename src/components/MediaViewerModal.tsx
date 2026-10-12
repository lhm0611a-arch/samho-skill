import React from 'react';
import { X, ExternalLink, Video, FileText, Copy, Check } from 'lucide-react';
import { getDrivePreviewUrl, getDriveViewUrl } from '../lib/utils';

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  candidateName?: string;
  appNo?: string;
  mediaType: 'video' | 'test';
  url: string;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  candidateName,
  appNo,
  mediaType,
  url
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !url) return null;

  const previewUrl = getDrivePreviewUrl(url);
  const openUrl = getDriveViewUrl(url);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 animate-in fade-in">
      <div className="bg-[#08172c] border border-blue-500/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#051326] px-4 py-3.5 border-b border-[#1e3a5f] flex justify-between items-center text-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            {mediaType === 'video' ? (
              <div className="w-8 h-8 rounded-lg bg-blue-900/50 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Video className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-900/50 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <FileText className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm md:text-base text-slate-100">{title}</h3>
                {appNo && (
                  <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono font-bold text-blue-300">
                    {appNo}
                  </span>
                )}
                {candidateName && (
                  <span className="text-xs font-bold text-slate-400">
                    ({candidateName})
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              title="링크 주소 복사"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1 border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? '복사됨' : '링크 복사'}</span>
            </button>
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">구글 드라이브에서 열기</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Frame Container */}
        <div className="flex-1 bg-black min-h-[350px] md:min-h-[500px] relative flex items-center justify-center overflow-hidden">
          <iframe
            src={previewUrl}
            title={title}
            className="w-full h-full min-h-[380px] md:min-h-[540px] border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Footer */}
        <div className="bg-[#051326] px-4 py-2.5 border-t border-[#1e3a5f] flex justify-between items-center text-xs text-slate-400 shrink-0">
          <span className="truncate max-w-[70%] font-mono text-[11px] text-slate-500">
            {url}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors text-xs"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
