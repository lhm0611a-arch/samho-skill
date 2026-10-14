export const LATEST_GAS_SCRIPT = `/**
 * ============================================================================
 * [HD현대중공업 기량검증 관리시스템] Google Apps Script (Code.gs)
 * 최신 통합 버전 (구글 드라이브 스마트 매칭 + 수험번호 자동 정규화 + AF/AG열 미디어 연동)
 * ============================================================================
 */

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = { candidates: [], logs: [] };

    function getSheetRobust(name) {
      var sh = ss.getSheetByName(name);
      if (sh) return sh;
      var sheets = ss.getSheets();
      var target = name.replace(/\s/g, '').toLowerCase();
      for (var i = 0; i < sheets.length; i++) {
        var sName = sheets[i].getName().replace(/\s/g, '').toLowerCase();
        if (sName === target || (target === 'log' && sName === '로그') || (target === '로그' && sName === 'log')) {
          return sheets[i];
        }
        if (target.indexOf('사전') > -1 && sName.indexOf('사전') > -1) {
          return sheets[i];
        }
        if (target.indexOf('본기량') > -1 && sName.indexOf('본기량') > -1) {
          return sheets[i];
        }
      }
      return null;
    }

    function formatSheetDate(val) {
      if (!val && val !== 0) return '';
      if (val instanceof Date) {
        return Utilities.formatDate(val, "GMT+9", "yyyy-MM-dd");
      }
      if (typeof val === 'number' && val >= 25000 && val <= 65000) {
        var d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return Utilities.formatDate(d, "GMT+9", "yyyy-MM-dd");
      }
      var s = String(val).trim().replace(/\s+/g, '');
      if (!s || s === '-' || s === 'null' || s === 'undefined') return '';
      if (s.indexOf('T') > -1) s = s.split('T')[0];
      var m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
      if (m) {
        var mm = ('0' + m[2]).slice(-2);
        var dd = ('0' + m[3]).slice(-2);
        return m[1] + '-' + mm + '-' + dd;
      }
      var m2 = s.match(/^(\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
      if (m2) {
        var yyyy = '20' + m2[1];
        var mm2 = ('0' + m2[2]).slice(-2);
        var dd2 = ('0' + m2[3]).slice(-2);
        return yyyy + '-' + mm2 + '-' + dd2;
      }
      if (/^\d{8}$/.test(s)) {
        return s.substring(0, 4) + '-' + s.substring(4, 6) + '-' + s.substring(6, 8);
      }
      return s;
    }

    function computeTrack(agency) {
      if (!agency) return '민간업체';
      var s = String(agency).toLowerCase().replace(/\s+/g, '');
      if (s.indexOf('koica') > -1 || s.indexOf('코이카') > -1 || s.indexOf('세랑') > -1 || s.indexOf('serang') > -1) {
        return '공공기관';
      }
      return '민간업체';
    }

    function parseSheet(sheetName) {
      var sheet = getSheetRobust(sheetName);
      if (!sheet) return;
      var data = sheet.getDataRange().getValues();
      
      var headerIdx = -1;
      for (var i = 0; i < Math.min(data.length, 5); i++) {
        var rowStr = JSON.stringify(data[i]);
        if (rowStr.indexOf('NO') > -1 || rowStr.indexOf('응시번호') > -1 || rowStr.indexOf('수험번호') > -1 || rowStr.indexOf('성 명') > -1 || rowStr.indexOf('성명') > -1) {
          headerIdx = i; break;
        }
      }
      var startIdx = headerIdx !== -1 ? headerIdx + 1 : 1;
      var isMainSheet = sheetName.indexOf('본기량') > -1;

      // 기본 열 인덱스 (0-indexed: Z열=25, AA열=26 등)
      var colPass = 25;       // Z열 기본: 합격일자
      var colFail = 26;       // AA열 기본: 탈락일자
      var colEntry = 27;      // AB열 기본 (본기량): 입국일자
      var colEntryFail = 28;  // AC열 기본 (본기량): 입국탈락일자
      var colTrack = isMainSheet ? 29 : 27; // 본기량: AD열(29) / 사전기량: AB열(27)
      var colDept = 30;       // AE열 기본 (본기량): 부서명
      var colVideo = 31;      // AF열 기본: 영상
      var colTest = 32;       // AG열 기본: 인성검사
      var colStar = 33;       // AH열 기본: 별표
      var colMemo = 34;       // AI열 기본: 면접특이사항
      var colSkillMemo = 35;  // AJ열 기본: 기량특이사항

      // 헤더 행이 존재하면 헤더 텍스트로 열 인덱스를 동적으로 자동 감지
      if (headerIdx !== -1 && data[headerIdx]) {
        var hRow = data[headerIdx];
        for (var c = 0; c < hRow.length; c++) {
          var hStr = String(hRow[c] || '').replace(/\s+/g, '');
          if (!hStr) continue;
          if (hStr.indexOf('합격일자') > -1 || hStr.indexOf('합격일') > -1) colPass = c;
          else if (hStr.indexOf('입국탈락') > -1) colEntryFail = c;
          else if (hStr.indexOf('탈락일자') > -1 || (hStr.indexOf('탈락일') > -1 && hStr.indexOf('입국') === -1)) colFail = c;
          else if (hStr.indexOf('입국일자') > -1 || (hStr.indexOf('입국일') > -1 && hStr.indexOf('탈락') === -1)) colEntry = c;
          else if (hStr.indexOf('트랙') > -1 || hStr.toLowerCase().indexOf('track') > -1) colTrack = c;
          else if (hStr.indexOf('부서') > -1 || hStr.indexOf('배치부서') > -1) colDept = c;
          else if (hStr.indexOf('영상') > -1 || hStr.indexOf('동영상') > -1 || hStr.toLowerCase().indexOf('video') > -1) colVideo = c;
          else if (hStr.indexOf('인성') > -1 || hStr.toLowerCase().indexOf('test') > -1) colTest = c;
          else if (hStr.indexOf('별표') > -1 || hStr.indexOf('★') > -1) colStar = c;
        }
      }
      
      for (var i = startIdx; i < data.length; i++) {
        var r = data[i];
        if (!r[1] && !r[3]) continue;
        
        var dob = r[4] instanceof Date ? Utilities.formatDate(r[4], "GMT+9", "yyyy-MM-dd") : r[4];
        var evalDate = r[24] instanceof Date ? Utilities.formatDate(r[24], "GMT+9", "yyyy-MM-dd HH:mm:ss") : r[24];
        
        // Z열(26번째 열, idx 25) / AA열(27번째 열, idx 26) 등
        var passDate = formatSheetDate(r[colPass]);
        var failDate = formatSheetDate(r[colFail]);
        var entryDate = '';
        var entryFailDate = '';
        var trackVal = '';
        var deptVal = '';

        if (isMainSheet) {
          entryDate = formatSheetDate(r[colEntry]);
          entryFailDate = formatSheetDate(r[colEntryFail]);
          trackVal = String(r[colTrack] || '').trim();
          if (!trackVal) trackVal = computeTrack(String(r[23] || ''));
          deptVal = String(r[colDept] || '').trim();
        } else {
          trackVal = String(r[colTrack] || '').trim();
          if (!trackVal) trackVal = computeTrack(String(r[23] || ''));
        }

        var videoUrl = String(r[colVideo] || '').trim();
        var testUrl = String(r[colTest] || '').trim();
        var starVal = String(r[colStar] || '').trim();
        var isStarred = starVal === '★' || starVal.toUpperCase() === 'O' || starVal.toUpperCase() === 'TRUE' || starVal === '1';
        
        // 메모: AI열(한국어 인터뷰 특이사항) 또는 Q열(기존 의견) 또는 AJ열(기량 특이사항)
        var interviewMemo = String(r[colMemo] || r[16] || '').trim();
        var skillMemo = String(r[colSkillMemo] || '').trim();
        var combinedMemo = interviewMemo || skillMemo || '';
        
        var cand = {
          no: r[0] || i,
          app_no: String(r[1] || '').trim(),
          job: String(r[2] || '').trim(),
          name: String(r[3] || '').trim(),
          dob: String(dob || '').trim(),
          e9: String(r[5] || 'X').trim(),
          age: parseInt(r[6]) || 0,
          k_score: parseInt(r[13]) || 0,
          k_grade: String(r[14] || '-').trim(),
          k_pass: String(r[15] || '대기').trim(),
          s_score_fit: parseInt(r[17]) || 0,
          grade_fit: String(r[18] || '-').trim(),
          s_score_weld: parseInt(r[19]) || 0,
          grade_weld: String(r[20] || '-').trim(),
          result: String(r[21] || '대기').trim(),
          country: String(r[22] || '').trim(),
          agency: String(r[23] || '').trim(),
          eval_date: String(evalDate || '').trim(),
          eval_type: sheetName,
          pass_date: passDate,
          fail_date: failDate,
          entry_date: entryDate,
          entry_fail_date: entryFailDate,
          track: trackVal,
          department: deptVal,
          video_url: videoUrl,
          test_url: testUrl,
          memo: combinedMemo,
          interview_memo: interviewMemo,
          skill_memo: skillMemo,
          starred: isStarred
        };
        
        result.candidates.push(cand);
      }
    }

    parseSheet("사전기량검증");
    parseSheet("본기량검증");

    var logSheet = getSheetRobust("log") || getSheetRobust("로그");
    if (logSheet) {
      var logData = logSheet.getDataRange().getValues();
      for (var i = 1; i < logData.length; i++) {
        var r = logData[i];
        if (!r[0]) continue;
        var ts = r[3] instanceof Date ? Utilities.formatDate(r[3], "GMT+9", "yyyy-MM-dd HH:mm:ss") : r[3];
        result.logs.push({
          app_no: String(r[0] || '').trim(),
          evaluator: String(r[1] || '').trim(),
          score: parseInt(r[2]) || 0,
          timestamp: String(ts || ''),
          details: JSON.stringify([r[4]||0, r[5]||0, r[6]||0, r[7]||0, r[8]||0, r[9]||0]),
          name: String(r[10] || '').trim(), 
          eval_type: String(r[11] || '사전기량검증').trim()
        });
      }
    }

    // applicants 키도 함께 반환하여 상호 호환성 보장
    result.applicants = result.candidates;

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch(ex) {
      payload = JSON.parse(Object.keys(e.parameter)[0]);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    function getSheetRobust(name) {
      var sh = ss.getSheetByName(name);
      if (sh) return sh;
      var sheets = ss.getSheets();
      var target = name.replace(/\\s/g, '').toLowerCase();
      for (var i = 0; i < sheets.length; i++) {
        var sName = sheets[i].getName().replace(/\\s/g, '').toLowerCase();
        if (sName === target || (target === 'log' && sName === '로그') || (target === '로그' && sName === 'log')) {
          return sheets[i];
        }
      }
      return null;
    }

    // =========================================================================
    // 스마트 응시번호 키 추출 함수: KE-11, KE-012, KE11, TM22, TM-022, K-107...
    // 오타나 이름 뒤죽박죽 무관하게 영문 접두사 + 번호 숫자로 1:1 표준화 매칭
    // =========================================================================
    function extractAppNoKey(str) {
      if (!str) return null;
      var clean = String(str).replace(/\\.[a-zA-Z0-9]{2,5}$/, '').trim(); // 확장자 제거
      
      // 패턴 1: 영문 접두사 + 구분자(하이픈/언더바/공백 등 유무 무관) + 숫자 (예: KE-012, KE12, TM-022, K-107 WASKITA)
      var m = clean.match(/^([a-zA-Z]{1,4})\\s*[-_.]*\\s*0*(\\d+)/);
      if (m) {
        return m[1].toUpperCase() + '-' + parseInt(m[2], 10);
      }
      
      // 패턴 2: 단독 숫자 (예: 012, 12)
      var mNum = clean.match(/^0*(\\d+)/);
      if (mNum) {
        return 'NUM-' + parseInt(mNum[1], 10);
      }
      
      // 패턴 3: 파일명 중간에 영문+숫자 패턴이 있는 경우 (예: "2026_KE-11_홍길동")
      var mMid = clean.match(/([a-zA-Z]{1,4})\\s*[-_.]*\\s*0*(\\d+)/);
      if (mMid) {
        return mMid[1].toUpperCase() + '-' + parseInt(mMid[2], 10);
      }
      
      return null;
    }

    // URL 또는 ID 문자열에서 구글 드라이브 폴더 ID 추출
    function extractFolderId(u) {
      if (!u) return '';
      var m = String(u).match(/\\/folders\\/([a-zA-Z0-9_-]+)/);
      if (m) return m[1];
      return String(u).replace(/[?#].*$/, '').trim();
    }

    var appNo = String(payload.app_no || payload.id || '').trim();
    var name = String(payload.name || '').replace(/\\s/g, '');
    var evalType = payload.eval_type || '사전기량검증';
    var saveMode = String(payload.save_mode || payload.saveMode || payload.mode || '').toLowerCase();
    var isReset = (payload.type === 'reset' || payload.action === 'reset');

    // =========================================================================
    // 기능 0: 재평가 초기화 (로그 및 시트 점수 초기화)
    // =========================================================================
    if (isReset) {
      var sheet = getSheetRobust(evalType) || getSheetRobust("사전기량검증");
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        for (var i = 0; i < data.length; i++) {
          var rowAppNo = String(data[i][1] || '').trim();
          var rowName = String(data[i][3] || '').replace(/\\s/g, '');
          
          if (rowAppNo === appNo || (name && rowName === name)) {
            if (saveMode === 'korean') {
              sheet.getRange(i + 1, 8, 1, 6).setValues([[0, 0, 0, 0, 0, 0]]); // H~M열
              sheet.getRange(i + 1, 14).setValue(0);    // N열: 한국어 총점 
              sheet.getRange(i + 1, 15).setValue('-');  // O열: 한국어 등급
              sheet.getRange(i + 1, 16).setValue('대기'); // P열: 합격여부
            } else {
              sheet.getRange(i + 1, 17).setValue('');   // Q열: 의견
              sheet.getRange(i + 1, 18).setValue(0);    // R열: 취부점수
              sheet.getRange(i + 1, 19).setValue('-');  // S열: 취부등급
              sheet.getRange(i + 1, 20).setValue(0);    // T열: 용접점수
              sheet.getRange(i + 1, 21).setValue('-');  // U열: 용접등급
              sheet.getRange(i + 1, 36).setValue('');   // AJ열: 메모
            }
            sheet.getRange(i + 1, 22).setValue('대기'); // V열: 최종결과
            if (payload.eval_date === '') {
              sheet.getRange(i + 1, 25).setValue('');   // Y열
            }
            break; 
          }
        }
      }

      if (saveMode === 'korean') {
        var logSheet = getSheetRobust("log") || getSheetRobust("로그");
        if (logSheet) {
          var logData = logSheet.getDataRange().getValues();
          for (var i = logData.length - 1; i >= 1; i--) {
            var logAppNo = String(logData[i][0] || '').trim();
            if (logAppNo === appNo) {
              logSheet.deleteRow(i + 1);
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Reset complete"})).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 기능 1: 구글 드라이브 폴더 기반 영상/인성검사 자동 매칭 (match_drive_media)
    // =========================================================================
    if (payload.type === 'match_drive_media') {
      var folderVideo = String(payload.folder_url_video || payload.folder_id || '').trim();
      var folderTest = String(payload.folder_url_test || '').trim();
      var matchDate = String(payload.eval_date || '').trim();
      var skipExisting = (payload.skip_existing !== false); // 기본 true (기존 링크 보존)

      var fvId = extractFolderId(folderVideo);
      var ftId = extractFolderId(folderTest);

      var videoFilesMap = {}; // { 'KE-11': 'https://drive.google.com/...' }
      var testFilesMap = {};

      // 1. 영상 폴더 파일 목록 스캔
      if (fvId) {
        try {
          var vFolder = DriveApp.getFolderById(fvId);
          var vFiles = vFolder.getFiles();
          while (vFiles.hasNext()) {
            var f = vFiles.next();
            var fn = f.getName();
            var k = extractAppNoKey(fn);
            var fileUrl = f.getUrl();
            var isPdf = fn.toLowerCase().indexOf('.pdf') !== -1 || fn.indexOf('인성') !== -1 || fn.indexOf('검사') !== -1;
            
            if (k) {
              if (isPdf) {
                testFilesMap[k] = fileUrl;
              } else {
                videoFilesMap[k] = fileUrl;
              }
            }
          }
        } catch(fErr) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "error", 
            message: "구글 드라이브 영상 폴더 접근 실패: " + fErr.toString() + " (폴더 권한 또는 주소를 확인하세요)"
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // 2. 별도 인성검사 폴더가 지정된 경우 스캔
      if (ftId && ftId !== fvId) {
        try {
          var tFolder = DriveApp.getFolderById(ftId);
          var tFiles = tFolder.getFiles();
          while (tFiles.hasNext()) {
            var tf = tFiles.next();
            var tfn = tf.getName();
            var tk = extractAppNoKey(tfn);
            if (tk) {
              testFilesMap[tk] = tf.getUrl();
            }
          }
        } catch(tErr) {
          console.warn("인성검사 폴더 스캔 경고: " + tErr);
        }
      }

      var sheetsToProcess = [];
      if (evalType === 'all' || !evalType) {
        var sMain = getSheetRobust("본기량검증");
        var sPre = getSheetRobust("사전기량검증");
        if (sMain) sheetsToProcess.push(sMain);
        if (sPre) sheetsToProcess.push(sPre);
      } else {
        var sTarget = getSheetRobust(evalType) || getSheetRobust("사전기량검증");
        if (sTarget) sheetsToProcess.push(sTarget);
      }

      if (sheetsToProcess.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({status: "error", message: "시트를 찾을 수 없습니다: " + evalType})).setMimeType(ContentService.MimeType.JSON);
      }

      var matchedV = 0;
      var matchedT = 0;
      var skippedCount = 0;

      for (var sI = 0; sI < sheetsToProcess.length; sI++) {
        var targetSheet = sheetsToProcess[sI];
        var sRows = targetSheet.getDataRange().getValues();

        for (var rIdx = 1; rIdx < sRows.length; rIdx++) {
          var rAppNo = String(sRows[rIdx][1] || '').trim();
          var rDateVal = sRows[rIdx][24];
          var rDate = '';
          if (rDateVal instanceof Date) {
            rDate = Utilities.formatDate(rDateVal, "GMT+9", "yyyy-MM-dd");
          } else if (rDateVal) {
            rDate = String(rDateVal).trim();
          }

          if (!rAppNo) continue;

          // 특정 날짜 필터링이 요청된 경우 일치 여부 점검 (비어있거나 all인 경우 전체 매칭)
          if (matchDate && matchDate !== 'all' && matchDate !== '전체') {
            if (rDate) {
              var cleanRDate = rDate.replace(/[\.\/\s]/g, '-').replace(/-0(\d)/g, '-$1').trim();
              var cleanMDate = matchDate.replace(/[\.\/\s]/g, '-').replace(/-0(\d)/g, '-$1').trim();
              if (cleanRDate.indexOf(cleanMDate) === -1 && cleanMDate.indexOf(cleanRDate) === -1) {
                continue;
              }
            }
          }

          var cKey = extractAppNoKey(rAppNo);
          if (!cKey) continue;

          var existingV = String(sRows[rIdx][31] || '').trim(); // AF열 (32번째 열)
          var existingT = String(sRows[rIdx][32] || '').trim(); // AG열 (33번째 열)
          var rowNumber = rIdx + 1;

          if (videoFilesMap[cKey]) {
            if (!existingV || !skipExisting) {
              targetSheet.getRange(rowNumber, 32).setValue(videoFilesMap[cKey]); // AF열에 영상 저장
              matchedV++;
            } else {
              skippedCount++;
            }
          }

          if (testFilesMap[cKey]) {
            if (!existingT || !skipExisting) {
              targetSheet.getRange(rowNumber, 33).setValue(testFilesMap[cKey]); // AG열에 인성검사 저장
              matchedT++;
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        matched_video: matchedV,
        matched_test: matchedT,
        skipped_existing: skippedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 기능 2: 일괄 미디어 링크 저장 (batch_update_media)
    // =========================================================================
    if (payload.type === 'batch_update_media' && payload.updates && payload.updates.length > 0) {
      var targetSheetM = getSheetRobust(evalType) || getSheetRobust("사전기량검증");
      if (targetSheetM) {
        var allRows = targetSheetM.getDataRange().getValues();
        var updateCount = 0;
        for (var u = 0; u < payload.updates.length; u++) {
          var item = payload.updates[u];
          var targetAppNo = String(item.app_no || '').trim();
          var targetKey = extractAppNoKey(targetAppNo);

          for (var rB = 1; rB < allRows.length; rB++) {
            var rowApp = String(allRows[rB][1] || '').trim();
            if (rowApp === targetAppNo || (targetKey && extractAppNoKey(rowApp) === targetKey)) {
              var rNum = rB + 1;
              if (item.video_url !== undefined) targetSheetM.getRange(rNum, 32).setValue(item.video_url);
              if (item.test_url !== undefined) targetSheetM.getRange(rNum, 33).setValue(item.test_url);
              updateCount++;
              break;
            }
          }
        }
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          updated_count: updateCount
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // =========================================================================
    // 기능 3: 단독 미디어 링크 저장 (update_media)
    // =========================================================================
    if (payload.type === 'update_media') {
      var sheetsToCheck = [];
      if (evalType) {
        var shDirect = getSheetRobust(evalType);
        if (shDirect) sheetsToCheck.push(shDirect);
      }
      var sMain = getSheetRobust("본기량검증");
      var sPre = getSheetRobust("사전기량검증");
      if (sMain && sheetsToCheck.indexOf(sMain) === -1) sheetsToCheck.push(sMain);
      if (sPre && sheetsToCheck.indexOf(sPre) === -1) sheetsToCheck.push(sPre);

      for (var sIdx = 0; sIdx < sheetsToCheck.length; sIdx++) {
        var sheetU = sheetsToCheck[sIdx];
        var dataU = sheetU.getDataRange().getValues();
        var targetK = extractAppNoKey(appNo);
        for (var ru = 1; ru < dataU.length; ru++) {
          var rApp = String(dataU[ru][1] || '').trim();
          var rNm = String(dataU[ru][3] || '').replace(/\s/g, '');
          if (rApp === appNo || (targetK && extractAppNoKey(rApp) === targetK) || (name && rNm === name)) {
            var rNumU = ru + 1;
            if (payload.video_url !== undefined) sheetU.getRange(rNumU, 32).setValue(payload.video_url);
            if (payload.test_url !== undefined) sheetU.getRange(rNumU, 33).setValue(payload.test_url);
            return ContentService.createTextOutput(JSON.stringify({
              status: "success",
              message: "Media updated successfully in " + sheetU.getName()
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "대상 응시자를 시트에서 찾을 수 없습니다: " + appNo
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 기능 3-2: 별표(특이사항/관심) 상태 토글 (toggle_star)
    // =========================================================================
    if (payload.type === 'toggle_star' || payload.type === 'update_star') {
      var sheetsStar = [];
      if (evalType) {
        var shD = getSheetRobust(evalType);
        if (shD) sheetsStar.push(shD);
      }
      var sMainS = getSheetRobust("본기량검증");
      var sPreS = getSheetRobust("사전기량검증");
      if (sMainS && sheetsStar.indexOf(sMainS) === -1) sheetsStar.push(sMainS);
      if (sPreS && sheetsStar.indexOf(sPreS) === -1) sheetsStar.push(sPreS);

      var starValToSet = payload.starred ? '★' : '';
      for (var sI = 0; sI < sheetsStar.length; sI++) {
        var shStar = sheetsStar[sI];
        var dStar = shStar.getDataRange().getValues();
        var tK = extractAppNoKey(appNo);
        for (var rs = 1; rs < dStar.length; rs++) {
          var rA = String(dStar[rs][1] || '').trim();
          var rN = String(dStar[rs][3] || '').replace(/\s/g, '');
          if (rA === appNo || (tK && extractAppNoKey(rA) === tK) || (name && rN === name)) {
            var rNStar = rs + 1;
            // AH열(34번째 열, 인덱스 33)에 별표 저장
            shStar.getRange(rNStar, 34).setValue(starValToSet);
            return ContentService.createTextOutput(JSON.stringify({
              status: "success",
              starred: !!payload.starred,
              message: "Star updated successfully in " + shStar.getName()
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "대상 응시자를 시트에서 찾을 수 없습니다: " + appNo
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 기능 3-3: 일정 및 부서 일괄/개별 등록 및 수정/삭제 (batch_update_management)
    // =========================================================================
    if (payload.type === 'batch_update_management' || payload.type === 'update_management') {
      function computeTrackGas(agency) {
        if (!agency) return '민간업체';
        var s = String(agency).toLowerCase().replace(/\s+/g, '');
        if (s.indexOf('koica') > -1 || s.indexOf('코이카') > -1 || s.indexOf('세랑') > -1 || s.indexOf('serang') > -1) {
          return '공공기관';
        }
        return '민간업체';
      }

      var updates = payload.updates || [payload];
      var count = 0;

      for (var u = 0; u < updates.length; u++) {
        var up = updates[u];
        var tApp = String(up.app_no || '').trim();
        var tKey = extractAppNoKey(tApp);
        var tName = String(up.name || '').replace(/\s/g, '');
        var tType = up.eval_type || evalType;

        var targetSheets = [];
        if (tType) {
          var sDirect = getSheetRobust(tType);
          if (sDirect) targetSheets.push(sDirect);
        }
        var sMainM = getSheetRobust("본기량검증");
        var sPreM = getSheetRobust("사전기량검증");
        if (sMainM && targetSheets.indexOf(sMainM) === -1) targetSheets.push(sMainM);
        if (sPreM && targetSheets.indexOf(sPreM) === -1) targetSheets.push(sPreM);

        for (var sIdx = 0; sIdx < targetSheets.length; sIdx++) {
          var targetSh = targetSheets[sIdx];
          var isMain = targetSh.getName().indexOf('본기량') > -1;
          var rowsD = targetSh.getDataRange().getValues();
          var matched = false;

          var colWritePass = 26;
          var colWriteFail = 27;
          var colWriteEntry = 28;
          var colWriteEntryFail = 29;
          var colWriteTrack = isMain ? 30 : 28;
          var colWriteDept = 31;

          if (rowsD.length > 0) {
            for (var hIdx = 0; hIdx < Math.min(rowsD.length, 5); hIdx++) {
              var hRow = rowsD[hIdx];
              var hFound = false;
              for (var c = 0; c < hRow.length; c++) {
                var hStr = String(hRow[c] || '').replace(/\s+/g, '');
                if (hStr.indexOf('합격일자') > -1 || hStr.indexOf('합격일') > -1) { colWritePass = c + 1; hFound = true; }
                else if (hStr.indexOf('입국탈락') > -1) { colWriteEntryFail = c + 1; hFound = true; }
                else if (hStr.indexOf('탈락일자') > -1 || (hStr.indexOf('탈락일') > -1 && hStr.indexOf('입국') === -1)) { colWriteFail = c + 1; hFound = true; }
                else if (hStr.indexOf('입국일자') > -1 || (hStr.indexOf('입국일') > -1 && hStr.indexOf('탈락') === -1)) { colWriteEntry = c + 1; hFound = true; }
                else if (hStr.indexOf('트랙') > -1 || hStr.toLowerCase().indexOf('track') > -1) { colWriteTrack = c + 1; hFound = true; }
                else if (hStr.indexOf('부서') > -1 || hStr.indexOf('배치부서') > -1) { colWriteDept = c + 1; hFound = true; }
              }
              if (hFound) break;
            }
          }

          for (var rIdx = 1; rIdx < rowsD.length; rIdx++) {
            var rowApp = String(rowsD[rIdx][1] || '').trim();
            var rowNm = String(rowsD[rIdx][3] || '').replace(/\s/g, '');
            if (rowApp === tApp || (tKey && extractAppNoKey(rowApp) === tKey) || (tName && rowNm === tName)) {
              var rNum = rIdx + 1;
              var agencyVal = String(rowsD[rIdx][23] || '');
              var trackToSet = computeTrackGas(agencyVal);

              // 1. 합격일자
              if (up.pass_date !== undefined) {
                targetSh.getRange(rNum, colWritePass).setValue(up.pass_date || '');
                if (up.pass_date) targetSh.getRange(rNum, colWriteFail).setValue(''); // 합격 시 탈락일자 초기화
              }

              // 2. 탈락일자
              if (up.fail_date !== undefined) {
                targetSh.getRange(rNum, colWriteFail).setValue(up.fail_date || '');
                if (up.fail_date) targetSh.getRange(rNum, colWritePass).setValue(''); // 탈락 시 합격일자 초기화
              }

              if (isMain) {
                // 본기량검증:
                // 입국일자
                if (up.entry_date !== undefined) {
                  targetSh.getRange(rNum, colWriteEntry).setValue(up.entry_date || '');
                  if (up.entry_date) targetSh.getRange(rNum, colWriteEntryFail).setValue(''); // 입국 시 입국탈락일자 초기화
                }
                // 입국 탈락일자
                if (up.entry_fail_date !== undefined) {
                  targetSh.getRange(rNum, colWriteEntryFail).setValue(up.entry_fail_date || '');
                  if (up.entry_fail_date) targetSh.getRange(rNum, colWriteEntry).setValue(''); // 입국탈락 시 입국일자 초기화
                }
                // 트랙 (자동 판별 또는 지정)
                targetSh.getRange(rNum, colWriteTrack).setValue(up.track || trackToSet);
                // 부서명
                if (up.department !== undefined) {
                  targetSh.getRange(rNum, colWriteDept).setValue(up.department || '');
                }
              } else {
                // 사전기량검증:
                // 트랙 (자동 판별 또는 지정)
                targetSh.getRange(rNum, colWriteTrack).setValue(up.track || trackToSet);
              }

              count++;
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        updated_count: count,
        message: "일정 및 부서 정보가 성공적으로 반영되었습니다."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 기능 4: 개별 평가 완료 저장 (save)
    // =========================================================================
    if (payload.type === 'save' || !payload.type) {
      var sheetS = getSheetRobust(evalType) || getSheetRobust("사전기량검증");
      if (sheetS) {
        var dataS = sheetS.getDataRange().getValues();
        for (var i = 0; i < dataS.length; i++) {
          var rowAppNoS = String(dataS[i][1] || '').trim();
          var rowNameS = String(dataS[i][3] || '').replace(/\\s/g, '');
          
          if (rowAppNoS === appNo || (name && rowNameS === name)) {
            var rowIdxS = i + 1;
            if (saveMode === 'korean') {
              var avgDetailed = payload.avg_detailed || payload.k_vals || [0, 0, 0, 0, 0, 0];
              sheetS.getRange(rowIdxS, 8, 1, 6).setValues([avgDetailed]); 
              sheetS.getRange(rowIdxS, 14).setValue(payload.k_score || 0); 
              sheetS.getRange(rowIdxS, 15).setValue(payload.k_grade || '-');
              sheetS.getRange(rowIdxS, 16).setValue(payload.k_pass || '대기');
              // 한국어 인터뷰 특이사항: Q열(기존의견) 및 AI열(35번째 열)에 저장
              if (payload.interview_memo !== undefined || payload.memo !== undefined) {
                var memoToSave = payload.interview_memo !== undefined ? payload.interview_memo : (payload.memo || '');
                sheetS.getRange(rowIdxS, 17).setValue(memoToSave); // Q열
                sheetS.getRange(rowIdxS, 35).setValue(memoToSave); // AI열: 한국어 면접 특이사항
              }
            } else {
              sheetS.getRange(rowIdxS, 18).setValue(payload.s_score_fit || payload.fit_score || 0); 
              sheetS.getRange(rowIdxS, 19).setValue(payload.grade_fit || payload.fit_grade || '-');   
              sheetS.getRange(rowIdxS, 20).setValue(payload.s_score_weld || payload.weld_score || 0); 
              sheetS.getRange(rowIdxS, 21).setValue(payload.grade_weld || payload.weld_grade || '-');   
              // 기량 검증 추가 특이사항: AJ열(36번째 열)에 저장
              if (payload.skill_memo !== undefined) {
                sheetS.getRange(rowIdxS, 36).setValue(payload.skill_memo);
              } else if (payload.memo !== undefined) {
                sheetS.getRange(rowIdxS, 36).setValue(payload.memo);
              }
            }
            sheetS.getRange(rowIdxS, 22).setValue(payload.result || '대기');
            if (payload.eval_date) {
              sheetS.getRange(rowIdxS, 25).setValue(payload.eval_date);
            }
            if (payload.video_url !== undefined) sheetS.getRange(rowIdxS, 32).setValue(payload.video_url);
            if (payload.test_url !== undefined) sheetS.getRange(rowIdxS, 33).setValue(payload.test_url);
            if (payload.starred !== undefined) {
              sheetS.getRange(rowIdxS, 34).setValue(payload.starred ? '★' : ''); // AH열
            }
            break; 
          }
        }
      }

      if (saveMode === 'korean') {
        var logSheetS = getSheetRobust("log") || getSheetRobust("로그");
        if (logSheetS) {
          var todayS = payload.eval_date || Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
          var kScores = payload.avg_detailed || payload.k_vals || [0, 0, 0, 0, 0, 0];
          logSheetS.appendRow([
            appNo,
            payload.evaluator || '평가관',
            payload.k_score || 0,
            todayS,
            kScores[0] || 0,
            kScores[1] || 0,
            kScores[2] || 0,
            kScores[3] || 0,
            kScores[4] || 0,
            kScores[5] || 0,
            payload.name || '',
            evalType
          ]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Saved successfully"})).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Action processed"})).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 💡 [구글 드라이브 접근 권한 승인용 1회 실행 함수]
 * Apps Script 에디터 상단 함수 목록에서 'testDriveAccess'를 선택하고 [실행]을 클릭하면,
 * 구글 계정 권한 승인 창이 뜹니다. 최초 1회 승인해 주시면 DriveApp이 원활히 동작합니다.
 */
function testDriveAccess() {
  var rootName = DriveApp.getRootFolder().getName();
  Logger.log("DriveApp 권한 승인 완료! 루트 폴더명: " + rootName);
}
`;
