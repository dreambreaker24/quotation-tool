/**
 * build-prod-from-dev.js
 * quotation-dev.html → quotation.html（移除所有 DEV 設定）
 *
 * DEV 與 PROD 差異：
 *   A. 標題 [DEV] 前綴
 *   B. auth.onAuthStateChanged else 區塊：DEV 登入繞過 + localStorage 還原
 *   C. saveQuote：DEV localStorage 儲存 + throw 攔截
 */

const fs = require('fs');
const path = require('path');
const DEV_PATH = path.join(__dirname, 'quotation-dev.html');
const PROD_PATH = path.join(__dirname, 'quotation.html');
let out = fs.readFileSync(DEV_PATH, 'utf-8');

// ── A. 移除 [DEV] 標題 ──
out = out.replace(
  '<title>[DEV] 奈拾設計 報價單</title>',
  '<title>奈拾設計 報價單</title>'
);

// ── B. 還原 auth else 區塊（替換整個 else 到 }); ） ──
// DEV else 包含：登入繞過 + localStorage 還原 + 多餘的 }
const devAuthElse = `    } else {
      document.getElementById('login-overlay').style.display = 'none';
      document.getElementById('user-status-bar').style.display = 'flex';
      document.getElementById('user-display-name').textContent = '[DEV 測試模式]';
      _canDelete = true; // [DEV]
      var _emBtn = document.getElementById('btn-edit-mode');
      if (_emBtn) _emBtn.style.display = 'inline-block';
      switchCompany('naiship');
      syncHeader();
      document.getElementById('in-contract-terms').value = DEFAULT_CONTRACT_TERMS;
      renderAll();
      // [DEV] 從 localStorage 還原歷史清單
      (function(){
        var _ks = Object.keys(localStorage).filter(function(k){ return k.startsWith('q_'); });
        liveQuotes = _ks.map(function(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } })
          .filter(Boolean).sort(function(a,b){ return (b._savedAt||'') > (a._savedAt||'') ? 1 : -1; });
        renderHistoryList();
      })();
    }
  });`;

const prodAuthElse = `    } else {
      document.getElementById('login-overlay').style.display = 'flex';
      document.getElementById('user-status-bar').style.display = 'none';
      if (unsubscribeListener) { unsubscribeListener(); unsubscribeListener = null; }
      liveQuotes = [];
      renderHistoryList();
    }
  });`;

if (!out.includes(devAuthElse)) {
  console.error('✗ B. auth else 區塊未找到，請手動確認 quotation-dev.html 結構');
  process.exit(1);
}
out = out.replace(devAuthElse, prodAuthElse);

// ── C. 移除 saveQuote DEV localStorage + throw ──
const devSaveBlock = `      const data = serializeQuote();
      // [DEV] localStorage 本地儲存
      data._savedAt = new Date().toISOString();
      var _dk = 'q_' + contractNo.replace(/\\//g, '_');
      localStorage.setItem(_dk, JSON.stringify(data));
      var _di = liveQuotes.findIndex(function(q){ return q.contractNo === contractNo; });
      if (_di >= 0) liveQuotes[_di] = data; else liveQuotes.unshift(data);
      liveQuotes.sort(function(a,b){ return (b._savedAt||'') > (a._savedAt||'') ? 1 : -1; });
      renderHistoryList();
      throw { __DEV__: true, msg: '[DEV] 已儲存（本地）：' + contractNo };
      const user = auth.currentUser;`;

const prodSaveBlock = `      const data = serializeQuote();
      const user = auth.currentUser;`;

if (!out.includes(devSaveBlock)) {
  console.error('✗ C. saveQuote DEV 區塊未找到，請手動確認 quotation-dev.html 結構');
  process.exit(1);
}
out = out.replace(devSaveBlock, prodSaveBlock);

// ── D. 移除 saveQuote catch 中的 __DEV__ 處理 ──
out = out.replace(
  `      if (e && e.__DEV__) { hint.style.color = '#3a3'; hint.textContent = e.msg; setTimeout(function(){ hint.textContent = ''; }, 3000); return; }\n`,
  ''
);

// ── 最終驗證 ──
const checks = [
  ['標題 [DEV] 已移除', !out.includes('[DEV] 奈拾設計 報價單')],
  ['DEV 登入繞過已移除', !out.includes('[DEV 測試模式]')],
  ['saveQuote throw 已移除', !out.includes('throw { __DEV__')],
  ['localStorage save 已移除', !out.includes('// [DEV] localStorage 本地儲存')],
  ['__DEV__ catch 已移除', !out.includes('e.__DEV__')],
];

let ok = true;
checks.forEach(([label, pass]) => {
  console.log((pass ? '✓' : '✗') + ' ' + label);
  if (!pass) ok = false;
});

if (!ok) {
  console.error('\n有驗證失敗，未寫入 quotation.html');
  process.exit(1);
}

fs.writeFileSync(PROD_PATH, out, 'utf-8');
console.log('\n✓ quotation.html 寫入完成，行數：' + out.split('\n').length);
