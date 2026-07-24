const dropzone = document.getElementById('dropzone');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const pasteArea = document.getElementById('pasteArea');
const delimiterSelect = document.getElementById('delimiter');
const firstRowHeadersCheckbox = document.getElementById('firstRowHeaders');
const inferTypesCheckbox = document.getElementById('inferTypes');
const tableSection = document.getElementById('tableSection');
const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.getElementById('tableBody');
const tableNote = document.getElementById('tableNote');
const previewSection = document.getElementById('previewSection');
const jsonOutput = document.getElementById('jsonOutput');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

const MAX_PREVIEW_ROWS = 50;

let currentCSVText = '';
let currentFileName = 'output.csv';
let currentJSON = null;
let dataRows = [];
let columns = []; // [{ index, key, included }]

function parseCSV(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip, handled with \n
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function inferValue(value) {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (!isNaN(trimmed) && trimmed !== '') return Number(trimmed);
  return value;
}

function buildJSON(rows, cols, inferTypes) {
  const included = cols.filter((c) => c.included);
  const keys = included.map((c) => {
    const trimmed = (c.key || '').trim();
    return trimmed !== '' ? trimmed : `column_${c.index + 1}`;
  });
  const hasDuplicateKeys = keys.some((k, i) => keys.indexOf(k) !== i);

  const result = rows.map((row) => {
    const obj = {};
    included.forEach((col, i) => {
      const raw = row[col.index] ?? '';
      obj[keys[i]] = inferTypes ? inferValue(raw) : raw;
    });
    return obj;
  });

  return { result, hasDuplicateKeys };
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status' + (type ? ` ${type}` : '');
}

function rebuildColumnsAndTable() {
  if (!currentCSVText) return;

  const delimiter = delimiterSelect.value === '\\t' ? '\t' : delimiterSelect.value;
  const useHeaders = firstRowHeadersCheckbox.checked;

  try {
    const rows = parseCSV(currentCSVText, delimiter);

    if (rows.length === 0) {
      tableSection.hidden = true;
      previewSection.hidden = true;
      setStatus('No rows found.', 'error');
      return;
    }

    let headers;
    if (useHeaders) {
      headers = rows[0].map((h) => h.trim());
      dataRows = rows.slice(1);
    } else {
      headers = rows[0].map((_, i) => `column_${i + 1}`);
      dataRows = rows;
    }

    columns = headers.map((h, i) => ({ index: i, key: h, included: true }));

    renderTable();
    renderJSON();
  } catch (err) {
    setStatus(`Failed to parse CSV: ${err.message}`, 'error');
  }
}

function moveColumn(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= columns.length) return;
  [columns[index], columns[newIndex]] = [columns[newIndex], columns[index]];
  renderTable();
  renderJSON();
}

function renderTable() {
  tableHeaderRow.innerHTML = '';
  tableBody.innerHTML = '';

  columns.forEach((col, colIdx) => {
    const th = document.createElement('th');
    if (!col.included) th.classList.add('excluded-col');

    const headerDiv = document.createElement('div');
    headerDiv.className = 'col-header';

    const moveLeftBtn = document.createElement('button');
    moveLeftBtn.type = 'button';
    moveLeftBtn.className = 'col-move';
    moveLeftBtn.textContent = '‹';
    moveLeftBtn.title = 'Move column left';
    moveLeftBtn.disabled = colIdx === 0;
    moveLeftBtn.addEventListener('click', () => moveColumn(colIdx, -1));

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'col-key-input';
    keyInput.value = col.key;
    keyInput.addEventListener('input', () => {
      col.key = keyInput.value;
      renderJSON();
    });

    const moveRightBtn = document.createElement('button');
    moveRightBtn.type = 'button';
    moveRightBtn.className = 'col-move';
    moveRightBtn.textContent = '›';
    moveRightBtn.title = 'Move column right';
    moveRightBtn.disabled = colIdx === columns.length - 1;
    moveRightBtn.addEventListener('click', () => moveColumn(colIdx, 1));

    headerDiv.append(moveLeftBtn, keyInput, moveRightBtn);

    const includeLabel = document.createElement('label');
    includeLabel.className = 'col-include';
    const includeCheckbox = document.createElement('input');
    includeCheckbox.type = 'checkbox';
    includeCheckbox.checked = col.included;
    includeCheckbox.addEventListener('change', () => {
      col.included = includeCheckbox.checked;
      renderTable();
      renderJSON();
    });
    includeLabel.append(includeCheckbox, document.createTextNode(' include'));

    th.append(headerDiv, includeLabel);
    tableHeaderRow.appendChild(th);
  });

  const previewRows = dataRows.slice(0, MAX_PREVIEW_ROWS);
  previewRows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((col) => {
      const td = document.createElement('td');
      if (!col.included) td.classList.add('excluded-col');
      td.textContent = row[col.index] ?? '';
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  tableNote.textContent =
    dataRows.length > MAX_PREVIEW_ROWS
      ? `Showing first ${MAX_PREVIEW_ROWS} of ${dataRows.length} rows. All rows are included in the export.`
      : `${dataRows.length} row(s).`;

  tableSection.hidden = false;
}

function renderJSON() {
  const inferTypes = inferTypesCheckbox.checked;
  const { result, hasDuplicateKeys } = buildJSON(dataRows, columns, inferTypes);
  currentJSON = result;
  jsonOutput.textContent = JSON.stringify(currentJSON, null, 2);
  previewSection.hidden = false;

  if (hasDuplicateKeys) {
    setStatus(
      `Converted ${currentJSON.length} row(s). Warning: duplicate column names will overwrite each other.`,
      'warning'
    );
  } else {
    setStatus(`Converted ${currentJSON.length} row(s).`, 'success');
  }
}

function loadCSVText(text, fileName) {
  currentCSVText = text;
  currentFileName = fileName || 'output.csv';
  fileNameEl.textContent = fileName ? `Loaded: ${fileName}` : '';
  rebuildColumnsAndTable();
}

chooseFileBtn.addEventListener('click', async () => {
  if (window.api) {
    const result = await window.api.openCSV();
    if (result) {
      pasteArea.value = '';
      loadCSVText(result.content, result.fileName);
    }
    return;
  }
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pasteArea.value = '';
    loadCSVText(reader.result, file.name);
  };
  reader.readAsText(file);
  fileInput.value = '';
});

let pasteDebounceTimer = null;
pasteArea.addEventListener('input', () => {
  clearTimeout(pasteDebounceTimer);
  pasteDebounceTimer = setTimeout(() => {
    if (pasteArea.value.trim() === '') return;
    loadCSVText(pasteArea.value, null);
  }, 250);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
    setStatus('Please drop a .csv file.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pasteArea.value = '';
    loadCSVText(reader.result, file.name);
  };
  reader.readAsText(file);
});

[delimiterSelect, firstRowHeadersCheckbox].forEach((el) => {
  el.addEventListener('change', rebuildColumnsAndTable);
});

inferTypesCheckbox.addEventListener('change', () => {
  if (!currentCSVText) return;
  renderJSON();
});

copyBtn.addEventListener('click', async () => {
  if (!currentJSON) return;
  await navigator.clipboard.writeText(JSON.stringify(currentJSON, null, 2));
  setStatus('JSON copied to clipboard.', 'success');
});

saveBtn.addEventListener('click', async () => {
  if (!currentJSON) return;
  const suggestedName = currentFileName.replace(/\.[^/.]+$/, '') + '.json';
  const jsonString = JSON.stringify(currentJSON, null, 2);

  if (window.api) {
    const result = await window.api.saveJSON(jsonString, suggestedName);
    if (result.saved) {
      setStatus(`Saved to ${result.filePath}`, 'success');
    }
    return;
  }

  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${suggestedName}`, 'success');
});
