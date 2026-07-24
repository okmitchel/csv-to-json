const dropzone = document.getElementById('dropzone');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const delimiterSelect = document.getElementById('delimiter');
const firstRowHeadersCheckbox = document.getElementById('firstRowHeaders');
const inferTypesCheckbox = document.getElementById('inferTypes');
const previewSection = document.getElementById('previewSection');
const jsonOutput = document.getElementById('jsonOutput');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

let currentCSVText = '';
let currentFileName = 'output.csv';
let currentJSON = null;

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

function rowsToJSON(rows, useHeaders, inferTypes) {
  if (rows.length === 0) return [];

  let headers;
  let dataRows;

  if (useHeaders) {
    headers = rows[0].map((h) => h.trim());
    dataRows = rows.slice(1);
  } else {
    headers = rows[0].map((_, i) => `column_${i + 1}`);
    dataRows = rows;
  }

  return dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      const raw = row[i] ?? '';
      obj[header] = inferTypes ? inferValue(raw) : raw;
    });
    return obj;
  });
}

function convertAndRender() {
  if (!currentCSVText) return;

  const delimiter = delimiterSelect.value === '\\t' ? '\t' : delimiterSelect.value;
  const useHeaders = firstRowHeadersCheckbox.checked;
  const inferTypes = inferTypesCheckbox.checked;

  try {
    const rows = parseCSV(currentCSVText, delimiter);
    currentJSON = rowsToJSON(rows, useHeaders, inferTypes);
    jsonOutput.textContent = JSON.stringify(currentJSON, null, 2);
    previewSection.hidden = false;
    setStatus(`Converted ${currentJSON.length} row(s).`, 'success');
  } catch (err) {
    setStatus(`Failed to parse CSV: ${err.message}`, 'error');
  }
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status' + (type ? ` ${type}` : '');
}

function loadCSVText(text, fileName) {
  currentCSVText = text;
  currentFileName = fileName || 'output.csv';
  fileNameEl.textContent = fileName ? `Loaded: ${fileName}` : '';
  convertAndRender();
}

chooseFileBtn.addEventListener('click', async () => {
  if (window.api) {
    const result = await window.api.openCSV();
    if (result) {
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
  reader.onload = () => loadCSVText(reader.result, file.name);
  reader.readAsText(file);
  fileInput.value = '';
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
  reader.onload = () => loadCSVText(reader.result, file.name);
  reader.readAsText(file);
});

[delimiterSelect, firstRowHeadersCheckbox, inferTypesCheckbox].forEach((el) => {
  el.addEventListener('change', convertAndRender);
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
