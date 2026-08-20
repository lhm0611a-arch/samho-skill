import React from 'react';
import { PieChart, ClipboardList, Database, RefreshCw, Settings, Power, HardHat, Shield } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { hashPassword } from '../lib/utils';

export default function Header() {
  const { currentView, setCurrentView, userRole, setUserRole, evaluatorName, confCountry, confAgency, fetchData, logout } = useAppContext();

  const handleRefresh = async () => {
    alert("데이터를 새로고침 합니다.");
    await fetchData();
  };

  const handleSettings = async () => {
    if (userRole === 'admin') {
      setCurrentView('admin');
    } else {
      const pw = prompt('관리자 권한이 필요합니다. 마스터 키를 입력하세요:');
      if (pw) {
        const hashed = await hashPassword(pw.trim());
        if (hashed === '170842') {
          setUserRole('admin');
          setCurrentView('admin');
          alert('관리자 모드로 전환되었습니다.');
        } else {
          alert('보안 코드가 일치하지 않습니다.');
        }
      }
    }
  };

  const locationText = (confCountry && confAgency) ? `${confCountry} / ${confAgency}` : '국가/업체 미설정';

  const getRoleLabel = () => {
    if (userRole === 'admin') return 'SYSTEM ADMIN';
    if (userRole === 'interviewer') return `${evaluatorName} (인터뷰어)`;
    return `${evaluatorName} (평가자)`;
  };

  const getRoleIcon = () => {
    if (userRole === 'admin') return <Shield className="w-5 h-5" />;
    if (userRole === 'interviewer') return <span className="font-bold text-lg">{evaluatorName.charAt(0)}</span>;
    return <HardHat className="w-5 h-5" />;
  };

  return (
    <header className="bg-hd-navy border-b border-hd-navy text-white px-2 sm:px-4 md:px-6 shadow-md flex flex-wrap md:flex-nowrap justify-between items-center shrink-0 z-50 relative py-2 md:py-0 min-h-[64px] md:h-16 xl:h-18 gap-y-2 md:gap-y-0">
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-hd-green"></div>
      
      <div className="flex items-center gap-2 sm:gap-4 w-auto md:w-1/3 shrink-0">
          <div className="hidden sm:block">
            <img src="/ci.png" alt="HD현대삼호" className="h-6 object-contain" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
          </div>
          <span className="hidden font-black text-hd-green tracking-tighter text-lg">HD현대삼호</span>
          
          <div className="flex flex-col justify-center sm:border-l border-white/20 sm:pl-4">
              <h1 className="font-black text-sm md:text-base tracking-tight leading-none text-white">스마트 평가 플랫폼</h1>
              <p className="font-bold text-[9px] md:text-[10px] text-hd-green mt-0.5 uppercase tracking-wider">Skill & Lang Platform</p>
          </div>
      </div>

      {userRole !== 'interviewer' && (
        <nav className="flex gap-1 md:gap-2 p-1 rounded-lg overflow-x-auto hide-scrollbar bg-white/10 border border-white/10 backdrop-blur-sm w-full md:w-auto order-last md:order-none justify-center md:justify-start mt-2 md:mt-0 shrink-0">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 md:gap-2 rounded-md transition-all whitespace-nowrap shrink-0 ${currentView === 'dashboard' ? 'bg-hd-green text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
            >
              <PieChart className="w-4 h-4 hidden sm:inline shrink-0" /> 대시보드
            </button>
            <button 
              onClick={() => setCurrentView('evaluation')}
              className={`px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 md:gap-2 rounded-md transition-all whitespace-nowrap shrink-0 ${currentView === 'evaluation' ? 'bg-hd-green text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
            >
              <ClipboardList className="w-4 h-4 hidden sm:inline shrink-0" /> 평가하기
            </button>
            {userRole === 'admin' && (
              <button 
                onClick={() => setCurrentView('admin')}
                className={`px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 md:gap-2 rounded-md transition-all whitespace-nowrap shrink-0 ${currentView === 'admin' ? 'bg-hd-green text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
              >
                <Database className="w-4 h-4 hidden sm:inline shrink-0" /> 시스템 관리
              </button>
            )}
        </nav>
      )}

      <div className="w-auto md:w-1/3 flex justify-end items-center gap-2 md:gap-4 text-xs md:text-sm shrink-0">
          <div className="text-right hidden xl:block">
              <p className="font-bold text-white text-sm">{getRoleLabel()}</p>
              <p className="tracking-wide text-[10px] text-gray-300 font-bold">{locationText}</p>
          </div>
          <div className="w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center font-black text-base border border-white/20 shrink-0 shadow-inner">
            {getRoleIcon()}
          </div>
          
          <div className="h-6 w-px bg-white/20 mx-1 hidden sm:block"></div>
          
          <div className="flex items-center gap-1">
              <button onClick={handleRefresh} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors" title="데이터 새로고침">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={handleSettings} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors hidden sm:flex" title="환경 설정">
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={logout} className="w-9 h-9 rounded-lg flex items-center justify-center text-red-300 hover:text-red-400 hover:bg-white/10 transition-colors" title="로그아웃">
                <Power className="w-4 h-4" />
              </button>
          </div>
      </div>
    </header>
  );
}
