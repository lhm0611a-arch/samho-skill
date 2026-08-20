import React, { useState, useRef } from 'react';
import { Database, Upload, Download, RefreshCw, Trash2, CheckCircle, Save, Sparkles, Loader2, FileSpreadsheet, Settings, Code, Code2, Copy, FileDown, Check } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import * as XLSX from 'xlsx';
import { 
  getKoreanGrade, 
  getKoreanPassText, 
  checkKoreanPass, 
  getSkillGradeByScore, 
  determineResult,
  normalizeAppNo, 
  normalizeName, 
  normalizeJob, 
  normalizeDob, 
  calculateAge, 
  normalizeE9, 
  normalizeType, 
  formatYYYYMMDD 
} from '../lib/utils';

export default function Admin() {
  const { candidates, setCandidates, globalLogs, setGlobalLogs, gasUrl, setGasUrl, fetchData, confCountry, setConfCountry, confAgency, setConfAgency } = useAppContext();
  
  const [tempUrl, setTempUrl] = useState(gasUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [uploadType, setUploadType] = useState('사전기량검증');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");
  const [showGasCodeModal, setShowGasCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 })
      });
      
      const data = await response.json();
      if (data.error) {
        alert('문항 생성 실패: ' + data.error);
      } else if (data.questions && data.questions.length > 0) {
        setGeneratedQuestions(data.questions);
        setSelectedQuestions(data.questions); // select all by default
        setShowQuestionModal(true);
      }
    } catch (e: any) {
      alert('문항 생성 중 오류가 발생했습니다: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'NO': 1,
        '응시번호': 'TM-001',
        '직종': '선각취부',
        '성명': 'PHAN HUU CUONG',
        '생년월일': '1986-10-18',
        'E-9': 'O'
      },
      {
        'NO': 2,
        '응시번호': 'C-001',
        '직종': '용접',
        '성명': 'LE VAN NAM',
        '생년월일': '1988-01-02',
        'E-9': 'O'
      },
      {
        'NO': 3,
        '응시번호': 'D-001',
        '직종': '의장취부',
        '성명': 'NGUYEN VAN DUNG',
        '생년월일': '1991-06-26',
        'E-9': 'X'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '평가명단');
    XLSX.writeFile(wb, 'HD현대삼호_평가명단_표준양식.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!confCountry || !confAgency) {
      alert('화면 상단의 검증 국가 및 송출 업체명을 먼저 입력 및 저장해주세요.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        let newCandidates: any[] = [];
        let newLogs: any[] = [];
        const seenUploadUids = new Map<string, number>();

        function parseCandidates(sheet: XLSX.WorkSheet, typeName: string) {
          if (!sheet) return [];
          const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          let headerIdx = -1;
          for (let i = 0; i < Math.min(json.length, 5); i++) {
            const rowStr = JSON.stringify(json[i]);
            if (rowStr.includes('NO') || rowStr.includes('성 명') || rowStr.includes('이름') || rowStr.includes('응시번호') || rowStr.includes('성명')) { headerIdx = i; break; }
          }
          
          const startIndex = headerIdx !== -1 ? headerIdx + 1 : 0;
          
          return json.slice(startIndex).map((r, index) => {
            try {
              if (!r || r.length < 2) return null;

              // A열: NO (r[0])
              const rowNo = parseInt(r[0]) || index + 1;

              // B열: 응시번호 (r[1]) -> 예: TM01 -> TM-001, C1 -> C-001, D-04 -> D-004
              const appNoRaw = normalizeAppNo(r[1]);
              if (!appNoRaw) return null;

              // C열: 직종 (r[2]) -> 용접, 선각취부, 의장취부 등
              const job = normalizeJob(r[2]);

              // D열: 성명 (r[3]) -> 대문자 및 공백 정리
              const candidateName = normalizeName(r[3]);

              // E열: 생년월일 (r[4]) -> 19820611, 820611, 82.06.11 등 어떠한 포맷도 1982-06-11로 정규화
              let dob = normalizeDob(r[4]);

              // F열: E-9 출신 여부 (r[5]) -> O 또는 X
              const e9 = normalizeE9(r[5]);

              // 나이: 생년월일 기준 만 나이 자동 정확 계산 (만 15세 이상)
              let age = calculateAge(dob);
              if ((age === 0 || age < 15) && r[6] !== undefined && r[6] !== null && String(r[6]).trim() !== '') {
                const parsedAge = parseInt(String(r[6]).replace(/[^0-9]/g, ''), 10);
                if (!isNaN(parsedAge) && parsedAge >= 15 && parsedAge <= 90) age = parsedAge;
              }
              if (age >= 15 && (!dob || dob.length < 10 || calculateAge(dob) < 15)) {
                dob = `${new Date().getFullYear() - age}-01-01`;
              }

              // 평가일자 (r[24] 또는 오늘 날짜)
              let eval_date = r[24] ? normalizeDob(r[24]) : '';

              // 기량/한국어 점수 (종합 시트인 경우)
              let k_score = parseInt(r[13]) || 0;
              let s_fit = parseInt(r[17]) || 0;
              let s_weld = parseInt(r[19]) || 0;

              const evalType = normalizeType(typeName);

              const baseUid = appNoRaw + '_' + candidateName + '_' + eval_date + '_' + evalType;
              const count = seenUploadUids.get(baseUid) || 0;
              seenUploadUids.set(baseUid, count + 1);
              const uniqueUid = count === 0 ? baseUid : `${baseUid}_${count}`;

              const tempCandidate = {
                id: appNoRaw,
                uid: uniqueUid,
                no: rowNo,
                app_no: appNoRaw,
                job: job,
                name: candidateName,
                dob: dob,
                age: age,
                e9: e9,
                country: r[22] || confCountry,
                agency: r[23] || confAgency,
                eval_type: evalType,
                eval_date: eval_date,
                k_score: k_score,
                k_grade: r[14] || (k_score > 0 ? getKoreanGrade(k_score) : '-'),
                k_pass: r[15] || (k_score > 0 ? getKoreanPassText(checkKoreanPass({ eval_type: evalType, age: age, k_score: k_score })) : ''),
                k_status: k_score > 0 ? '완료' : '대기',
                s_score_fit: s_fit,
                grade_fit: s_fit > 0 ? getSkillGradeByScore(s_fit) : '-',
                s_score_weld: s_weld,
                grade_weld: s_weld > 0 ? getSkillGradeByScore(s_weld) : '-',
                s_status: (s_fit > 0 || s_weld > 0) ? '완료' : '대기',
                result: r[21] || '대기'
              };

              // 자동 종합 결과 계산
              if (k_score > 0 || s_fit > 0 || s_weld > 0) {
                tempCandidate.result = determineResult(tempCandidate);
              }

              return tempCandidate;
            } catch (rowErr) {
              console.error('Row parse error', rowErr, r);
              return null;
            }
          }).filter(Boolean);
        }

        const sNames = wb.SheetNames;
        const hasSajeon = sNames.includes('사전기량검증');
        const hasBon = sNames.includes('본기량검증');
        const logName = sNames.find(n => n.toLowerCase() === 'log');

        if (hasSajeon || hasBon) {
          if (hasSajeon) newCandidates = newCandidates.concat(parseCandidates(wb.Sheets['사전기량검증'], '사전기량검증'));
          if (hasBon) newCandidates = newCandidates.concat(parseCandidates(wb.Sheets['본기량검증'], '본기량검증'));
          
          if (logName) {
            const logJson = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[logName], { header: 1, defval: '' });
            newLogs = logJson.slice(1).map(r => {
              if (!r[0]) return null;
              return {
                app_no: r[0], evaluator: r[1], score: parseInt(r[2]) || 0,
                timestamp: r[3], details: JSON.stringify([r[4], r[5], r[6], r[7], r[8], r[9]].map(Number)),
                name: r[10] ? String(r[10]).trim() : '',
                eval_type: r[11] ? String(r[11]).trim() : '사전기량검증'
              };
            }).filter(Boolean);
            
            newLogs.forEach(l => {
              let matches = newCandidates.filter(c => String(c.app_no) === String(l.app_no) && c.eval_type === l.eval_type);
              if (matches.length > 0) l.uid = matches[0].uid;
            });
          }
        } else {
          newCandidates = parseCandidates(wb.Sheets[sNames[0]], uploadType);
        }

        if (newCandidates.length === 0) {
          alert('유효한 데이터 구조를 찾을 수 없습니다.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        if (gasUrl && gasUrl.trim() !== '') {
            setIsUploading(true);
            try {
                const preList = newCandidates.filter(c => c.eval_type === '사전기량검증' || c.eval_type === '사전');
                const mainList = newCandidates.filter(c => c.eval_type === '본기량검증' || c.eval_type === '본');

                const CHUNK_SIZE = 30; // 안정적인 전송을 위한 30개 분할
                let totalChunks = Math.ceil(preList.length / CHUNK_SIZE) + Math.ceil(mainList.length / CHUNK_SIZE);
                let currentChunk = 0;

                const sendData = async (list: any[], typeName: string) => {
                    for (let i = 0; i < list.length; i += CHUNK_SIZE) {
                        currentChunk++;
                        setUploadProgressMsg(`명단 전송 중... (${currentChunk}/${totalChunks})`);
                        const chunk = list.slice(i, i + CHUNK_SIZE);
                        const payloadData = chunk.map(c => ({
                            no: c.no,
                            app_no: c.app_no,
                            job: c.job,
                            name: c.name,
                            dob: c.dob,
                            e9: c.e9,
                            age: c.age,
                            country: c.country,
                            agency: c.agency,
                            eval_date: c.eval_date,
                            k_score: c.k_score || 0,
                            k_grade: c.k_grade || '-',
                            k_pass: c.k_pass || '',
                            k_status: c.k_status || '대기',
                            s_score_fit: c.s_score_fit || 0,
                            grade_fit: c.grade_fit || '-',
                            s_score_weld: c.s_score_weld || 0,
                            grade_weld: c.grade_weld || '-',
                            s_status: c.s_status || '대기',
                            result: c.result || '대기',
                            eval_type: typeName // 백엔드 분류를 위해 추가
                        }));

                        await fetch(gasUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({
                                type: 'upload_multi',
                                candidates: payloadData,
                                logs: [] 
                            })
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                };

                if (preList.length > 0) await sendData(preList, '사전기량검증');
                if (mainList.length > 0) await sendData(mainList, '본기량검증');
                
                if (newLogs.length > 0) {
                    const LOG_CHUNK = 50;
                    const totalLogChunks = Math.ceil(newLogs.length / LOG_CHUNK);
                    for (let i = 0; i < newLogs.length; i += LOG_CHUNK) {
                        const currentLogChunk = Math.floor(i / LOG_CHUNK) + 1;
                        setUploadProgressMsg(`로그 전송 중... (${currentLogChunk}/${totalLogChunks})`);
                        const chunk = newLogs.slice(i, i + LOG_CHUNK);
                        await fetch(gasUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({
                                type: 'upload_multi',
                                candidates: [],
                                logs: chunk
                            })
                        });
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                alert(`서버 전송이 완료되었습니다.`);
                // Normally reload here, but we will fetch data to re-sync
                fetchData();

            } catch(e: any){
                alert('서버 연동 오류: ' + e.message);
            } finally {
                setIsUploading(false);
                setUploadProgressMsg("");
            }
        } else {
            const existingUids = new Set(candidates.map(c => c.uid));
            const uniqueNewCandidates = newCandidates.filter(c => !existingUids.has(c.uid));
            
            const nextCandidates = [...candidates, ...uniqueNewCandidates];
            setCandidates(nextCandidates);
            localStorage.setItem('hd_candidates', JSON.stringify(nextCandidates));
            
            const existingLogKeys = new Set(globalLogs.map(l => l.app_no + '_' + l.evaluator + '_' + l.eval_type));
            const uniqueNewLogs = newLogs.filter(l => !existingLogKeys.has(l.app_no + '_' + l.evaluator + '_' + l.eval_type));
            const nextLogs = [...globalLogs, ...uniqueNewLogs];
            setGlobalLogs(nextLogs);
            localStorage.setItem('hd_logs', JSON.stringify(nextLogs));
            
            if(uniqueNewCandidates.length === 0 && newCandidates.length > 0) {
                alert('업로드한 데이터가 이미 모두 시스템에 존재합니다 (중복 제외).');
            } else {
                alert(`로컬 업로드 성공: 신규 ${uniqueNewCandidates.length}건 추가 (중복 ${newCandidates.length - uniqueNewCandidates.length}건 제외)`);
            }
        }
      } catch (err: any) {
        alert('엑셀 파싱 중 시스템 오류가 발생했습니다: ' + err.message);
        console.error(err);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGasSave = () => {
      setGasUrl(tempUrl);
      localStorage.setItem('hd_gas_url', tempUrl);
      alert("Google Apps Script URL이 저장되었습니다.");
  };

  const saveUploadConfig = () => {
    if(!confCountry || !confAgency) return alert('검증 국가와 업체를 입력해주세요.');
    localStorage.setItem('hd_country', confCountry);
    localStorage.setItem('hd_agency', confAgency);
    alert('업로드 환경이 저장되었습니다.');
  }

  const handleClearAll = () => {
      const pw = prompt("모든 로컬 데이터가 삭제됩니다. 관리자 마스터 키를 입력하세요:");
      const adminPw = import.meta.env.VITE_ADMIN_PASSWORD || '1234';
      if (pw === adminPw) {
          setCandidates([]);
          setGlobalLogs([]);
          localStorage.removeItem('hd_candidates');
          localStorage.removeItem('hd_logs');
          alert("데이터가 초기화 되었습니다.");
      }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#030f1c] animate-in fade-in">
        <div className="max-w-[1400px] mx-auto space-y-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 시스템 설정 */}
                <div className="hud-card p-6 lg:col-span-1 border-t-2 border-t-blue-500 shadow-lg bg-[#08172c]">
                    <h3 className="text-xl font-black text-blue-300 flex items-center gap-2 mb-4 tracking-tight"><Database className="w-6 h-6 text-blue-400" /> 시스템 설정 및 연동</h3>
                    
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Google Apps Script URL 동기화</label>
                        <div className="space-y-3">
                            <input type="text" value={tempUrl} onChange={e=>setTempUrl(e.target.value)} className="dx-input bg-[#051326] border-[#1e3a5f] text-slate-300 font-mono text-sm w-full focus:border-blue-500" placeholder="https://script.google.com/macros/s/.../exec" />
                            <button onClick={handleGasSave} className="dx-btn-primary w-full py-3 text-sm font-black flex items-center justify-center gap-2 shadow-sm"><Save className="w-5 h-5" /> 시스템 연결 저장</button>
                        </div>
                        <div className="mt-4 p-3 bg-slate-800/80 rounded-sm border border-blue-800/50 shadow-inner">
                            <p className="text-xs text-blue-200 font-bold leading-relaxed flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-blue-400" /> 올바른 URL을 입력해야 동기화됩니다.</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-[#1e3a5f]">
                        <button onClick={() => setShowGasCodeModal(true)} className="bg-indigo-900/40 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-700 hover:text-white w-full py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                            <Code2 className="w-4 h-4 text-indigo-400" /> GAS 최신 서버 코드 확인 및 복사
                        </button>
                        <button onClick={handleClearAll} className="bg-red-900/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white w-full py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                            <Trash2 className="w-4 h-4" /> 시스템 로컬 초기화
                        </button>
                    </div>
                </div>

                {/* 명단 업로드 */}
                <div className="hud-card p-6 lg:col-span-2 border-t-2 border-t-purple-500 shadow-lg bg-[#08172c]">
                    <h3 className="text-xl font-black text-purple-300 flex items-center gap-2 mb-4 tracking-tight"><FileSpreadsheet className="w-6 h-6 text-purple-400" /> 평가 명단 일괄 구축 (Excel)</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                        <div>
                            <label className="block text-xs font-bold text-purple-400 mb-1.5">검증 단계 (단일 시트)</label>
                            <div className="flex bg-slate-900 p-1 rounded-sm border border-[#1e3a5f] h-[46px] shadow-inner">
                                <label className="flex-1 text-center cursor-pointer h-full">
                                    <input type="radio" name="upload_type" value="사전기량검증" checked={uploadType === '사전기량검증'} onChange={() => setUploadType('사전기량검증')} className="peer sr-only" />
                                    <div className="h-full flex items-center justify-center rounded-sm text-xs font-bold text-slate-400 peer-checked:bg-purple-900 peer-checked:text-white peer-checked:border peer-checked:border-purple-400 transition-all shadow-sm">사전기량</div>
                                </label>
                                <label className="flex-1 text-center cursor-pointer h-full">
                                    <input type="radio" name="upload_type" value="본기량검증" checked={uploadType === '본기량검증'} onChange={() => setUploadType('본기량검증')} className="peer sr-only" />
                                    <div className="h-full flex items-center justify-center rounded-sm text-xs font-bold text-slate-400 peer-checked:bg-purple-900 peer-checked:text-white peer-checked:border peer-checked:border-purple-400 transition-all shadow-sm">본기량</div>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-purple-400 mb-1.5">검증 국가</label>
                            <input type="text" value={confCountry} onChange={e => { setConfCountry(e.target.value); }} className="dx-input !py-2.5 !text-sm h-[46px] bg-[#051326] border-[#1e3a5f] focus:border-purple-500 font-bold text-purple-100" placeholder="예: 베트남" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-purple-400 mb-1.5">송출 업체명</label>
                            <input type="text" value={confAgency} onChange={e => { setConfAgency(e.target.value); }} className="dx-input !py-2.5 !text-sm h-[46px] bg-[#051326] border-[#1e3a5f] focus:border-purple-500 font-bold text-purple-100" placeholder="예: 코인파워" />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={saveUploadConfig} className="bg-slate-800 text-slate-200 border border-slate-500 px-4 py-3 rounded-sm text-sm font-black hover:bg-slate-700 hover:text-white hover:border-slate-400 transition-colors flex-1 flex items-center justify-center gap-2 tracking-wide shadow-md">
                            <Settings className="w-5 h-5" /> 업로드 환경 저장
                        </button>
                        <button onClick={handleDownloadTemplate} className="bg-blue-900/60 text-blue-200 border border-blue-500/50 hover:bg-blue-800 hover:text-white px-4 py-3 rounded-sm text-sm font-black transition-colors flex-1 flex items-center justify-center gap-2 tracking-wide shadow-md">
                            <FileDown className="w-5 h-5 text-blue-400" /> 표준 서식 다운로드
                        </button>
                        <input 
                            type="file" 
                            id="file-upload" 
                            className="hidden" 
                            accept=".xlsx,.xls" 
                            onChange={handleFileUpload} 
                            ref={fileInputRef}
                            disabled={isUploading}
                        />
                        <label htmlFor={isUploading ? "" : "file-upload"} className={`px-6 py-3 flex-1 flex items-center justify-center gap-2 border shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all ${isUploading ? 'bg-slate-700 border-slate-500 cursor-not-allowed text-slate-400' : 'dx-btn-success cursor-pointer border-emerald-400 hover:shadow-emerald-400/50'}`}>
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                                    <span className="font-black tracking-wide text-sm">{uploadProgressMsg || '업로드 중...'}</span>
                                </>
                            ) : (
                                <>
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" /> 
                                    <span className="font-black tracking-wide text-sm">명단 데이터 업로드 (.xlsx)</span>
                                </>
                            )}
                        </label>
                    </div>

                    <div className="mt-5 p-4 bg-slate-800/80 rounded-sm border border-[#1e3a5f] text-xs text-slate-300 font-bold leading-relaxed shadow-inner">
                        <p className="font-black text-purple-300 mb-2 text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-purple-400" /> 스마트 엑셀 자동 보정 및 데이터 가이드라인</p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li><strong className="text-blue-300">표준 열 구성 (A~F열)</strong>: <span className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">A: NO</span>, <span className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">B: 응시번호</span>, <span className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">C: 직종</span>, <span className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">D: 성명</span>, <span className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">E: 생년월일</span>, <span className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">F: E-9 여부</span></li>
                            <li><strong className="text-emerald-400">응시번호 3자리 자동 패딩</strong>: <code className="text-amber-300 font-mono bg-black/40 px-1 rounded">TM01</code>, <code className="text-amber-300 font-mono bg-black/40 px-1 rounded">TM-1</code> → <code className="text-emerald-300 font-mono bg-black/40 px-1 rounded">TM-001</code> / <code className="text-amber-300 font-mono bg-black/40 px-1 rounded">C1</code> → <code className="text-emerald-300 font-mono bg-black/40 px-1 rounded">C-001</code> / <code className="text-amber-300 font-mono bg-black/40 px-1 rounded">D-04</code> → <code className="text-emerald-300 font-mono bg-black/40 px-1 rounded">D-004</code> 자동 변환</li>
                            <li><strong className="text-emerald-400">성명 대문자 자동 변환</strong>: 소문자로 입력해도 시스템/서버에 영문 대문자(<code className="text-emerald-300 font-mono bg-black/40 px-1 rounded">PHAN HUU CUONG</code>)로 자동 등록</li>
                            <li><strong className="text-emerald-400">생년월일 및 만 나이 자동 계산</strong>: <code className="text-amber-300 font-mono bg-black/40 px-1 rounded">19820611</code>, <code className="text-amber-300 font-mono bg-black/40 px-1 rounded">820611</code>, <code className="text-amber-300 font-mono bg-black/40 px-1 rounded">82.06.11</code>, <code className="text-amber-300 font-mono bg-black/40 px-1 rounded">82-06-11</code> 등 어떤 형식이든 <code className="text-emerald-300 font-mono bg-black/40 px-1 rounded">1982-06-11</code>로 변환되고 <strong>만 나이가 자동 산출</strong>됩니다.</li>
                            <li><strong className="text-emerald-400">직종 표준화</strong>: <code className="text-emerald-300 font-mono bg-black/40 px-1 rounded">용접</code>, <code className="text-emerald-300 font-mono bg-black/40 px-1 rounded">선각취부</code>, <code className="text-emerald-300 font-mono bg-black/40 px-1 rounded">의장취부</code>로 정규화 매칭</li>
                            <li>파일 내 <strong className="text-white bg-slate-900 px-1 rounded border border-slate-600">'사전기량검증'</strong>, <strong className="text-white bg-slate-900 px-1 rounded border border-slate-600">'본기량검증'</strong>, <strong className="text-white bg-slate-900 px-1 rounded border border-slate-600">'log'</strong> 시트가 있으면 다중 시트 동시 파싱 지원</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="dx-card bg-[#08172c] border-[#1e3a5f] p-6 border-t-4 border-t-hd-green shadow-lg">
                <h3 className="text-xl font-black text-slate-100 flex items-center gap-3 mb-4 tracking-tight"><Sparkles className="w-6 h-6 text-purple-400" /> AI 한국어 문항 생성</h3>
                <p className="text-sm text-slate-300 mb-6 font-medium bg-[#0a1b35] border border-[#1e3a5f] p-4 rounded-xl leading-relaxed">
                    Gemini 3.5 Flash 모델을 사용하여 새로운 한국어 인터뷰 문항(기초~심화)을 자동으로 생성하고 평가 풀에 추가합니다. 생성된 문항에는 음성(TTS) 기능이 기본 제공됩니다.
                </p>
                <div className="flex justify-start">
                    <button 
                        onClick={handleGenerateQuestions} 
                        disabled={isGenerating}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl text-base font-bold shadow-lg flex items-center gap-2 transition-all">
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} 
                        {isGenerating ? 'AI가 문항을 생성 중입니다...' : '신규 문항 10개 생성하기'}
                    </button>
                </div>
            </div>

            <div className="dx-card p-5 text-center text-base font-medium text-slate-400 bg-[#08172c] border border-[#1e3a5f]">
                로컬 메모리에 현재 <strong className="text-blue-400 text-lg mx-1">{candidates.length}</strong>명의 데이터가 로드되어 있습니다.
            </div>

        </div>

            {showQuestionModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-[#08172c] border border-[#1e3a5f] rounded-xl p-6 w-full max-w-3xl shadow-2xl relative my-8">
                        <h3 className="text-xl font-black text-slate-100 flex items-center gap-3 mb-6"><Sparkles className="w-6 h-6 text-purple-400" /> 생성된 문항 검토</h3>
                        <p className="text-sm text-slate-300 mb-6 bg-[#0a1b35] border border-[#1e3a5f] p-4 rounded-xl">
                            AI가 생성한 문항 중 평가에 사용할 문항을 선택하세요. 선택된 문항은 평가 풀에 추가됩니다.
                        </p>
                        <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {generatedQuestions.map((q, idx) => (
                                <label key={idx} className="flex items-start gap-4 p-4 rounded-lg bg-[#0a1b35] border border-[#1e3a5f] cursor-pointer hover:bg-[#122849] transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedQuestions.includes(q)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedQuestions([...selectedQuestions, q]);
                                            else setSelectedQuestions(selectedQuestions.filter(sq => sq !== q));
                                        }}
                                        className="mt-1 w-5 h-5 rounded border-slate-600 text-purple-600 bg-slate-800 focus:ring-purple-500 focus:ring-offset-slate-900"
                                    />
                                    <span className="text-slate-200 font-medium leading-relaxed">{q}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowQuestionModal(false)}
                                className="px-5 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-all"
                            >
                                취소
                            </button>
                            <button 
                                onClick={() => {
                                    if (selectedQuestions.length === 0) return alert('선택된 문항이 없습니다.');
                                    const stored = localStorage.getItem('hd_custom_questions');
                                    let customList = stored ? JSON.parse(stored) : [];
                                    customList = [...customList, ...selectedQuestions];
                                    localStorage.setItem('hd_custom_questions', JSON.stringify(customList));
                                    alert(`${selectedQuestions.length}개의 신규 한국어 문항이 성공적으로 추가되었습니다.`);
                                    setShowQuestionModal(false);
                                }}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all flex items-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" />
                                선택한 문항 적용하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showGasCodeModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
                    <div className="bg-[#08172c] border border-[#1e3a5f] rounded-2xl p-6 w-full max-w-4xl shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between pb-4 border-b border-[#1e3a5f]">
                            <h3 className="text-xl font-black text-slate-100 flex items-center gap-3">
                                <Code2 className="w-6 h-6 text-indigo-400" /> Google Apps Script (GAS) 최신 연동 코드
                            </h3>
                            <button
                                onClick={() => setShowGasCodeModal(false)}
                                className="text-slate-400 hover:text-white px-3 py-1 rounded-lg bg-slate-800 text-sm font-bold"
                            >
                                닫기
                            </button>
                        </div>
                        <div className="py-3 text-xs text-slate-300 bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-4 my-3 space-y-1">
                            <p className="font-bold text-indigo-200">💡 구글 시트 배포 방법:</p>
                            <p>1. 구글 스프레드시트 메뉴에서 <strong>[확장 프로그램] → [Apps Script]</strong>를 엽니다.</p>
                            <p>2. 아래 코드를 전체 복사하여 <code className="text-amber-300 font-mono">코드.gs</code>에 붙여넣고 저장합니다.</p>
                            <p>3. 상단 <strong>[배포] → [새 배포]</strong> (또는 배포 관리에서 새 버전) 선택 후 유형을 <strong>웹 앱(Web App)</strong>으로 지정하고, 액세스 권한을 <strong>'모든 사용자(Anyone)'</strong>로 설정하여 배포합니다.</p>
                            <p>4. 생성된 웹 앱 URL을 복사하여 위 <strong>[Google Apps Script URL 동기화]</strong> 입력창에 붙여넣고 저장합니다.</p>
                        </div>
                        <div className="relative flex-1 min-h-[300px] overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#030f1c]">
                            <button
                                onClick={() => {
                                    const codeEl = document.getElementById("gas-code-content");
                                    if (codeEl) {
                                        navigator.clipboard.writeText(codeEl.innerText);
                                        setCopiedCode(true);
                                        setTimeout(() => setCopiedCode(false), 2000);
                                    }
                                }}
                                className="absolute top-3 right-3 z-10 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2 rounded-lg shadow-lg flex items-center gap-1.5 transition-all"
                            >
                                {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                                {copiedCode ? "복사 완료!" : "전체 코드 복사"}
                            </button>
                            <pre id="gas-code-content" className="p-4 text-xs font-mono text-slate-200 overflow-y-auto h-[350px] custom-scrollbar select-all leading-relaxed whitespace-pre">
{`function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var preSheet = ss.getSheetByName("사전기량검증");
    var mainSheet = ss.getSheetByName("본기량검증");
    var logSheet = ss.getSheetByName("로그");
    
    var applicants = [];
    var logs = [];
    
    function parseSheet(sheet, typeName) {
      if (!sheet) return;
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return;
      var headers = data[0];
      
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[1] && !row[3]) continue; // app_no 또는 name 없으면 스킵
        
        var no = row[0] || i;
        var app_no = String(row[1] || '').trim();
        var job = String(row[2] || '').trim();
        var name = String(row[3] || '').trim();
        var dob = row[4] ? String(row[4]).trim() : '';
        var e9 = String(row[5] || 'X').trim();
        var age = Number(row[6]) || 0;
        
        var q1 = Number(row[7]) || 0;
        var q2 = Number(row[8]) || 0;
        var q3 = Number(row[9]) || 0;
        var q4 = Number(row[10]) || 0;
        var q5 = Number(row[11]) || 0;
        var q6 = Number(row[12]) || 0;
        var k_score = Number(row[13]) || 0;
        var k_grade = String(row[14] || '-').trim();
        var k_pass = String(row[15] || '대기').trim();
        var s_score_weld = Number(row[17]) || 0;
        var grade_weld = String(row[18] || '-').trim();
        var s_score_fit = Number(row[19]) || 0;
        var grade_fit = String(row[20] || '-').trim();
        var result = String(row[21] || '대기').trim();
        var country = String(row[22] || '').trim();
        var agency = String(row[23] || '').trim();
        var eval_date = row[24] ? String(row[24]).trim() : '';
        
        applicants.push({
          no: no,
          app_no: app_no,
          job: job,
          name: name,
          dob: dob,
          e9: e9,
          age: age,
          eval_type: typeName,
          k_score: k_score,
          k_grade: k_grade,
          k_pass: k_pass,
          k_status: (k_score > 0 || k_pass === '합격' || k_pass === '불합격') ? '완료' : '대기',
          k_vals: [q1, q2, q3, q4, q5, q6],
          s_score_weld: s_score_weld,
          grade_weld: grade_weld,
          s_score_fit: s_score_fit,
          grade_fit: grade_fit,
          s_status: (s_score_weld > 0 || s_score_fit > 0) ? '완료' : '대기',
          result: result,
          country: country,
          agency: agency,
          eval_date: eval_date
        });
      }
    }
    
    parseSheet(preSheet, "사전기량검증");
    parseSheet(mainSheet, "본기량검증");
    
    if (logSheet) {
      var logData = logSheet.getDataRange().getValues();
      for (var j = 1; j < logData.length; j++) {
        var lRow = logData[j];
        if (!lRow[0] && !lRow[1]) continue;
        logs.push({
          eval_date: String(lRow[0] || ''),
          eval_type: String(lRow[1] || ''),
          evaluator: String(lRow[2] || ''),
          app_no: String(lRow[3] || ''),
          score: Number(lRow[4]) || 0,
          details: String(lRow[5] || '[]'),
          name: String(lRow[6] || '')
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      applicants: applicants,
      logs: logs
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var evalType = data.eval_type || "사전기량검증";
    var sheetName = evalType.indexOf("본") !== -1 ? "본기량검증" : "사전기량검증";
    var targetSheet = ss.getSheetByName(sheetName);
    var logSheet = ss.getSheetByName("로그");
    
    if (!targetSheet) {
      targetSheet = ss.insertSheet(sheetName);
      targetSheet.appendRow([
        "연번", "수험번호", "직종", "성명", "생년월일", "E-9여부", "만나이",
        "언어이해", "발음명확성", "문법구성", "어휘활용", "표현력", "질의응답",
        "한국어총점", "한국어등급", "한국어판정", "면접관의견",
        "기량용접점수", "기량용접등급", "기량취부점수", "기량취부등급", "최종결과",
        "국가", "송출업체", "평가일자"
      ]);
    }
    
    var appNo = String(data.app_no || data.id || '').trim();
    var name = String(data.name || '').trim();
    var saveMode = String(data.save_mode || data.mode || data.type || '').toLowerCase();
    var isReset = (data.type === 'reset' || data.action === 'reset');
    
    // 1. 점수 초기화 (RESET) 처리
    if (isReset) {
      if (targetSheet) {
        var sData = targetSheet.getDataRange().getValues();
        for (var r = 1; r < sData.length; r++) {
          var rowAppNo = String(sData[r][1] || '').trim();
          var rowName = String(sData[r][3] || '').trim();
          if (rowAppNo === appNo || (name && rowName === name)) {
            var rowIdx = r + 1;
            if (saveMode === 'korean') {
              // 한국어 관련 컬럼 초기화 (H열 ~ P열)
              targetSheet.getRange(rowIdx, 8, 1, 9).setValues([[0, 0, 0, 0, 0, 0, 0, "-", "대기"]]);
            } else {
              // 기량 관련 컬럼 초기화 (R열 ~ U열) 및 의견(Q열)
              targetSheet.getRange(rowIdx, 17, 1, 5).setValues([["", 0, "-", 0, "-"]]);
            }
            // 최종 판정(V열) 갱신
            targetSheet.getRange(rowIdx, 22).setValue("대기");
            break;
          }
        }
      }
      
      // 로그 시트에서 해당 수험자의 로그 삭제
      if (logSheet && saveMode === 'korean') {
        var lData = logSheet.getDataRange().getValues();
        for (var lr = lData.length - 1; lr >= 1; lr--) {
          var logAppNo = String(lData[lr][3] || '').trim();
          var logType = String(lData[lr][1] || '').trim();
          if (logAppNo === appNo && (logType.indexOf(evalType) !== -1 || evalType.indexOf(logType) !== -1)) {
            logSheet.deleteRow(lr + 1);
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Reset completed successfully"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. 점수 저장 (SAVE) 처리
    if (targetSheet) {
      var sData2 = targetSheet.getDataRange().getValues();
      var foundRow = -1;
      for (var r2 = 1; r2 < sData2.length; r2++) {
        var rowAppNo2 = String(sData2[r2][1] || '').trim();
        var rowName2 = String(sData2[r2][3] || '').trim();
        if (rowAppNo2 === appNo || (name && rowName2 === name)) {
          foundRow = r2 + 1;
          break;
        }
      }
      
      var q1 = Number(data.q1 || 0);
      var q2 = Number(data.q2 || 0);
      var q3 = Number(data.q3 || 0);
      var q4 = Number(data.q4 || 0);
      var q5 = Number(data.q5 || 0);
      var q6 = Number(data.q6 || 0);
      var kScore = Number(data.k_score || 0);
      var kGrade = String(data.k_grade || '-');
      var kPass = String(data.k_pass || '대기');
      var sWeld = Number(data.s_score_weld || 0);
      var gWeld = String(data.grade_weld || '-');
      var sFit = Number(data.s_score_fit || 0);
      var gFit = String(data.grade_fit || '-');
      var memo = String(data.memo || '');
      var result = String(data.result || '대기');
      var evalDate = String(data.eval_date || '');
      var country = String(data.country || '');
      var agency = String(data.agency || '');
      
      if (foundRow !== -1) {
        if (saveMode === 'korean') {
          targetSheet.getRange(foundRow, 8, 1, 9).setValues([[q1, q2, q3, q4, q5, q6, kScore, kGrade, kPass]]);
        } else {
          targetSheet.getRange(foundRow, 17, 1, 5).setValues([[memo, sWeld, gWeld, sFit, gFit]]);
        }
        targetSheet.getRange(foundRow, 22).setValue(result);
        if (evalDate) targetSheet.getRange(foundRow, 25).setValue(evalDate);
        if (country) targetSheet.getRange(foundRow, 23).setValue(country);
        if (agency) targetSheet.getRange(foundRow, 24).setValue(agency);
      }
    }
    
    // 로그 시트에 면접관별 평가 기록 추가
    if (logSheet && saveMode === 'korean') {
      var evaluator = String(data.evaluator || data.evaluator_name || '평가위원').trim();
      var details = JSON.stringify(data.details || [q1, q2, q3, q4, q5, q6]);
      var myScore = Number(data.my_score || data.score || kScore);
      
      // 동일 면접관의 기존 평가 로그가 있으면 업데이트 또는 추가
      logSheet.appendRow([
        evalDate || new Date().toISOString().substring(0, 10),
        evalType,
        evaluator,
        appNo,
        myScore,
        details,
        name
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Save completed successfully"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`}
                            </pre>
                        </div>
                        <div className="flex justify-end pt-4 border-t border-[#1e3a5f] mt-4">
                            <button
                                onClick={() => setShowGasCodeModal(false)}
                                className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-2.5 rounded-xl transition-all"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </div>
  );
}
