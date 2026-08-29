import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  QuestionItem,
  generateCandidateQuestions,
} from "../data";
import {
  getKoreanGrade,
  getKoreanPassText,
  checkKoreanPass,
  checkSkillPass,
  determineResult,
  getSkillGradeByScore,
  getBadgeHtml,
  normalizeType,
  formatYYYYMMDD,
  normalizeDate,
  calculateAge,
  normalizeDob,
} from "../lib/utils";
import { playTTS, stopTTS, getTTSVoice, setTTSVoice, TTSVoiceType } from "../lib/speech";

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

  const [questionLevel, setQuestionLevel] = useState<"basic" | "intermediate" | "advanced">("basic");
  const [candidateQuestions, setCandidateQuestions] = useState<{
    basic: QuestionItem[];
    intermediate: QuestionItem[];
    advanced: QuestionItem[];
  }>({
    basic: [],
    intermediate: [],
    advanced: [],
  });
  const [shuffleSeeds, setShuffleSeeds] = useState<Record<string, number>>({});

  const [kVals, setKVals] = useState<number[]>([2, 2, 2, 2, 2, 2]);
  const [sWeld, setSWeld] = useState<string>("");
  const [sFit, setSFit] = useState<string>("");
  const [sMemo, setSMemo] = useState<string>("");
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3200);
  };

  // Check if Korean evaluation is completed for a candidate
  const isCandidateKoreanDone = useCallback((c: any) => {
    if (!c) return false;
    const isKoreanDone = c.k_status === "완료" || (c.k_score || 0) > 0;
    if (userRole === "interviewer") {
      const myKoreanLog = globalLogs.find(
        (l) =>
          String(l.app_no) === String(c.app_no) &&
          l.eval_type === c.eval_type &&
          l.evaluator === evaluatorName,
      );
      return !!myKoreanLog || isKoreanDone;
    }
    return isKoreanDone;
  }, [userRole, globalLogs, evaluatorName]);

  // Check if Skill evaluation is completed for a candidate
  const isCandidateSkillDone = useCallback((c: any) => {
    if (!c) return false;
    const isFit = (c.job || "").includes("취부");
    const hasSkillScore = isFit
      ? (c.s_score_weld || 0) > 0 && (c.s_score_fit || 0) > 0
      : (c.s_score_weld || 0) > 0;
    return c.s_status === "완료" || hasSkillScore;
  }, []);

  // Check if ALL evaluations are completed (Both Korean and Skill must be completed)
  const isCandidateCompleted = useCallback((c: any) => {
    if (!c) return false;
    if (userRole === "interviewer") {
      return isCandidateKoreanDone(c);
    }
    return isCandidateKoreanDone(c) && isCandidateSkillDone(c);
  }, [userRole, isCandidateKoreanDone, isCandidateSkillDone]);

  // Helper to convert 6-item scores or indexes into button indexes (0..4)
  function convertArrayToKVals(arr: any[], targetTotalScore?: number): number[] {
    if (!Array.isArray(arr) || arr.length < 6) {
      return targetTotalScore && targetTotalScore > 0
        ? convertTotalScoreToKVals(targetTotalScore)
        : [2, 2, 2, 2, 2, 2];
    }

    // Interpretation 1: arr contains actual score points (e.g. [4, 2, 4, 4, 4, 2] -> 20pts, [12, 6, 12, 12, 12, 6] -> 60pts)
    const asScoresIdx: number[] = [];
    let sumAsScores = 0;
    for (let i = 0; i < 6; i++) {
      const val = Number(arr[i]) || 0;
      const max = i === 1 || i === 5 ? 10 : 20;
      const scores = max === 10 ? SCORES_10 : SCORES_20;
      let bestIdx = 0;
      let minDiff = Infinity;
      scores.forEach((s, idx) => {
        const diff = Math.abs(s - val);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = idx;
        }
      });
      asScoresIdx.push(bestIdx);
      sumAsScores += scores[bestIdx];
    }

    // Interpretation 2: arr contains 0..4 button indexes (e.g. [0, 0, 0, 0, 0, 0] -> 20pts, [2, 2, 2, 2, 2, 2] -> 60pts)
    const isPureIndices = arr.every(
      (v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 4,
    );
    if (isPureIndices) {
      let sumAsIndices = 0;
      for (let i = 0; i < 6; i++) {
        const idx = Math.max(0, Math.min(4, Math.round(Number(arr[i]))));
        const max = i === 1 || i === 5 ? 10 : 20;
        sumAsIndices += max === 10 ? SCORES_10[idx] : SCORES_20[idx];
      }

      if (targetTotalScore && targetTotalScore > 0) {
        if (Math.abs(sumAsScores - targetTotalScore) < Math.abs(sumAsIndices - targetTotalScore)) {
          return asScoresIdx;
        }
        if (Math.abs(sumAsIndices - targetTotalScore) < Math.abs(sumAsScores - targetTotalScore)) {
          return arr.map((v) => Math.max(0, Math.min(4, Math.round(Number(v)))));
        }
      }
    }

    // If targetTotalScore is provided and sumAsScores differs significantly, reconcile
    if (targetTotalScore && targetTotalScore > 0 && Math.abs(sumAsScores - targetTotalScore) > 5) {
      return convertTotalScoreToKVals(targetTotalScore);
    }

    return asScoresIdx;
  }

  // Helper to convert total score (e.g. 75, 80) into closest item button indexes (0..4)
  function convertTotalScoreToKVals(targetScore: number): number[] {
    if (!targetScore || targetScore <= 0) return [2, 2, 2, 2, 2, 2];
    const baseLevel = Math.max(0, Math.min(4, Math.floor((targetScore / 100) * 5)));
    const kVals = [baseLevel, baseLevel, baseLevel, baseLevel, baseLevel, baseLevel];

    const calcSum = (vals: number[]) => {
      let sum = 0;
      for (let i = 0; i < 6; i++) {
        const max = i === 1 || i === 5 ? 10 : 20;
        sum += max === 10 ? SCORES_10[vals[i]] : SCORES_20[vals[i]];
      }
      return sum;
    };

    let currentSum = calcSum(kVals);
    let iterations = 0;
    while (currentSum !== targetScore && iterations < 30) {
      iterations++;
      if (currentSum < targetScore) {
        let bestIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < 6; i++) {
          if (kVals[i] < 4) {
            kVals[i]++;
            const newDiff = Math.abs(calcSum(kVals) - targetScore);
            if (newDiff < minDiff) {
              minDiff = newDiff;
              bestIdx = i;
            }
            kVals[i]--;
          }
        }
        if (bestIdx !== -1) {
          kVals[bestIdx]++;
          currentSum = calcSum(kVals);
        } else break;
      } else {
        let bestIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < 6; i++) {
          if (kVals[i] > 0) {
            kVals[i]--;
            const newDiff = Math.abs(calcSum(kVals) - targetScore);
            if (newDiff < minDiff) {
              minDiff = newDiff;
              bestIdx = i;
            }
            kVals[i]++;
          }
        }
        if (bestIdx !== -1) {
          kVals[bestIdx]--;
          currentSum = calcSum(kVals);
        } else break;
      }
    }
    return kVals;
  }

  // Sync candidate selection (keep filter controls intact so all candidates remain visible)
  useEffect(() => {
    if (selectedUid) {
      const c = candidates.find((item) => item.uid === selectedUid);
      if (c) {
        // Never auto-lock filterDate to candidate's eval_date to avoid hiding unevaluated candidates
      }
    }
  }, [selectedUid, candidates]);

  // Helper to reliably resolve evaluation date
  const getCandidateDate = (c: any): string => {
    if (c.eval_date && String(c.eval_date).trim() !== '') {
      const n = normalizeDate(c.eval_date);
      if (n) return n;
    }
    const matchLog = globalLogs.find(l => 
      String(l.app_no).trim() === String(c.app_no).trim() && 
      (normalizeType(l.eval_type) === normalizeType(c.eval_type) || !l.eval_type) && 
      l.eval_date
    );
    if (matchLog && matchLog.eval_date) {
      return normalizeDate(matchLog.eval_date);
    }
    return '';
  };

  // Candidate pool based on showCompleted toggle
  const evalPoolCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (showCompleted) return true;
      return !isCandidateCompleted(c);
    });
  }, [candidates, showCompleted, isCandidateCompleted]);

  const validTypes = useMemo(
    () =>
      Array.from(
        new Set(
          evalPoolCandidates
            .filter(
              (c) =>
                (filterDate === "all" || getCandidateDate(c) === filterDate) &&
                (filterCountry === "all" || c.country === filterCountry) &&
                (filterAgency === "all" || c.agency === filterAgency),
            )
            .map((c) => c.eval_type)
            .filter(Boolean),
        ),
      ).sort(),
    [evalPoolCandidates, filterDate, filterCountry, filterAgency, globalLogs],
  );

  const validDates = useMemo(
    () =>
      Array.from(
        new Set(
          evalPoolCandidates
            .filter(
              (c) =>
                (filterType === "all" || c.eval_type === filterType) &&
                (filterCountry === "all" || c.country === filterCountry) &&
                (filterAgency === "all" || c.agency === filterAgency),
            )
            .map((c) => getCandidateDate(c))
            .filter(Boolean),
        ),
      )
        .sort()
        .reverse(),
    [evalPoolCandidates, filterType, filterCountry, filterAgency, globalLogs],
  );

  const validCountries = useMemo(
    () =>
      Array.from(
        new Set(
          evalPoolCandidates
            .filter(
              (c) =>
                (filterType === "all" || c.eval_type === filterType) &&
                (filterDate === "all" || getCandidateDate(c) === filterDate) &&
                (filterAgency === "all" || c.agency === filterAgency),
            )
            .map((c) => c.country)
            .filter(Boolean),
        ),
      ).sort(),
    [evalPoolCandidates, filterType, filterDate, filterAgency, globalLogs],
  );

  const validAgencies = useMemo(
    () =>
      Array.from(
        new Set(
          evalPoolCandidates
            .filter(
              (c) =>
                (filterType === "all" || c.eval_type === filterType) &&
                (filterDate === "all" || getCandidateDate(c) === filterDate) &&
                (filterCountry === "all" || c.country === filterCountry),
            )
            .map((c) => c.agency)
            .filter(Boolean),
        ),
      ).sort(),
    [evalPoolCandidates, filterType, filterDate, filterCountry, globalLogs],
  );

  useEffect(() => {
    if (filterType !== "all" && !validTypes.includes(filterType)) {
      setFilterType("all");
    }
  }, [validTypes, filterType]);

  useEffect(() => {
    if (filterDate !== "all" && !validDates.includes(filterDate)) {
      setFilterDate("all");
    }
  }, [validDates, filterDate]);

  useEffect(() => {
    if (filterCountry !== "all" && !validCountries.includes(filterCountry)) {
      setFilterCountry("all");
    }
  }, [validCountries, filterCountry]);

  useEffect(() => {
    if (filterAgency !== "all" && !validAgencies.includes(filterAgency)) {
      setFilterAgency("all");
    }
  }, [validAgencies, filterAgency]);

  const filteredCandidates = useMemo(() => {
    return evalPoolCandidates
      .filter((c) => {
        if (filterType !== "all" && c.eval_type !== filterType) return false;
        if (filterDate !== "all" && getCandidateDate(c) !== filterDate) return false;
        if (filterCountry !== "all" && c.country !== filterCountry)
          return false;
        if (filterAgency !== "all" && c.agency !== filterAgency) return false;
        return true;
      })
      .sort((a: any, b: any) =>
        String(a.app_no).localeCompare(String(b.app_no), "en", {
          numeric: true,
        }),
      );
  }, [
    evalPoolCandidates,
    filterType,
    filterDate,
    filterCountry,
    filterAgency,
    globalLogs,
  ]);

  useEffect(() => {
    if (filteredCandidates.length > 0) {
      const exists = filteredCandidates.some((c) => c.uid === selectedUid);
      if (!exists) {
        setSelectedUid(filteredCandidates[0].uid);
      }
    } else {
      if (selectedUid !== null) {
        setSelectedUid(null);
      }
    }
  }, [filteredCandidates, selectedUid, setSelectedUid]);

  const currentCandidate = useMemo(
    () => (selectedUid ? candidates.find((c) => c.uid === selectedUid) || null : null),
    [candidates, selectedUid],
  );

  useEffect(() => {
    if (selectedUid) {
      const c = candidates.find((item) => item.uid === selectedUid);
      if (c) loadCandidateData(c);
    }
  }, [selectedUid]);

  const loadCandidateData = (p: any) => {
    if (!p) return;

    // 1. Try finding log for this candidate
    const myLog = [...globalLogs]
      .reverse()
      .find(
        (l) =>
          String(l.app_no) === String(p.app_no) &&
          l.evaluator === evaluatorName &&
          l.eval_type === p.eval_type,
      );

    const anyLog = [...globalLogs]
      .reverse()
      .find(
        (l) =>
          String(l.app_no) === String(p.app_no) &&
          l.eval_type === p.eval_type,
      );

    const targetScore = myLog?.score || anyLog?.score || p.k_score || 0;
    let loadedKVals = [2, 2, 2, 2, 2, 2];
    let loadedFromDetails = false;

    // Check myLog details
    if (myLog && myLog.details) {
      try {
        const parsed = typeof myLog.details === "string" ? JSON.parse(myLog.details) : myLog.details;
        if (Array.isArray(parsed) && parsed.length >= 6) {
          loadedKVals = convertArrayToKVals(parsed, targetScore);
          loadedFromDetails = true;
        }
      } catch (e) {}
    }

    // Check anyLog details if not loaded
    if (!loadedFromDetails && anyLog && anyLog.details) {
      try {
        const parsed = typeof anyLog.details === "string" ? JSON.parse(anyLog.details) : anyLog.details;
        if (Array.isArray(parsed) && parsed.length >= 6) {
          loadedKVals = convertArrayToKVals(parsed, targetScore);
          loadedFromDetails = true;
        }
      } catch (e) {}
    }

    // Check p.k_vals or p.avg_detailed or p.k_scores_actual
    if (!loadedFromDetails) {
      const candidateArray = p.k_vals || p.avg_detailed || p.k_scores_actual;
      if (Array.isArray(candidateArray) && candidateArray.length >= 6 && candidateArray.some((v: any) => v > 0)) {
        loadedKVals = convertArrayToKVals(candidateArray, targetScore);
        loadedFromDetails = true;
      }
    }

    // If still not loaded from array, check if targetScore > 0 exists
    if (!loadedFromDetails) {
      if (targetScore > 0) {
        loadedKVals = convertTotalScoreToKVals(targetScore);
      }
    }

    setKVals(loadedKVals);
    setSWeld(p.s_score_weld ? String(p.s_score_weld) : "");
    setSFit(p.s_score_fit ? String(p.s_score_fit) : "");
    setSMemo(p.memo || "");

    // Generate candidate questions (초급 10 / 중급 10 / 고급 10)
    const generated = generateCandidateQuestions({
      app_no: p.app_no,
      name: p.name,
      e9: p.e9,
    });
    setCandidateQuestions(generated);
  };

  // Re-generate questions when candidate or shuffle seed changes
  useEffect(() => {
    if (currentCandidate) {
      const generated = generateCandidateQuestions({
        app_no: currentCandidate.app_no,
        name: currentCandidate.name + (shuffleSeeds[currentCandidate.uid] ? `_${shuffleSeeds[currentCandidate.uid]}` : ""),
        e9: currentCandidate.e9,
      });
      setCandidateQuestions(generated);
    }
  }, [currentCandidate, shuffleSeeds]);

  const manualShuffle = () => {
    if (!currentCandidate) return;
    const currentSeed = shuffleSeeds[currentCandidate.uid] || 0;
    const newSeed = currentSeed + Math.floor(Math.random() * 1000) + 1;
    setShuffleSeeds((prev) => ({
      ...prev,
      [currentCandidate.uid]: newSeed,
    }));
    showToast("인터뷰 문항(초급/중급/고급)이 새롭게 재배정되었습니다.", "info");
  };

  const [playingTTS, setPlayingTTS] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<TTSVoiceType>(() => {
    return getTTSVoice();
  });

  useEffect(() => {
    return () => {
      stopTTS();
    };
  }, []);

  const handlePlayTTS = (text: string) => {
    if (playingTTS === text) {
      stopTTS();
      setPlayingTTS(null);
      return;
    }

    setPlayingTTS(text);
    playTTS(
      text,
      {
        onStart: () => setPlayingTTS(text),
        onEnd: () => setPlayingTTS(null),
        onError: () => setPlayingTTS(null),
      },
      selectedVoice
    );
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

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "save" | "reset";
    title: string;
    message: string;
    description?: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: () => void;
  } | null>(null);

  const executeSave = async () => {
    if (!currentCandidate) {
      showToast("평가 대상자가 선택되지 않았습니다.", "error");
      return;
    }
    const p = { ...currentCandidate };
    let saveMode = currentTab;
    let individualScore = 0;
    let actualScores: number[] = [];
    const effectiveEvaluator = (evaluatorName && evaluatorName.trim() !== '') ? evaluatorName.trim() : (userRole === 'admin' ? 'Admin' : '평가위원');
    
    // Update evaluation date to today (or candidate's custom selected date if any)
    const todayStr = formatYYYYMMDD(new Date().toISOString());
    p.eval_date = todayStr;
    p.eval_type = normalizeType(p.eval_type);

    if (currentTab === "korean") {
      let myTotal = 0;
      for (let i = 1; i <= 6; i++) {
        const v = kVals[i - 1];
        const max = i === 2 || i === 6 ? 10 : 20;
        const s = max === 10 ? SCORES_10[v] : SCORES_20[v];
        actualScores.push(s);
        myTotal += s;
      }
      individualScore = myTotal;
      const newLogs = globalLogs.filter(
        (l) =>
          !(
            String(l.app_no).trim() === String(p.app_no).trim() &&
            (l.evaluator || '').trim() === effectiveEvaluator &&
            normalizeType(l.eval_type) === p.eval_type
          ),
      );
      newLogs.push({
        app_no: p.app_no,
        eval_date: p.eval_date,
        eval_type: p.eval_type,
        evaluator: effectiveEvaluator,
        score: individualScore,
        details: JSON.stringify(actualScores),
        name: p.name,
      });
      const applicantLogsAll = newLogs.filter(
        (l) =>
          String(l.app_no).trim() === String(p.app_no).trim() &&
          normalizeType(l.eval_type) === p.eval_type &&
          l.evaluator && String(l.evaluator).trim() !== ''
      );
      const latestMap = new Map<string, (typeof newLogs)[0]>();
      applicantLogsAll.forEach((l) => {
        const evalKey = String(l.evaluator).trim();
        latestMap.set(evalKey, l);
      });
      const applicantLogs = Array.from(latestMap.values());
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
        applicantLogs.length > 0 ? Math.round(sum / applicantLogs.length) : individualScore;
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
      try {
        localStorage.setItem("hd_logs", JSON.stringify(newLogs));
      } catch (e) {}
    } else {
      const wV = parseInt(sWeld) || 0;
      const fV = parseInt(sFit) || 0;
      const isFit = (p.job || "").includes("취부");
      if (isFit && (!sWeld || !sFit)) {
        showToast("취부 직종은 용접/취부 점수를 일괄 입력해야 합니다.", "error");
        return;
      }
      if (!isFit && !sWeld) {
        showToast("용접 점수를 입력하세요.", "error");
        return;
      }
      p.s_score_weld = wV;
      p.grade_weld = getSkillGradeByScore(wV);
      p.s_score_fit = fV;
      p.grade_fit = getSkillGradeByScore(fV);
      p.memo = sMemo;
      p.s_status = "완료";
      saveMode = "skill";
    }
    p.result = determineResult(p);
    const updatedCandidates = candidates.map((c) =>
      c.uid === p.uid || (String(c.app_no) === String(p.app_no) && normalizeType(c.eval_type) === p.eval_type) ? p : c,
    );
    setCandidates(updatedCandidates);
    try {
      localStorage.setItem("hd_candidates", JSON.stringify(updatedCandidates));
    } catch (e) {}

    // Find next candidate for continuous sequential evaluation workflow
    const filteredPool = updatedCandidates
      .filter((c) => {
        if (!showCompleted && isCandidateCompleted(c) && c.uid !== p.uid) return false;
        if (filterType !== "all" && c.eval_type !== filterType) return false;
        if (filterDate !== "all" && c.eval_date !== filterDate) return false;
        if (filterCountry !== "all" && c.country !== filterCountry) return false;
        if (filterAgency !== "all" && c.agency !== filterAgency) return false;
        return true;
      })
      .sort((a, b) => String(a.app_no).localeCompare(String(b.app_no), "en", { numeric: true }));

    const currentIndex = filteredPool.findIndex((c) => c.uid === p.uid);
    let nextCandidate: any = null;

    if (filteredPool.length > 0) {
      // 1. Search forward from current index for next pending candidate in current evaluation mode
      for (let step = 1; step <= filteredPool.length; step++) {
        const checkIdx = (currentIndex + step) % filteredPool.length;
        const candidateAtIdx = filteredPool[checkIdx];
        if (candidateAtIdx.uid === p.uid) continue;

        const isKorPending = !isCandidateKoreanDone(candidateAtIdx);
        const isSklPending = !isCandidateSkillDone(candidateAtIdx);

        if (currentTab === "korean" && isKorPending) {
          nextCandidate = candidateAtIdx;
          break;
        } else if (currentTab === "skill" && isSklPending) {
          nextCandidate = candidateAtIdx;
          break;
        }
      }

      // 2. If all ahead are evaluated, check if any other candidate exists
      if (!nextCandidate && filteredPool.length > 1) {
        for (let step = 1; step < filteredPool.length; step++) {
          const checkIdx = (currentIndex + step) % filteredPool.length;
          if (filteredPool[checkIdx].uid !== p.uid) {
            nextCandidate = filteredPool[checkIdx];
            break;
          }
        }
      }
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (nextCandidate) {
      setSelectedUid(nextCandidate.uid);
      showToast(`[${p.name}] 점수 저장 완료 ➔ 다음 응시자 [${nextCandidate.app_no} ${nextCandidate.name}] 이동`, "success");
    } else {
      showToast(`[${p.name}] 평가 점수가 저장되었습니다! (해당 조건 응시자 평가 완료)`, "success");
    }

    if (gasUrl && gasUrl.trim() !== "") {
      try {
        const q1 = actualScores[0] || (p.k_vals ? p.k_vals[0] : 0) || 0;
        const q2 = actualScores[1] || (p.k_vals ? p.k_vals[1] : 0) || 0;
        const q3 = actualScores[2] || (p.k_vals ? p.k_vals[2] : 0) || 0;
        const q4 = actualScores[3] || (p.k_vals ? p.k_vals[3] : 0) || 0;
        const q5 = actualScores[4] || (p.k_vals ? p.k_vals[4] : 0) || 0;
        const q6 = actualScores[5] || (p.k_vals ? p.k_vals[5] : 0) || 0;

        const gasPayload = {
          type: "save",
          save_mode: saveMode,
          saveMode: saveMode,
          mode: saveMode,
          save_mode_kor: saveMode === "korean" ? "한국어" : "기량검증",
          app_no: String(p.app_no).trim(),
          id: String(p.app_no).trim(),
          no: p.no || "",
          name: String(p.raw_name || p.name || "").trim(),
          job: String(p.job || "").trim(),
          dob: String(p.dob || "").trim(),
          age: (Number(p.age) || 0) > 0 ? Number(p.age) : (p.dob ? calculateAge(p.dob) : 0),
          e9: String(p.e9 || "X").trim(),
          country: String(p.country || "").trim(),
          agency: String(p.agency || "").trim(),
          eval_type: p.eval_type,
          eval_date: p.eval_date,
          evaluator_name: effectiveEvaluator,
          evaluator: effectiveEvaluator,
          my_score: individualScore,
          score: individualScore,
          q1: q1,
          q2: q2,
          q3: q3,
          q4: q4,
          q5: q5,
          q6: q6,
          k1: q1,
          k2: q2,
          k3: q3,
          k4: q4,
          k5: q5,
          k6: q6,
          item1: q1,
          item2: q2,
          item3: q3,
          item4: q4,
          item5: q5,
          item6: q6,
          score1: q1,
          score2: q2,
          score3: q3,
          score4: q4,
          score5: q5,
          score6: q6,
          k_score: Number(p.k_score) || 0,
          korean_score: Number(p.k_score) || 0,
          k_grade: String(p.k_grade || "-"),
          korean_grade: String(p.k_grade || "-"),
          k_pass: String(p.k_pass || "대기"),
          korean_pass: String(p.k_pass || "대기"),
          k_status: String(p.k_status || "완료"),
          korean_status: String(p.k_status || "완료"),
          s_score_weld: Number(p.s_score_weld) || 0,
          weld_score: Number(p.s_score_weld) || 0,
          score_weld: Number(p.s_score_weld) || 0,
          grade_weld: String(p.grade_weld || "-"),
          weld_grade: String(p.grade_weld || "-"),
          s_score_fit: Number(p.s_score_fit) || 0,
          fit_score: Number(p.s_score_fit) || 0,
          score_fit: Number(p.s_score_fit) || 0,
          grade_fit: String(p.grade_fit || "-"),
          fit_grade: String(p.grade_fit || "-"),
          s_status: String(p.s_status || "완료"),
          skill_status: String(p.s_status || "완료"),
          memo: String(p.memo || ""),
          s_memo: String(p.memo || ""),
          result: String(p.result || "대기"),
          details: [q1, q2, q3, q4, q5, q6],
          details_str: JSON.stringify([q1, q2, q3, q4, q5, q6]),
          avg_detailed: p.avg_detailed || [q1, q2, q3, q4, q5, q6],
          k_vals: [q1, q2, q3, q4, q5, q6],
        };

        fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(gasPayload),
        }).catch((err) => console.warn("GAS save error", err));
      } catch (e) {
        console.warn("GAS save exception", e);
      }
    }
  };

  const handleSave = () => {
    if (!currentCandidate) {
      showToast("평가 대상자가 선택되지 않았습니다.", "error");
      return;
    }
    const isFit = (currentCandidate.job || "").includes("취부");
    if (currentTab === "skill") {
      if (isFit && (!sWeld || !sFit)) {
        showToast("취부 직종은 용접/취부 점수를 일괄 입력해야 합니다.", "error");
        return;
      }
      if (!isFit && !sWeld) {
        showToast("용접 점수를 입력하세요.", "error");
        return;
      }
    }

    const scoreText =
      currentTab === "korean"
        ? `한국어 점수: ${calcKoreanTotal()}점`
        : isFit
        ? `용접: ${sWeld}점, 취부: ${sFit}점`
        : `용접: ${sWeld}점`;

    setConfirmModal({
      isOpen: true,
      type: "save",
      title: isCandidateEvaluated ? "💾 평가 점수 수정 저장 확인" : "💾 평가 점수 저장 확인",
      message: `[${currentCandidate.name} (수험번호: ${currentCandidate.app_no})] 응시자의 ${currentTab === "korean" ? "한국어 평가" : "기량 검증"} 점수를 저장하시겠습니까?`,
      description: `입력 점수 [ ${scoreText} ] 가 구글 스프레드시트 및 대시보드 통계에 즉시 반영됩니다.`,
      confirmLabel: isCandidateEvaluated ? "수정 저장하기" : "저장하기",
      confirmColor: isCandidateEvaluated
        ? "bg-blue-600 hover:bg-blue-500"
        : "bg-emerald-600 hover:bg-emerald-500",
      onConfirm: () => {
        setConfirmModal(null);
        executeSave();
      },
    });
  };

  const executeReset = async () => {
    if (!currentCandidate) {
      showToast("평가 대상자가 선택되지 않았습니다.", "error");
      return;
    }
    const p = { ...currentCandidate };
    p.eval_type = normalizeType(p.eval_type);
    
    // Check if other evaluation category is still done
    const isSkillStillDone = (p.s_status === "완료") || (Number(p.s_score_weld) || 0) > 0 || (Number(p.s_score_fit) || 0) > 0;
    const isKoreanStillDone = (p.k_status === "완료") || (Number(p.k_score) || 0) > 0;

    let newLogs = globalLogs;
    if (currentTab === "korean") {
      p.k_score = 0;
      p.k_grade = "-";
      p.k_pass = "대기";
      p.k_vals = [];
      p.k_scores_actual = [];
      p.avg_detailed = [0, 0, 0, 0, 0, 0];
      p.k_status = "대기";
      newLogs = globalLogs.filter(
        (l) =>
          !(
            String(l.app_no) === String(p.app_no) &&
            normalizeType(l.eval_type) === p.eval_type
          ),
      );
      setGlobalLogs(newLogs);
      try {
        localStorage.setItem("hd_logs", JSON.stringify(newLogs));
      } catch (e) {}
      setKVals([2, 2, 2, 2, 2, 2]);

      // If skill evaluation is also not done, reset eval_date completely
      if (!isSkillStillDone) {
        p.eval_date = "";
      }
    } else {
      p.s_score_weld = 0;
      p.grade_weld = "-";
      p.s_score_fit = 0;
      p.grade_fit = "-";
      p.memo = "";
      p.s_status = "대기";
      setSWeld("");
      setSFit("");
      setSMemo("");

      // If korean evaluation is also not done, reset eval_date completely
      if (!isKoreanStillDone) {
        p.eval_date = "";
      }
    }
    p.result = determineResult(p);
    const updatedCandidates = candidates.map((c) =>
      c.uid === p.uid || (String(c.app_no) === String(p.app_no) && normalizeType(c.eval_type) === p.eval_type) ? p : c,
    );
    setCandidates(updatedCandidates);
    try {
      localStorage.setItem("hd_candidates", JSON.stringify(updatedCandidates));
    } catch (e) {}

    // Reset date filter to 'all' so that all candidates (A~E) immediately appear in the evaluation pool
    setFilterDate("all");

    showToast(`[${p.name}] 평가 내역이 '대기' 상태로 초기화되었습니다. (응시일자 초기화 완료)`, "info");

    if (gasUrl && gasUrl.trim() !== "") {
      try {
        const gasResetPayload = {
          type: "reset",
          action: "reset",
          save_mode: currentTab,
          saveMode: currentTab,
          mode: currentTab,
          app_no: String(p.app_no).trim(),
          id: String(p.app_no).trim(),
          no: p.no || "",
          eval_type: p.eval_type,
          name: String(p.raw_name || p.name || "").trim(),
          eval_date: p.eval_date || "", // Send empty string to clear Y column in Google Sheets
          evaluator: (evaluatorName && evaluatorName.trim() !== "") ? evaluatorName.trim() : "",
          evaluator_name: (evaluatorName && evaluatorName.trim() !== "") ? evaluatorName.trim() : "",
          k_score: 0,
          k_grade: "-",
          k_pass: "대기",
          k_status: "대기",
          s_score_weld: 0,
          weld_score: 0,
          score_weld: 0,
          grade_weld: "-",
          weld_grade: "-",
          s_score_fit: 0,
          fit_score: 0,
          score_fit: 0,
          grade_fit: "-",
          fit_grade: "-",
          s_status: "대기",
          skill_status: "대기",
          memo: "",
          s_memo: "",
          result: "대기",
        };

        fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(gasResetPayload),
        }).catch((err) => console.warn("GAS reset error", err));
      } catch (e) {
        console.warn("GAS reset exception", e);
      }
    }
  };

  const handleReset = () => {
    if (!currentCandidate) {
      showToast("평가 대상자가 선택되지 않았습니다.", "error");
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: "reset",
      title: "⚠️ 평가 점수 초기화 확인",
      message: `[${currentCandidate.name} (수험번호: ${currentCandidate.app_no})] 응시자의 ${currentTab === "korean" ? "한국어 평가" : "기량 검증"} 점수를 초기화하시겠습니까?`,
      description: "초기화 시 해당 평가 항목의 입력된 점수와 결과가 '대기' 상태로 전환되며, 구글 스프레드시트와 대시보드에서도 삭제 처리됩니다.",
      confirmLabel: "초기화 실행",
      confirmColor: "bg-red-600 hover:bg-red-500",
      onConfirm: () => {
        setConfirmModal(null);
        executeReset();
      },
    });
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
    !!currentCandidate &&
    (!!myKoreanLog ||
      (currentCandidate.k_score || 0) > 0 ||
      currentCandidate.k_status === "완료" ||
      currentCandidate.s_status === "완료" ||
      (currentCandidate.s_score_weld || 0) > 0 ||
      (currentCandidate.s_score_fit || 0) > 0 ||
      globalLogs.some(
        (l) =>
          String(l.app_no) === String(currentCandidate.app_no) &&
          l.eval_type === currentCandidate.eval_type,
      ));

  const isCandidateEvaluated = currentCandidate
    ? (currentTab === "korean"
        ? (!!myKoreanLog || (currentCandidate.k_score || 0) > 0 || currentCandidate.k_status === "완료")
        : (currentCandidate.s_status === "완료" || (currentCandidate.s_score_weld || 0) > 0 || (currentCandidate.s_score_fit || 0) > 0))
    : false;

  return (
    <div className="flex-1 min-h-0 flex flex-col animate-in fade-in bg-[#030f1c] relative">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 bg-[#08172c]/95 border-blue-500/60 text-white">
          {toast.type === "success" && <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toast.type === "info" && <RotateCcw className="w-5 h-5 text-blue-400 shrink-0" />}
          {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span className="text-sm font-bold tracking-tight">{toast.message}</span>
        </div>
      )}
      <div className="bg-[#051326] border-b border-[#1e3a5f] px-3 md:px-5 py-2.5 flex flex-col gap-2.5 shrink-0 z-30 relative shadow-sm">
        {/* Row 1: Filter Bar & Candidate Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3 w-full">
          {/* Left Filters Group */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <select
              value={filterType}
              onChange={(e) => {
                const val = e.target.value;
                setFilterType(val);
                const matches = evalPoolCandidates.filter(
                  (c) =>
                    (val === "all" || c.eval_type === val) &&
                    (filterDate === "all" || getCandidateDate(c) === filterDate) &&
                    (filterCountry === "all" || c.country === filterCountry) &&
                    (filterAgency === "all" || c.agency === filterAgency),
                );
                if (matches.length > 0) {
                  setSelectedUid(matches[0].uid);
                }
              }}
              className="bg-[#08172c] border border-[#1e3a5f] hover:border-blue-500/50 focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-200 cursor-pointer outline-none transition-colors h-8 shrink-0"
            >
              <option value="all">
                검증 {validTypes.length > 0 ? `(${validTypes.length})` : "전체"}
              </option>
              {validTypes.map((t) => (
                <option key={t} value={t}>
                  {t === "사전기량검증"
                    ? "사전기량"
                    : t === "본기량검증"
                      ? "본기량"
                      : t}
                </option>
              ))}
            </select>

            <select
              value={filterDate}
              onChange={(e) => {
                const val = e.target.value;
                setFilterDate(val);
                const matches = evalPoolCandidates.filter(
                  (c) =>
                    (filterType === "all" || c.eval_type === filterType) &&
                    (val === "all" || getCandidateDate(c) === val) &&
                    (filterCountry === "all" || c.country === filterCountry) &&
                    (filterAgency === "all" || c.agency === filterAgency),
                );
                if (matches.length > 0) {
                  setSelectedUid(matches[0].uid);
                }
              }}
              className="bg-[#08172c] border border-[#1e3a5f] hover:border-blue-500/50 focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-200 cursor-pointer outline-none transition-colors h-8 shrink-0"
            >
              <option value="all">
                날짜 {validDates.length > 0 ? `(${validDates.length})` : "전체"}
              </option>
              {validDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={filterCountry}
              onChange={(e) => {
                const val = e.target.value;
                setFilterCountry(val);
                const matches = evalPoolCandidates.filter(
                  (c) =>
                    (filterType === "all" || c.eval_type === filterType) &&
                    (filterDate === "all" || getCandidateDate(c) === filterDate) &&
                    (val === "all" || c.country === val) &&
                    (filterAgency === "all" || c.agency === filterAgency),
                );
                if (matches.length > 0) {
                  setSelectedUid(matches[0].uid);
                }
              }}
              className="bg-[#08172c] border border-[#1e3a5f] hover:border-blue-500/50 focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-200 cursor-pointer outline-none transition-colors h-8 shrink-0"
            >
              <option value="all">
                국가 {validCountries.length > 0 ? `(${validCountries.length})` : "전체"}
              </option>
              {validCountries.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={filterAgency}
              onChange={(e) => {
                const val = e.target.value;
                setFilterAgency(val);
                const matches = evalPoolCandidates.filter(
                  (c) =>
                    (filterType === "all" || c.eval_type === filterType) &&
                    (filterDate === "all" || getCandidateDate(c) === filterDate) &&
                    (filterCountry === "all" || c.country === filterCountry) &&
                    (val === "all" || c.agency === val),
                );
                if (matches.length > 0) {
                  setSelectedUid(matches[0].uid);
                }
              }}
              className="bg-[#08172c] border border-[#1e3a5f] hover:border-blue-500/50 focus:border-blue-400 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-200 cursor-pointer outline-none transition-colors h-8 shrink-0"
            >
              <option value="all">
                업체 {validAgencies.length > 0 ? `(${validAgencies.length})` : "전체"}
              </option>
              {validAgencies.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs text-slate-300 font-bold cursor-pointer bg-[#08172c] px-2.5 py-1 rounded-lg border border-[#1e3a5f] hover:border-blue-500/50 transition-all select-none shrink-0 h-8">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => {
                  const val = e.target.checked;
                  setShowCompleted(val);
                  const newPool = candidates.filter((c) => val || !isCandidateCompleted(c));
                  const matches = newPool.filter(
                    (c) =>
                      (filterType === "all" || c.eval_type === filterType) &&
                      (filterDate === "all" || getCandidateDate(c) === filterDate) &&
                      (filterCountry === "all" || c.country === filterCountry) &&
                      (filterAgency === "all" || c.agency === filterAgency),
                  );
                  if (matches.length > 0) {
                    setSelectedUid(matches[0].uid);
                  }
                }}
                className="rounded bg-[#051326] border-[#1e3a5f] text-blue-500 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="whitespace-nowrap">완료자 포함</span>
            </label>
          </div>

          {/* Right: Candidate Select Dropdown */}
          <div className="relative w-full sm:w-80 md:w-88 lg:w-96 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UserSearch className="text-blue-400 w-4 h-4" />
            </div>
            <select
              value={selectedUid || ""}
              onChange={(e) => setSelectedUid(e.target.value)}
              disabled={filteredCandidates.length === 0}
              className="w-full bg-[#08172c] border border-blue-500/50 hover:border-blue-400 focus:border-blue-400 rounded-lg pl-9 pr-8 py-1 text-xs sm:text-sm font-black text-blue-200 cursor-pointer appearance-none shadow-sm h-8 sm:h-8.5 outline-none transition-colors"
            >
              {filteredCandidates.length === 0 && (
                <option value="">
                  {showCompleted
                    ? "조건 일치 평가 대상 없음"
                    : "평가 대상자 없음 (완료자 포함 선택 가능)"}
                </option>
              )}
              {filteredCandidates.map((c, idx) => {
                const isKorDone = isCandidateKoreanDone(c);
                const isSklDone = isCandidateSkillDone(c);
                const isFullyDone = isKorDone && isSklDone;
                
                let statusTag = "";
                if (isFullyDone) {
                  statusTag = " (전체완료)";
                } else if (isKorDone && !isSklDone) {
                  statusTag = " (한국어완료 / 기량대기)";
                } else if (!isKorDone && isSklDone) {
                  statusTag = " (한국어대기 / 기량완료)";
                }

                const label = `[${c.app_no}] ${c.name?.toUpperCase()}${statusTag}`;
                return (
                  <option key={`${c.uid || c.app_no}_${idx}`} value={c.uid}>
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

        {/* Row 2: Selected Candidate Full Profile Information Banner (No text truncation, fully responsive) */}
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3 bg-[#08172c] border border-[#1e3a5f] rounded-xl px-3 sm:px-4 py-2 text-xs shadow-inner">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
            {/* 수험번호 & 성명 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-blue-400 font-black bg-blue-950/70 border border-blue-800 px-1.5 py-0.5 rounded text-[11px] font-mono">
                {currentCandidate?.app_no || "-"}
              </span>
              <span className="font-black text-white text-xs sm:text-sm tracking-wide">
                {currentCandidate?.name?.toUpperCase() || "선택된 응시자 없음"}
              </span>
            </div>

            <div className="hidden sm:block w-px h-3.5 bg-slate-700 shrink-0"></div>

            {/* 나이 및 출생연도 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400 font-bold">연령:</span>
              <span className="font-bold text-emerald-400 text-xs sm:text-sm">
                {(() => {
                  if (!currentCandidate) return "-";
                  let ageVal = Number(currentCandidate.age) || 0;
                  const dobStr = currentCandidate.dob ? String(currentCandidate.dob).trim() : "";
                  if (ageVal === 0 && dobStr) {
                    ageVal = calculateAge(dobStr);
                  }
                  let birthYear = "";
                  if (dobStr.includes("-")) {
                    const y = dobStr.split("-")[0];
                    if (/^\d{4}$/.test(y)) birthYear = y;
                  } else if (/^\d{4}$/.test(dobStr)) {
                    birthYear = dobStr;
                  }
                  if (!birthYear && ageVal >= 10 && ageVal <= 85) {
                    birthYear = String(new Date().getFullYear() - ageVal);
                  }
                  if (ageVal === 0 && birthYear) {
                    const y = parseInt(birthYear, 10);
                    if (y >= 1940 && y <= new Date().getFullYear()) {
                      ageVal = new Date().getFullYear() - y;
                    }
                  }

                  if (ageVal > 0 && birthYear) {
                    return `${ageVal}세 (${birthYear}년생)`;
                  } else if (ageVal > 0) {
                    return `${ageVal}세`;
                  } else if (birthYear) {
                    return `${birthYear}년생`;
                  }
                  return "-";
                })()}
              </span>
            </div>

            <div className="hidden sm:block w-px h-3.5 bg-slate-700 shrink-0"></div>

            {/* E-9 여부 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400 font-bold">E-9:</span>
              <span
                className={`font-black px-1.5 py-0.5 rounded text-[11px] ${
                  currentCandidate?.e9 === "O"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                }`}
              >
                {currentCandidate?.e9 === "O" ? "O (유경험)" : "X (신규)"}
              </span>
            </div>

            <div className="hidden sm:block w-px h-3.5 bg-slate-700 shrink-0"></div>

            {/* 직종 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400 font-bold">직종:</span>
              <span className="font-black text-amber-300 bg-amber-950/50 border border-amber-800 px-2 py-0.5 rounded text-xs">
                {currentCandidate?.job || "-"}
              </span>
            </div>

            <div className="hidden sm:block w-px h-3.5 bg-slate-700 shrink-0"></div>

            {/* 국가 / 송출업체 */}
            {(currentCandidate?.country || currentCandidate?.agency) && (
              <div className="flex items-center gap-1.5 shrink-0 text-slate-300 text-xs">
                <span className="text-slate-400 font-bold">소속:</span>
                <span className="font-bold text-slate-200">
                  {[currentCandidate.country, currentCandidate.agency].filter(Boolean).join(" / ")}
                </span>
              </div>
            )}
          </div>

          {/* 검증 구분 배지 */}
          <div className="flex items-center gap-2 shrink-0">
            {currentCandidate && (
              <span
                dangerouslySetInnerHTML={{
                  __html: getBadgeHtml(currentCandidate.eval_type),
                }}
              ></span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row gap-2.5 md:gap-3.5 p-2 sm:p-3 md:p-4 max-w-[1800px] mx-auto w-full">
        <div
          className={`dx-card ${userRole === "interviewer" ? "w-full" : "w-full md:w-5/12"} h-[300px] sm:h-[350px] md:h-full flex-none md:flex-1 flex flex-col relative min-h-0 overflow-hidden bg-[#08172c]`}
        >
          {/* Header Row: Title, Level Tabs (초급, 중급, 고급), Voice & Shuffle */}
          <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 border-b border-[#1e3a5f] bg-[#051326] flex flex-col gap-1.5 sticky top-0 z-10 w-full shrink-0">
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileQuestion className="text-blue-400 w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="font-black text-slate-100 text-xs sm:text-sm whitespace-nowrap">
                  인터뷰 문항
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 bg-[#0a1b35] px-1.5 py-0.5 rounded border border-[#1e3a5f] whitespace-nowrap shrink-0 hidden sm:inline-block">
                  30문항 풀
                </span>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <select
                  value={selectedVoice}
                  onChange={(e) => {
                    const v = e.target.value as TTSVoiceType;
                    setSelectedVoice(v);
                    setTTSVoice(v);
                  }}
                  className="bg-[#0a1b35] text-[10px] sm:text-[11px] font-semibold text-blue-300 border border-blue-500/30 rounded-lg px-1.5 py-0.5 sm:py-1 outline-none cursor-pointer hover:border-blue-400 transition-colors shrink min-w-0 truncate max-w-[90px] sm:max-w-[110px] h-7"
                  title="AI 면접관 음성 선택"
                >
                  <option value="Fenrir">👨 남성 1 (차분)</option>
                  <option value="Charon">👨 남성 2 (신뢰)</option>
                </select>

                <button
                  onClick={() => manualShuffle()}
                  className="bg-[#0a1b35] border border-[#1e3a5f] hover:bg-[#1e3a5f] text-slate-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap h-7"
                  title="해당 인원 문항 랜덤 재배정"
                >
                  <Shuffle className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="hidden xs:inline sm:inline whitespace-nowrap">재배정</span>
                </button>
              </div>
            </div>

            {/* Level Selector Tabs: 초급 (10문항) / 중급 (10문항) / 고급 (10문항) */}
            <div className="grid grid-cols-3 gap-1 bg-[#030f1c] p-0.5 sm:p-1 rounded-lg border border-[#1e3a5f]/80">
              <button
                type="button"
                onClick={() => setQuestionLevel("basic")}
                className={`py-1 px-1 rounded-md font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                  questionLevel === "basic"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950 font-black"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#0a1b35]"
                }`}
              >
                <span>초급<span className="hidden lg:inline font-normal text-[10px] text-emerald-200 ml-0.5">(기초)</span></span>
                <span
                  className={`text-[9px] sm:text-[10px] px-1 py-0.2 rounded font-mono shrink-0 ${
                    questionLevel === "basic" ? "bg-emerald-800 text-emerald-100 font-black" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  10
                </span>
              </button>

              <button
                type="button"
                onClick={() => setQuestionLevel("intermediate")}
                className={`py-1 px-1 rounded-md font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                  questionLevel === "intermediate"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-950 font-black"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#0a1b35]"
                }`}
              >
                <span>중급<span className="hidden lg:inline font-normal text-[10px] text-blue-200 ml-0.5">(직무)</span></span>
                <span
                  className={`text-[9px] sm:text-[10px] px-1 py-0.2 rounded font-mono shrink-0 ${
                    questionLevel === "intermediate" ? "bg-blue-800 text-blue-100 font-black" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  10
                </span>
              </button>

              <button
                type="button"
                onClick={() => setQuestionLevel("advanced")}
                className={`py-1 px-1 rounded-md font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                  questionLevel === "advanced"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-950 font-black"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#0a1b35]"
                }`}
              >
                <span>고급<span className="hidden lg:inline font-normal text-[10px] text-purple-200 ml-0.5">(심층)</span></span>
                <span
                  className={`text-[9px] sm:text-[10px] px-1 py-0.2 rounded font-mono shrink-0 ${
                    questionLevel === "advanced" ? "bg-purple-800 text-purple-100 font-black" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  10
                </span>
              </button>
            </div>
          </div>

          {/* Question List View */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 md:p-4 bg-[#030f1c] space-y-2 sm:space-y-2.5">
            {(() => {
              const list: QuestionItem[] = candidateQuestions[questionLevel] || [];
              if (list.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    응시자를 선택하면 맞춤 30문항(초급 10 / 중급 10 / 고급 10)이 자동 배정됩니다.
                  </div>
                );
              }

              return list.map((item, idx) => {
                const isE9Special = !!item.isE9Special;
                const cleanQ = item.q;
                const cleanTail = item.tail || "";

                return (
                  <div
                    key={`${questionLevel}_${idx}`}
                    className={`p-2.5 rounded-xl border transition-all relative overflow-hidden group ${
                      isE9Special
                        ? "bg-[#0b1d3a] border-amber-500/60 shadow-sm"
                        : "bg-[#08172c] border-[#1e3a5f] hover:border-blue-500/50 hover:shadow-lg"
                    }`}
                  >
                    {/* Left Accent Bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${
                        isE9Special
                          ? "bg-amber-400"
                          : questionLevel === "basic"
                          ? "bg-emerald-500"
                          : questionLevel === "intermediate"
                          ? "bg-blue-500"
                          : "bg-purple-500"
                      }`}
                    ></div>

                    <div className="flex flex-col gap-1.5 w-full pl-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-bold text-slate-100 text-[13px] md:text-sm leading-snug flex items-start text-left flex-1">
                          <span
                            className={`mr-1.5 text-sm md:text-base font-black shrink-0 ${
                              isE9Special
                                ? "text-amber-400"
                                : questionLevel === "basic"
                                ? "text-emerald-400"
                                : questionLevel === "intermediate"
                                ? "text-blue-400"
                                : "text-purple-400"
                            }`}
                          >
                            Q{idx + 1}.
                          </span>
                          <span className="break-keep flex-1">
                            {cleanQ}
                            {isE9Special && (
                              <span className="font-black ml-2 text-[10px] bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-500/60 align-middle inline-block">
                                📋 E-9 근무이력 정보취득
                              </span>
                            )}
                            {item.category && !isE9Special && (
                              <span className="font-bold ml-1.5 text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 align-middle inline-block">
                                {item.category}
                              </span>
                            )}
                          </span>
                        </div>

                        <button
                          onClick={() => handlePlayTTS(cleanQ)}
                          disabled={playingTTS === cleanQ}
                          className="p-1 rounded-md hover:bg-[#1e3a5f] text-blue-400 transition-colors shrink-0 disabled:opacity-50"
                          title="질문 음성으로 듣기"
                        >
                          {playingTTS === cleanQ ? (
                            <Volume2 className="w-4 h-4 animate-pulse text-purple-400" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {cleanTail && (
                        <div className="flex justify-between items-start gap-2 bg-[#051326]/80 rounded-lg p-2 border border-cyan-900/40 text-xs">
                          <div className="flex items-start gap-1.5 flex-1 text-left">
                            <span className="text-cyan-400 font-bold shrink-0 text-[11px] bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-700/30">
                              꼬리질문
                            </span>
                            <span className="text-cyan-200/90 break-keep font-medium leading-relaxed">
                              {cleanTail}
                            </span>
                          </div>
                          <button
                            onClick={() => handlePlayTTS(cleanTail)}
                            disabled={playingTTS === cleanTail}
                            className="p-1 rounded hover:bg-[#1e3a5f] text-cyan-400 transition-colors shrink-0 disabled:opacity-50"
                            title="꼬리질문 음성으로 듣기"
                          >
                            {playingTTS === cleanTail ? (
                              <Volume2 className="w-3.5 h-3.5 animate-pulse text-purple-400" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="dx-card w-full md:w-7/12 flex-1 md:flex-[1.4] flex flex-col relative min-h-0 overflow-hidden bg-[#08172c]">
          <div className="flex border-b border-[#1e3a5f] bg-[#051326] p-1.5 sm:p-2 gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setCurrentTab("korean")}
              className={`flex-1 h-8 sm:h-9 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${currentTab === "korean" ? "text-white bg-blue-600 shadow-md border border-blue-500" : "text-slate-400 bg-transparent hover:bg-slate-800 border border-transparent"}`}
            >
              <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 한국어 평가
            </button>
            <button
              onClick={() => setCurrentTab("skill")}
              className={`flex-1 h-8 sm:h-9 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${currentTab === "skill" ? "text-white bg-hd-green shadow-md border border-green-500" : "text-slate-400 bg-transparent hover:bg-slate-800 border border-transparent"}`}
            >
              <HardHat className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 기량 검증
            </button>
          </div>

          <div className="px-2.5 sm:px-4 py-1.5 flex items-center justify-between gap-2 border-b border-[#1e3a5f] bg-[#0a1b35] z-20 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider hidden xs:inline">
                Score
              </span>
              <div className="bg-[#051326] px-2 sm:px-3 py-0.5 rounded-lg border border-[#1e3a5f] flex items-baseline gap-1 shadow-inner h-8 flex-nowrap items-center">
                <span className="text-base sm:text-lg md:text-xl font-black text-blue-400 leading-none">
                  {currentTab === "korean" ? calcKoreanTotal() : (sWeld || "0")}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-500">
                  /100
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="bg-red-500/15 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 px-2 sm:px-2.5 h-8 rounded-lg text-[11px] sm:text-xs font-bold transition-all shadow-sm flex items-center gap-1 shrink-0"
                title="기존 입력된 점수를 모두 지우고 '대기' 상태로 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">초기화</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={`px-2.5 sm:px-4 h-8 rounded-lg font-black tracking-wide transition-all shadow-md flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-white shrink-0 ${
                  savedSuccess
                    ? "bg-emerald-600 border border-emerald-300 shadow-emerald-900/50"
                    : isCandidateEvaluated
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/40 border border-blue-400/40"
                    : "bg-gradient-to-r from-hd-green to-[#008f4c] hover:from-[#008f4c] hover:to-[#00703c] shadow-green-900/40 border border-emerald-400/30"
                }`}
                title={isCandidateEvaluated ? "변경한 점수를 최종 저장합니다" : "평가 점수를 저장합니다"}
              >
                {savedSuccess ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-white animate-pulse shrink-0" />
                    <span className="whitespace-nowrap">저장 완료!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{isCandidateEvaluated ? "수정 저장" : "평가 저장"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

            <div className="flex-1 overflow-y-auto bg-[#030f1c] relative">
              {currentTab === "korean" ? (
                <div className="p-2.5 sm:p-3 md:p-4 pb-16 md:pb-20 grid grid-cols-1 gap-2.5 sm:gap-3">
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
                        className="bg-[#08172c] border border-[#1e3a5f] p-2.5 sm:p-3.5 rounded-xl shadow-sm transition-all hover:border-blue-500/30 flex flex-col justify-between h-auto min-h-[136px] sm:min-h-[144px] gap-2 sm:gap-2.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-black text-xs sm:text-sm md:text-base text-slate-100 tracking-tight flex items-center gap-1.5 sm:gap-2">
                            <Icon className="text-blue-400 w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />{" "}
                            {item.title}
                          </span>
                          <span className="text-[9px] sm:text-[10px] md:text-xs bg-slate-800 text-slate-400 font-bold px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-lg border border-slate-700 tracking-wider shrink-0">
                            MAX {item.max}
                          </span>
                        </div>
                        <div className="flex justify-between gap-1 sm:gap-1.5 md:gap-2">
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
                                className={`score-btn flex-1 py-1 sm:py-1.5 flex flex-col items-center justify-center rounded-lg ${isActive ? `active-${i}` : ""}`}
                              >
                                <span className="text-[9px] sm:text-[10px] md:text-xs opacity-90 tracking-tight mb-0.5">
                                  {label}
                                </span>
                                <span className="text-sm sm:text-base md:text-lg font-black leading-none">
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
      </div>

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#08172c] border border-[#1e3a5f] rounded-2xl p-6 w-full max-w-lg shadow-2xl relative border-t-4 border-t-blue-500">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.type === "reset"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}
              >
                {confirmModal.type === "reset" ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <Save className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-slate-100 mb-1">
                  {confirmModal.title}
                </h3>
                <p className="text-sm font-bold text-slate-200 leading-relaxed mb-2">
                  {confirmModal.message}
                </p>
                {confirmModal.description && (
                  <p className="text-xs font-medium text-slate-300 bg-[#051326] p-3 rounded-lg border border-[#1e3a5f] leading-relaxed">
                    {confirmModal.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#1e3a5f]">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2.5 rounded-xl text-sm font-black text-white shadow-lg transition-all flex items-center gap-2 ${confirmModal.confirmColor}`}
              >
                {confirmModal.type === "reset" ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{confirmModal.confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
