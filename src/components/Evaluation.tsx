import React, { useState, useEffect, useMemo } from "react";
import {
  UserSearch,
  ChevronDown,
  FileQuestion,
  Shuffle,
  ChevronRight,
  Languages,
  HardHat,
  Save,
  RotateCcw,
  PenTool,
  Flame,
  Ruler,
  AlertTriangle,
  CircleAlert,
  Ear,
  Mic,
  BookOpen,
  MessagesSquare,
  UserCheck,
  Volume2,
} from "lucide-react";
import { useAppContext } from "../context/AppContext";
import {
  QUESTIONS_DB,
  CRITERIA,
  SCORES_10,
  SCORES_20,
  SCORE_LABELS,
} from "../data";
import {
  getKoreanGrade,
  getKoreanPassText,
  checkKoreanPass,
  checkSkillPass,
  determineResult,
  getSkillGradeByScore,
  getBadgeHtml,
} from "../lib/utils";

export default function Evaluation() {
  const {
    candidates,
    setCandidates,
    globalLogs,
    setGlobalLogs,
    userRole,
    evaluatorName,
    gasUrl,
    fetchData,
    selectedCandidateUid,
    setSelectedCandidateUid,
  } = useAppContext();

  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterAgency, setFilterAgency] = useState("all");

  const [currentTab, setCurrentTab] = useState<"korean" | "skill">("korean");
  const selectedUid = selectedCandidateUid;
  const setSelectedUid = setSelectedCandidateUid;

  const [qSets, setQSets] = useState<number[]>([]);
  const [qPage, setQPage] = useState(0);
  const [activeQuestions, setActiveQuestions] =
    useState<string[][]>(QUESTIONS_DB);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("hd_custom_questions");
      if (stored) {
        const customList: string[] = JSON.parse(stored);
        if (customList.length > 0) {
          // split custom questions into sets of 10
          const newSets: string[][] = [];
          for (let i = 0; i < customList.length; i += 10) {
            newSets.push(customList.slice(i, i + 10));
          }
          setActiveQuestions([...QUESTIONS_DB, ...newSets]);
        }
      }
    } catch (e) {}
  }, []);

  const [kVals, setKVals] = useState<number[]>([2, 2, 2, 2, 2, 2]);
  const [sWeld, setSWeld] = useState<string>("");
  const [sFit, setSFit] = useState<string>("");
  const [sMemo, setSMemo] = useState<string>("");

  const validDates = useMemo(
    () =>
      Array.from(
        new Set(
          candidates
            .filter(
              (c) =>
                (filterType === "all" || c.eval_type === filterType) &&
                (filterCountry === "all" || c.country === filterCountry) &&
                (filterAgency === "all" || c.agency === filterAgency),
            )
            .map((c) => c.eval_date)
            .filter(Boolean),
        ),
      )
        .sort()
        .reverse(),
    [candidates, filterType, filterCountry, filterAgency],
  );
  const validCountries = useMemo(
    () =>
      Array.from(
        new Set(
          candidates
            .filter(
              (c) =>
                (filterType === "all" || c.eval_type === filterType) &&
                (filterDate === "all" || c.eval_date === filterDate) &&
                (filterAgency === "all" || c.agency === filterAgency),
            )
            .map((c) => c.country)
            .filter(Boolean),
        ),
      ).sort(),
    [candidates, filterType, filterDate, filterAgency],
  );
  const validAgencies = useMemo(
    () =>
      Array.from(
        new Set(
          candidates
            .filter(
              (c) =>
                (filterType === "all" || c.eval_type === filterType) &&
                (filterDate === "all" || c.eval_date === filterDate) &&
                (filterCountry === "all" || c.country === filterCountry),
            )
            .map((c) => c.agency)
            .filter(Boolean),
        ),
      ).sort(),
    [candidates, filterType, filterDate, filterCountry],
  );

  const filteredCandidates = useMemo(() => {
    return candidates
      .filter((c) => {
        if (selectedUid && c.uid === selectedUid) return true;
        if (filterType !== "all" && c.eval_type !== filterType) return false;
        if (filterDate !== "all" && c.eval_date !== filterDate) return false;
        if (filterCountry !== "all" && c.country !== filterCountry)
          return false;
        if (filterAgency !== "all" && c.agency !== filterAgency) return false;

        const isFit = (c.job || "").includes("취부");
        const hasSkillScore = isFit
          ? (c.s_score_weld || 0) > 0 && (c.s_score_fit || 0) > 0
          : (c.s_score_weld || 0) > 0;
        const isSkillDone = c.s_status === "완료" || hasSkillScore;
        const isKoreanDone = (c.k_score || 0) > 0;

        if (userRole === "interviewer") {
          const myKoreanLog = globalLogs.find(
            (l) =>
              String(l.app_no) === String(c.app_no) &&
              l.eval_type === c.eval_type &&
              l.evaluator === evaluatorName,
          );
          if (myKoreanLog || isKoreanDone) return false;
        } else {
          if (isKoreanDone && isSkillDone) return false;
        }
        return true;
      })
      .sort((a: any, b: any) =>
        String(a.app_no).localeCompare(String(b.app_no), "en", {
          numeric: true,
        }),
      );
  }, [
    candidates,
    filterType,
    filterDate,
    filterCountry,
    filterAgency,
    selectedUid,
    userRole,
    globalLogs,
    evaluatorName,
  ]);

  useEffect(() => {
    if (
      filteredCandidates.length > 0 &&
      (!selectedUid || !filteredCandidates.find((c) => c.uid === selectedUid))
    ) {
      setSelectedUid(filteredCandidates[0].uid);
    }
  }, [filteredCandidates, selectedUid, setSelectedUid]);

  const currentCandidate = useMemo(
    () => candidates.find((c) => c.uid === selectedUid) || null,
    [candidates, selectedUid],
  );

  useEffect(() => {
    if (currentCandidate) loadCandidateData(currentCandidate);
  }, [currentCandidate]);

  const loadCandidateData = (p: any) => {
    const myLog = [...globalLogs]
      .reverse()
      .find(
        (l) =>
          String(l.app_no) === String(p.app_no) &&
          l.evaluator === evaluatorName &&
          l.eval_type === p.eval_type,
      );
    let parsedVals = [0, 0, 0, 0, 0, 0];
    let isMyComplete = false;
    if (myLog && myLog.details) {
      try {
        parsedVals = JSON.parse(myLog.details);
        isMyComplete = true;
      } catch (e) {}
    }
    let newKVals = [2, 2, 2, 2, 2, 2];
    if (isMyComplete && !parsedVals.every((v) => v === 0)) {
      for (let i = 1; i <= 6; i++) {
        let val = parsedVals[i - 1];
        let idx = 2;
        const max = i === 2 || i === 6 ? 10 : 20;
        if (max === 20) {
          if (val === 4) idx = 0;
          else if (val === 8) idx = 1;
          else if (val === 12) idx = 2;
          else if (val === 16) idx = 3;
          else if (val === 20) idx = 4;
        } else {
          if (val === 2) idx = 0;
          else if (val === 4) idx = 1;
          else if (val === 6) idx = 2;
          else if (val === 8) idx = 3;
          else if (val === 10) idx = 4;
        }
        newKVals[i - 1] = idx;
      }
    }
    setKVals(newKVals);
    setSWeld(p.s_score_weld ? String(p.s_score_weld) : "");
    setSFit(p.s_score_fit ? String(p.s_score_fit) : "");
    setSMemo(p.memo || "");
    manualShuffle(p.name);
  };

  const manualShuffle = (seedName?: string) => {
    const name = seedName || currentCandidate?.name || "";
    if (!name) return;
    let seed = 0;
    for (let i = 0; i < name.length; i++) seed += name.charCodeAt(i);
    const newSets: number[] = [];
    let indices = Array.from({ length: activeQuestions.length }, (_, i) => i);
    for (let i = 0; i < 3; i++) {
      let idx = (seed + i * 7) % indices.length;
      if (seedName === undefined)
        idx = Math.floor(Math.random() * indices.length);
      newSets.push(indices[idx]);
      if (indices.length > 1) {
        indices.splice(idx, 1);
      }
    }
    setQSets(newSets);
    setQPage(0);
  };

  const [playingTTS, setPlayingTTS] = useState<string | null>(null);

  const handlePlayTTS = async (text: string) => {
    if (playingTTS) return;

    setPlayingTTS(text);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (data.error) {
        console.error("TTS Error:", data.error);
        alert("음성 합성 오류: " + data.error);
        setPlayingTTS(null);
        return;
      }

      if (data.audioBase64) {
        const audio = new Audio(
          `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`,
        );
        try {
          await audio.play();
          audio.onended = () => setPlayingTTS(null);
          audio.onerror = (e) => {
            console.error("Audio playback error:", e);
            setPlayingTTS(null);
          };
        } catch(e) {
          console.error("Audio play blocked/failed:", e);
          setPlayingTTS(null);
        }
      } else {
        setPlayingTTS(null);
      }
    } catch (e: any) {
      console.error("TTS fetch error:", e);
      alert("음성 재생 중 오류가 발생했습니다.");
      setPlayingTTS(null);
    }
  };

  const calcKoreanTotal = () => {
    let total = 0;
    for (let i = 1; i <= 6; i++) {
      const v = kVals[i - 1];
      const max = i === 2 || i === 6 ? 10 : 20;
      total += max === 10 ? SCORES_10[v] : SCORES_20[v];
    }
    return total;
  };

  const handleSave = async () => {
    if (!currentCandidate) return alert("대상자 없음");
    const p = { ...currentCandidate };
    const executeSave = async () => {
      let saveMode = "";
      let individualScore = 0;
      const now = new Date();
      p.eval_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      if (currentTab === "korean") {
        let myTotal = 0,
          actualScores = [];
        for (let i = 1; i <= 6; i++) {
          const v = kVals[i - 1];
          const max = i === 2 || i === 6 ? 10 : 20;
          const s = max === 10 ? SCORES_10[v] : SCORES_20[v];
          actualScores.push(s);
          myTotal += s;
        }
        individualScore = myTotal;
        let newLogs = globalLogs.filter(
          (l) =>
            !(
              String(l.app_no) === String(p.app_no) &&
              l.evaluator === evaluatorName &&
              l.eval_type === p.eval_type
            ),
        );
        newLogs.push({
          app_no: p.app_no,
          eval_date: p.eval_date,
          eval_type: p.eval_type,
          evaluator: evaluatorName,
          score: individualScore,
          details: JSON.stringify(actualScores),
          name: p.name,
        });
        const applicantLogs = newLogs.filter(
          (l) =>
            String(l.app_no) === String(p.app_no) &&
            l.eval_type === p.eval_type,
        );
        let sum = 0;
        let detailedSums = [0, 0, 0, 0, 0, 0];
        applicantLogs.forEach((l) => {
          sum += l.score;
          try {
            let d = JSON.parse(l.details);
            for (let i = 0; i < 6; i++) detailedSums[i] += d[i] || 0;
          } catch (e) {}
        });
        let avgScore =
          applicantLogs.length > 0 ? Math.round(sum / applicantLogs.length) : 0;
        let avgDetailed = detailedSums.map((v) =>
          applicantLogs.length > 0 ? Math.round(v / applicantLogs.length) : 0,
        );
        p.k_vals = actualScores;
        p.k_scores_actual = actualScores;
        p.k_score = avgScore;
        p.k_grade = getKoreanGrade(avgScore);
        p.k_pass = getKoreanPassText(checkKoreanPass(p));
        p.avg_detailed = avgDetailed;
        p.k_status = "완료";
        saveMode = "korean";
        setGlobalLogs(newLogs);
      } else {
        const wV = parseInt(sWeld) || 0;
        const fV = parseInt(sFit) || 0;
        const isFit = (p.job || "").includes("취부");
        if (isFit && (!sWeld || !sFit))
          return alert("취부 직종은 용접/취부 점수를 일괄 입력해야 합니다.");
        if (!isFit && !sWeld) return alert("용접 점수를 입력하세요.");
        p.s_score_weld = wV;
        p.grade_weld = getSkillGradeByScore(wV);
        p.s_score_fit = fV;
        p.grade_fit = getSkillGradeByScore(fV);
        p.memo = sMemo;
        p.s_status = "완료";
        saveMode = "skill";
      }
      p.result = determineResult(p);
      setCandidates(candidates.map((c) => (c.id === p.id ? p : c)));

      const list = filteredCandidates;
      const curIdx = list.findIndex((c) => c.uid === p.uid);
      let nextId = null;
      if (currentTab === "korean") {
        for (let i = 1; i < list.length; i++) {
          const next = list[(curIdx + i) % list.length];
          const hasMyLog = globalLogs.some(
            (l) =>
              String(l.app_no) === String(next.app_no) &&
              l.eval_type === next.eval_type &&
              l.evaluator === evaluatorName,
          );
          if (!hasMyLog) {
            nextId = next.uid;
            break;
          }
        }
      } else {
        for (let i = 1; i < list.length; i++) {
          const next = list[(curIdx + i) % list.length];
          if (next.s_status !== "완료") {
            nextId = next.uid;
            break;
          }
        }
      }
      alert("저장되었습니다.");
      if (nextId) setSelectedUid(nextId);

      if (gasUrl && gasUrl.trim() !== "") {
        try {
          await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              ...p,
              type: "save",
              save_mode: saveMode,
              evaluator_name: evaluatorName,
              my_score: individualScore,
              avg_detailed: p.avg_detailed,
              k_grade: p.k_grade,
              k_pass: p.k_pass,
              eval_date: p.eval_date,
            }),
          });
        } catch (e) {}
      }
    };

    let isAlreadyCompleted = false;
    if (currentTab === "korean") {
      const myLog = globalLogs.find(
        (l) =>
          String(l.app_no) === String(p.app_no) &&
          l.eval_type === p.eval_type &&
          l.evaluator === evaluatorName,
      );
      if (myLog) isAlreadyCompleted = true;
    } else {
      const isFit = (p.job || "").includes("취부");
      const hasSkillScore = isFit
        ? (p.s_score_weld || 0) > 0 && (p.s_score_fit || 0) > 0
        : (p.s_score_weld || 0) > 0;
      if (p.s_status === "완료" || hasSkillScore) isAlreadyCompleted = true;
    }

    if (isAlreadyCompleted) {
      if (
        window.confirm(
          `[${p.name}] 지원자는 본인이 이미 평가를 완료했습니다.\n새로운 점수로 덮어쓰시겠습니까?`,
        )
      )
        executeSave();
    } else {
      executeSave();
    }
  };

  const handleReset = async () => {
    if (!currentCandidate) return;
    if (
      !window.confirm(
        `[${currentCandidate.name}] 지원자의 평가 기록을 초기화하시겠습니까?\n(저장 시 모든 평가자의 기존 점수가 영구 삭제됩니다)`,
      )
    )
      return;
    const p = { ...currentCandidate };
    if (currentTab === "korean") {
      p.k_score = 0;
      p.k_grade = "-";
      p.k_pass = "대기";
      p.k_vals = [];
      p.k_scores_actual = [];
      p.k_status = "대기";
      setGlobalLogs(
        globalLogs.filter(
          (l) =>
            !(
              String(l.app_no) === String(p.app_no) &&
              l.eval_type === p.eval_type
            ),
        ),
      );
    } else {
      p.s_score_weld = 0;
      p.grade_weld = "-";
      p.s_score_fit = 0;
      p.grade_fit = "-";
      p.memo = "";
      p.s_status = "대기";
    }
    p.eval_date = "";
    p.result = determineResult(p);
    setCandidates(candidates.map((c) => (c.id === p.id ? p : c)));
    loadCandidateData(p);

    if (gasUrl && gasUrl.trim() !== "") {
      try {
        await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            type: "reset",
            app_no: p.app_no,
            eval_type: p.eval_type,
            save_mode: currentTab,
            name: p.name,
            eval_date: "",
            k_grade: "-",
            k_pass: "대기",
          }),
        });
      } catch (e) {}
    }
    alert("초기화되었습니다.");
  };

  const isFit = currentCandidate
    ? (currentCandidate.job || "").includes("취부")
    : false;
  const isPre = currentCandidate
    ? currentCandidate.eval_type === "사전기량검증" ||
      currentCandidate.eval_type === "사전"
    : true;
  const weldPassCriteriaText = isPre
    ? "51점 이상 합격 기준"
    : "61점 이상 합격 기준";
  const fitPassCriteriaText = isPre
    ? "41점 이상 합격 기준"
    : "51점 이상 합격 기준";
  const myKoreanLog = currentCandidate
    ? globalLogs.find(
        (l) =>
          String(l.app_no) === String(currentCandidate.app_no) &&
          l.evaluator === evaluatorName &&
          l.eval_type === currentCandidate.eval_type,
      )
    : null;
  const showReset =
    currentCandidate &&
    (currentTab === "korean"
      ? !!myKoreanLog
      : currentCandidate.s_status === "완료");

  return (
    <div className="h-full flex flex-col animate-in fade-in bg-[#030f1c]">
      <div className="bg-[#051326] border-b border-[#1e3a5f] px-3 md:px-5 py-2 md:py-3 flex flex-col xl:flex-row gap-3 md:gap-4 xl:items-center shrink-0 z-30 relative shadow-sm">
        <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 w-full xl:w-auto shrink-0">
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3 w-full lg:w-auto shrink-0">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="dx-input !py-1.5 md:!py-2 !text-xs md:!text-sm cursor-pointer w-full md:w-32 bg-[#08172c]"
            >
              <option value="all">검증 전체</option>
              <option value="사전기량검증">사전기량</option>
              <option value="본기량검증">본기량</option>
            </select>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="dx-input !py-1.5 md:!py-2 !text-xs md:!text-sm cursor-pointer w-full md:w-32 bg-[#08172c]"
            >
              <option value="all">전체 날짜</option>
              {validDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="dx-input !py-1.5 md:!py-2 !text-xs md:!text-sm cursor-pointer w-full md:w-32 bg-[#08172c]"
            >
              <option value="all">전체 국가</option>
              {validCountries.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={filterAgency}
              onChange={(e) => setFilterAgency(e.target.value)}
              className="dx-input !py-1.5 md:!py-2 !text-xs md:!text-sm cursor-pointer w-full md:w-32 bg-[#08172c]"
            >
              <option value="all">전체 업체</option>
              {validAgencies.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-slate-700 hidden lg:block self-center mx-1"></div>

          <div className="relative w-full lg:w-64 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UserSearch className="text-blue-400 w-4 h-4 md:w-5 md:h-5" />
            </div>
            <select
              value={selectedUid || ''}
              onChange={(e) => setSelectedUid(e.target.value)}
              disabled={filteredCandidates.length === 0}
              className="dx-input w-full pl-9 md:pl-10 pr-8 !py-1.5 md:!py-2.5 font-black text-xs md:text-sm text-blue-300 cursor-pointer appearance-none bg-[#08172c] border-[#3b82f6]/50 focus:border-blue-400"
            >
              {filteredCandidates.length === 0 && (
                <option value="">평가 대상 없음</option>
              )}
              {filteredCandidates.map((c) => {
                let label = `[${c.app_no}] ${c.name} (${c.eval_date || "미응시"})`;
                const myLog = globalLogs.find(
                  (l) =>
                    String(l.app_no) === String(c.app_no) &&
                    l.evaluator === evaluatorName &&
                    l.eval_type === c.eval_type,
                );
                if (myLog) label += " (완료)";
                const isFit = (c.job || "").includes("취부");
                const hasSkillScore = isFit
                  ? (c.s_score_weld || 0) > 0 && (c.s_score_fit || 0) > 0
                  : (c.s_score_weld || 0) > 0;
                if (c.s_status === "완료" || hasSkillScore) label += " [기]";
                return (
                  <option key={c.uid} value={c.uid}>
                    {label}
                  </option>
                );
              })}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown className="text-slate-400 w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-between xl:justify-start gap-1 sm:gap-2 md:gap-3 xl:gap-4 overflow-hidden whitespace-nowrap bg-[#08172c] border border-[#1e3a5f] rounded-xl px-2 sm:px-3 md:px-4 lg:px-5 py-2 text-[10px] sm:text-xs md:text-sm shadow-inner w-full">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-slate-400 font-bold hidden sm:inline">이름</span>
            <span className="font-black text-slate-100 text-[11px] sm:text-xs md:text-sm lg:text-base truncate max-w-[60px] sm:max-w-none">
              {currentCandidate?.name || "-"}
            </span>
          </div>
          <div className="w-px h-3 md:h-4 bg-slate-700 shrink-0"></div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-slate-400 font-bold hidden sm:inline">나이</span>
            <span className="font-bold text-blue-400 text-[11px] sm:text-xs md:text-sm lg:text-base">
              {currentCandidate
                ? `${currentCandidate.age}/${currentCandidate.dob ? new Date(currentCandidate.dob).getFullYear() : "-"}`
                : "-"}
            </span>
          </div>
          <div className="w-px h-3 md:h-4 bg-slate-700 shrink-0"></div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-slate-400 font-bold hidden sm:inline">E-9</span>
            <span className="font-bold text-blue-400 text-[11px] sm:text-xs md:text-sm lg:text-base truncate max-w-[40px] sm:max-w-none">
              {currentCandidate?.e9 || "-"}
            </span>
          </div>
          <div className="w-px h-3 md:h-4 bg-slate-700 shrink-0"></div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-slate-400 font-bold hidden sm:inline">직종</span>
            <span className="font-black text-hd-green text-[11px] sm:text-xs md:text-sm lg:text-base truncate max-w-[50px] sm:max-w-none">
              {currentCandidate?.job || "-"}
            </span>
          </div>
          <div className="w-px h-3 md:h-4 bg-slate-700 shrink-0"></div>
          <span className="scale-75 sm:scale-90 lg:scale-100 origin-left shrink-0"
            dangerouslySetInnerHTML={{
              __html: currentCandidate
                ? getBadgeHtml(currentCandidate.eval_type)
                : "-",
            }}
          ></span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-3 md:gap-4 p-3 md:p-4 max-w-[1800px] mx-auto w-full">
        <div
          className={`dx-card ${userRole === "interviewer" ? "w-full" : "w-full md:w-5/12"} flex-[1] md:flex-none flex flex-col relative min-h-0 overflow-hidden bg-[#08172c]`}
        >
          <div className="p-3 md:p-4 border-b border-[#1e3a5f] bg-[#051326] flex justify-between items-center sticky top-0 z-10">
            <span className="font-black text-slate-100 text-sm md:text-base flex items-center gap-2" style={{ textAlign: 'left' }}>
              <FileQuestion className="text-blue-400 w-4 h-4 md:w-5 md:h-5" /> 인터뷰 스크립트
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => manualShuffle()}
                className="bg-[#0a1b35] border border-[#1e3a5f] hover:bg-[#1e3a5f] text-slate-300 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1 md:gap-1.5 shadow-sm"
              >
                <Shuffle className="w-3 h-3 md:w-4 md:h-4" />{" "}
                <span className="hidden xl:inline">문항 셔플</span>
              </button>
              <div className="flex items-center gap-1 md:gap-2 bg-[#0a1b35] px-2 py-1 rounded-lg border border-[#1e3a5f] shadow-sm ml-1">
                <span className="px-1 md:px-2 text-xs md:text-sm font-bold text-slate-300 tracking-wide" style={{ textAlign: 'center', fontSize: '12px' }}>
                  {qPage + 1} / 3 (SET {(qSets[qPage] || 0) + 1})
                </span>
                <button
                  onClick={() => setQPage((prev) => (prev + 1) % 3)}
                  className="hover:bg-[#1e3a5f] text-slate-400 hover:text-slate-200 w-6 h-6 md:w-7 md:h-7 rounded-md flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-[#030f1c]">
            {qSets[qPage] !== undefined &&
              activeQuestions[qSets[qPage]]?.map((qStr, idx) => {
                const [q] = qStr.split("→");
                const isNew = q.includes("[신규]");
                const cleanQ = q.replace("[신규]", "").trim();
                return (
                  <div
                    key={idx}
                    className="p-[5px] mb-[5px] rounded-xl bg-[#08172c] border border-[#1e3a5f] hover:border-blue-500/50 hover:shadow-lg transition-all relative overflow-hidden group min-h-[53px] flex items-center"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5 bg-slate-700 group-hover:bg-blue-500 transition-colors"></div>
                    <div className="flex justify-between items-center gap-2 md:gap-3 w-full pl-2">
                      <p className="font-bold text-slate-200 text-[13px] md:text-sm leading-snug flex-1 flex items-center text-left min-h-[42px]">
                        <span className="text-blue-400 mr-1.5 md:mr-2 text-sm md:text-base shrink-0">
                          Q{idx + 1}.
                        </span>
                        <span className="break-keep flex-1">{cleanQ}
                          {isNew && (
                            <span className="font-black ml-2 text-[9px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30 align-middle inline-block">
                              NEW
                            </span>
                          )}
                        </span>
                      </p>
                      <button
                        onClick={() => handlePlayTTS(cleanQ)}
                        disabled={playingTTS === cleanQ}
                        className="p-1.5 md:p-2 rounded-full hover:bg-[#1e3a5f] text-blue-400 transition-colors shrink-0 disabled:opacity-50"
                        title="음성으로 듣기"
                      >
                        {playingTTS === cleanQ ? (
                          <Volume2 className="w-4 h-4 md:w-5 md:h-5 animate-pulse text-purple-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {userRole !== "interviewer" && (
          <div className="dx-card w-full md:w-7/12 flex-[2] md:flex-none flex flex-col relative min-h-0 overflow-hidden bg-[#08172c]">
            <div className="flex border-b border-[#1e3a5f] bg-[#051326] p-2 md:p-3 gap-2 md:gap-3">
              <button
                onClick={() => setCurrentTab("korean")}
                className={`flex-1 h-[45px] rounded-xl text-sm md:text-base font-black transition-all flex items-center justify-center gap-2 ${currentTab === "korean" ? "text-white bg-blue-600 shadow-md border border-blue-500" : "text-slate-400 bg-transparent hover:bg-slate-800 border border-transparent"}`}
              >
                <Languages className="w-4 h-4 md:w-5 md:h-5" /> 한국어 평가
              </button>
              <button
                onClick={() => setCurrentTab("skill")}
                className={`flex-1 h-[45px] rounded-xl text-sm md:text-base font-black transition-all flex items-center justify-center gap-2 ${currentTab === "skill" ? "text-white bg-hd-green shadow-md border border-green-500" : "text-slate-400 bg-transparent hover:bg-slate-800 border border-transparent"}`}
              >
                <HardHat className="w-4 h-4 md:w-5 md:h-5" /> 기량 검증
              </button>
            </div>

            <div className="px-3 sm:px-4 md:px-5 py-2 sm:py-[10px] min-h-[63px] flex flex-wrap gap-2 justify-between items-center border-b border-[#1e3a5f] bg-[#0a1b35] z-20 shrink-0">
              <div className="flex flex-wrap items-center gap-2 md:gap-5">
                <div className="flex items-center gap-2 md:gap-4">
                  <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">
                    Total Score
                  </span>
                  <div className="bg-[#051326] px-3 md:px-5 py-1 sm:py-0 sm:h-[50px] sm:pt-[4px] rounded-xl border border-[#1e3a5f] flex items-baseline gap-1 md:gap-1.5 shadow-inner">
                    <span className="text-xl sm:text-[25px] sm:h-[33px] font-black text-blue-400">
                      {calcKoreanTotal()}
                    </span>
                    <span className="text-xs sm:text-sm md:text-base font-bold text-slate-500">
                      /100
                    </span>
                  </div>
                </div>
                {showReset && (
                  <button
                    onClick={handleReset}
                    className="bg-red-900/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5 md:gap-2"
                  >
                    <RotateCcw className="w-3 h-3 md:w-4 md:h-4" /> 재평가
                  </button>
                )}
              </div>
              <button
                onClick={handleSave}
                className="px-3 sm:px-4 md:px-6 py-2 sm:py-0 sm:h-[41px] rounded-xl bg-gradient-to-r from-hd-green to-[#008f4c] hover:from-[#008f4c] hover:to-[#00703c] text-white font-black tracking-wide transition-all shadow-lg flex items-center gap-1.5 md:gap-2 text-xs sm:text-sm md:text-base"
              >
                <Save className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" /> <span>평가 저장</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#030f1c] relative">
              {currentTab === "korean" ? (
                <div className="p-3 md:p-5 pb-20 md:pb-24 grid grid-cols-1 gap-3 md:gap-4">
                  {[
                    {
                      id: 1,
                      title: "① 언어 이해 및 응답 능력",
                      max: 20,
                      icon: Ear,
                    },
                    {
                      id: 2,
                      title: "② 발음 및 억양의 명확성",
                      max: 10,
                      icon: Mic,
                    },
                    {
                      id: 3,
                      title: "③ 문법 및 문장 구성력",
                      max: 20,
                      icon: PenTool,
                    },
                    {
                      id: 4,
                      title: "④ 상황별 어휘 활용 능력",
                      max: 20,
                      icon: BookOpen,
                    },
                    {
                      id: 5,
                      title: "⑤ 표현력 및 대화 확장성",
                      max: 20,
                      icon: MessagesSquare,
                    },
                    {
                      id: 6,
                      title: "⑥ 기본 태도 및 자신감",
                      max: 10,
                      icon: UserCheck,
                    },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="bg-[#08172c] border border-[#1e3a5f] p-3 md:p-4 rounded-xl shadow-sm transition-all hover:border-blue-500/30 flex flex-col justify-between h-auto min-h-[156px] gap-3"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-black text-sm md:text-base text-slate-100 tracking-tight flex items-center gap-2">
                            <Icon className="text-blue-400 w-4 h-4 md:w-5 md:h-5" />{" "}
                            {item.title}
                          </span>
                          <span className="text-[10px] md:text-xs bg-slate-800 text-slate-400 font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-slate-700 tracking-wider shrink-0">
                            MAX {item.max}
                          </span>
                        </div>
                        <div className="flex justify-between gap-1.5 md:gap-3">
                          {SCORE_LABELS.map((label, i) => {
                            const score =
                              item.max === 10 ? SCORES_10[i] : SCORES_20[i];
                            const isActive = kVals[index] === i;
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  const newVals = [...kVals];
                                  newVals[index] = i;
                                  setKVals(newVals);
                                }}
                                className={`score-btn flex-1 py-2 flex flex-col items-center justify-center rounded-lg ${isActive ? `active-${i}` : ""}`}
                              >
                                <span className="text-[10px] md:text-xs opacity-90 tracking-tight mb-1">
                                  {label}
                                </span>
                                <span className="text-base md:text-lg font-black leading-none">
                                  {score}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="relative mt-auto flex items-stretch">
                          <div className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5 bg-blue-500 rounded-l-lg"></div>
                          <p
                            className="text-[11px] md:text-[12px] font-medium text-slate-300 bg-[#051326] pl-[14px] py-[10px] pr-2 m-0 rounded-lg border border-[#1e3a5f] leading-relaxed shadow-inner w-full min-h-[41px]"
                            dangerouslySetInnerHTML={{
                              __html: CRITERIA[item.id][kVals[index]],
                            }}
                          ></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 md:p-6 pb-20 md:pb-24 flex flex-col items-center">
                  <div className="w-full max-w-2xl space-y-6 md:space-8">
                    {isFit && (
                      <div className="bg-[#08172c] border border-[#1e3a5f] p-5 md:p-8 rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 md:h-1.5 bg-hd-green"></div>
                        <h4 className="font-black text-hd-green text-lg md:text-xl mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-green-900/30 border border-green-500/20 text-hd-green flex items-center justify-center">
                            <Ruler className="w-5 h-5 md:w-6 md:h-6" />
                          </div>{" "}
                          취부(Fitting) 실기 평가
                        </h4>
                        <div className="flex items-center justify-center gap-6 md:gap-10 mb-6 md:mb-8">
                          <div className="relative">
                            <input
                              type="number"
                              value={sFit}
                              onChange={(e) => setSFit(e.target.value)}
                              className="w-32 md:w-48 text-center text-4xl md:text-6xl lg:text-[4rem] font-black border-b-4 border-[#1e3a5f] focus:border-hd-green outline-none py-1 md:py-2 bg-transparent text-slate-100 transition-colors"
                              placeholder="0"
                            />
                            <span className="absolute -right-2 md:-right-4 bottom-4 md:bottom-8 text-slate-500 font-bold text-sm md:text-lg">
                              점
                            </span>
                          </div>
                          <div className="h-16 md:h-24 w-[2px] bg-[#1e3a5f]"></div>
                          <div className="text-center w-24 md:w-36">
                            <p className="text-xs md:text-sm text-hd-green font-bold tracking-[0.2em] mb-1 md:mb-2">
                              GRADE
                            </p>
                            <p
                              className={`text-4xl md:text-6xl lg:text-[4rem] font-black leading-none transition-colors duration-300 ${getSkillGradeByScore(parseInt(sFit)) === "S" || getSkillGradeByScore(parseInt(sFit)) === "A" ? "text-purple-400 text-shadow-sm" : (isPre ? parseInt(sFit) >= 41 : parseInt(sFit) >= 51) ? "text-hd-green" : "text-red-500"}`}
                            >
                              {getSkillGradeByScore(parseInt(sFit))}
                            </p>
                          </div>
                        </div>
                        <div className="text-center text-sm md:text-base font-bold text-slate-300 bg-[#051326] py-3 md:py-4 rounded-xl border border-[#1e3a5f] flex justify-center items-center gap-2">
                          <CircleAlert className="text-hd-green w-4 h-4 md:w-5 md:h-5" />{" "}
                          {fitPassCriteriaText}
                        </div>
                      </div>
                    )}

                    <div className="bg-[#08172c] border border-[#1e3a5f] p-5 md:p-8 rounded-2xl shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 md:h-1.5 bg-blue-500"></div>
                      <h4 className="font-black text-blue-400 text-lg md:text-xl mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-900/30 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                          <Flame className="w-5 h-5 md:w-6 md:h-6" />
                        </div>{" "}
                        용접(Welding) 실기 평가
                      </h4>
                      <div className="flex items-center justify-center gap-6 md:gap-10 mb-6 md:mb-8">
                        <div className="relative">
                          <input
                            type="number"
                            value={sWeld}
                            onChange={(e) => setSWeld(e.target.value)}
                            className="w-32 md:w-48 text-center text-4xl md:text-6xl lg:text-[4rem] font-black border-b-4 border-[#1e3a5f] focus:border-blue-500 outline-none py-1 md:py-2 bg-transparent text-slate-100 transition-colors"
                            placeholder="0"
                          />
                          <span className="absolute -right-2 md:-right-4 bottom-4 md:bottom-8 text-slate-500 font-bold text-sm md:text-lg">
                            점
                          </span>
                        </div>
                        <div className="h-16 md:h-24 w-[2px] bg-[#1e3a5f]"></div>
                        <div className="text-center w-24 md:w-36">
                          <p className="text-xs md:text-sm text-blue-400 font-bold tracking-[0.2em] mb-1 md:mb-2">
                            GRADE
                          </p>
                          <p
                            className={`text-4xl md:text-6xl lg:text-[4rem] font-black leading-none transition-colors duration-300 ${getSkillGradeByScore(parseInt(sWeld)) === "S" || getSkillGradeByScore(parseInt(sWeld)) === "A" ? "text-purple-400 text-shadow-sm" : (isPre ? parseInt(sWeld) >= 51 : parseInt(sWeld) >= 61) ? "text-hd-green" : "text-red-500"}`}
                          >
                            {getSkillGradeByScore(parseInt(sWeld))}
                          </p>
                        </div>
                      </div>
                      <div className="text-center text-sm md:text-base font-bold text-slate-300 bg-[#051326] py-3 md:py-4 rounded-xl border border-[#1e3a5f] flex justify-center items-center gap-2">
                        <CircleAlert className="text-blue-400 w-4 h-4 md:w-5 md:h-5" />{" "}
                        {weldPassCriteriaText}
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-2xl mt-6 md:mt-8">
                    <label className="flex text-sm md:text-base font-black text-slate-200 mb-2 md:mb-3 items-center gap-2">
                      <PenTool className="w-4 h-4 md:w-5 md:h-5 text-blue-400" /> 종합 의견 및
                      특이사항
                    </label>
                    <textarea
                      value={sMemo}
                      onChange={(e) => setSMemo(e.target.value)}
                      className="dx-input h-32 md:h-40 resize-none text-sm md:text-base font-medium bg-[#051326] border-[#1e3a5f] text-slate-200 p-4 md:p-5 rounded-xl placeholder-slate-600"
                      placeholder="면접관의 상세한 의견을 기록해주세요. (예: 체력이 우수함, 도면 이해도가 부족함 등)"
                    ></textarea>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
