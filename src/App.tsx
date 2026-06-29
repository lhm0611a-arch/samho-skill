import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import LoginOverlay from './components/LoginOverlay';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Evaluation from './components/Evaluation';
import Admin from './components/Admin';

function MainApp() {
  const { userRole, currentView } = useAppContext();

  if (!userRole) {
    return <LoginOverlay />;
  }

  return (
    <div className="font-kor h-screen flex flex-col selection:bg-[#00a859]/30 selection:text-white relative bg-[#030f1c] text-slate-200">
      <Header />
      <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'evaluation' && <Evaluation />}
        {currentView === 'admin' && <Admin />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
