const fs = require('fs');
const priceDB = JSON.parse(fs.readFileSync('C:/AI助理 Claude/price_db_temp.json', 'utf8'));
let out = fs.readFileSync('C:/AI助理 Claude/quotation.html', 'utf8');

// ── 跳過 Step 1：標題不加 [DEV] 前綴 ──

// ── 2. Modal CSS ──
const modalCSS = `
    /* ── 牌價選擇 Modal ── */
    #price-modal {
      display:none; position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.55); z-index:9000; align-items:center; justify-content:center;
    }
    #price-modal.open { display:flex; }
    #price-modal-box {
      background:#fff; border-radius:10px; width:600px; max-height:82vh;
      display:flex; flex-direction:column;
      box-shadow:0 8px 40px rgba(0,0,0,0.25); overflow:hidden;
    }
    #price-modal-header {
      display:flex; justify-content:space-between; align-items:center;
      padding:14px 18px; border-bottom:1px solid #eee; flex-shrink:0;
    }
    #price-modal-header strong { font-size:15px; color:#2C2C2C; }
    #price-modal-header button {
      padding:4px 10px; background:#eee; border:none; border-radius:4px;
      cursor:pointer; font-size:13px; color:#555; font-family:inherit;
    }
    #price-modal-search { padding:10px 14px 0; flex-shrink:0; }
    #price-modal-search input {
      width:100%; padding:8px 12px; border:1px solid #ccc; border-radius:6px;
      font-size:14px; font-family:"Microsoft JhengHei",sans-serif; outline:none; box-sizing:border-box;
    }
    #price-modal-search input:focus { border-color:#2C2C2C; }
    #price-cat-tabs { display:flex; flex-wrap:wrap; gap:4px; padding:8px 0 6px; }
    .price-cat-tab {
      padding:3px 10px; border-radius:20px; border:1px solid #ddd;
      font-size:11px; cursor:pointer; white-space:nowrap; background:#fff;
      font-family:"Microsoft JhengHei",sans-serif; color:#555;
    }
    .price-cat-tab.active { background:#2C2C2C; color:#fff; border-color:#2C2C2C; }
    #price-modal-list { overflow-y:auto; flex:1; padding:4px 0 8px; }
    .price-item { padding:8px 16px; border-bottom:1px solid #f5f5f5; cursor:pointer; }
    .price-item:hover { background:#f7f7f7; }
    .price-item-desc { font-size:13px; font-weight:bold; color:#1a1a1a; }
    .price-item-spec { font-size:11px; color:#888; margin-top:1px; }
    .price-item-meta { font-size:11px; color:#666; margin-top:2px; }
    .price-item-meta .pv { color:#2C2C2C; font-weight:bold; }`;

out = out.replace('  </style>', modalCSS + '\n  </style>');

// ── 3. Modal HTML ──
const modalHTML = `
  <!-- 牌價選擇 Modal -->
  <div id="price-modal" onclick="if(event.target===this)closePriceModal()">
    <div id="price-modal-box">
      <div id="price-modal-header">
        <strong>從牌價表選擇</strong>
        <div style="display:flex; align-items:center; gap:10px;">
          <label style="font-size:12px;color:#555;cursor:pointer;display:flex;align-items:center;gap:3px;user-select:none;">
            <input type="checkbox" id="price-modal-multi-toggle" onchange="_priceModalMulti=this.checked" style="cursor:pointer;"> 連續新增
          </label>
          <button onclick="closePriceModal()">✕ 關閉</button>
        </div>
      </div>
      <div id="price-modal-search">
        <input type="text" id="price-modal-input"
          placeholder="搜尋項目（如：磁磚、天花板、嵌燈、水電）…"
          oninput="renderPriceList(this.value)"
          onkeydown="if(event.key==='Escape')closePriceModal()">
        <div id="price-cat-tabs"></div>
      </div>
      <div id="price-modal-list"></div>
    </div>
  </div>`;

out = out.replace('</body>', modalHTML + '\n</body>');

// ── 4. 兩顆按鈕 + 材料說明折疊區 ──
out = out.replace(
    `      <button onclick="addSubItem(\${cat.id})" style="margin-top:8px; width:100%; padding:6px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:inherit; font-size:12px;">＋ 新增細項</button>`,
    `      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px;">
        <button onclick="addSubItem(\${cat.id})" style="padding:6px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:inherit; font-size:12px;">＋ 手動新增</button>
        <button onclick="openPriceModal(\${cat.id})" style="padding:6px; background:#1565c0; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:inherit; font-size:12px;">📋 從牌價表選</button>
      </div>
      <div style="margin-top:6px;">
        <button id="note-toggle-\${cat.id}" onclick="toggleCatNote(\${cat.id})"
          style="width:100%; padding:3px 8px; background:transparent; border:1px solid \${cat.note ? '#a8c8f0' : '#e0e0e0'}; border-radius:4px; cursor:pointer; font-size:11px; color:\${cat.note ? '#1565c0' : '#aaa'}; font-family:inherit; text-align:left;">
          \${cat.note ? '📝 材料說明 ▲' : '📝 加入材料說明'}
        </button>
        <div id="note-area-\${cat.id}" style="display:\${cat.note ? 'block' : 'none'}; margin-top:3px;">
          <textarea id="note-text-\${cat.id}"
            oninput="updateCat(\${cat.id},'note',this.value)"
            style="width:100%; min-height:68px; padding:5px 7px; border:1px solid #c7d8f8; border-radius:4px; font-family:inherit; font-size:11px; color:#1565c0; background:#f0f8ff; resize:vertical; box-sizing:border-box; line-height:1.5;"
            placeholder="材料品牌、注意事項…">\${escHtml(cat.note || '')}</textarea>
        </div>
      </div>`
);

// ── 跳過 Step 5：DEV 登入繞過 ──

// ── 6. getCatTotal：拆除工程加入垃圾費 ──
out = out.replace(
    `  function getCatTotal(cat) {
    return cat.subItems.reduce((s, i) => s + (i.price||0)*(i.qty||0), 0);
  }`,
    `  function getCatTotal(cat) {
    var base = cat.subItems.reduce((s, i) => s + (i.price||0)*(i.qty||0), 0);
    if (cat.name && cat.name.includes('拆除') && cat.subItems.some(function(i) { return (i.qty||0) > 0; })) {
      var qtySum = cat.subItems.reduce(function(s, i) { return s + (i.qty||0); }, 0);
      base += qtySum * 20000;
    }
    return base;
  }`
);

// ── 7. renderPage2：拆除垃圾列 + 注意事項 ──
out = out.replace(
    `      container.appendChild(section);
    });
  }

  // ── 計算金額 ───────────────────────────────────────────
  function calcTotals() {`,
    `      container.appendChild(section);
      if (cat.name && cat.name.includes('拆除') && cat.subItems.some(function(i) { return (i.qty||0) > 0; })) {
        var _tbody = section.querySelector('tbody');
        if (_tbody) {
          var _qtySum = cat.subItems.reduce(function(s, i) { return s + (i.qty||0); }, 0);
          var _rowBase = cat.subItems.length;
          [
            { label: '垃圾清運', total: _qtySum * 2000 },
            { label: '工程中廢棄物清理', total: _qtySum * 18000 }
          ].forEach(function(r, ri) {
            var tr = document.createElement('tr');
            tr.style.background = (_rowBase + ri) % 2 === 0 ? '#fff' : '#f7f6f3';
            tr.innerHTML =
              '<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">' + (_rowBase + ri + 1) + '</td>' +
              '<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;">' + r.label + '</td>' +
              '<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;color:#555;"></td>' +
              '<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">1</td>' +
              '<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">式</td>' +
              '<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">—</td>' +
              '<td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;">' + r.total.toLocaleString() + '</td>' +
              '<td class="cost-col" style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:right;color:#888;">—</td>' +
              '<td class="cost-col" style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:right;color:#888;">—</td>';
            _tbody.appendChild(tr);
          });
          var _existRows = Array.from(_tbody.querySelectorAll('tr'));
          _existRows.slice(0, cat.subItems.length).forEach(function(row) {
            var cells = row.querySelectorAll('td');
            if (cells[3]) cells[3].textContent = '1';
            if (cells[4]) cells[4].textContent = '式';
            if (cells[5]) cells[5].textContent = '—';
          });
        }
      }
      var _note = cat.note || '';
      if (_note) {
        var _noteDiv = document.createElement('div');
        _noteDiv.style.cssText = 'background:#eff6ff;color:#1e40af;font-size:8.5pt;padding:6px 12px;border-left:3px solid #60a5fa;margin-top:0;white-space:pre-wrap;line-height:1.6;';
        _noteDiv.textContent = _note;
        section.appendChild(_noteDiv);
      }
    });
  }

  // ── 計算金額 ───────────────────────────────────────────
  function calcTotals() {`
);

// ── 8a. addSubItem：初始有 price+cost 時自動算毛利 ──
out = out.replace(
    `    if (data) Object.assign(item, { desc: data.desc||'', spec: data.spec||'', qty: data.qty||1, unit: data.unit||'式', price: data.price||0, cost: data.cost||0, margin: data.margin||0 });`,
    `    if (data) Object.assign(item, { desc: data.desc||'', spec: data.spec||'', qty: data.qty||1, unit: data.unit||'式', price: data.price||0, cost: data.cost||0, margin: data.margin||0 });
    if (!data?.margin && item.price > 0 && item.cost > 0) {
      item.margin = Math.round((item.price - item.cost) / item.price * 1000) / 10;
    }`
);

// ── 8. 毛利欄 id ──
out = out.replace(
    `          <input type="number" value="\${item.margin||''}" placeholder="—" oninput="updateSubItem(\${catId},\${item.id},'margin',+this.value)"`,
    `          <input id="sub-margin-\${item.id}" type="number" value="\${item.margin||''}" placeholder="—" oninput="updateSubItem(\${catId},\${item.id},'margin',+this.value)"`
);

// ── 9. updateSubItem：price/cost 有值→算毛利；margin→算單價 ──
out = out.replace(
    `    if ((field === 'cost' || field === 'margin') && item.cost > 0 && item.margin > 0) {\n      item.price = Math.round(item.cost * (1 + item.margin / 100));\n      const priceEl = document.getElementById(\`sub-price-\${item.id}\`);\n      if (priceEl) priceEl.value = item.price;\n    }`,
    function() { return `    if (field === 'margin') {\n      if (item.cost > 0 && item.margin > 0) {\n        item.price = Math.round(item.cost * (1 + item.margin / 100));\n        const priceEl = document.getElementById(\`sub-price-\${item.id}\`);\n        if (priceEl) priceEl.value = item.price;\n      }\n    } else if (field === 'price' || field === 'cost') {\n      if (item.price > 0 && item.cost > 0) {\n        item.margin = Math.round((item.price - item.cost) / item.price * 1000) / 10;\n        const marginEl = document.getElementById(\`sub-margin-\${item.id}\`);\n        if (marginEl) marginEl.value = item.margin;\n      }\n    }`; }
);

// ── 10. renderAll：加 updateLeftTotal ──
out = out.replace(
    `  function renderAll() { renderPage1(); renderPage2(); calcTotals(); requestAnimationFrame(updatePrintZoom); }`,
    `  function renderAll() { renderPage1(); renderPage2(); calcTotals(); updateLeftTotal(); updateCatSubtotals(); updateMarginColors(); requestAnimationFrame(updatePrintZoom); }`
);

// ── 11. addCategory：初始化 note 欄位 ──
out = out.replace(
    `    const cat = { id, name: '', unit: '式', qty: 1, subItems: [] };
    if (data) { cat.name = data.name || ''; cat.unit = data.unit || '式'; cat.qty = data.qty || 1; }`,
    `    const cat = { id, name: '', unit: '式', qty: 1, subItems: [], note: '' };
    if (data) { cat.name = data.name || ''; cat.unit = data.unit || '式'; cat.qty = data.qty || 1; cat.note = (data.note !== undefined) ? data.note : (getCatNote(data.name || '') || ''); }`
);

// ── 12. updateCat：NaN guard + 自動帶入材料說明 ──
out = out.replace(
    `  function updateCat(catId, field, value) {
    const cat = categories.find(c => c.id === catId);
    if (cat) { cat[field] = field === 'qty' ? +value : value; renderAll(); }
  }`,
    `  function updateCat(catId, field, value) {
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      var _num = +value;
      cat[field] = field === 'qty' ? (isNaN(_num) || _num < 0 ? 0 : _num) : value;
      if (field === 'name' && !cat.note) {
        var _autoNote = getCatNote(value);
        if (_autoNote) {
          cat.note = _autoNote;
          var _na = document.getElementById('note-area-' + catId);
          var _nt = document.getElementById('note-text-' + catId);
          var _nb = document.getElementById('note-toggle-' + catId);
          if (_na) _na.style.display = 'block';
          if (_nt) _nt.value = _autoNote;
          if (_nb) { _nb.textContent = '📝 材料說明 ▲'; _nb.style.color = '#1565c0'; _nb.style.borderColor = '#a8c8f0'; }
        }
      }
      renderAll();
    }
  }`
);

// ── 13. serializeQuote：儲存 note ──
out = out.replace(
    `        name: cat.name,\n        unit: cat.unit,\n        qty: cat.qty,`,
    `        name: cat.name,\n        note: cat.note || '',\n        unit: cat.unit,\n        qty: cat.qty,`
);

// ── 14. 左側總金額 bar + 模板按鈕（新增大項靠近大項列表，小計在下）──
out = out.replace(
    `    <button onclick="addCategory()" style="margin-top:10px; width:100%; padding:8px; background:#2C2C2C; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:inherit;">＋ 新增大項</button>`,
    `    <div style="position:relative; margin-top:8px;">
      <div style="display:flex;">
        <button onclick="addCategory()" style="flex:1; padding:8px; background:#2C2C2C; color:#fff; border:none; border-radius:4px 0 0 4px; cursor:pointer; font-family:inherit;">＋ 新增大項</button>
        <button onclick="toggleQuickAdd(this)" style="padding:8px 12px; background:#444; color:#fff; border:none; border-left:1px solid #666; border-radius:0 4px 4px 0; cursor:pointer; font-size:13px;" title="從常用分類新增">▼</button>
      </div>
      <div id="quick-add-menu" style="display:none; position:absolute; top:100%; margin-top:2px; left:0; right:0; background:#fff; border:1px solid #ddd; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:100; overflow:hidden;"></div>
    </div>
    <div id="left-total-bar" style="margin-top:8px; padding:8px 12px; background:#f0f4ff; border-radius:6px; border:1px solid #c7d8f8; display:none; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;"></div>
    <div style="margin-top:8px; margin-bottom:4px;">
      <div style="font-size:11px; color:#aaa; margin-bottom:5px;">套用模板</div>
      <div style="display:flex; gap:5px; flex-wrap:wrap;">
        <button onclick="applyTemplate('full')" style="padding:4px 10px; background:#fff; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:12px; font-family:inherit; color:#444;">🏠 住宅全室</button>
        <button onclick="applyTemplate('bathroom')" style="padding:4px 10px; background:#fff; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:12px; font-family:inherit; color:#444;">🚿 衛浴翻新</button>
        <button onclick="applyTemplate('kitchen')" style="padding:4px 10px; background:#fff; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:12px; font-family:inherit; color:#444;">🍳 廚房翻新</button>
      </div>
    </div>`
);

// ── renderCatInput：加上移/下移按鈕 ──
out = out.replace(
    `      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="font-size:13px; color:#333;">大項</strong>
        <button onclick="removeCategory(\${cat.id})" style="padding:2px 8px; background:#e55; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:12px;">✕ 刪除</button>
      </div>`,
    `      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <strong style="font-size:13px; color:#333;">大項</strong>
          <span id="cat-subtotal-\${cat.id}" style="font-size:11px;color:#1565c0;font-weight:bold;background:#eef5ff;padding:1px 6px;border-radius:3px;display:none;"></span>
        </div>
        <div style="display:flex; gap:4px; align-items:center;">
          <button onclick="moveCat(\${cat.id},-1)" style="padding:2px 7px; background:#888; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:13px;" title="上移">↑</button>
          <button onclick="moveCat(\${cat.id},1)" style="padding:2px 7px; background:#888; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:13px;" title="下移">↓</button>
          <button onclick="confirmRemoveCat(\${cat.id})" style="padding:2px 8px; background:#e55; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:12px;">✕ 刪除</button>
        </div>
      </div>`
);

// ── 細項搜尋欄 ──
out = out.replace(
    `      <div style="background:#f7f7f7; border-radius:4px; padding:8px;" id="sub-list-\${cat.id}">
        <label style="font-size:11px; color:#888; display:block; margin-bottom:4px;">細項</label>`,
    `      <div style="background:#f7f7f7; border-radius:4px; padding:8px;" id="sub-list-\${cat.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label style="font-size:11px; color:#888;">細項</label>
          <input type="text" placeholder="搜尋細項…" oninput="filterSubItems(\${cat.id},this.value)"
            style="width:90px; padding:2px 6px; border:1px solid #ddd; border-radius:3px; font-size:11px; background:#fff; font-family:inherit;">
        </div>`
);

// ── renderSubInput：複製按鈕 + 算式數量輸入 ──
out = out.replace(
    `        <button onclick="removeSubItem(\${catId},\${item.id})"
          style="padding:2px 8px; background:#e55; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:11px; align-self:flex-end;">✕</button>`,
    `        <div style="display:flex; gap:3px; align-self:flex-end;">
          <button onclick="copySubItem(\${catId},\${item.id})" style="padding:2px 7px; background:#1565c0; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:11px;" title="複製此細項">⧉</button>
          <button onclick="removeSubItem(\${catId},\${item.id})" style="padding:2px 8px; background:#e55; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:11px;">✕</button>
        </div>`
);

// 算式數量輸入（type=number → type=text）
out = out.replace(
    `          <input type="number" value="\${item.qty}" oninput="updateSubItem(\${catId},\${item.id},'qty',+this.value)"
            style="width:100%; padding:3px; border:1px solid #ddd; border-radius:3px; font-size:12px;" min="0">`,
    `          <input type="text" inputmode="decimal" value="\${item.qty}"
            oninput="updateSubItem(\${catId},\${item.id},'qty',evalQtyExpr(this.value))"
            onblur="var _r=evalQtyExpr(this.value); updateSubItem(\${catId},\${item.id},'qty',_r); this.value=_r;"
            onkeydown="if(event.key==='Enter'){var _r=evalQtyExpr(this.value);updateSubItem(\${catId},\${item.id},'qty',_r);this.value=_r;this.blur();}"
            style="width:100%; padding:3px; border:1px solid #ddd; border-radius:3px; font-size:12px;" placeholder="數量或算式">`
);

// spec 欄 input → 自動展開 textarea
out = out.replace(
    `        <input type="text" value="\${item.spec}" oninput="updateSubItem(\${catId},\${item.id},'spec',this.value)"
          style="width:100%; padding:3px; border:1px solid #ddd; border-radius:3px; font-family:inherit; font-size:12px;" placeholder="規格說明">`,
    function() { return (
        `        <textarea rows="1" oninput="updateSubItem(\${catId},\${item.id},'spec',this.value);this.style.height='auto';this.style.height=this.scrollHeight+'px';"` +
        `\n          style="width:100%; padding:3px; border:1px solid #ddd; border-radius:3px; font-family:inherit; font-size:12px; resize:none; overflow:hidden; min-height:26px; line-height:1.4; box-sizing:border-box; display:block;" placeholder="規格說明">\${escHtml(item.spec||'')}</textarea>`
    ); }
);

// ── 在 </script> 前插入所有新 JS ──
const newJS = `
  // ── 牌價資料庫 ────────────────────────────────────────
  const PRICE_DB = ${JSON.stringify(priceDB)};

  // ── 注意事項查詢 ──────────────────────────────────────
  function getCatNote(catName) {
    if (!catName) return '';
    for (var i = 0; i < PRICE_DB.length; i++) {
      if (PRICE_DB[i].name === catName) return PRICE_DB[i].note || '';
    }
    return '';
  }

  // ── 左側總金額列 ──────────────────────────────────────
  function updateLeftTotal() {
    var el = document.getElementById('left-total-bar');
    if (!el) return;
    var subtotal = categories.reduce(function(s, cat) { return s + getCatTotal(cat); }, 0);
    if (subtotal === 0) { el.style.display = 'none'; return; }
    var subtotalEl = document.getElementById('prev-subtotal');
    var totalEl = document.getElementById('prev-total');
    var subtotalText = subtotalEl ? subtotalEl.textContent : ('$' + subtotal.toLocaleString());
    var totalText = totalEl ? totalEl.textContent : subtotalText;
    el.style.display = 'flex';
    el.innerHTML =
      '<span style="font-size:11px;color:#555;">工程小計 <strong style="font-size:16px;color:#1565c0;">' + subtotalText + '</strong></span>' +
      (totalText !== subtotalText
        ? '<span style="font-size:11px;color:#555;">含管費總額 <strong style="font-size:16px;color:#2a7a55;">' + totalText + '</strong></span>'
        : '');
  }

  // ── 算式數量解析 ──────────────────────────────────────
  function evalQtyExpr(str) {
    if (!str && str !== 0) return 0;
    var clean = String(str).replace(/[^0-9.+\\-*/() ]/g, '').trim();
    if (!clean) return 0;
    try {
      var r = Function('"use strict";return(' + clean + ')')();
      if (!isFinite(r) || r < 0) return 0;
      return Math.round(r * 1000) / 1000;
    } catch(e) { return Math.max(0, parseFloat(str) || 0); }
  }

  // ── 材料說明折疊切換 ─────────────────────────────────
  function toggleCatNote(catId) {
    var area = document.getElementById('note-area-' + catId);
    var btn = document.getElementById('note-toggle-' + catId);
    if (!area || !btn) return;
    var isOpen = area.style.display !== 'none';
    area.style.display = isOpen ? 'none' : 'block';
    var cat = categories.find(function(c) { return c.id === catId; });
    var hasNote = cat && cat.note;
    if (isOpen) {
      btn.textContent = hasNote ? '📝 材料說明 ✓' : '📝 加入材料說明';
      btn.style.color = hasNote ? '#1565c0' : '#aaa';
      btn.style.borderColor = hasNote ? '#a8c8f0' : '#e0e0e0';
    } else {
      btn.textContent = '📝 材料說明 ▲';
      btn.style.color = '#1565c0';
      btn.style.borderColor = '#a8c8f0';
    }
  }

  // ── 大項上移 / 下移 ───────────────────────────────────
  function moveCat(catId, dir) {
    var idx = categories.findIndex(function(c) { return c.id === catId; });
    if (idx < 0) return;
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categories.length) return;
    var tmp = categories[idx];
    categories[idx] = categories[newIdx];
    categories[newIdx] = tmp;
    var list = document.getElementById('categories-input-list');
    categories.map(function(c) { return document.getElementById('cat-' + c.id); })
      .filter(Boolean).forEach(function(el) { list.appendChild(el); });
    renderAll();
  }

  // ── 細項複製 ──────────────────────────────────────────
  function copySubItem(catId, itemId) {
    var cat = categories.find(function(c) { return c.id === catId; });
    var item = cat && cat.subItems.find(function(s) { return s.id === itemId; });
    if (!item) return;
    addSubItem(catId, { desc: item.desc, spec: item.spec, qty: item.qty, unit: item.unit, price: item.price, cost: item.cost, margin: item.margin });
  }

  // ── 報價模板 ──────────────────────────────────────────
  var TEMPLATES = {
    full:     ['拆除工程','水電工程','泥作工程','木作工程','油漆工程','地板工程'],
    bathroom: ['拆除工程','水電工程','泥作工程','油漆工程'],
    kitchen:  ['拆除工程','水電工程','泥作工程','系統廚具','油漆工程']
  };

  function applyTemplate(key) {
    if (!TEMPLATES[key]) return;
    if (categories.length > 0 && !confirm('目前已有大項，套用模板會清空現有內容，確定嗎？')) return;
    categories = [];
    document.getElementById('categories-input-list').innerHTML = '';
    TEMPLATES[key].forEach(function(name) { addCategory({ name: name }); });
  }

  // ── 刪除確認 ──────────────────────────────────────────
  function confirmRemoveCat(catId) {
    var cat = categories.find(function(c) { return c.id === catId; });
    var name = cat ? (cat.name || '此大項') : '此大項';
    if (confirm('確定刪除「' + name + '」及其所有細項？')) removeCategory(catId);
  }

  // ── 大項小計（左側即時顯示） ─────────────────────────
  function updateCatSubtotals() {
    categories.forEach(function(cat) {
      var el = document.getElementById('cat-subtotal-' + cat.id);
      if (!el) return;
      var total = getCatTotal(cat);
      if (total > 0) { el.textContent = '$' + total.toLocaleString(); el.style.display = ''; }
      else { el.textContent = ''; el.style.display = 'none'; }
    });
  }

  // ── 毛利顏色標示 ──────────────────────────────────────
  function updateMarginColors() {
    categories.forEach(function(cat) {
      cat.subItems.forEach(function(item) {
        var el = document.getElementById('sub-margin-' + item.id);
        if (!el) return;
        var m = item.margin || 0;
        el.style.color = m > 0 && m < 15 ? '#c0392b' : m > 0 && m < 25 ? '#e09000' : '';
        el.style.fontWeight = m > 0 && m < 15 ? 'bold' : '';
      });
    });
  }

  // ── 細項搜尋 ──────────────────────────────────────────
  function filterSubItems(catId, keyword) {
    var cat = categories.find(function(c) { return c.id === catId; });
    if (!cat) return;
    var kw = keyword.trim().toLowerCase();
    cat.subItems.forEach(function(item) {
      var el = document.getElementById('sub-' + item.id);
      if (!el) return;
      var match = !kw || (item.desc||'').toLowerCase().indexOf(kw) >= 0 || (item.spec||'').toLowerCase().indexOf(kw) >= 0;
      el.style.display = match ? '' : 'none';
    });
  }

  // ── 快速分類新增 ──────────────────────────────────────
  function toggleQuickAdd(btn) {
    var menu = document.getElementById('quick-add-menu');
    if (!menu) return;
    if (menu.style.display !== 'none') { menu.style.display = 'none'; return; }
    menu.innerHTML = '';
    PRICE_DB.forEach(function(cat) {
      var b = document.createElement('button');
      b.textContent = cat.name;
      b.style.cssText = 'display:block;width:100%;padding:7px 12px;text-align:left;background:#fff;border:none;border-bottom:1px solid #f0f0f0;cursor:pointer;font-family:inherit;font-size:12px;';
      b.onmouseover = function() { this.style.background = '#f5f7ff'; };
      b.onmouseout = function() { this.style.background = '#fff'; };
      b.onclick = function() { addCategory({ name: cat.name }); menu.style.display = 'none'; };
      menu.appendChild(b);
    });
    menu.style.display = 'block';
    setTimeout(function() {
      document.addEventListener('click', function _close(e) {
        if (!menu.contains(e.target) && e.target !== btn) {
          menu.style.display = 'none';
          document.removeEventListener('click', _close);
        }
      });
    }, 10);
  }

  // ── 牌價選擇 Modal ──────────────────────────────────────
  var _priceItems = [];
  var _priceModalCatId = null;
  var _priceCatFilter = null;
  var _priceModalMulti = false;

  function openPriceModal(catId) {
    _priceModalCatId = catId;
    var cat = categories.find(function(c) { return c.id === catId; });
    if (cat && cat.name) {
      var dbMatch = PRICE_DB.find(function(c) { return c.name === cat.name; });
      if (dbMatch) _priceCatFilter = dbMatch.name;
    }
    document.getElementById('price-modal-input').value = '';
    var _toggle = document.getElementById('price-modal-multi-toggle');
    if (_toggle) _toggle.checked = _priceModalMulti;
    renderCatTabs();
    renderPriceList('');
    document.getElementById('price-modal').classList.add('open');
    setTimeout(function() { document.getElementById('price-modal-input').focus(); }, 60);
  }

  function closePriceModal() {
    document.getElementById('price-modal').classList.remove('open');
    _priceModalCatId = null;
  }

  function renderCatTabs() {
    var tabs = document.getElementById('price-cat-tabs');
    var all = [{ name: '全部', val: null }].concat(PRICE_DB.map(function(c) { return { name: c.name, val: c.name }; }));
    tabs.innerHTML = all.map(function(t) {
      var active = _priceCatFilter === t.val ? ' active' : '';
      var valStr = t.val ? "'" + t.val.replace(/'/g, "\\'") + "'" : 'null';
      return '<button class="price-cat-tab' + active + '" onclick="setPriceCatFilter(' + valStr + ')">' + t.name + '</button>';
    }).join('');
  }

  function setPriceCatFilter(val) {
    _priceCatFilter = val;
    if (val && _priceModalCatId !== null) {
      var cat = categories.find(function(c) { return c.id === _priceModalCatId; });
      if (cat && !cat.name) {
        updateCat(_priceModalCatId, 'name', val);
        var nameInput = document.querySelector('#cat-' + _priceModalCatId + ' input[type="text"]');
        if (nameInput) nameInput.value = val;
      }
    }
    renderCatTabs();
    renderPriceList(document.getElementById('price-modal-input').value);
  }

  function renderPriceList(keyword) {
    var list = document.getElementById('price-modal-list');
    var kw = keyword.trim().toLowerCase();
    _priceItems = [];
    for (var ci = 0; ci < PRICE_DB.length; ci++) {
      var cat = PRICE_DB[ci];
      if (_priceCatFilter && cat.name !== _priceCatFilter) continue;
      for (var ii = 0; ii < cat.items.length; ii++) {
        var item = cat.items[ii];
        if (!kw || item.desc.toLowerCase().indexOf(kw) >= 0 ||
            item.spec.toLowerCase().indexOf(kw) >= 0 ||
            cat.name.toLowerCase().indexOf(kw) >= 0) {
          _priceItems.push({ desc: item.desc, spec: item.spec, unit: item.unit, price: item.price, cost: item.cost, catName: cat.name });
        }
      }
    }
    if (_priceItems.length === 0) {
      list.innerHTML = '<div style="padding:24px;color:#aaa;text-align:center;font-size:13px;">無符合項目</div>';
      return;
    }
    list.innerHTML = _priceItems.map(function(item, i) {
      var specHtml = item.spec ? '<div class="price-item-spec">' + escHtml(item.spec) + '</div>' : '';
      var costHtml = item.cost > 0 ? ' ｜ 成本 <span class="pv">$' + item.cost.toLocaleString() + '</span>' : '';
      return '<div class="price-item" onclick="selectPriceItem(' + i + ')">' +
        '<div class="price-item-desc">' + escHtml(item.desc) + '</div>' +
        specHtml +
        '<div class="price-item-meta">' + escHtml(item.catName) + ' ｜ ' + escHtml(item.unit) +
        ' ｜ 單價 <span class="pv">$' + item.price.toLocaleString() + '</span>' + costHtml + '</div>' +
        '</div>';
    }).join('');
  }

  function selectPriceItem(idx) {
    var item = _priceItems[idx];
    if (!item || _priceModalCatId === null) return;
    var margin = (item.price > 0 && item.cost > 0)
      ? Math.round((item.price - item.cost) / item.price * 1000) / 10
      : 0;
    addSubItem(_priceModalCatId, { desc: item.desc, spec: item.spec, qty: 1, unit: item.unit, price: item.price, cost: item.cost, margin: margin });
    if (!_priceModalMulti) { closePriceModal(); } else {
      var el = document.getElementById('price-modal-list');
      var items = el ? el.querySelectorAll('.price-item') : [];
      if (items[idx]) { items[idx].style.background = '#e8f5e9'; items[idx].style.opacity = '0.6'; }
    }
  }
`;

out = out.replace('<script>\n  // ── Firebase 初始化', function() {
    return '<script>\n' + newJS + '\n  // ── Firebase 初始化';
});

// ══════════════════════════════════════════════════════════════
// ── 視覺設計升級（V1-V7）─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

// ── V1. 頁1 頁首：灰色 → 深色 + 品牌金底線 ──
out = out.replace(
    'background:#808080; margin: -4mm -16mm 0 -16mm; padding: 0 16mm; height:50mm; overflow:hidden;',
    'background:#2C2C2C; border-bottom:3px solid #c9a96e; margin: -4mm -16mm 0 -16mm; padding: 0 16mm; height:50mm; overflow:hidden;'
);

// ── V2. 頁2 頁首：同步升級 ──
out = out.replace(
    'background:#808080; margin:-8mm -14mm 4mm -14mm; padding:0 14mm; height:22mm; print-color-adjust:exact; -webkit-print-color-adjust:exact;',
    'background:#2C2C2C; border-bottom:3px solid #c9a96e; margin:-8mm -14mm 4mm -14mm; padding:0 14mm; height:22mm; print-color-adjust:exact; -webkit-print-color-adjust:exact;'
);

// ── V3. 工程大項：Card 外框 + page-break-inside:avoid ──
out = out.replace(
    "      section.style.marginBottom = '6mm';",
    "      section.style.cssText = 'margin-bottom:8mm; page-break-inside:avoid; break-inside:avoid; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden; box-shadow:0 1px 5px rgba(0,0,0,0.07);';"
);

// ── V4. 大項標題列：字體放大加粗 + 寬 padding ──
out = out.replace(
    '        <div style="background:#2C2C2C; color:#fff; padding:4px 8px; font-size:10pt; font-weight:bold; margin-bottom:0;">',
    function() {
        return '        <div style="background:#2C2C2C; color:#fff; padding:8px 16px; font-size:11.5pt; font-weight:900; margin-bottom:0; letter-spacing:0.5px;">';
    }
);

// ── V5. 欄位標題列：深灰 + 寬 padding ──
out = out.replace(
    '            <tr style="background:#555; color:#fff;">',
    function() { return '            <tr style="background:#444; color:#e0e0e0;">'; }
);
out = out.replace(
    '<th style="padding:4px 5px; text-align:center; width:5%;">項次</th>\n              <th style="padding:4px 5px; text-align:left; width:18%;">工程項目</th>\n              <th style="padding:4px 5px; text-align:left; width:27%;">設備／工法／材料／規格</th>\n              <th style="padding:4px 5px; text-align:right; width:6%;">數量</th>\n              <th style="padding:4px 5px; text-align:center; width:5%;">單位</th>\n              <th style="padding:4px 5px; text-align:right; width:11%;">單價</th>\n              <th style="padding:4px 5px; text-align:right; width:13%;">複價</th>\n              <th class="cost-col" style="padding:4px 5px; text-align:right; width:8%;">成本單價</th>\n              <th class="cost-col" style="padding:4px 5px; text-align:right; width:7%;">成本複價</th>',
    function() {
        return '<th style="padding:5px 6px; text-align:center; width:6%; white-space:nowrap;">項次</th>\n              <th style="padding:5px 6px; text-align:left; width:17%;">工程項目</th>\n              <th style="padding:5px 6px; text-align:left; width:25%;">設備／工法／材料／規格</th>\n              <th style="padding:5px 6px; text-align:right; width:6%;">數量</th>\n              <th style="padding:5px 6px; text-align:left; width:6%; white-space:nowrap;">單位</th>\n              <th style="padding:5px 6px; text-align:right; width:11%;">單價</th>\n              <th style="padding:5px 6px; text-align:right; width:13%;">複價</th>\n              <th class="cost-col" style="padding:5px 6px; text-align:right; width:9%; line-height:1.3;">成本<br>單價</th>\n              <th class="cost-col" style="padding:5px 6px; text-align:right; width:7%; line-height:1.3;">成本<br>複價</th>';
    }
);

// ── V6. 細項列：加寬 padding + 柔和邊框（全域替換） ──
out = out.split('padding:2px 5px; border-bottom:1px solid #eee;').join('padding:4px 6px; border-bottom:1px solid #e5e7eb;');

// ── V6b. 規格欄：允許顯示多行（pre-wrap）──
out = out.replace(
    '<td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; color:#555;">${s.spec||\'\'}',
    function() { return '<td style="padding:4px 6px; border-bottom:1px solid #e5e7eb; color:#555; white-space:pre-wrap;">${s.spec||\'\'}'; }
);

// ── V7. 小計列：暖米色背景 + 品牌金上框線 ──
out = out.replace(
    '            <tr style="background:#f0f0f0; font-weight:bold;">',
    function() { return '            <tr style="background:#fdf8ee; font-weight:bold; border-top:2px solid #c9a96e;">'; }
);
out = out.replace(
    '              <td colspan="6" style="padding:3px 8px; text-align:right; font-size:10pt; color:#1565c0;">小計</td>',
    function() { return '              <td colspan="6" style="padding:5px 6px; text-align:right; font-size:10pt; color:#2C2C2C; letter-spacing:1px;">小計</td>'; }
);
out = out.replace(
    '              <td style="padding:3px 8px; text-align:right; font-size:10pt; color:#1565c0;">${catTotal.toLocaleString()}</td>',
    function() { return '              <td style="padding:5px 6px; text-align:right; font-size:10pt; color:#2C2C2C; font-weight:bold;">${catTotal.toLocaleString()}</td>'; }
);
out = out.replace(
    '              <td class="cost-col" style="padding:3px 8px; text-align:right; font-size:10pt; color:#888;" colspan="2">${catCost > 0 ? catCost.toLocaleString() : \'—\'}</td>',
    function() { return '              <td class="cost-col" style="padding:5px 6px; text-align:right; font-size:10pt; color:#888;" colspan="2">${catCost > 0 ? catCost.toLocaleString() : \'—\'}</td>'; }
);

// ══════════════════════════════════════════════════════════════
// ── 首頁區塊化（W1-W6）────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

// ── W1. 匯款資訊：外層 div 加卡片邊框 ──
out = out.replace(
    '<div id="prev-bank-info" style="font-size:9pt; color:#444; line-height:1.8;"></div>',
    '<div id="prev-bank-info" style="font-size:9pt; color:#444; line-height:1.8; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden; min-width:170px;"></div>'
);

// ── W2. 匯款資訊：loadCompanyInfo 的 innerHTML 加標題列 ──
out = out.replace(
    '    document.getElementById(\'prev-bank-info\').innerHTML =\n      `<div style="font-weight:bold; margin-bottom:2px;">匯款資訊</div>` +\n      `<div>銀行：${b.name} | ${b.code}</div>` +\n      `<div>帳號：${b.account}</div>` +\n      `<div>分行：${b.branch}</div>` +\n      `<div>戶名：${b.holder}</div>`;',
    function() {
        return '    document.getElementById(\'prev-bank-info\').innerHTML =\n      `<div style="background:#2C2C2C; color:#fff; padding:4px 10px; font-size:10pt; font-weight:bold; border-left:3px solid #c9a96e;">匯款資訊</div>` +\n      `<div style="padding:5px 10px; line-height:1.9;"><div>銀行：${b.name} | ${b.code}</div><div>帳號：${b.account}</div><div>分行：${b.branch}</div><div>戶名：${b.holder}</div></div>`;';
    }
);

// ── W3. 備註：卡片 + 標題列 ──
out = out.replace(
    '      <!-- 備註 -->\n      <div id="prev-notes-section" style="margin-bottom:1mm;">\n        <div style="font-weight:bold; margin-bottom:2px; font-size:10pt;">備註</div>\n        <div id="prev-notes" style="font-size:10pt; color:#444; padding:2px 4px; border:1px solid #eee; border-radius:3px; white-space:pre-wrap;">—</div>\n      </div>',
    function() {
        return '      <!-- 備註 -->\n      <div id="prev-notes-section" style="margin-bottom:2mm; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden;">\n        <div style="background:#2C2C2C; color:#fff; padding:4px 10px; font-size:10pt; font-weight:bold; border-left:3px solid #c9a96e;">備註</div>\n        <div id="prev-notes" style="font-size:10pt; color:#444; padding:5px 10px; white-space:pre-wrap; min-height:16px;">—</div>\n      </div>';
    }
);

// ── W4. 付款條件：卡片 + 標題列 ──
out = out.replace(
    '      <!-- 付款條件 -->\n      <div id="prev-payment-section" style="margin-bottom:1mm;">\n        <div style="font-weight:bold; margin-bottom:2px; font-size:10pt;">付款條件</div>\n        <table id="prev-payment" style="width:100%; font-size:10pt; border-collapse:collapse;"></table>\n      </div>',
    function() {
        return '      <!-- 付款條件 -->\n      <div id="prev-payment-section" style="margin-bottom:2mm; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden;">\n        <div style="background:#2C2C2C; color:#fff; padding:4px 10px; font-size:10pt; font-weight:bold; border-left:3px solid #c9a96e;">付款條件</div>\n        <table id="prev-payment" style="width:100%; font-size:10pt; border-collapse:collapse;"></table>\n      </div>';
    }
);

// ── W5. 付款條件：表格列 padding + 交替底色 ──
out = out.replace(
    "    const tdS = 'padding:2px 6px;', tdG = 'padding:2px 6px; color:#555;';\n    const tdA = 'padding:2px 8px; font-weight:bold; color:#e53935;', tdL2 = 'padding:2px 6px 2px 16px; color:#555;';",
    function() {
        return "    const tdS = 'padding:4px 7px;', tdG = 'padding:4px 7px; color:#555;';\n    const tdA = 'padding:4px 9px; font-weight:bold; color:#e53935;', tdL2 = 'padding:4px 7px 4px 18px; color:#555;';";
    }
);
out = out.replace(
    '      return `<tr>\n        <td style="${tdG}">',
    function() { return '      return `<tr style="background:${r%2===0?\'#fff\':\'#fafaf8\'}; border-bottom:1px solid #f0f0f0;">\n        <td style="${tdG}">'; }
);

// ── W6. 合約條款：卡片 + 標題列 + ol 調整 ──
out = out.replace(
    '      <!-- 合約條款 -->\n      <div id="prev-contract-section" style="margin-bottom:2mm; padding:3px 8px; border:1px solid #ddd; border-radius:3px; font-size:9pt; color:#444; line-height:1.4;">\n        <div style="font-weight:bold; font-size:10pt; margin-bottom:3px; color:#2C2C2C;">合約條款</div>\n        <ol style="padding-left:16px;">',
    function() {
        return '      <!-- 合約條款 -->\n      <div id="prev-contract-section" style="margin-bottom:2mm; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden; font-size:9pt; color:#444; line-height:1.4;">\n        <div style="background:#2C2C2C; color:#fff; padding:4px 10px; font-size:10pt; font-weight:bold; border-left:3px solid #c9a96e;">合約條款</div>\n        <ol style="padding:4px 10px 5px 26px; margin:0;">';
    }
);

// ── W7. 合約條款可編輯 ──
out = out.replace('\n  </style>', function() {
    return '\n    @media print { #prev-contract-ol { display: block !important; } }\n  </style>';
});

out = out.replace(
    '        <ol style="padding:4px 10px 5px 26px; margin:0;">\n' +
    '          <li><b>付款條款：</b>依付款條件約定期程給付，逾期每日加計千分之三違約金。</li>\n' +
    '          <li><b>工程變更：</b>工程施作期間如需變更設計或材料，須雙方書面同意，並另行議定費用。</li>\n' +
    '          <li><b>工期延誤：</b>因不可抗力（天災、疫情、供料延誤）造成工期延誤，雙方不互相追究。</li>\n' +
    '          <li><b>驗收標準：</b>工程完工後，委託人應於 7 日內完成驗收；逾期視為驗收通過。</li>\n' +
    '          <li><b>保固責任：</b>竣工驗收後，乙方提供 1 年工程保固，材料瑕疵不在此限。</li>\n' +
    '          <li><b>爭議處理：</b>因本合約發生爭議，雙方同意以台灣台南地方法院為第一審管轄法院。</li>\n' +
    '        </ol>',
    function() {
        return (
            '        <textarea id="in-contract-terms" class="no-print" rows="6"' +
            ' style="width:100%; box-sizing:border-box; border:none; outline:none; resize:vertical;' +
            " font-size:9pt; font-family:'Microsoft JhengHei','Noto Sans TC',sans-serif;" +
            ' color:#444; line-height:1.8; padding:6px 10px; background:transparent; min-height:96px; display:block;"></textarea>\n' +
            '        <ol id="prev-contract-ol" style="padding:4px 10px 5px 26px; margin:0; display:none;"></ol>'
        );
    }
);

// JS：DEFAULT_CONTRACT_TERMS 常數
out = out.replace(
    '  const COMPANIES = {',
    function() {
        return (
            "  var DEFAULT_CONTRACT_TERMS = " +
            "'付款條款：依付款條件約定期程給付，逾期每日加計千分之三違約金。\\n" +
            "工程變更：工程施作期間如需變更設計或材料，須雙方書面同意，並另行議定費用。\\n" +
            "工期延誤：因不可抗力（天災、疫情、供料延誤）造成工期延誤，雙方不互相追究。\\n" +
            "驗收標準：工程完工後，委託人應於 7 日內完成驗收；逾期視為驗收通過。\\n" +
            "保固責任：竣工驗收後，乙方提供 1 年工程保固，材料瑕疵不在此限。\\n" +
            "爭議處理：因本合約發生爭議，雙方同意以台灣台南地方法院為第一審管轄法院。';\n\n" +
            "  const COMPANIES = {"
        );
    }
);

// JS：renderContractTerms 函數 + beforeprint 鉤子
out = out.replace(
    '  function renderAll() {',
    function() {
        return (
            '  function renderContractTerms() {\n' +
            '    var ta = document.getElementById(\'in-contract-terms\');\n' +
            '    var ol = document.getElementById(\'prev-contract-ol\');\n' +
            '    if (!ta || !ol) return;\n' +
            '    var lines = ta.value.split(\'\\n\').filter(function(l) { return l.trim(); });\n' +
            '    ol.innerHTML = lines.map(function(l) {\n' +
            '      return \'<li>\' + l.replace(/&/g,\'&amp;\').replace(/</g,\'&lt;\').replace(/>/g,\'&gt;\') + \'</li>\';\n' +
            '    }).join(\'\');\n' +
            '  }\n' +
            '  window.addEventListener(\'beforeprint\', renderContractTerms);\n\n' +
            '  function renderAll() {'
        );
    }
);

// JS：serializeQuote 加入 contractTerms
out = out.replace(
    "      notes: document.getElementById('in-notes').value,",
    function() {
        return (
            "      notes: document.getElementById('in-notes').value,\n" +
            "      contractTerms: document.getElementById('in-contract-terms').value,"
        );
    }
);

// JS：newQuote 重設合約條款
out = out.replace(
    "    document.getElementById('in-notes').value = '';",
    function() {
        return (
            "    document.getElementById('in-notes').value = '';\n" +
            "    document.getElementById('in-contract-terms').value = DEFAULT_CONTRACT_TERMS;"
        );
    }
);

// JS：loadQuote 還原合約條款
out = out.replace(
    "    document.getElementById('in-notes').value = q.notes || '';",
    function() {
        return (
            "    document.getElementById('in-notes').value = q.notes || '';\n" +
            "    document.getElementById('in-contract-terms').value = q.contractTerms || DEFAULT_CONTRACT_TERMS;"
        );
    }
);

// JS：登入成功後設定預設條款
out = out.replace(
    "      switchCompany('naiship');\n      syncHeader();\n      renderAll();\n      startRealtimeListener();",
    function() {
        return (
            "      switchCompany('naiship');\n" +
            "      syncHeader();\n" +
            "      if (!document.getElementById('in-contract-terms').value) document.getElementById('in-contract-terms').value = DEFAULT_CONTRACT_TERMS;\n" +
            "      renderAll();\n" +
            "      startRealtimeListener();"
        );
    }
);

// ── 跳過 Bug2d：DEV 模式合約條款設定 ──

// ── A1. newQuote：自動帶入合約編號（Firestore 流水號）──
out = out.replace(
    `    document.getElementById('in-contract-no').value = '';
    document.getElementById('in-date').value = '';`,
    function() {
        return (
            `    // 自動產生合約編號\n` +
            `    (async function(){\n` +
            `      var _yr = new Date().getFullYear();\n` +
            `      var _pfx = currentCompany === 'baiting' ? 'PO' : 'NS';\n` +
            `      var _pref = _pfx + '-' + _yr + '-';\n` +
            `      try {\n` +
            `        var _snap = await db.collection('quotations')\n` +
            `          .where(firebase.firestore.FieldPath.documentId(), '>=', _pref)\n` +
            `          .where(firebase.firestore.FieldPath.documentId(), '<', _pref + '\\uf8ff')\n` +
            `          .get();\n` +
            `        var _seqs = _snap.docs.map(function(d) {\n` +
            `          var m = d.id.match(/-(\\d+)$/);\n` +
            `          return m ? parseInt(m[1]) : 0;\n` +
            `        });\n` +
            `        var _next = _seqs.length > 0 ? Math.max.apply(null, _seqs) + 1 : 1;\n` +
            `        document.getElementById('in-contract-no').value = _pref + String(_next).padStart(3, '0');\n` +
            `      } catch(_e) {\n` +
            `        document.getElementById('in-contract-no').value = _pref;\n` +
            `      }\n` +
            `      document.getElementById('in-contract-no').dispatchEvent(new Event('input'));\n` +
            `    })();\n` +
            `    document.getElementById('in-date').value = '';`
        );
    }
);

// ── A2. savePDF：檔名改為 公司名稱｜合約編號｜施工項目｜報價日期.pdf ──
// 已直接套用至 quotation.html，此步驟為 no-op（保留供參考）
out = out.replace(
    "        pdf.save(`${contractNo}.pdf`);",
    function() {
        return (
            `        var _coLabel = currentCompany === 'baiting' ? '柏延' : '奈拾設計';\n` +
            `        var _pdfProj = (document.getElementById('in-project').value || '').trim().replace(/[\\/\\\\:*?"<>|]/g, '');\n` +
            `        var _pdfDt = (document.getElementById('in-date').value || '').trim();\n` +
            `        var _pdfName = [_coLabel, contractNo, _pdfProj, _pdfDt].filter(Boolean).join('｜') + '.pdf';\n` +
            `        pdf.save(_pdfName);`
        );
    }
);

// ── P1. 第一頁大項 qty 顯示 fallback：0 → 1 ──
out = out.replace(
    `        <td style="padding:3px 8px; border-bottom:1px solid #eee; text-align:right;">\${cat.qty}</td>`,
    function() {
        return `        <td style="padding:3px 8px; border-bottom:1px solid #eee; text-align:right;">\${cat.qty || 1}</td>`;
    }
);

// ── Bug1. updateSubItem NaN guard ──
out = out.replace(
    `    item[field] = (field === 'qty' || field === 'price' || field === 'cost' || field === 'margin') ? +value : value;`,
    function() {
        return (
            `    var _nv = +value;\n` +
            `    item[field] = (field === 'qty' || field === 'price' || field === 'cost' || field === 'margin')\n` +
            `      ? (isNaN(_nv) ? 0 : (field === 'qty' && _nv < 0 ? 0 : _nv)) : value;`
        );
    }
);

// ── 跳過 Bug2a/b/c/d：DEV localStorage 相關 ──

// ── W9. 浮水印 CSS ──
out = out.replace('\n  </style>', function() {
    return (
        '\n    /* ── 浮水印 ── */\n' +
        '    .page-watermark {\n' +
        '      position: absolute;\n' +
        '      top: 50%;\n' +
        '      left: 50%;\n' +
        '      transform: translate(-50%, -50%);\n' +
        '      width: 62%;\n' +
        '      opacity: 0.10;\n' +
        '      filter: brightness(0);\n' +
        '      pointer-events: none;\n' +
        '      user-select: none;\n' +
        '      z-index: 0;\n' +
        '      print-color-adjust: exact;\n' +
        '      -webkit-print-color-adjust: exact;\n' +
        '    }\n' +
        '  </style>'
    );
});

// W9. 浮水印 HTML
out = out.replace(
    '    <div id="a4-page">\n\n      <!-- 頁首 -->',
    function() {
        return (
            '    <div id="a4-page">\n' +
            '      <img id="wm-page1" class="page-watermark" src="assets/奈拾設計LOGO2.png" alt="">\n\n' +
            '      <!-- 頁首 -->'
        );
    }
);

out = out.replace(
    '<div id="a4-page-2" style="width:210mm; min-height:297mm; background:#fff; padding:8mm 14mm 14mm 14mm; box-shadow:0 2px 12px rgba(0,0,0,0.15); font-family:\'Microsoft JhengHei\',\'Noto Sans TC\',sans-serif; font-size:10pt; color:#1a1a1a; position:relative;">\n\n      <!-- 頁首色塊 -->',
    function() {
        return (
            '<div id="a4-page-2" style="width:210mm; min-height:297mm; background:#fff; padding:8mm 14mm 14mm 14mm; box-shadow:0 2px 12px rgba(0,0,0,0.15); font-family:\'Microsoft JhengHei\',\'Noto Sans TC\',sans-serif; font-size:10pt; color:#1a1a1a; position:relative;">\n' +
            '      <img id="wm-page2" class="page-watermark" src="assets/奈拾設計LOGO2.png" alt="">\n\n' +
            '      <!-- 頁首色塊 -->'
        );
    }
);

// W9. 浮水印 JS：switchCompany 時同步換圖
const WM_LOGOS = "  var WM_LOGOS = { naiship: 'assets/奈拾設計LOGO2.png', baiting: 'assets/柏延LOGO.png' };";
out = out.replace(
    '  function switchCompany(id) {',
    function() { return WM_LOGOS + '\n  function switchCompany(id) {'; }
);
out = out.replace(
    "    document.getElementById('prev2-logo').src = co.logo;",
    function() {
        return (
            "    document.getElementById('prev2-logo').src = co.logo;\n" +
            "    ['wm-page1','wm-page2'].forEach(function(wid) {\n" +
            "      var wel = document.getElementById(wid);\n" +
            "      if (wel) wel.src = WM_LOGOS[id] || co.logo;\n" +
            "    });"
        );
    }
);

// ── W8. savePDF 第一頁縮放修正 ──
out = out.replace(
    "      const canvas1 = await html2canvas(page1, captureOpts);\n      const page1H = Math.min(canvas1.height / canvas1.width * 210, 297);",
    function() {
        return (
            "      const canvas1 = await html2canvas(page1, captureOpts);\n" +
            "      const _fitStyle = document.getElementById('__pfit');\n" +
            "      let _p1Zoom = 1;\n" +
            "      if (_fitStyle) {\n" +
            "        const _m = _fitStyle.textContent.match(/zoom:([\\d.]+)/);\n" +
            "        if (_m) _p1Zoom = parseFloat(_m[1]);\n" +
            "      }\n" +
            "      let page1DataUrl, page1H;\n" +
            "      if (_p1Zoom < 0.999) {\n" +
            "        const _sc = document.createElement('canvas');\n" +
            "        _sc.width = Math.round(canvas1.width * _p1Zoom);\n" +
            "        _sc.height = Math.round(canvas1.height * _p1Zoom);\n" +
            "        const _ctx = _sc.getContext('2d');\n" +
            "        _ctx.scale(_p1Zoom, _p1Zoom);\n" +
            "        _ctx.drawImage(canvas1, 0, 0);\n" +
            "        page1DataUrl = _sc.toDataURL('image/jpeg', 0.95);\n" +
            "        page1H = Math.min(_sc.height / _sc.width * 210, 297);\n" +
            "      } else {\n" +
            "        page1DataUrl = canvas1.toDataURL('image/jpeg', 0.95);\n" +
            "        page1H = Math.min(canvas1.height / canvas1.width * 210, 297);\n" +
            "      }"
        );
    }
);

out = out.replace(
    "      pdf.addImage(canvas1.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, page1H);",
    function() {
        return "      pdf.addImage(page1DataUrl, 'JPEG', 0, 0, 210, page1H);";
    }
);

// ══════════════════════════════════════════════════════════════
// ── 輸出正式版 quotation.html ─────────────────────────────────
// ══════════════════════════════════════════════════════════════
fs.writeFileSync('C:/AI助理 Claude/quotation.html', out, 'utf8');

// 驗證
const checks = [
  ['標題無 DEV 前綴', !out.includes('[DEV] 奈拾設計')],
  ['PRICE_DB 嵌入', out.includes('const PRICE_DB = [')],
  ['牌價 Modal HTML', out.includes('id="price-modal"')],
  ['從牌價表選按鈕', out.includes('從牌價表選')],
  ['getCatTotal 拆除邏輯', out.includes("cat.name.includes('拆除')")],
  ['renderPage2 垃圾清運列', out.includes('垃圾清運')],
  ['getCatNote 函數', out.includes('function getCatNote(')],
  ['renderPage2 注意事項', out.includes('var _note = cat.note')],
  ['左側總金額 bar', out.includes('id="left-total-bar"')],
  ['updateLeftTotal 函數', out.includes('function updateLeftTotal(')],
  ['renderAll 含 updateLeftTotal', out.includes('updateLeftTotal()')],
  ['模板按鈕', out.includes('applyTemplate(')],
  ['applyTemplate 函數', out.includes('function applyTemplate(')],
  ['TEMPLATES 常數', out.includes('var TEMPLATES =')],
  ['↑↓ 按鈕', out.includes('moveCat(')],
  ['moveCat 函數', out.includes('function moveCat(')],
  ['複製按鈕', out.includes('copySubItem(')],
  ['copySubItem 函數', out.includes('function copySubItem(')],
  ['算式數量 evalQtyExpr', out.includes('evalQtyExpr(')],
  ['evalQtyExpr 函數', out.includes('function evalQtyExpr(')],
  ['Modal 分類記憶', out.includes('_priceCatFilter')],
  ['Modal 自動對應分類', out.includes('dbMatch')],
  ['材料說明折疊區', out.includes('note-toggle-')],
  ['toggleCatNote 函數', out.includes('function toggleCatNote(')],
  ['addCategory note 初始化', out.includes('cat.note = (data.note !== undefined)')],
  ['updateCat 自動帶入 note', out.includes('_autoNote')],
  ['serializeQuote 存 note', out.includes("note: cat.note || ''")],
  ['刪除確認 confirmRemoveCat', out.includes('confirmRemoveCat(')],
  ['大項小計 span', out.includes('cat-subtotal-')],
  ['大項小計函數', out.includes('function updateCatSubtotals(')],
  ['毛利顏色函數', out.includes('function updateMarginColors(')],
  ['細項搜尋', out.includes('filterSubItems(')],
  ['spec textarea auto-grow', out.includes('scrollHeight')],
  ['Modal 連續新增', out.includes('_priceModalMulti')],
  ['快速分類下拉', out.includes('toggleQuickAdd(')],
  ['addSubItem 自動算毛利', out.includes('item.margin = Math.round((item.price - item.cost) / item.price')],
  ['毛利 id', out.includes('sub-margin-')],
  ['無 DEV 登入繞過', !out.includes('[DEV 測試模式]')],
  ['無 DEV localStorage 儲存', !out.includes('__DEV__')],
  ['只有 1 個 onAuthStateChanged', (out.match(/auth\.onAuthStateChanged/g)||[]).length === 1],
  ['區塊化 匯款資訊', out.includes('border-left:3px solid #c9a96e;">匯款資訊</div>')],
  ['區塊化 備註', out.includes('id="prev-notes-section" style="margin-bottom:2mm; border:')],
  ['區塊化 付款條件', out.includes('id="prev-payment-section" style="margin-bottom:2mm; border:')],
  ['區塊化 合約條款', out.includes('margin-bottom:2mm; border:1px solid #d8d8d8; border-radius:4px; overflow:hidden; font-size:9pt')],
  ['合約條款可編輯 textarea', out.includes('id="in-contract-terms"')],
  ['合約條款 print ol', out.includes('id="prev-contract-ol"')],
  ['renderContractTerms 函數', out.includes('function renderContractTerms(')],
  ['savePDF 縮放修正', out.includes('_p1Zoom') && out.includes('page1DataUrl')],
  ['浮水印 CSS', out.includes('.page-watermark')],
  ['浮水印 HTML page1', out.includes('id="wm-page1"')],
  ['浮水印 HTML page2', out.includes('id="wm-page2"')],
  ['浮水印 switchCompany', out.includes('WM_LOGOS')],
  ['視覺 頁首深色', out.includes('background:#2C2C2C; border-bottom:3px solid #c9a96e;')],
  ['視覺 Card 邊框', out.includes('break-inside:avoid')],
  ['視覺 首頁金左線', out.includes('border-left:3px solid #c9a96e')],
  ['視覺 小計暖米色', out.includes('background:#fdf8ee')],
  ['PDF 檔名四段式', out.includes("pdf.save(_pdfName)")],
  ['Firestore 自動合約編號', out.includes('FieldPath.documentId()')],
  ['覆蓋防呆 confirm', out.includes('確定要覆蓋舊報價嗎')],
  ['第一頁 qty fallback', out.includes('cat.qty || 1')],
  ['NaN guard updateSubItem', out.includes('isNaN(_nv)')],
];

let pass = 0;
checks.forEach(function([name, ok]) {
  console.log((ok ? '✅' : '❌') + ' ' + name);
  if (ok) pass++;
});
console.log('\n' + pass + '/' + checks.length + ' 通過，大小：' + Math.round(out.length/1024) + ' KB');
