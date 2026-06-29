import React, { useState } from 'react';
import { ArrowRight, Settings, X, Shield, Lock, User, Terminal, QrCode } from 'lucide-react';
import { hashPassword } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

export default function LoginOverlay() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [evaluator, setEvaluator] = useState('');
  const [code, setCode] = useState('');
  const [adminCode, setAdminCode] = useState('');
  
  const { setUserRole, setEvaluatorName, setCurrentView, candidates } = useAppContext();

  const handleLogin = async () => {
    if (!evaluator.trim()) {
      alert("본인의 실명을 입력해주십시오.");
      return;
    }
    
    const inputCode = code.trim();
    const hashed = await hashPassword(inputCode);
    
    const interviewerPw = import.meta.env.VITE_INTERVIEWER_PASSWORD || '9999';
    const evaluatorPw = import.meta.env.VITE_EVALUATOR_PASSWORD || '5678';
    
    if (inputCode === interviewerPw || hashed === '94b4cfbf67406a466487ffdf3dc0beabf2df471a28a2b535d826a70e17f09312') {
      setUserRole('interviewer');
      setEvaluatorName(evaluator.trim());
      setCurrentView('evaluation');
    }
    else if (inputCode === evaluatorPw || hashed === '1714fc2a7008cb01bb1df34825d19c0b5f10b0e9bbafe884fb7d704ba416c148') {
      setUserRole('evaluator');
      setEvaluatorName(evaluator.trim());
      setCurrentView('evaluation');
    } else {
      alert("인가되지 않은 접근 코드입니다.");
    }
  };

  const handleAdminLogin = async () => {
    const inputCode = adminCode.trim();
    const hashed = await hashPassword(inputCode);
    const adminPw = import.meta.env.VITE_ADMIN_PASSWORD || '1234';

    if (inputCode === adminPw || hashed === '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4') {
      setUserRole('admin');
      setEvaluatorName('Admin');
      setCurrentView('admin');
    } else {
      alert("보안 코드가 일치하지 않습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900 bg-cover bg-center animate-in fade-in duration-500 font-kor" style={{ backgroundImage: "url('/yard.jpg')" }}>
      {/* Premium dark overlay with gradient matching the reference */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[4px]"></div>
      
      {/* Main HUD Panel */}
      <div className="relative w-full max-w-[600px] bg-[#020b16]/70 backdrop-blur-md border border-cyan-900/50 shadow-2xl p-10 md:p-14 flex flex-col items-center">
        
        {/* HUD Corner Accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-cyan-400"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-cyan-400"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-cyan-400"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-cyan-400"></div>

        {/* Top Right Action Buttons */}
        <div className="absolute top-4 right-4 flex gap-2 z-20">
          <button 
            onClick={() => setShowAdmin(!showAdmin)}
            className="px-2.5 py-1 rounded text-[10px] text-cyan-300 font-bold flex items-center gap-1.5 hover:bg-cyan-900/30 transition-all border border-cyan-900"
          >
            {showAdmin ? <X className="w-3 h-3" /> : <Settings className="w-3 h-3" />} 
            {showAdmin ? "입력 취소" : "SYS_ADMIN"}
          </button>
          {!showAdmin && (
            <button className="px-2.5 py-1 rounded text-[10px] text-cyan-300 font-bold flex items-center gap-1.5 hover:bg-cyan-900/30 transition-all border border-cyan-900">
              <QrCode className="w-3 h-3" /> QR_LINK
            </button>
          )}
        </div>

        {/* Top Center Pill Badge */}
        <div className="mb-8">
            <div className="px-4 py-1.5 rounded-full bg-[#031526]/80 border border-[#003b6d] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-hd-green animate-pulse"></span>
                <span className="text-[10px] font-bold text-gray-300 tracking-[0.15em]">HR_EVALUATION_SYSTEM</span>
            </div>
        </div>

        <div className="relative z-10 flex flex-col items-center w-full">
          
          <div className="mb-8">
             <img src="/ci.png" alt="HD현대삼호" className="h-10 mx-auto object-contain brightness-0 invert" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
             <span className="hidden font-black text-white tracking-tighter text-3xl">HD현대삼호</span>
          </div>

          <h2 className="text-3xl font-black text-white mb-3 tracking-tight">외국인 근로자 기량평가</h2>
          <p className="text-[13px] text-hd-green mb-8 font-bold tracking-[0.2em] uppercase">Skill & Language Assessment</p>
          
          <p className="text-[9px] text-gray-500 font-bold tracking-[0.25em] mb-10">BUILD V40.DX_PRO</p>

          {!showAdmin ? (
            <div className="space-y-4 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-4 h-4 text-cyan-700 group-focus-within:text-cyan-400 transition-colors" />
                </div>
                <input 
                  type="text" 
                  value={evaluator}
                  onChange={(e) => setEvaluator(e.target.value)}
                  className="w-full bg-[#051326] border border-[#0a274a] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded text-sm text-white px-10 py-3.5 transition-all outline-none font-bold placeholder:text-gray-600" 
                  placeholder="평가자 성명 (필수)" 
                />
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-cyan-700 group-focus-within:text-cyan-400 transition-colors" />
                </div>
                <input 
                  type="password" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-[#051326] border border-[#0a274a] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded text-sm text-white px-10 py-3.5 tracking-widest transition-all outline-none font-bold placeholder:text-gray-600" 
                  placeholder="접속 코드 입력" 
                />
              </div>
              <button 
                onClick={handleLogin}
                className="w-full mt-4 py-3.5 rounded bg-gradient-to-r from-[#003770] to-[#00a859] hover:from-[#004b99] hover:to-[#00c268] text-white font-black text-sm tracking-widest transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
              >
                  시작하기 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="relative group mb-4">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Terminal className="w-4 h-4 text-cyan-700 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input 
                    type="password" 
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    className="w-full bg-[#051326] border border-[#0a274a] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded text-sm text-white px-10 py-3.5 tracking-widest transition-all outline-none font-bold placeholder:text-gray-600" 
                    placeholder="관리자 마스터 키" 
                  />
                </div>
                <button 
                  onClick={handleAdminLogin}
                  className="w-full py-3.5 rounded bg-gradient-to-r from-red-900 to-[#003770] hover:from-red-800 hover:to-[#004b99] text-white font-black text-sm tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                >
                    <Shield className="w-4 h-4" /> 관리자 권한 인증
                </button>
            </div>
          )}
        </div>

        {/* Footer Status Line */}
        <div className="absolute bottom-4 left-6 right-6 flex justify-between items-center text-[9px] font-bold tracking-widest text-cyan-800">
            <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-hd-green"></span>
                <span>LOCAL_DB : {candidates.length}</span>
            </div>
            <span>SECURE CONNECTION (ONLINE)</span>
        </div>
      </div>
    </div>
  );
}
