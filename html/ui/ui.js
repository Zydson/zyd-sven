var globalData = {};
var zIndex = 99;
globalData["extensions"] = {
  "Unknown": "unknown_.png",
  "Image": "image.png",
  "Text document": "notepad.png",
  "Code": "code.png",
  "Archive": "archive.png",
  "Video": "video.png",
  "Audio": "video.png",
  "Folder": "folder.png",
};

globalData["windows"] = {
  "notepad": {"size": {"width": 400, "height": 300}, "position": {"x": "10%", "y": "20%"}},
  "image": {"size": {"width": 600, "height": 400}, "position": {"x": "10%", "y": "20%"}},
  "archive": {"size": {"width": 600, "height": 400}, "position": {"x": "10%", "y": "20%"}},
  "video": {"size": {"width": 600, "height": 400}, "position": {"x": "10%", "y": "20%"}},
  "audio": {"size": {"width": 300, "height": 200}, "position": {"x": "10%", "y": "20%"}},
  "code": {"size": {"width": 800, "height": 500}, "position": {"x": "10%", "y": "15%"}},
  "calculator": {"size": {"width": 200, "height": 300}, "position": {"x": "10%", "y": "20%"}},
};

globalData["mTab"] = {}
globalData["openedWindows"] = JSON.parse(window.localStorage.getItem("globalData_windows")) || {}
globalData["filePositions"] = {}
globalData["gridSize"] = 9;
globalData["contextClickPosition"] = null;
globalData["selectedFiles"] = new Set();

const tempData = JSON.parse(window.localStorage.getItem("globalData"));

if (tempData != null) {
  for (const key in globalData["windows"]) {
    if (tempData[key]) {
      globalData["windows"][key]["size"] = tempData[key]["size"];
      globalData["windows"][key]["position"] = tempData[key]["position"];
    }
  }
}


(async () => {
  try {
    const response = await fetch(`${window.location.origin}/files/list`);
    if (response.ok) {
      const files = await response.json();
      
      globalData["filePositions"] = {};
      files.forEach(file => {
        if (file.position) {
          globalData["filePositions"][file.file] = file.position;
        }
      });
      
      loadFiles(JSON.stringify(files));
      
      setupSelectionRectangle();
    }
  } catch (e) {
    const tempFilesEl = document.getElementById("temp_files");
    if (tempFilesEl) {
      loadFiles(tempFilesEl.getAttribute("data-files").replaceAll("'", '"'));
      tempFilesEl.remove();
    }
    
    setupSelectionRectangle();
  }
  
  if (globalData["openedWindows"] && Object.keys(globalData["openedWindows"]).length > 0) {
    for (const key in globalData["openedWindows"]) {
      const winInfo = globalData["openedWindows"][key];
      const reopenTarget = winInfo.url || winInfo.file;
      Fopen(reopenTarget, winInfo["extension"], key);
    }
  }
  
  window.localStorage.setItem("globalData", JSON.stringify(globalData["windows"]));
})();



function saveWindowsConfig() {
  try { window.localStorage.setItem("globalData", JSON.stringify(globalData["windows"])); } catch {}
}
function saveOpenedWindowsState() {
  try { window.localStorage.setItem("globalData_windows", JSON.stringify(globalData["openedWindows"])); } catch {}
}
async function saveFilePositions(specificFiles = null) {
  try {
    let positionsToSave;
    if (specificFiles && specificFiles.length > 0) {
      positionsToSave = {};
      specificFiles.forEach(fname => {
        if (globalData["filePositions"][fname]) {
          positionsToSave[fname] = globalData["filePositions"][fname];
        }
      });
    } else {
      positionsToSave = globalData["filePositions"];
    }
    
    await post("files/save-positions", { positions: positionsToSave });
  } catch (e) {
  }
}
function setWindowSize(kind, key, width, height) {
  try {
    if (globalData["mTab"][key] != true) {
      if (globalData["windows"][kind]) {
        globalData["windows"][kind]["size"] = { width, height };
      }
      if (globalData["openedWindows"][key]) {
        globalData["openedWindows"][key]["size"] = { width, height };
      }
      saveOpenedWindowsState();
      saveWindowsConfig();
    }
  } catch {}
}
function setWindowPosition(kind, key, x, y) {
  try {
    if (globalData["mTab"][key] != true) {
      if (globalData["windows"][kind]) {
        globalData["windows"][kind]["position"] = { x, y };
      }
      if (globalData["openedWindows"][key]) {
        globalData["openedWindows"][key]["position"] = { x, y };
      }
      saveOpenedWindowsState();
      saveWindowsConfig();
    }
  } catch {}
}

function getGridPosition(fileName) {
  if (globalData["filePositions"][fileName]) {
    return globalData["filePositions"][fileName];
  }
  const noSlash = fileName.replace(/\/$/, '');
  if (noSlash !== fileName && globalData["filePositions"][noSlash]) {
    globalData["filePositions"][fileName] = globalData["filePositions"][noSlash];
    delete globalData["filePositions"][noSlash];
    return globalData["filePositions"][fileName];
  }
  const withSlash = fileName.endsWith('/') ? fileName : (fileName + '/');
  if (globalData["filePositions"][withSlash]) {
    globalData["filePositions"][fileName] = globalData["filePositions"][withSlash];
    return globalData["filePositions"][fileName];
  }
  return findNextFreeGridSlot();
}

function findNextFreeGridSlot() {
  const gridSize = globalData["gridSize"];
  const filesContainer = document.getElementById("Files");
  const containerHeight = window.innerHeight - (window.innerHeight * 0.05);
  const containerWidth = window.innerWidth;
  
  const cols = Math.floor(containerWidth / (gridSize * window.innerHeight / 100));
  const rows = Math.floor(containerHeight / (gridSize * 1 * window.innerHeight / 100));
  
  const occupied = new Set();
  for (const fname in globalData["filePositions"]) {
    const pos = globalData["filePositions"][fname];
    occupied.add(`${pos.col},${pos.row}`);
  }
  
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (!occupied.has(`${col},${row}`)) {
        return { col, row };
      }
    }
  }
  
  return { col: 0, row: 0 };
}

function snapToGrid(x, y) {
  const gridSize = globalData["gridSize"];
  const cellWidth = gridSize * window.innerHeight / 100;
  const cellHeight = gridSize * 1 * window.innerHeight / 100;
  
  const filesContainer = document.getElementById("Files");
  if (filesContainer) {
    const containerRect = filesContainer.getBoundingClientRect();
    const maxCols = Math.floor(containerRect.width / cellWidth);
    const maxRows = Math.floor(containerRect.height / cellHeight);
    
    let col = Math.round(x / cellWidth);
    let row = Math.round(y / cellHeight);
    
    col = Math.max(0, Math.min(col, maxCols - 1));
    row = Math.max(0, Math.min(row, maxRows - 1));
    
    return {
      col: col,
      row: row,
      x: col * cellWidth,
      y: row * cellHeight
    };
  }
  
  const col = Math.max(0, Math.round(x / cellWidth));
  const row = Math.max(0, Math.round(y / cellHeight));
  
  return {
    col: col,
    row: row,
    x: col * cellWidth,
    y: row * cellHeight
  };
}

function isPositionOccupied(col, row, excludeFileName) {
  for (const fname in globalData["filePositions"]) {
    if (excludeFileName && fname === excludeFileName) continue;
    const pos = globalData["filePositions"][fname];
    if (pos.col === col && pos.row === row) {
      return true;
    }
  }
  return false;
}

function findNearestFreeSlot(targetCol, targetRow, excludeFileName) {
  if (!isPositionOccupied(targetCol, targetRow, excludeFileName)) {
    return { col: targetCol, row: targetRow };
  }
  
  const containerHeight = window.innerHeight - (window.innerHeight * 0.05);
  const containerWidth = window.innerWidth;
  const gridSize = globalData["gridSize"];
  const maxCols = Math.floor(containerWidth / (gridSize * window.innerHeight / 100));
  const maxRows = Math.floor(containerHeight / (gridSize * 1 * window.innerHeight / 100));
  
  for (let radius = 1; radius < Math.max(maxCols, maxRows); radius++) {
    for (let col = Math.max(0, targetCol - radius); col <= Math.min(maxCols - 1, targetCol + radius); col++) {
      for (let row = Math.max(0, targetRow - radius); row <= Math.min(maxRows - 1, targetRow + radius); row++) {
        if (Math.abs(col - targetCol) === radius || Math.abs(row - targetRow) === radius) {
          if (!isPositionOccupied(col, row, excludeFileName)) {
            return { col, row };
          }
        }
      }
    }
  }
  
  return findNextFreeGridSlot();
}

function setFilePosition(element, col, row) {
  const gridSize = globalData["gridSize"];
  const cellWidth = gridSize * window.innerHeight / 100;
  const cellHeight = gridSize * 1 * window.innerHeight / 100;
  
  element.style.left = (col * cellWidth) + 'px';
  element.style.top = (row * cellHeight) + 'px';
}

function clearSelection() {
  globalData["selectedFiles"].clear();
  document.querySelectorAll('file.selected').forEach(el => {
    el.classList.remove('selected');
  });
}

function createEditableInput(span, initialValue = '', selectAll = false) {
  const spanRect = span.getBoundingClientRect();
  const spanStyles = window.getComputedStyle(span);
  const input = document.createElement('input');
  input.type = 'text';
  input.value = initialValue;
  input.style.width = spanRect.width + 'px';
  input.style.height = spanRect.height + 'px';
  input.style.boxSizing = 'border-box';
  input.style.background = 'rgba(0,0,0,0.2)';
  input.style.color = 'inherit';
  input.style.border = 'none';
  input.style.outline = '1px solid rgba(255,255,255,0.3)';
  input.style.borderRadius = '3px';
  input.style.padding = spanStyles.padding || '0';
  input.style.margin = spanStyles.margin || '0';
  input.style.fontSize = spanStyles.fontSize || 'inherit';
  input.style.fontFamily = spanStyles.fontFamily || 'inherit';
  input.style.lineHeight = spanStyles.lineHeight || 'inherit';
  input.style.textAlign = 'center';
  input.style.display = spanStyles.display || 'inline-block';
  input.style.verticalAlign = spanStyles.verticalAlign || 'baseline';
  
  span.replaceWith(input);
  
  setTimeout(() => { 
    try { 
      input.focus(); 
      if (selectAll && initialValue) {
        const lastDot = initialValue.lastIndexOf('.');
        const baseLen = lastDot > 0 ? lastDot : initialValue.length;
        input.setSelectionRange(0, baseLen);
      }
    } catch {} 
  }, 10);
  
  return input;
}

function toggleFileSelection(fileName, ctrlKey) {
  if (ctrlKey) {
    if (globalData["selectedFiles"].has(fileName)) {
      globalData["selectedFiles"].delete(fileName);
      document.querySelector(`file[data-name="${fileName}"]`)?.classList.remove('selected');
    } else {
      globalData["selectedFiles"].add(fileName);
      document.querySelector(`file[data-name="${fileName}"]`)?.classList.add('selected');
    }
  } else {
    clearSelection();
    globalData["selectedFiles"].add(fileName);
    document.querySelector(`file[data-name="${fileName}"]`)?.classList.add('selected');
  }
}

function selectFilesInRectangle(rect) {
  const filesContainer = document.getElementById("Files");
  const containerRect = filesContainer.getBoundingClientRect();
  
  document.querySelectorAll('file[data-name]').forEach(fileEl => {
    const fileRect = fileEl.getBoundingClientRect();
    const fileName = fileEl.getAttribute('data-name');
    
    const intersects = !(
      fileRect.right < rect.left ||
      fileRect.left > rect.right ||
      fileRect.bottom < rect.top ||
      fileRect.top > rect.bottom
    );
    
    if (intersects) {
      globalData["selectedFiles"].add(fileName);
      fileEl.classList.add('selected');
    }
  });
}

function setupFileDragging(fileElement) {
  let isDragging = false;
  let hasMoved = false;
  let startX, startY, offsetX, offsetY;
  let preventNextClick = false;
  let draggedFiles = [];
  let clickedFileName, clickedCtrlKey;
  
  const onMouseDown = function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.target.closest('context')) return;
    
    if (e.button !== 0) return;
    
    clickedFileName = fileElement.getAttribute('data-name');
    clickedCtrlKey = e.ctrlKey;
    
    isDragging = true;
    hasMoved = false;
    preventNextClick = false;
    
    const rect = fileElement.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    startX = e.clientX;
    startY = e.clientY;
    
    draggedFiles = [];
    globalData["selectedFiles"].forEach(fname => {
      const el = document.querySelector(`file[data-name="${fname}"]`);
      if (el) {
        const elRect = el.getBoundingClientRect();
        draggedFiles.push({
          element: el,
          offsetX: e.clientX - elRect.left,
          offsetY: e.clientY - elRect.top,
          originalFileName: fname
        });
        el.style.zIndex = '1000';
      }
    });
    
    if (!globalData["selectedFiles"].has(clickedFileName)) {
      const el = document.querySelector(`file[data-name="${clickedFileName}"]`);
      if (el) {
        draggedFiles.push({
          element: el,
          offsetX: e.clientX - el.getBoundingClientRect().left,
          offsetY: e.clientY - el.getBoundingClientRect().top,
          originalFileName: clickedFileName
        });
        el.style.zIndex = '1000';
      }
    }
    
    e.preventDefault();
    e.stopPropagation();
  };
  
  const onMouseMove = function(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    if (!hasMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      hasMoved = true;
      draggedFiles.forEach(df => {
        df.element.style.opacity = '0.7';
      });
    }
    
    if (hasMoved) {
      const filesContainer = document.getElementById("Files");
      const containerRect = filesContainer.getBoundingClientRect();
      
      draggedFiles.forEach(df => {
        let newLeft = e.clientX - df.offsetX - containerRect.left;
        let newTop = e.clientY - df.offsetY - containerRect.top;
        
        const fileRect = df.element.getBoundingClientRect();
        const maxLeft = containerRect.width - fileRect.width;
        const maxTop = containerRect.height - fileRect.height;
        
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        
        df.element.style.left = newLeft + 'px';
        df.element.style.top = newTop + 'px';
      });
    }
  };
  
  const onMouseUp = function(e) {
    if (!isDragging) return;
    
    if (e.target.closest('context')) return;
    
    if (!hasMoved) {
      if (clickedCtrlKey) {
        toggleFileSelection(clickedFileName, true);
      } else {
        if (!globalData["selectedFiles"].has(clickedFileName) || globalData["selectedFiles"].size > 1) {
          clearSelection();
          globalData["selectedFiles"].add(clickedFileName);
          fileElement.classList.add('selected');
        }
      }
    }
    
    isDragging = false;
    draggedFiles.forEach(df => {
      df.element.style.zIndex = '';
      df.element.style.opacity = '';
    });
    
    if (hasMoved) {
      draggedFiles.forEach(df => df.element.style.display = 'none');
      let elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      draggedFiles.forEach(df => df.element.style.display = '');

      const draggedSet = new Set(draggedFiles.map(df => df.originalFileName));
      let folderEl = elementAtPoint ? elementAtPoint.closest('file[extension="Folder"]') : null;
      const inWin = elementAtPoint && elementAtPoint.closest('.winbox');
      if (folderEl && draggedSet.has(folderEl.getAttribute('data-name') || '')) {
        folderEl = null;
      }
      if (!folderEl && !inWin) {
        const folders = Array.from(document.querySelectorAll('file[extension="Folder"]'));
        const expand = 10;
        for (const f of folders) {
          const id = f.getAttribute('data-name') || '';
          if (draggedSet.has(id)) continue;
          const r = f.getBoundingClientRect();
          if (e.clientX >= r.left - expand && e.clientX <= r.right + expand && e.clientY >= r.top - expand && e.clientY <= r.bottom + expand) {
            folderEl = f; break;
          }
        }
      }
      if (folderEl && !inWin) {
        const folderId = folderEl.getAttribute('data-name');
        const folderName = folderId.replace(/\/$/, '');
        const moveCandidates = draggedFiles.filter(df => {
          const orig = df.originalFileName || '';
          if (!orig) return false;
          if (orig.replace(/\/$/, '').includes('/')) return false;
          if (orig.endsWith('/') && folderId.startsWith(orig)) return false;
          if (orig === folderId) return false;
          return true;
        });

        if (moveCandidates.length > 0) {
          const toRemoveFromDesktop = [];
          (async () => {
            for (const df of moveCandidates) {
              const orig = df.originalFileName;
              const base = orig.replace(/\/$/, '').split('/').pop();
              const newPath = `${folderName}/${base}` + (orig.endsWith('/') ? '/' : '');
              const resp = await post('files/move', { old: orig, new: newPath });
              try { JSON.parse(resp); } catch {}
              document.getElementById('F' + orig)?.remove();
              delete globalData['filePositions'][orig];
              toRemoveFromDesktop.push(orig);
            }
            if (toRemoveFromDesktop.length) await saveFilePositions([]);
            try {
              document.querySelectorAll('.folder-window').forEach(win => {
                const p = (win.dataset && win.dataset.path) ? win.dataset.path.replace(/\/$/, '') : '';
                if (p === folderName) {
                  win.dispatchEvent(new CustomEvent('folder:refresh', { bubbles: true, detail: { path: folderName } }));
                }
              });
            } catch {}
          })();

          isDragging = false;
          draggedFiles.forEach(df => { df.element.style.zIndex = ''; df.element.style.opacity = ''; });
          draggedFiles = [];
          return;
        }
      }
      if (inWin) {
        const folderWin = elementAtPoint && elementAtPoint.closest('.folder-window');
        if (folderWin) {
          const targetPath = (folderWin.dataset && folderWin.dataset.path) ? folderWin.dataset.path.replace(/\/$/, '') : '';
          const toRemoveFromDesktop = [];
          (async () => {
            for (const df of draggedFiles) {
              const orig = df.originalFileName;
              if (!orig) continue;
              if (orig.replace(/\/$/, '').includes('/')) continue;
              const base = orig.replace(/\/$/, '').split('/').pop();
              const newPath = targetPath ? `${targetPath}/${base}${orig.endsWith('/') ? '/' : ''}` : `${base}${orig.endsWith('/') ? '/' : ''}`;
              try {
                const resp = await post('files/move', { old: orig, new: newPath });
                try { JSON.parse(resp); } catch {}
              } catch (err) { }
              document.getElementById('F' + orig)?.remove();
              delete globalData['filePositions'][orig];
              toRemoveFromDesktop.push(orig);
            }
            if (toRemoveFromDesktop.length) await saveFilePositions([]);
            try {
              folderWin.dispatchEvent(new CustomEvent('folder:refresh', { bubbles: true, detail: { path: targetPath } }));
            } catch {}
          })();

          isDragging = false;
          draggedFiles.forEach(df => { df.element.style.zIndex = ''; df.element.style.opacity = ''; });
          draggedFiles = [];
          return;
        }
      }

      const changedFiles = [];
      draggedFiles.forEach(df => {
        const currentLeft = parseInt(df.element.style.left) || 0;
        const currentTop = parseInt(df.element.style.top) || 0;
        
        const fileName = df.originalFileName;
        const snapped = snapToGrid(currentLeft, currentTop);
        
        const finalPos = findNearestFreeSlot(snapped.col, snapped.row, fileName);
        setFilePosition(df.element, finalPos.col, finalPos.row);
        
        globalData["filePositions"][fileName] = { col: finalPos.col, row: finalPos.row };
        changedFiles.push(fileName);
      });
      
      saveFilePositions(changedFiles);
      
      preventNextClick = true;
      setTimeout(() => { 
        hasMoved = false;
        preventNextClick = false;
      }, 100);
    }
    
    draggedFiles = [];
  };
  
  const onClickCapture = function(e) {
    if (preventNextClick) {
      e.stopPropagation();
      e.preventDefault();
      preventNextClick = false;
      return false;
    }
  };
  
  fileElement.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  fileElement.addEventListener('click', onClickCapture, true);
}


function getWindowData(name,key) {
  if (globalData["windows"][name]) {
    var size = globalData["windows"][name]["size"];
    var position = globalData["windows"][name]["position"];
    if (key!=null && globalData["openedWindows"][key]["size"]) {
      size = globalData["openedWindows"][key]["size"];
      position = globalData["openedWindows"][key]["position"];
    }
    return {
      "width": size["width"],
      "height": size["height"],
      "x": position["x"],
      "y": position["y"]
    };
  }
}

async function get(q) {
  const response = await fetch(`${window.location.origin}/${q}`, { credentials: 'include' });
  var text = await response.text();
  if (response.status === 500) {
    text = ""
  }
  return text;
};

const isJson = (data) => {
  try {
    JSON.parse(data);
    return true;
  } catch (e) {
    return false;
  }
};

async function post(q,d) {
  const isFormData = d.constructor === FormData;
  const isJson = !isFormData && typeof d === 'object';
  const headers = {};

  if (isJson) {
      headers['Content-Type'] = 'application/json';
  };

  const response = await fetch(`${window.location.origin}/${q}`, { 
      method: 'POST',
      body: isJson ? JSON.stringify(d) : d,
      headers: headers,
      credentials: 'include'
  });
  const text = await response.text();

  return text;
};

function menu() {
  var e = document.getElementById("menu");

  if (e.style.display=="block") {
    e.style.transform = 'translateY(-100%)';
    setTimeout(() => {
        e.style.display = 'none';
    }, 500);
  } else {
    e.style.display = 'block';
    setTimeout(() => {
        e.style.transform = 'translateY(0%)';
    }, 10);
  };
};

function loadFiles(files) {
  const items = JSON.parse(files), container = document.getElementById("Files"), frag = document.createDocumentFragment();
  for (let i = 0; i < items.length; i++) {
    const d = items[i], el = document.createElement("file"), ic = globalData["extensions"][d.type];
    const normalized = (d.file || '').replace(/\/$/, '');
    if (normalized.includes('/')) continue;

    el.setAttribute("id", "F" + d.file);
    el.setAttribute("data-name", d.file);
    el.setAttribute("extension", d.type);
    el.setAttribute("draggable", "true");

    let labelHtml, tooltipHtml;
    if (d.type === 'Folder') {
      const disp = (d.file || '').replace(/\/$/, '');
      labelHtml = `<span extension="${d.type}" data-name="${d.file}">${disp}</span>`;
      tooltipHtml = `<div extension="${d.type}" data-name="${d.file}" class="tooltip">Name: ${disp}<br>Type: Folder<br>Size: -<br>Changed: ${d.last_change || '-'}</div>`;
    } else {
      const lab = computeDisplayNames(d.file);
      labelHtml = `<span extension="${d.type}" data-name="${d.file}">${lab.name}</span>`;
      tooltipHtml = `<div extension="${d.type}" data-name="${d.file}" class="tooltip">Name: ${lab.nameL}<br>Type: ${d.type}<br>Size: ${d.size}<br>Changed: ${d.last_change}</div>`;
    }

    el.innerHTML = `
      <img extension="${d.type}" data-name="${d.file}" src="/static/icons/${ic}">
      ${labelHtml}
      ${tooltipHtml}
    `;
    
    const pos = getGridPosition(d.file);
    setFilePosition(el, pos.col, pos.row);
    if (!globalData["filePositions"][d.file]) {
      globalData["filePositions"][d.file] = pos;
    }
    
    frag.appendChild(el);
  }
  container.appendChild(frag);
  
  document.querySelectorAll('file[draggable="true"]').forEach(fileEl => {
    setupFileDragging(fileEl);
    setupTooltipPositioning(fileEl);
  });
};

function setupTooltipPositioning(fileEl) {
  const tooltip = fileEl.querySelector('.tooltip');
  if (!tooltip) return;
  
  fileEl.addEventListener('mouseenter', function() {
    setTimeout(() => {
      const fileRect = fileEl.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let left = fileRect.left + (fileRect.width / 2) - (tooltipRect.width / 2);
      let top = fileRect.bottom + 8;
      
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      
      if (left < 10) {
        left = 10;
      }
      
      if (top + tooltipRect.height > window.innerHeight - 10) {
        top = fileRect.top - tooltipRect.height - 8;
      }
      
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }, 50);
  });
}

function isInWinBox(element) {
  return element.closest('.winbox') !== null;
}

function setupSelectionRectangle() {
  if (globalData["selectionRectangleSetup"]) return;
  globalData["selectionRectangleSetup"] = true;
  
  const filesContainer = document.getElementById("Files");
  let selectionRect = document.getElementById("selectionRectangle");
  
  if (!selectionRect) {
    selectionRect = document.createElement("div");
    selectionRect.id = "selectionRectangle";
    document.body.appendChild(selectionRect);
  }
  
  let isSelecting = false;
  let selectStartX, selectStartY;
  globalData["hasSelectedFiles"] = false;
  
  document.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    
    if (isInWinBox(e.target)) return;
    
    const isOnFile = e.target.closest('file[data-name]');
    if (isOnFile) return;
    
    const containerRect = filesContainer.getBoundingClientRect();
    const isInContainer = e.clientX >= containerRect.left && 
                         e.clientX <= containerRect.right && 
                         e.clientY >= containerRect.top && 
                         e.clientY <= containerRect.bottom;
    
    if (!isInContainer) return;
    
    clearSelection();
    
    isSelecting = true;
    globalData["hasSelectedFiles"] = false;
    selectStartX = e.clientX;
    selectStartY = e.clientY;
    
    selectionRect.style.left = e.clientX + 'px';
    selectionRect.style.top = e.clientY + 'px';
    selectionRect.style.width = '0px';
    selectionRect.style.height = '0px';
    selectionRect.style.display = 'block';
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if (!isSelecting) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(selectStartX, currentX);
    const top = Math.min(selectStartY, currentY);
    const width = Math.abs(currentX - selectStartX);
    const height = Math.abs(currentY - selectStartY);
    
    selectionRect.style.left = left + 'px';
    selectionRect.style.top = top + 'px';
    selectionRect.style.width = width + 'px';
    selectionRect.style.height = height + 'px';
    
    const rect = {
      left: left,
      top: top,
      right: left + width,
      bottom: top + height
    };
    
    globalData["selectedFiles"] = new Set();
    document.querySelectorAll('file.selected').forEach(el => el.classList.remove('selected'));
    selectFilesInRectangle(rect);
    globalData["hasSelectedFiles"] = (width > 5 || height > 5);
  });
  
  document.addEventListener('mouseup', function(e) {
    if (!isSelecting) return;
    
    isSelecting = false;
    selectionRect.style.display = 'none';
    
    if (globalData["hasSelectedFiles"]) {
      setTimeout(() => {
        globalData["hasSelectedFiles"] = false;
      }, 50);
    }
  });
}

document.addEventListener("contextmenu", (event)=>{
  var menu_el = document.getElementById("menu");

  if (event.target.id != "menuBtn" && event.target.id != "menu" && event.target.id != "rightMenu" && event.target.id != "leftMenu" && menu_el.style.display == "block") {
    menu_el.style.transform = "translateY(-100%)";
    setTimeout(() => {
        menu_el.style.display = "none";
    }, 500);
  };
  globalData["focused"] = "none";

  hideContext();
  event.preventDefault();
  if (event.target.hasAttribute("data-name")) {
    document.documentElement.style.setProperty('--tooltip-display', 'none');
    var id = event.target.getAttribute("data-name");
    var extension = event.target.getAttribute("extension");
    var e = document.createElement("context");
    
    const isMultiSelected = globalData["selectedFiles"].size > 1;
    const removeLabel = isMultiSelected ? `Remove (${globalData["selectedFiles"].size} files)` : 'Remove';
    const downloadLabel = isMultiSelected ? `Download (${globalData["selectedFiles"].size} files)` : 'Download';

    let hasFolderSelected = false;
    if (isMultiSelected) {
      try {
        for (const fname of globalData["selectedFiles"]) {
          const el = document.querySelector(`file[data-name="${fname}"]`);
          if (el && el.getAttribute('extension') === 'Folder') { hasFolderSelected = true; break; }
        }
      } catch {}
    } else {
      hasFolderSelected = (extension === 'Folder');
    }

    let menuHTML = '';
    if (!isMultiSelected) {
        menuHTML += `<button onclick='Fopen("${id}", "${extension}")'>Open</button>`;
    }
    if (!hasFolderSelected) {
      menuHTML += `<button onclick='${isMultiSelected ? "FdownloadMulti()" : `Fdownload("${id}")` }'>${downloadLabel}</button>`;
    }
    if (!isMultiSelected) {
        menuHTML += `<button onclick='Frename("${id}")'>Rename</button>`;
    }
    menuHTML += `<button onclick='${isMultiSelected ? "FremoveMulti()" : `Fremove("${id}")` }'>${removeLabel}</button>`;
    
    e.innerHTML = menuHTML;
    
    if (extension=="Image" && !isMultiSelected) {
      e.innerHTML = e.innerHTML+`<button onclick='Fsetwallpaper("${id}")'>Set as wallpaper</button>`;
    };
    e.setAttribute("data-name",id);
    document.getElementById(`F${id}`).appendChild(e);
  } else if (event.target.getAttribute("id")=="wallpaper" || event.target.getAttribute("id")=="Files") {
    const filesContainer = document.getElementById("Files");
    const containerRect = filesContainer.getBoundingClientRect();
    const clickX = event.clientX - containerRect.left;
    const clickY = event.clientY - containerRect.top;
    
    globalData["contextClickPosition"] = { x: clickX, y: clickY };
    
    var e = document.createElement("context");
  e.innerHTML = `
    <button class="context-create-btn">Create file</button>
    <button class="context-create-folder-btn">Create folder</button>
    <button onclick='document.getElementById("file_upload").click()'>Upload</button>
    <button onclick='Frefresh()'>Refresh</button>
  `;
    e.style.position = "absolute";
    e.style.left = event.clientX + "px";
    e.style.top = event.clientY + "px";
    document.getElementById("wallpaper").appendChild(e);
    
    e.querySelector('.context-create-btn').addEventListener('click', function() {
      Fcreate();
    });
    e.querySelector('.context-create-folder-btn').addEventListener('click', function() {
      FcreateFolder();
    });
  };
});

if (!window.showBusyOverlay) {
  window.showBusyOverlay = (message = 'Working…') => {
    let el = document.getElementById('busyOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'busyOverlay';
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.background = 'rgba(0,0,0,0.35)';
      el.style.zIndex = '99999';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.backdropFilter = 'blur(2px)';
      const box = document.createElement('div');
      box.style.padding = '16px 20px';
      box.style.borderRadius = '10px';
      box.style.background = 'rgba(20,20,20,0.9)';
      box.style.color = '#fff';
      box.style.font = '14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      box.style.display = 'flex';
      box.style.alignItems = 'center';
      box.style.gap = '10px';
      const spinner = document.createElement('div');
      spinner.style.width = '18px';
      spinner.style.height = '18px';
      spinner.style.border = '2px solid rgba(255,255,255,0.25)';
      spinner.style.borderTopColor = '#fff';
      spinner.style.borderRadius = '50%';
      spinner.style.animation = 'spin 0.9s linear infinite';
      const text = document.createElement('div');
      text.className = 'busyOverlayText';
      text.textContent = message;
      box.appendChild(spinner);
      box.appendChild(text);
      el.appendChild(box);
      const style = document.createElement('style');
      style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      el.appendChild(style);
      document.body.appendChild(el);
    } else {
      const t = el.querySelector('.busyOverlayText');
      if (t) t.textContent = message;
      el.style.display = 'flex';
    }
  };
}
if (!window.hideBusyOverlay) {
  window.hideBusyOverlay = () => {
    const el = document.getElementById('busyOverlay');
    if (el) el.style.display = 'none';
  };
}
if (!window.uploadFileWithProgress) {
  window.uploadFileWithProgress = (file) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/files/upload');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = Math.round((e.loaded / e.total) * 100);
          window.showBusyOverlay('Uploading ' + p + '%');
        }
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve(xhr.responseText || '');
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  };
}

document.getElementById("file_upload").addEventListener("change", handleFiles, false);
async function handleFiles() {
  const f = this.files[0];
  let response = '';
  showBusyOverlay('Uploading 0%');
  try {
    response = await uploadFileWithProgress(f);
  } finally {
    hideBusyOverlay();
  }
  if (response != "Updated") {
    loadFiles("[" + response + "]");
  }
};

async function Frefresh() {
  if (globalData["refreshing"] == false || globalData["refreshing"] == undefined) {
    globalData["refreshing"] = true;
    try {
      var elements = document.getElementsByTagName("file");

      for(let i = elements.length-1;i >= 0; i--){
        elements[i].remove();
      };
    }catch{};
    
    const response = await fetch(`${window.location.origin}/files/list`);
    if (response.ok) {
      const files = await response.json();
      
      globalData["filePositions"] = {};
      files.forEach(file => {
        if (file.position) {
          globalData["filePositions"][file.file] = file.position;
        }
      });
      
      loadFiles(JSON.stringify(files));
    }
    
    globalData["refreshing"] = false;
  } else {return};
};

async function Fopen(file, extension, key, options) {
  const looksArchiveUrl = typeof file === 'string' && file.startsWith('files/archive/get/');
  let isFromArchive = !!(options && options.archiveFile) || looksArchiveUrl;

  let fileName = file;
  if (isFromArchive) {
    if (looksArchiveUrl) {
      try {
        const q = file.split('?')[1] || '';
        const params = new URLSearchParams(q);
        const p = params.get('path');
        fileName = p ? decodeURIComponent(p).split('/').pop() : file.split('/').pop();
      } catch { fileName = file.split('/').pop(); }
    } else {
      fileName = file.split('/').pop();
    }
  }

  let url;
  if (looksArchiveUrl) {
    url = file;
  } else if (options && options.archiveFile) {
    const archiveUrlPart = encodeURIComponent(options.archiveFile);
    const internalUrlPart = encodeURIComponent(file);
    url = `files/archive/get/${archiveUrlPart}?path=${internalUrlPart}`;
  } else {
    url = `files/get/${file}`;
  }

  if (extension == "Text document") {
    const text = await get(url);
    openNotepad(text, fileName, key);
  } else if (extension == "Code") {
    const text = await get(url);
    openCodeEditor(text, fileName, key, { readOnly: !!isFromArchive, sourceUrl: looksArchiveUrl ? file : (isFromArchive ? url : undefined) });
  } else if (extension == "Image") {
    openImage(isFromArchive ? url : file, key, fileName);
  } else if (extension == "Video" || extension == "Audio") {
    openVideo(isFromArchive ? url : file, extension.toLowerCase(), key, fileName);
  } else if (extension == "Archive") {
    openArchive(file,key);
  } else if (extension == "Folder") {
    openFolder(file, key);
  } else {
    prompt("This file type is not supported","Error","Ok");
  }
};

async function Fsetwallpaper(file) {
  await post(`set/wallpaper`,{"file":file});
  document.getElementById("wallpaper").style.backgroundImage = `url("wallpaper?a=${Math.random()}")`;
};

async function Fdownload(file) {
  const filesToDownload = globalData["selectedFiles"].size > 0 ? Array.from(globalData["selectedFiles"]) : [file];
  for (const fname of filesToDownload) {
    const response = await fetch(`${window.location.origin}/files/get/${fname}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fname.split('/').pop() || fname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
};

async function FdownloadMulti() {
  const filesToDownload = Array.from(globalData["selectedFiles"]);
  for (const fname of filesToDownload) {
    const response = await fetch(`${window.location.origin}/files/get/${fname}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fname.split('/').pop() || fname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
};

async function createNewItem(type) {
  hideContext();
  
  const tempName = `new_${type}_${Date.now()}`;
  const tempType = type === 'folder' ? 'Folder' : 'Unknown';
  const displayName = type === 'folder' ? 'new_folder' : 'new_file';
  const sizeText = type === 'folder' ? '-' : '0 B';
  
  const el = document.createElement("file");
  el.setAttribute("id", "F" + tempName);
  el.setAttribute("data-name", tempName);
  el.setAttribute("extension", tempType);
  el.setAttribute("draggable", "true");
  el.setAttribute("data-temp-new", "1");
  
  const ic = globalData["extensions"][tempType];
  el.innerHTML = `
    <img extension="${tempType}" data-name="${tempName}" src="/static/icons/${ic}">
    <span extension="${tempType}" data-name="${tempName}">${displayName}</span>
    <div extension="${tempType}" data-name="${tempName}" class="tooltip">Name: ${displayName}<br>Type: ${tempType}<br>Size: ${sizeText}<br>Changed: -</div>
  `;
  
  let pos;
  if (globalData["contextClickPosition"]) {
    const clickPos = globalData["contextClickPosition"];
    const snapped = snapToGrid(clickPos.x, clickPos.y);
    pos = findNearestFreeSlot(snapped.col, snapped.row, tempName);
    globalData["contextClickPosition"] = null;
  } else {
    pos = findNextFreeGridSlot();
  }
  
  setFilePosition(el, pos.col, pos.row);
  globalData["filePositions"][tempName] = pos;
  
  document.getElementById("Files").appendChild(el);
  setupFileDragging(el);
  
  const span = el.querySelector('span[extension][data-name]');
  const img = el.querySelector('img[extension][data-name]');
  const tooltip = el.querySelector('div.tooltip');
  
  const input = createEditableInput(span);
  
  let finished = false;
  
  const cleanup = () => {
    if (finished) return;
    finished = true;
    el.remove();
    delete globalData["filePositions"][tempName];
    saveFilePositions();
  };
  
  const applyDomUpdate = (newName, newType) => {
    el.id = 'F' + newName;
    el.setAttribute('data-name', newName);
    el.setAttribute('extension', newType);
    el.removeAttribute('data-temp-new');
    
    if (img) {
      img.setAttribute('data-name', newName);
      img.setAttribute('extension', newType);
      const icon = globalData["extensions"][newType] || globalData["extensions"]["Unknown"];
      img.src = `/static/icons/${icon}`;
    }
    
    const displayNameFinal = (newType === 'Folder') ? newName.replace(/\/$/, '') : newName;
    const labels = computeDisplayNames(displayNameFinal);
    const newSpan = document.createElement('span');
    newSpan.setAttribute('extension', newType);
    newSpan.setAttribute('data-name', newName);
    newSpan.innerText = labels.name;
    input.replaceWith(newSpan);
    
    if (tooltip) {
      tooltip.setAttribute('data-name', newName);
      tooltip.setAttribute('extension', newType);
      tooltip.innerHTML = `Name: ${labels.nameL}<br>Type: ${newType}<br>Size: ${newType === 'Folder' ? '-' : '0 B'}<br>Changed: -`;
    }
    
    if (globalData["filePositions"][tempName]) {
      globalData["filePositions"][newName] = globalData["filePositions"][tempName];
      delete globalData["filePositions"][tempName];
      saveFilePositions();
    }
  };
  
  const commit = async (cancel) => {
    if (finished) return;
    if (cancel) { cleanup(); return; }
    
    let newName = (input.value || '').trim();
    if (!newName) {
      cleanup();
      return;
    }
    
    if (newName.includes('/') || newName.includes('\\') || newName.includes(':') || newName.startsWith('.') || newName.includes(';') || newName.includes('*') || newName.includes('?') || newName.includes('"') || newName.includes('<') || newName.includes('>') || newName.includes('|') || newName.includes("'")) {
      prompt(`Name cannot contain illegal characters`, `Create ${type}`, 'Ok');
      cleanup();
      return;
    }
    
    if (document.getElementById("F" + newName)) {
      prompt(`${type.charAt(0).toUpperCase() + type.slice(1)} with that name already exists`, `Create ${type}`, 'Ok');
      cleanup();
      return;
    }
    
    let resp;
    if (type === 'file') {
      resp = await post('files/upload', { file: newName, data: '' });
    } else {
      resp = await post('files/folders/create', { path: newName });
    }
    
    try {
      const data = JSON.parse(resp);
      if (data && data.file) {
        finished = true;
        const finalName = type === 'folder' ? (data.file.endsWith('/') ? data.file : data.file + '/') : data.file;
        const newType = type === 'folder' ? 'Folder' : getTypeForFilename(finalName);
        applyDomUpdate(finalName, newType);
        
        if (tooltip) {
          const disp = type === 'folder' ? finalName.replace(/\/$/, '') : finalName;
          tooltip.innerHTML = `Name: ${computeDisplayNames(disp).nameL}<br>Type: ${newType}<br>Size: ${type === 'folder' ? '-' : (data.size || '0 B')}<br>Changed: ${data.last_change || '-'}`;
        }
        return;
      }
    } catch {}
    
    if (resp === 'Updated' || resp.includes(type) || resp.includes('created')) {
      finished = true;
      const finalName = type === 'folder' ? (newName.endsWith('/') ? newName : newName + '/') : newName;
      const newType = type === 'folder' ? 'Folder' : getTypeForFilename(finalName);
      applyDomUpdate(finalName, newType);
      return;
    } else {
      await prompt(resp || `Failed to create ${type}`, `Create ${type}`, 'Ok');
      setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);
    }
  };
  
  input.addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      await commit(false);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      commit(true);
    }
  });
  
  input.addEventListener('blur', () => { 
    setTimeout(() => commit(false), 10);
  });
  
  const outsideClickHandler = (ev) => {
    if (!el.contains(ev.target) && !finished) {
      commit(false);
      document.removeEventListener('mousedown', outsideClickHandler, true);
    }
  };
  document.addEventListener('mousedown', outsideClickHandler, true);
}

async function Fcreate() {
  await createNewItem('file');
}

async function FcreateFolder() {
  await createNewItem('folder');
}



async function Fremove(file) {
  const filesToRemove = globalData["selectedFiles"].size > 0 ? Array.from(globalData["selectedFiles"]) : [file];
  for (const fname of filesToRemove) {
    const response = await post("files/remove",{"file":fname});
    if (response == "Removed" || response == "File not found") {
      document.getElementById("F"+fname)?.remove();
      delete globalData["filePositions"][fname];
      globalData["selectedFiles"].delete(fname);
      if (typeof fname === 'string' && fname.endsWith('/')) {
        try { closeFolderWindowsForPath(fname); } catch {}
      }
    }
  }
  saveFilePositions();
};

async function FremoveMulti() {
  const filesToRemove = Array.from(globalData["selectedFiles"]);

  for (const fname of filesToRemove) {
    const response = await post("files/remove",{"file":fname});
    if (response == "Removed" || response == "File not found") {
      document.getElementById("F"+fname)?.remove();
      delete globalData["filePositions"][fname];
      globalData["selectedFiles"].delete(fname);
      if (typeof fname === 'string' && fname.endsWith('/')) {
        try { closeFolderWindowsForPath(fname); } catch {}
      }
    }
  }
  saveFilePositions();
};

function hideContext() {
  try {
    var elements = document.getElementsByTagName("context");
    document.documentElement.style.setProperty('--tooltip-display', 'block');
    for(let i = 0;i < elements.length; i++) {
        elements[i].remove();
    };
  }catch{};
};

function closeFolderWindowsForPath(deletedPath) {
  if (!deletedPath) return;
  const base = deletedPath.replace(/\/$/, '');
  if (!base) return;
  document.querySelectorAll('.folder-window').forEach(el => {
    try {
      const cur = (el.dataset && el.dataset.path) ? el.dataset.path : '';
      if (!cur) return;
      if (cur === base || cur.startsWith(base + '/')) {
        const key = (el.id && el.id.startsWith('folder-win-')) ? el.id.slice('folder-win-'.length) : null;
        if (key && globalData["openedWindows"][key]) {
          delete globalData["openedWindows"][key];
        }
        const winEl = el.closest('.winbox');
        if (winEl) {
          winEl.remove();
        } else {
          el.remove();
        }
      }
    } catch {}
  });
  try {
    for (const key in globalData["openedWindows"]) {
      const info = globalData["openedWindows"][key];
      if (!info || info.extension !== 'Folder') continue;
      const f = (info.file || '').replace(/\/$/, '');
      if (f === base || f.startsWith(base + '/')) {
        delete globalData["openedWindows"][key];
      }
    }
  } catch {}
  try { saveOpenedWindowsState(); } catch {}
}

function getTypeForFilename(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  
  if (ext === 'txt') return 'Text document';
  
  const code = [
    'html','htm','xhtml','css','scss','sass','less','js','mjs','ts','tsx','jsx','json','json5','xml','svg','vue','astro',
    'py','pyw',
    'java','kt','kts','scala','groovy','clj','cljs',
    'c','h','cpp','cc','cxx','hpp','hh','hxx',
    'cs','csx','fs','fsx','fsi','vb',
    'go','rs','swift','m','mm',
    'php','php3','php4','php5','phtml','rb','rake','gemspec','erb','lua',
    'sh','bash','zsh','bat','cmd','ps1','psm1',
    'jl',
    'md','markdown','rst','tex','latex','asciidoc','adoc','textile',
    'yaml','yml','toml','ini','cfg','conf','properties',
    'sql','mysql','pgsql','psql','plsql',
    'pl','pm','r','tcl',
    'hs','elm','erl','hrl','ex','exs','ml','mli','scm','ss','lisp','lsp','clue','flix',
    'dart','hx','coffee','cr','d','nim','zig','odin','v','vala','pas','pp','ada','adb','ads','cob','cbl','f','f90','f95',
    'asm','s',
    'ejs','jade','pug','haml','slim','handlebars','hbs','mustache','twig','nunjucks','njk','jinja','jinja2','django','liquid','smarty','tpl','ftl','velocity','vm',
    'dockerfile','docker','tf','tfvars','hcl','proto','graphql','gql','prisma','nix','htaccess','nginx','gitignore','diff','patch','makefile','mk',
    'csv','tsv',
    'glsl','vert','frag','vhd','vhdl','mat',
    'as','applescript','ahk','bas','cfm','cfc','ls','styl','pro',
    'mafile','maFile'
  ];
  
  const image = ['png','jpg','jpeg','gif','bmp','webp','svg'];
  const video = ['mp4','avi','mkv','webm','mov'];
  const audio = ['flac','mp3','wav','ogg','m4a'];
  const archive = ['zip','rar','tar'];
  
  if (code.includes(ext)) return 'Code';
  if (image.includes(ext)) return 'Image';
  if (video.includes(ext)) return 'Video';
  if (audio.includes(ext)) return 'Audio';
  if (archive.includes(ext)) return 'Archive';
  return 'Unknown';
}



async function FrenameInPath(fullPath, key) {
  let e = document.getElementById("folder-win-" + key);
  if (!e) {
    const allFolders = document.querySelectorAll('.folder-window');
    for (const folderEl of allFolders) {
      if (folderEl.dataset.path === fullPath.split('/').slice(0, -1).join('/')) {
        e = folderEl;
        break;
      }
    }
    if (!e) {
      return;
    }
  }
  try {
    hideContext();
    let row = e.querySelector(`tr[data-path="${fullPath}"]`);
    if (!row) {
      const target = (fullPath || '').replace(/\/$/, '');
      row = Array.from(e.querySelectorAll('.archive-table tbody tr')).find(r => {
        const p = (r.dataset.path || r.dataset.name || '').replace(/\/$/, '');
        return p === target;
      }) || null;
    }
    if (!row) return;
    const td = row.querySelector('td');
    if (!td) return;
    const originalHTML = td.innerHTML;
    const label = fullPath.endsWith('/') ? fullPath.slice(0, -1).split('/').pop() : (fullPath.split('/').pop() || fullPath);
    const iconMatch = originalHTML.match(/^(<img[^>]*>)/);
    const iconHTML = iconMatch ? iconMatch[1] : '';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = label;
    input.style.display = 'inline-block';
    input.style.width = 'auto';
    input.style.minWidth = '50px';
    input.style.maxWidth = '200px';
    input.style.boxSizing = 'border-box';
    input.style.background = 'rgba(0,0,0,0.2)';
    input.style.color = 'inherit';
    input.style.border = 'none';
    input.style.outline = '1px solid rgba(255,255,255,0.3)';
    input.style.borderRadius = '3px';
    input.style.padding = '1px 2px';
    input.style.fontSize = 'inherit';
    input.style.fontFamily = 'inherit';
    input.style.verticalAlign = 'middle';
    td.innerHTML = iconHTML;
    td.appendChild(input);
    input.addEventListener('mousedown', (ev) => ev.stopPropagation());
    setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);

    const handleGlobalClick = (ev) => {
      if (ev.target !== input && !input.contains(ev.target)) {
        commit(false);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);

    let finished = false;
    const restore = () => {
      if (finished) return;
      finished = true;
      document.removeEventListener('mousedown', handleGlobalClick);
      td.innerHTML = originalHTML;
    };

    const commit = async (cancel) => {
      if (finished) return;
      if (cancel) { restore(); return; }
      let newName = (input.value || '').trim();
      if (!newName) {
        restore();
        prompt('Name cannot be empty', 'Rename', 'Ok');
        return;
      }
      if (newName === label) { restore(); return; }
      if (label.indexOf('.') !== -1 && newName.indexOf('.') === -1) {
        newName += label.substring(label.lastIndexOf('.'));
      }
      if (newName.includes('/') || newName.includes('\\') || newName.includes(':') || newName.startsWith('.') || newName.includes(';') || newName.includes('*') || newName.includes('?') || newName.includes('"') || newName.includes('<') || newName.includes('>') || newName.includes('|') || newName.includes("'")) {
        restore();
        prompt('Name cannot contain illegal characters', 'Rename', 'Ok');
        return;
      }
  const baseFull = fullPath.replace(/\/$/, '');
  const dir = baseFull.includes('/') ? baseFull.split('/').slice(0, -1).join('/') : '';
  let newPath = dir ? `${dir}/${newName}` : newName;
      if (fullPath.endsWith('/')) newPath += '/';
      const resp = await post('files/move', { old: fullPath, new: newPath });
      try { const j = JSON.parse(resp); if (j && j.error) { restore(); prompt(j.error, 'Rename', 'Ok'); return; } } catch {}
      finished = true;
      try { document.removeEventListener('mousedown', handleGlobalClick); } catch {}
      row.dataset.path = newPath;
      e.dispatchEvent(new CustomEvent('folder:refresh', { bubbles: true }));
      await Frefresh();
    };

    input.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        await commit(false);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        commit(true);
      }
    });
    input.addEventListener('blur', () => { commit(false); });
  } catch (e) { }
}

async function FremoveInPath(fullPath, key) {
  try {
    hideContext();
    const resp = await post('files/remove', { file: fullPath });
    try { const j = JSON.parse(resp); if (j && j.error) { await prompt(j.error, 'Remove', 'Ok'); return; } } catch {}
    if (typeof fullPath === 'string' && fullPath.endsWith('/')) {
      try { closeFolderWindowsForPath(fullPath); } catch {}
    }
    await Frefresh();
    const e = document.getElementById("folder-win-" + key);
    if (e) e.dispatchEvent(new CustomEvent('folder:refresh', { bubbles: true }));
    return resp;
  } catch (e) { }
}

function computeDisplayNames(fullName) {
  let name = fullName;
  let nameL = fullName;
  if (fullName.length >= 10) {
    name = fullName.substring(0, 8) + "..";
    if (fullName.length >= 20) {
      nameL = fullName.substring(0, 20) + "..";
    }
  }
  return { name, nameL };
}

function promptInput(text, title, defaultValue, b1, b2) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    const id = (Math.random() + 1).toString(36).substring(7);
    wrap.innerHTML = `
      <p class="promptText">${text}</p>
      <input id="${id}-input" type="text" class="promptInput" value="${defaultValue || ''}" style="width: 100%; box-sizing: border-box; margin: 6px 0;"/>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button id="${id}-ok" class="promptBtn">${b1 || 'OK'}</button>
        <button id="${id}-cancel" class="promptBtn">${b2 || 'Cancel'}</button>
      </div>
    `;

    const dlg = new WinBox({
      title: title || 'Input',
      width: 320,
      height: 150,
      top: 60,
      x: '42%',
      y: '43%',
      mount: wrap,
      class: ["modern", "no-full", "no-min", "no-max", "no-resize"],
      onclose: () => {
        resolve({ action: 'Close', value: null });
        return false;
      }
    });

    const input = wrap.querySelector(`#${id}-input`);
    const okBtn = wrap.querySelector(`#${id}-ok`);
    const cancelBtn = wrap.querySelector(`#${id}-cancel`);

    okBtn.onclick = function() {
      const val = input.value.trim();
      dlg.close(true);
      resolve({ action: b1 || 'OK', value: val });
    };
    cancelBtn.onclick = function() {
      dlg.close(true);
      resolve({ action: b2 || 'Cancel', value: null });
    };
    setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);
  });
}

async function Frename(oldName) {
  try {
    for (const k in globalData["openedWindows"]) {
      if (globalData["openedWindows"][k] && globalData["openedWindows"][k]["file"] === oldName) {
        await prompt("Close the file before renaming", "Rename", "Ok");
        return;
      }
    }

    const el = document.getElementById("F" + oldName);
    if (!el) return;
    hideContext();

    const span = el.querySelector('span[extension][data-name]');
    const img = el.querySelector('img[extension][data-name]');
    const tooltip = el.querySelector('div.tooltip');
    if (!span) return;

  const oldType = el.getAttribute('extension') || '';
  const initialVal = (oldType === 'Folder') ? (oldName || '').replace(/\/$/, '') : oldName;
  const input = createEditableInput(span, initialVal, true);
    input.addEventListener('mousedown', (ev) => ev.stopPropagation());

    const handleGlobalClick = (ev) => {
      if (ev.target !== input && !input.contains(ev.target)) {
        commit(false);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);

    let finished = false;
    const restore = () => {
      if (finished) return;
      finished = true;
      document.removeEventListener('mousedown', handleGlobalClick);
      const newSpan = document.createElement('span');
      newSpan.setAttribute('extension', el.getAttribute('extension'));
      newSpan.setAttribute('data-name', oldName);
      const isFolder = (oldType === 'Folder');
      const displayOld = isFolder ? (oldName || '').replace(/\/$/, '') : oldName;
      const labels = computeDisplayNames(displayOld);
      newSpan.innerText = labels.name;
      input.replaceWith(newSpan);
    };

    const applyDomUpdate = (newName, newType) => {
      el.id = 'F' + newName;
      el.setAttribute('data-name', newName);
      el.setAttribute('extension', newType);

      if (img) {
        img.setAttribute('data-name', newName);
        img.setAttribute('extension', newType);
        const icon = globalData["extensions"][newType] || globalData["extensions"]["Unknown"];
        img.src = `/static/icons/${icon}`;
      }

  const displayNameFinal = (newType === 'Folder') ? (newName || '').replace(/\/$/, '') : newName;
  const labels = computeDisplayNames(displayNameFinal);
      const newSpan = document.createElement('span');
      newSpan.setAttribute('extension', newType);
      newSpan.setAttribute('data-name', newName);
      newSpan.innerText = labels.name;
      input.replaceWith(newSpan);

      if (tooltip) {
        let sizeText = '0 B';
        let changedText = '-';
        try {
          const mSize = tooltip.innerHTML.match(/Size:\s*([^<]+)/i);
          if (mSize) sizeText = mSize[1].trim();
          const mCh = tooltip.innerHTML.match(/Changed:\s*([^<]+)/i);
          if (mCh) changedText = mCh[1].trim();
        } catch {}
        tooltip.setAttribute('data-name', newName);
        tooltip.setAttribute('extension', newType);
        tooltip.innerHTML = `Name: ${labels.nameL}<br>Type: ${newType}<br>Size: ${sizeText}<br>Changed: ${changedText}`;
      }

      try {
        if (globalData["focused"]) {
          const wasFocused = globalData["focused"].id === 'F' + oldName;
          if (wasFocused) {
            globalData["focused"] = el;
          }
        }
      } catch {}
      
      if (globalData["selectedFiles"].has(oldName)) {
        globalData["selectedFiles"].delete(oldName);
        globalData["selectedFiles"].add(newName);
        el.classList.add('selected');
      }
      
      if (globalData["filePositions"][oldName]) {
        globalData["filePositions"][newName] = globalData["filePositions"][oldName];
        delete globalData["filePositions"][oldName];
        saveFilePositions([newName]);
      }
    };

    const commit = async (cancel) => {
      if (finished) return;
      if (cancel) { restore(); return; }
      let newName = (input.value || '').trim();
      if (!newName) {
        restore();
        prompt('Name cannot be empty', 'Rename', 'Ok');
        return;
      }
      if (newName === oldName) { restore(); return; }
      if (oldName.indexOf('.') !== -1 && newName.indexOf('.') === -1) {
        newName += oldName.substring(oldName.lastIndexOf('.'));
      }
      if (newName.includes('/') || newName.includes('\\') || newName.includes(':') || newName.startsWith('.') || newName.includes(';') || newName.includes('*') || newName.includes('?') || newName.includes('"') || newName.includes('<') || newName.includes('>') || newName.includes('|') || newName.includes("'")) {
        restore();
        prompt('Name cannot contain illegal characters', 'Rename', 'Ok');
        return;
      }

  const isFolder = (oldType === 'Folder');
  const newNameAdj = isFolder ? (newName.endsWith('/') ? newName : (newName + '/')) : newName;
  const resp = await post('files/move', { old: oldName, new: newNameAdj });
      try {
        const data = JSON.parse(resp);
        if (data && (data.status === 'Renamed' || data.status === 'Moved')) {
          finished = true;
          try { document.removeEventListener('mousedown', handleGlobalClick); } catch {}
          const newType = isFolder ? 'Folder' : getTypeForFilename(newNameAdj);
          applyDomUpdate(newNameAdj, newType);
          return;
        } else if (data && data.error) {
          restore();
          prompt(data.error, 'Rename', 'Ok');
          return;
        }
      } catch {}
      if (resp === 'Renamed' || resp === 'Moved') {
        finished = true;
        try { document.removeEventListener('mousedown', handleGlobalClick); } catch {}
        const newType = isFolder ? 'Folder' : getTypeForFilename(newNameAdj);
        applyDomUpdate(newNameAdj, newType);
        return;
      } else {
        restore();
        prompt(resp || 'Failed to rename', 'Rename', 'Ok');
        return;
      }
    };

    input.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        await commit(false);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        commit(true);
      }
    });
    input.addEventListener('blur', () => { commit(false); });
  } catch (e) {
    await prompt('Unexpected error during rename', 'Rename', 'Ok');
  }
}

document.onkeydown = async function(event) {
  const { ctrlKey, keyCode, target } = event;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
  
  if (ctrlKey && keyCode === 83) {
    if (target.classList?.contains('ace_text-input')) return;
    event.preventDefault();
    try {
      const activeEl = document.activeElement;
      if (activeEl?.id?.includes('Text')) {
        const id = activeEl.id.split('Text')[0];
        await saveNotepad(id);
      }
    } catch {}
    return;
  }
  
  if (ctrlKey && keyCode === 65 && !isInput) {
    event.preventDefault();
    clearSelection();
    document.querySelectorAll('file[data-name]').forEach(fileEl => {
      const fileName = fileEl.getAttribute('data-name');
      globalData["selectedFiles"].add(fileName);
      fileEl.classList.add('selected');
    });
    return;
  }
  
  if (keyCode === 46) {
    event.preventDefault();
    if (globalData["selectedFiles"].size > 0) {
      const filesToRemove = Array.from(globalData["selectedFiles"]);
      for (const fname of filesToRemove) {
        await Fremove(fname);
      }
    } else if (globalData["focused"] !== "none") {
      await Fremove(globalData["focused"].getAttribute("data-name"));
    }
    return;
  }
  
  if (keyCode === 116) {
    event.preventDefault();
    await Frefresh();
    return;
  }
};


async function saveNotepad(file) {
  if (document.getElementById(file+"Text").value==globalData[file]) {return};

  var response = await post("files/upload",{"file":file,"data":document.getElementById(file+"Text").value});
  globalData[file] = document.getElementById(file+"Text").value;

  if (response!="Updated") {
    response = JSON.parse(response);
    var e = document.createElement("file");
    e.setAttribute("data-name",file);
    e.setAttribute("id","F"+file);
    e.setAttribute("extension","Text document");
    e.innerHTML = `
      <img extension="Text document" data-name="${file}" src="/static/icons/notepad.png">
      <span extension="Text document" data-name="${file}">${file}</span>
      <div extension="Text document" data-name="${file}" class="tooltip">Type: ${response.type}<br>Size: ${response.size}<br>Change: ${response.last_change}</div>
    `;

    let pos;
    if (globalData["contextClickPosition"]) {
      const clickPos = globalData["contextClickPosition"];
      const snapped = snapToGrid(clickPos.x, clickPos.y);
      pos = findNearestFreeSlot(snapped.col, snapped.row, file);
      globalData["contextClickPosition"] = null;
    } else {
      pos = findNextFreeGridSlot();
    }

    setFilePosition(e, pos.col, pos.row);
    globalData["filePositions"][file] = pos;
    document.getElementById("Files").appendChild(e);
    setupFileDragging(e);
    saveFilePositions([file]);
  };
};

function openCalculator() {
  if (document.getElementById("calcInput")) {return};
  var e = document.createElement("div");
  var windowData = getWindowData("calculator");
  e.setAttribute("id","calculator");

  e.innerHTML = `
      <input id="calcInput" type="text" placeholder="0" value="0">
      <table>
        <tr>
          <td></td>
          <td onclick="calcValue('sqrt')"><span style="white-space: nowrap;">√<span style="white-space: nowrap;border-top:1px solid; padding:0 0.3em;">x</span></span></td>
          <td onclick="calcValue('^')">x<sup>2</sup></td>
          <td onclick="calcValue(null)"><-</td>
        </tr>
        <tr>
          <td onclick="calcValue('7')">7</td>
          <td onclick="calcValue('8')">8</td>
          <td onclick="calcValue('9')">9</td>
          <td onclick="calcValue('*')">x</td>
        </tr>
        <tr>
          <td onclick="calcValue('4')">4</td>
          <td onclick="calcValue('5')">5</td>
          <td onclick="calcValue('6')">6</td>
          <td onclick="calcValue('+')">+</td>
        </tr>
        <tr>
          <td onclick="calcValue('1')">1</td>
          <td onclick="calcValue('2')">2</td>
          <td onclick="calcValue('3')">3</td>
          <td onclick="calcValue('-')">-</td>
        </tr>
        <tr>
          <td onclick="calcValue('C')">C</td>
          <td onclick="calcValue('0')">0</td>
          <td onclick="calcValue('.')">.</td>
          <td onclick="calcValue('=')">=</td>
        </tr>
      </table>
  `;

  const win = new WinBox({
    title: "Calculator",
    width: windowData.width,
    height: windowData.height,
    top: 50,
    right: 0,
    bottom: 50,
    minheight: 75,
    x: windowData.x,
    y: windowData.y,
    left: 0,
    mount: e,
    onmove: (x, y) => {
      globalData["windows"]["calculator"]["position"] = {"x": x, "y": y};
      window.localStorage.setItem("globalData", JSON.stringify(globalData["windows"]));
    },
    icon: "/static/icons/calculator.png",
    class: ["modern", "no-full", "no-min", "no-max", "no-resize"],
    onclose: () => {
      return false;
    }
   });


  document.getElementById("calcInput").addEventListener("beforeinput", function(event) {
    event.preventDefault();
    calcValue(event.data);
  });

};

function calcValue(value) {
  const input = document.getElementById('calcInput');
  try {
    if (input.value == 'err*')  {
      input.value = '0';
    }
    if (value === 'C') {
      input.value = '0';
    } else if (value === '=') {
      if (input.value.length == 0) {return};
      input.value = input.value.replaceAll("^","**");
      input.value = eval(input.value);
    } else if (value === null) {
      input.value = input.value.substring(0, input.value.length - 1);
    } else if (value === 'sqrt') {
      if (input.value.length == 0) {return};
      input.value = input.value.replaceAll("^","**");
      input.value = eval(input.value);
      input.value = Math.sqrt(input.value);
    } else {
      if (value === 'x') {
        value = '*';
      }
      if ((value == "*" || value == "/" || value == "-" || value == "+" || value == "." || value == "^") && (input.value[input.value.length-1] == "^" || input.value[input.value.length-1] == "." || input.value[input.value.length-1] == "-" || input.value[input.value.length-1] == "+" || input.value[input.value.length-1] == "*" || input.value[input.value.length-1] == "/")) {return};
      if (value && !/[0-9/*\-+x^.]/.test(value)) {return}
      input.value += value;
      if (input.value[0] === '0' && (input.value[1] !== '.' && input.value[1] !== '*' && input.value[1] !== '/' && input.value[1] !== '+' && input.value[1] !== '^')) {
        input.value = input.value.substring(1);
      } else if (input.value[0] == "*" || input.value[0] == "/" || input.value[0] == "+" || input.value[0] == "." || input.value[0] == "^") {
        input.value = "0"+input.value;
      }
    }
  } catch (e) {
    input.value = 'err*';
  };
}

function openNotepad(text,file,key) {
  var prompted = false;
  var dynamic = false;
  var e = document.createElement("div");
  var windowData = getWindowData("notepad",key);
  globalData["mTab"][key] = false;
  title = file;

  if (file==null) {
    text = "";
    title="Notepad";
    dynamic = true;
    file = (Math.random() + 1).toString(36).substring(7)+".txt";
  }

  if (key == null) {
    key = (Math.random() + 1).toString(36).substring(7);
  }

  let isMinimized = false;

  e.innerHTML = `
      <textarea id="${file}Text" placeholder="Write something here">${text}</textarea>
  `;

  var win = new WinBox({
    title: title,
    width: windowData.width,
    height: windowData.height,
    top: 50,
    minheight: 75,
    right: 0,
    x: windowData.x,
    y: windowData.y,
    bottom: 50,
    left: 0,
    mount: e,
    icon: "/static/icons/notepad.png",
    class: ["modern", "no-full"],
    onresize: (width, height) => {
      setTimeout(() => { setWindowSize("notepad", key, width, height); },100);
    },
    onmove: (x, y) => {
      setTimeout(() => { setWindowPosition("notepad", key, x, y); },150);
    },
    onclose: (force) => {
      if (force) {
        delete globalData["openedWindows"][key];
        window.localStorage.setItem("globalData_windows", JSON.stringify(globalData["openedWindows"]));
        return false;
      }
      handleClose();
      return true;
    },
    onminimize: () => {
      if (isMinimized) return;
      isMinimized = true;
      globalData["mTab"][key] = true;
    },
    onfocus: () => {
      isMinimized = false;
      globalData["mTab"][key] = false;
    },
    oncreate: () => {
      if (!dynamic) {
        globalData["openedWindows"][key] = {"file": file, "extension": "Text document", "size": {"width": windowData.width, "height": windowData.height}, "position": {"x": windowData.x, "y": windowData.y}};
        saveOpenedWindowsState();
      }
    }
   });

   async function handleClose() {
     const value = document.getElementById(file + "Text").value;

     if (value !== "") {
       if (value === text || globalData[file] === value) {
         win.close(true);
         return;
       }
       if (!prompted) {
         prompted = true;
         const a = await prompt("Do you want to save it?", "Notepad", "Save", "Cancel");
         prompted = false;
         if (a === "Cancel") {
           return;
         } else if (a === "Save") {
           await saveNotepad(file);
           win.close(true);
           return;
         } else if (a === "Close") {
           win.close(true);
           return;
         }
       }
     } else {
       win.close(true);
     }
   }
};

function getAceModeForFilename(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map = {
    html: 'ace/mode/html', htm: 'ace/mode/html', xhtml: 'ace/mode/html',
    css: 'ace/mode/css', scss: 'ace/mode/scss', sass: 'ace/mode/sass', less: 'ace/mode/less',
    js: 'ace/mode/javascript', mjs: 'ace/mode/javascript',
    ts: 'ace/mode/typescript', tsx: 'ace/mode/tsx',
    jsx: 'ace/mode/jsx',
    json: 'ace/mode/json', json5: 'ace/mode/json5',
    xml: 'ace/mode/xml', svg: 'ace/mode/svg',
    vue: 'ace/mode/vue',
    astro: 'ace/mode/astro',
    py: 'ace/mode/python', pyw: 'ace/mode/python',
    java: 'ace/mode/java',
    kt: 'ace/mode/kotlin', kts: 'ace/mode/kotlin',
    scala: 'ace/mode/scala',
    groovy: 'ace/mode/groovy',
    clj: 'ace/mode/clojure', cljs: 'ace/mode/clojure',
    c: 'ace/mode/c_cpp', h: 'ace/mode/c_cpp',
    cpp: 'ace/mode/c_cpp', cc: 'ace/mode/c_cpp', cxx: 'ace/mode/c_cpp',
    hpp: 'ace/mode/c_cpp', hh: 'ace/mode/c_cpp', hxx: 'ace/mode/c_cpp',
    cs: 'ace/mode/csharp', csx: 'ace/mode/csharp',
    fs: 'ace/mode/fsharp', fsx: 'ace/mode/fsharp', fsi: 'ace/mode/fsharp',
    vb: 'ace/mode/vbscript',
    go: 'ace/mode/golang',
    rs: 'ace/mode/rust',
    swift: 'ace/mode/swift',
    m: 'ace/mode/objectivec', mm: 'ace/mode/objectivec',
    php: 'ace/mode/php', php3: 'ace/mode/php', php4: 'ace/mode/php', php5: 'ace/mode/php',
    phtml: 'ace/mode/php',
    rb: 'ace/mode/ruby', rake: 'ace/mode/ruby', gemspec: 'ace/mode/ruby',
    erb: 'ace/mode/rhtml',
    lua: 'ace/mode/lua',
    sh: 'ace/mode/sh', bash: 'ace/mode/sh', zsh: 'ace/mode/sh',
    bat: 'ace/mode/batchfile', cmd: 'ace/mode/batchfile',
    ps1: 'ace/mode/powershell', psm1: 'ace/mode/powershell',
    jl: 'ace/mode/julia',
    md: 'ace/mode/markdown', markdown: 'ace/mode/markdown',
    rst: 'ace/mode/rst',
    tex: 'ace/mode/latex', latex: 'ace/mode/latex',
    asciidoc: 'ace/mode/asciidoc', adoc: 'ace/mode/asciidoc',
    textile: 'ace/mode/textile',
    yaml: 'ace/mode/yaml', yml: 'ace/mode/yaml',
    toml: 'ace/mode/toml',
    ini: 'ace/mode/ini', cfg: 'ace/mode/ini', conf: 'ace/mode/ini',
    properties: 'ace/mode/properties',
    sql: 'ace/mode/sql',
    mysql: 'ace/mode/mysql',
    pgsql: 'ace/mode/pgsql', psql: 'ace/mode/pgsql',
    plsql: 'ace/mode/plsql',
    pl: 'ace/mode/perl', pm: 'ace/mode/perl',
    r: 'ace/mode/r',
    tcl: 'ace/mode/tcl',
    hs: 'ace/mode/haskell',
    elm: 'ace/mode/elm',
    erl: 'ace/mode/erlang', hrl: 'ace/mode/erlang',
    ex: 'ace/mode/elixir', exs: 'ace/mode/elixir',
    ml: 'ace/mode/ocaml', mli: 'ace/mode/ocaml',
    scm: 'ace/mode/scheme', ss: 'ace/mode/scheme',
    lisp: 'ace/mode/lisp', lsp: 'ace/mode/lisp',
    clue: 'ace/mode/clue',
    flix: 'ace/mode/flix',
    dart: 'ace/mode/dart',
    hx: 'ace/mode/haxe',
    coffee: 'ace/mode/coffee',
    cr: 'ace/mode/crystal',
    d: 'ace/mode/d',
    nim: 'ace/mode/nim',
    zig: 'ace/mode/zig',
    odin: 'ace/mode/odin',
    v: 'ace/mode/vala',
    vala: 'ace/mode/vala',
    pas: 'ace/mode/pascal', pp: 'ace/mode/pascal',
    ada: 'ace/mode/ada', adb: 'ace/mode/ada', ads: 'ace/mode/ada',
    cob: 'ace/mode/cobol', cbl: 'ace/mode/cobol',
    f: 'ace/mode/fortran', f90: 'ace/mode/fortran', f95: 'ace/mode/fortran',
    asm: 'ace/mode/assembly_x86', s: 'ace/mode/assembly_x86',
    ejs: 'ace/mode/ejs',
    jade: 'ace/mode/jade', pug: 'ace/mode/jade',
    haml: 'ace/mode/haml',
    slim: 'ace/mode/slim',
    handlebars: 'ace/mode/handlebars', hbs: 'ace/mode/handlebars',
    mustache: 'ace/mode/handlebars',
    twig: 'ace/mode/twig',
    nunjucks: 'ace/mode/nunjucks', njk: 'ace/mode/nunjucks',
    jinja: 'ace/mode/django', jinja2: 'ace/mode/django',
    django: 'ace/mode/django',
    liquid: 'ace/mode/liquid',
    smarty: 'ace/mode/smarty', tpl: 'ace/mode/smarty',
    ftl: 'ace/mode/ftl',
    velocity: 'ace/mode/velocity', vm: 'ace/mode/velocity',
    dockerfile: 'ace/mode/dockerfile',
    docker: 'ace/mode/dockerfile',
    tf: 'ace/mode/terraform', tfvars: 'ace/mode/terraform',
    hcl: 'ace/mode/terraform',
    proto: 'ace/mode/protobuf',
    graphql: 'ace/mode/graphqlschema', gql: 'ace/mode/graphqlschema',
    prisma: 'ace/mode/prisma',
    nix: 'ace/mode/nix',
    htaccess: 'ace/mode/apache_conf',
    nginx: 'ace/mode/nginx',
    gitignore: 'ace/mode/gitignore',
    diff: 'ace/mode/diff', patch: 'ace/mode/diff',
    makefile: 'ace/mode/makefile', mk: 'ace/mode/makefile',
    csv: 'ace/mode/csv',
    tsv: 'ace/mode/tsv',
    glsl: 'ace/mode/glsl', vert: 'ace/mode/glsl', frag: 'ace/mode/glsl',
    v: 'ace/mode/verilog', sv: 'ace/mode/verilog',
    vhd: 'ace/mode/vhdl', vhdl: 'ace/mode/vhdl',
    m: 'ace/mode/matlab', mat: 'ace/mode/matlab',
    r: 'ace/mode/r',
    pp: 'ace/mode/puppet',
    as: 'ace/mode/actionscript',
    applescript: 'ace/mode/applescript',
    ahk: 'ace/mode/autohotkey',
    bas: 'ace/mode/basic',
    cfm: 'ace/mode/coldfusion', cfc: 'ace/mode/coldfusion',
    ls: 'ace/mode/livescript',
    styl: 'ace/mode/stylus',
    pl: 'ace/mode/prolog', pro: 'ace/mode/prolog',
    txt: 'ace/mode/text', text: 'ace/mode/text',
    mafile: 'ace/mode/json',
  };
  return map[ext] || 'ace/mode/text';
}

async function openCodeEditor(text, file, key, opts) {
  let prompted = false;
  const e = document.createElement('div');
  e.style.height = '100%';
  e.style.display = 'flex';
  e.style.flexDirection = 'column';

  const editorHost = document.createElement('div');
  editorHost.id = `ace_${Date.now()}`;
  editorHost.style.flex = '1';
  editorHost.style.width = '100%';
  editorHost.style.minHeight = '200px';

  e.appendChild(editorHost);

  const windowData = getWindowData('code', key);
  if (key == null) key = (Math.random() + 1).toString(36).substring(7);

  let isMinimized = false;
  let isDirty = false;
  let savedText = typeof text === 'string' ? text : '';

  const win = new WinBox({
    title: file,
    width: windowData.width,
    height: windowData.height,
    top: 40,
    x: windowData.x,
    y: windowData.y,
    minheight: 200,
    minwidth: 300,
    mount: e,
    icon: '/static/icons/code.png',
    class: ['modern', 'no-full'],
    onresize: (width, height) => {
      setTimeout(() => { setWindowSize('code', key, width, height); }, 100);
    },
    onmove: (x, y) => {
      setTimeout(() => { setWindowPosition('code', key, x, y); }, 150);
    },
    onclose: (force) => {
      if (force) {
        delete globalData['openedWindows'][key];
        window.localStorage.setItem('globalData_windows', JSON.stringify(globalData['openedWindows']));
        return false;
      }
      handleClose();
      return true;
    },
    onminimize: () => {
      if (isMinimized) return;
      isMinimized = true;
      globalData['mTab'][key] = true;
    },
    onfocus: () => {
      isMinimized = false;
      globalData['mTab'][key] = false;
    },
    oncreate: () => {
      const info = { 'file': file, 'extension': 'Code', 'size': { 'width': windowData.width, 'height': windowData.height }, 'position': { 'x': windowData.x, 'y': windowData.y } };
      if (opts && opts.sourceUrl) {
        info.url = opts.sourceUrl;
      }
      globalData['openedWindows'][key] = info;
      saveOpenedWindowsState();
    }
  });

  const editor = ace.edit(editorHost.id);
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode(getAceModeForFilename(file));
  editor.setOptions({
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: true,
    fontSize: '12pt',
    wrap: false,
    showPrintMargin: false,
    readOnly: (opts && opts.readOnly) === true
  });
  editor.setValue(text || '', -1);
  savedText = editor.getValue();
  if (typeof savedText === 'string') {
    globalData[file] = savedText;
  }

  function updateTitle() {
    const base = file;
    const title = isDirty ? `${base} *` : base;
    try { win.setTitle(title); } catch {}
  }
  updateTitle();

  async function save() {
    if ((opts && opts.readOnly) === true) return;
    const content = editor.getValue();
    await post('files/upload', { file: file, data: content });
    savedText = content;
    globalData[file] = content;
    isDirty = false;
    updateTitle();
  }

  editor.commands.addCommand({
    name: 'saveFile',
    bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
    exec: save
  });

  editor.session.on('change', function() {
    const current = editor.getValue();
    const newDirty = current !== savedText;
    if (newDirty !== isDirty) {
      isDirty = newDirty;
      updateTitle();
    }
  });

  async function handleClose() {
    if ((opts && opts.readOnly) === true) {
      win.close(true);
      return;
    }
    const value = editor.getValue();
    if (value === savedText) {
      win.close(true);
      return;
    }
    if (!prompted) {
      prompted = true;
      const a = await prompt('Do you want to save it?', 'Code', 'Save', 'Cancel');
      prompted = false;
      if (a === 'Cancel') {
        return;
      } else if (a === 'Save') {
        await save();
        win.close(true);
        return;
      } else if (a === 'Close') {
        win.close(true);
        return;
      }
    }
  }
}


async function openArchive(file, key) {
    const e = document.createElement("div");
    e.style.height = '100%';
    e.style.display = 'flex';
    e.style.flexDirection = 'column';

    const windowData = getWindowData("archive", key);
    const title = file;
  let currentPath = '';
  let currentFiles = [];
  let selectedRows = new Set();
    let sortColumn = 'name';
    let sortDirection = 'asc';

    if (key == null) {
        key = (Math.random() + 1).toString(36).substring(7);
    }

    const savedPath = (key && globalData["openedWindows"][key] && globalData["openedWindows"][key]["archivePath"]) || '';

    function sortFiles(column) {
        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }
        renderTable();
    }

  function renderTable() {
        let sorted = [...currentFiles];
        
        sorted.sort((a, b) => {
            if (a.is_dir !== b.is_dir) {
                return a.is_dir ? -1 : 1;
            }
            
            let valA, valB;
            if (sortColumn === 'name') {
                valA = (a.display || a.name || '').toLowerCase();
                valB = (b.display || b.name || '').toLowerCase();
            } else if (sortColumn === 'size') {
                const parseSize = (sizeStr) => {
                    if (sizeStr === '-') return 0;
                    const match = sizeStr.match(/([\d.]+)\s*(B|KB|MB|GB)/i);
                    if (!match) return 0;
                    const value = parseFloat(match[1]);
                    const unit = match[2].toUpperCase();
                    const multipliers = { 'B': 1, 'KB': 1024, 'MB': 1024 * 1024, 'GB': 1024 * 1024 * 1024 };
                    return value * (multipliers[unit] || 1);
                };
                valA = parseSize(a.size);
                valB = parseSize(b.size);
            } else if (sortColumn === 'modified') {
                valA = a.modified === '-' ? 0 : new Date(a.modified).getTime();
                valB = b.modified === '-' ? 0 : new Date(b.modified).getTime();
            }
            
            if (sortDirection === 'asc') {
                return valA > valB ? 1 : valA < valB ? -1 : 0;
            } else {
                return valA < valB ? 1 : valA > valB ? -1 : 0;
            }
        });

        let table = `
            <div class="archive-content">
                <table class="archive-table">
                    <thead><tr>
                        <th class="sortable" data-column="name">Name ${sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
                        <th class="sortable" data-column="size">Size ${sortColumn === 'size' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
                        <th class="sortable" data-column="modified">Modified ${sortColumn === 'modified' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</th>
                    </tr></thead>
                    <tbody>
        `;

        if (currentPath) {
            const icon = '<img src="/static/icons/folder.png" class="archive-icon" style="width:14px;height:14px;">';
            table += `<tr data-path=".." data-isdir="true"><td>${icon}..</td><td>-</td><td>-</td></tr>`;
        }

        sorted.forEach(f => {
            let icon;
            if (f.is_dir) {
                icon = '<img src="/static/icons/folder.png" class="archive-icon" style="width:14px;height:14px;">';
            } else {
                const fileName = (f.display && f.display.length > 0) ? f.display : (f.name ? f.name.split('/').pop() : '');
                const fileType = getTypeForFilename(fileName);
                const iconName = globalData["extensions"][fileType] || "unknown_.png";
                icon = `<img src="/static/icons/${iconName}" class="archive-icon" style="width:14px;height:14px;">`;
            }
            const label = (f.display && f.display.length > 0) ? f.display : (f.name ? (f.name.endsWith('/') ? f.name.slice(0, -1).split('/').pop() : f.name.split('/').pop()) : '');
            table += `<tr data-path="${f.name}" data-isdir="${f.is_dir}"><td>${icon}${label}</td><td>${f.size}</td><td>${f.modified}</td></tr>`;
        });
        
        table += '</tbody></table></div>';
        e.innerHTML = table;

        e.querySelectorAll('.archive-table thead th.sortable').forEach(th => {
            th.style.cursor = 'pointer';
            th.onclick = () => sortFiles(th.dataset.column);
        });

        const applySelectionStyling = () => {
          e.querySelectorAll('.archive-table tbody tr').forEach(r => {
            const p = r.dataset.path || r.dataset.name;
            if (!p || p === '..') return;
            const sel = selectedRows.has(p);
            r.classList.toggle('selected-once', sel);
            r.style.background = '';
            r.querySelectorAll('td').forEach(td => { td.style.background = ''; });
          });
        };

        const pathToIsDir = new Map();
        sorted.forEach(f => { if (f && f.name) pathToIsDir.set(f.name, !!f.is_dir); });
        
    e.querySelectorAll('.archive-table tbody tr').forEach(row => {
      row.addEventListener('click', (ev) => {
        const p = row.dataset.path || row.dataset.name;
        if (!p || p === '..') return;
        if (ev.ctrlKey) {
          if (selectedRows.has(p)) selectedRows.delete(p); else selectedRows.add(p);
        } else {
          selectedRows.clear();
          selectedRows.add(p);
        }
        applySelectionStyling();
      });

      row.ondblclick = () => {
        const isDir = row.dataset.isdir === 'true';
        const internalPath = row.dataset.path;

        if (isDir) {
          if (internalPath === '..') {
            const parts = currentPath.split('/');
            parts.pop();
            renderPath(parts.join('/'));
          } else {
            renderPath(internalPath);
          }
        } else {
          const fileName = internalPath.split('/').pop();
          const fileExtension = fileName.split('.').pop().toLowerCase();
          const fileTypes = {
            'txt': 'Text document',
            'png': 'Image', 'jpg': 'Image', 'jpeg': 'Image', 'gif': 'Image', 'bmp': 'Image', 'webp': 'Image', 'svg': 'Image',
            'mp4': 'Video', 'avi': 'Video', 'mkv': 'Video', 'webm': 'Video', 'mov': 'Video',
            'flac': 'Audio', 'mp3': 'Audio', 'wav': 'Audio', 'ogg': 'Audio', 'm4a': 'Audio',
            'js': 'Code', 'ts': 'Code', 'py': 'Code', 'lua': 'Code', 'json': 'Code', 'html': 'Code', 'css': 'Code', 'md': 'Code',
            'yaml': 'Code', 'yml': 'Code', 'sh': 'Code', 'bat': 'Code', 'ps1': 'Code', 'c': 'Code', 'h': 'Code', 'cpp': 'Code',
            'cs': 'Code', 'java': 'Code', 'go': 'Code', 'rs': 'Code', 'php': 'Code', 'rb': 'Code', 'swift': 'Code', 'kt': 'Code',
            'toml': 'Code', 'ini': 'Code', 'conf': 'Code', 'mafile': 'Code'
          };
          const type = fileTypes[fileExtension] || 'Unknown';
          
          if (type !== 'Unknown') {
            Fopen(internalPath, type, null, { archiveFile: file });
          } else {
            prompt("This file type is not supported","Error","Ok");
          }
        }
      };

      row.addEventListener('mousedown', (downEvent) => {
        if (downEvent.button !== 0) return;
        const internalPath = row.dataset.path;
        if (!internalPath || internalPath === '..') return;

        let dragging = false;
        let ghost = null;
        const startX = downEvent.clientX;
        const startY = downEvent.clientY;
        const draggedItems = (function(){
          const items = [];
          const active = (selectedRows.size > 0 && selectedRows.has(internalPath)) ? Array.from(selectedRows) : [internalPath];
          active.forEach(p => {
            if (p && p !== '..') {
              const isDir = !!pathToIsDir.get(p);
              items.push({ path: p, isDir });
            }
          });
          return items;
        })();

        const updateGhost = (x, y) => {
          if (!ghost) {
            ghost = document.createElement('div');
            ghost.className = 'archive-drag-ghost';
            ghost.style.position = 'fixed';
            ghost.style.zIndex = '2000';
            ghost.style.pointerEvents = 'none';
            ghost.style.padding = '6px 10px';
            ghost.style.borderRadius = '6px';
            ghost.style.background = 'rgba(30,30,30,0.9)';
            ghost.style.color = '#fff';
            ghost.style.fontSize = '12px';
            ghost.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            const label = draggedItems.length > 1 ? `${draggedItems.length} items` : ((internalPath.split('/').pop() || internalPath));
            ghost.textContent = `Extract: ${label}`;
            document.body.appendChild(ghost);
          }
          ghost.style.left = (x + 12) + 'px';
          ghost.style.top = (y + 12) + 'px';
        };

        const onMouseMove = (mv) => {
          const dx = Math.abs(mv.clientX - startX);
          const dy = Math.abs(mv.clientY - startY);
          if (!dragging && (dx > 8 || dy > 8)) {
            dragging = true;
          }
          if (dragging) {
            updateGhost(mv.clientX, mv.clientY);
          }
        };

        const listFilesRecursively = async (dirPath) => {
          const results = [];
          const stack = [dirPath];
          while (stack.length) {
            const p = stack.pop();
            const q = encodeURIComponent(p);
            try {
              const resp = await get(`files/archive/list/${file}?path=${q}`);
              const arr = JSON.parse(resp);
              for (const item of arr) {
                if (!item || !item.name) continue;
                if (item.is_dir) {
                  stack.push(item.name);
                } else {
                  results.push(item.name);
                }
              }
            } catch {}
          }
          return results;
        };

        const ensureFolderTree = async (targetPath) => {
          const parts = targetPath.replace(/\/$/, '').split('/');
          let acc = '';
          for (let i = 0; i < parts.length; i++) {
            acc += (i === 0 ? parts[i] : ('/' + parts[i]));
            try { await post('files/folders/create', { path: acc + '/' }); } catch {}
          }
        };

        const showBusyOverlay = (message = 'Working…') => {
          let el = document.getElementById('busyOverlay');
          if (!el) {
            el = document.createElement('div');
            el.id = 'busyOverlay';
            el.style.position = 'fixed';
            el.style.inset = '0';
            el.style.background = 'rgba(0,0,0,0.35)';
            el.style.zIndex = '99999';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.backdropFilter = 'blur(2px)';
            const box = document.createElement('div');
            box.style.padding = '16px 20px';
            box.style.borderRadius = '10px';
            box.style.background = 'rgba(20,20,20,0.9)';
            box.style.color = '#fff';
            box.style.font = '14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
            box.style.display = 'flex';
            box.style.alignItems = 'center';
            box.style.gap = '10px';
            const spinner = document.createElement('div');
            spinner.style.width = '18px';
            spinner.style.height = '18px';
            spinner.style.border = '2px solid rgba(255,255,255,0.25)';
            spinner.style.borderTopColor = '#fff';
            spinner.style.borderRadius = '50%';
            spinner.style.animation = 'spin 0.9s linear infinite';
            const text = document.createElement('div');
            text.className = 'busyOverlayText';
            text.textContent = message;
            box.appendChild(spinner);
            box.appendChild(text);
            el.appendChild(box);
            const style = document.createElement('style');
            style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
            el.appendChild(style);
            document.body.appendChild(el);
          } else {
            const t = el.querySelector('.busyOverlayText');
            if (t) t.textContent = message;
            el.style.display = 'flex';
          }
        };
        const hideBusyOverlay = () => {
          const el = document.getElementById('busyOverlay');
          if (el) el.style.display = 'none';
        };

        const uploadFileWithProgress = (file) => {
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/files/upload');
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const p = Math.round((e.loaded / e.total) * 100);
                showBusyOverlay('Uploading ' + p + '%');
              }
            };
            xhr.onreadystatechange = () => {
              if (xhr.readyState === 4) {
                resolve(xhr.responseText || '');
              }
            };
            xhr.onerror = () => reject(new Error('Upload failed'));
            const fd = new FormData();
            fd.append('file', file);
            xhr.send(fd);
          });
        };

        const extractToDesktopAt = async (clientX, clientY) => {
          try {
            const filesContainer = document.getElementById('Files');
            if (!filesContainer) return;
            const containerRect = filesContainer.getBoundingClientRect();

            if (clientX < containerRect.left || clientX > containerRect.right || clientY < containerRect.top || clientY > containerRect.bottom) {
              return;
            }

            const elementAtPoint = document.elementFromPoint(clientX, clientY);
            if (elementAtPoint && elementAtPoint.closest('.winbox')) {
              return;
            }

            const dropX = clientX - containerRect.left;
            const dropY = clientY - containerRect.top;

            const snapped = snapToGrid(dropX, dropY);
            let offset = 0;
            const total = draggedItems.length;
            const isAnyDir = draggedItems.some(i => i.isDir);
            showBusyOverlay(isAnyDir ? `Extracting ${total} item${total>1?'s':''}…` : 'Copying…');
            for (const item of draggedItems) {
              const itemPath = item.path;
              const baseName = (itemPath.split('/').pop() || 'extracted');
              const startCol = snapped.col + (offset % 3);
              const startRow = snapped.row + Math.floor(offset / 3);
              const targetPos = findNearestFreeSlot(startCol, startRow, baseName + (item.isDir ? '/' : ''));
              if (item.isDir) {
                try {
                  const resp = await post('files/archive/extract', { archive: file, path: itemPath, dest: baseName });
                  let finalFolder = baseName + '/';
                  try { const j = JSON.parse(resp); if (j && j.file) finalFolder = j.file.endsWith('/') ? j.file : (j.file + '/'); } catch {}
                  globalData["filePositions"][finalFolder] = targetPos;
                  await saveFilePositions([finalFolder]);
                  await Frefresh();
                  const el = document.getElementById('F' + finalFolder);
                  if (el) setFilePosition(el, targetPos.col, targetPos.row);
                } catch (ex) {
                }
              } else {
                const archiveUrlPart = encodeURIComponent(file);
                const internalUrlPart = encodeURIComponent(itemPath);
                const getUrl = `files/archive/get/${archiveUrlPart}?path=${internalUrlPart}`;
                const resp = await fetch(getUrl);
                if (!resp.ok) { continue; }
                const blob = await resp.blob();
                const uploadFile = new File([blob], baseName, { type: blob.type || 'application/octet-stream' });
                showBusyOverlay('Uploading 0%');
                let upText = '';
                try {
                  upText = await uploadFileWithProgress(uploadFile);
                } finally {
                  hideBusyOverlay();
                }
                globalData["filePositions"][baseName] = targetPos;
                await saveFilePositions([baseName]);
                if (upText !== 'Updated') {
                  loadFiles("[" + upText + "]");
                } else {
                  const el = document.getElementById('F' + baseName);
                  if (el) setFilePosition(el, targetPos.col, targetPos.row);
                }
              }
              offset++;
            }
            hideBusyOverlay();
          } catch (err) {
            hideBusyOverlay();
          }
        };

        const onMouseUp = async (up) => {
          document.removeEventListener('mousemove', onMouseMove, true);
          document.removeEventListener('mouseup', onMouseUp, true);
          if (dragging) {
            up.preventDefault();
            up.stopPropagation();
            await extractToDesktopAt(up.clientX, up.clientY);
          }
          if (ghost) {
            ghost.remove();
            ghost = null;
          }
        };

        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseup', onMouseUp, true);
      });
    });

      const content = e.querySelector('.archive-content') || e;
      if (content) {
        let selecting = false; let startX = 0; let startY = 0; let box = null; let baseSelection = null; let containerRect = null; let bodyRect = null; let prevPos = '';
        const onMouseMove = (mv) => {
          if (!selecting) return;
          const cx = Math.min(Math.max(mv.clientX, containerRect.left), containerRect.right);
          const cy = Math.min(Math.max(mv.clientY, bodyRect.top), containerRect.bottom);
          const x1v = Math.min(startX, cx); const y1v = Math.min(startY, cy);
          const x2v = Math.max(startX, cx); const y2v = Math.max(startY, cy);
          box.style.left = (x1v - containerRect.left) + 'px';
          box.style.top = (y1v - containerRect.top) + 'px';
          box.style.width = (x2v - x1v) + 'px';
          box.style.height = (y2v - y1v) + 'px';
          const nextSel = new Set(baseSelection);
          e.querySelectorAll('.archive-table tbody tr').forEach(r => {
            const p = r.dataset.path || r.dataset.name;
            if (!p || p === '..') return;
            const rr = r.getBoundingClientRect();
            const intersects = !(rr.right < x1v || rr.left > x2v || rr.bottom < y1v || rr.top > y2v);
            if (intersects) nextSel.add(p);
          });
          selectedRows = nextSel;
          applySelectionStyling();
        };
        const onMouseUp = () => {
          if (!selecting) return;
          selecting = false;
          document.removeEventListener('mousemove', onMouseMove, true);
          document.removeEventListener('mouseup', onMouseUp, true);
          if (box) { box.remove(); box = null; }
          content.style.userSelect = '';
          e.style.overflow = '';
          if (prevPos) e.style.position = prevPos;
        };
        content.addEventListener('mousedown', (ev) => {
          if (ev.button !== 0) return;
          if (ev.target.closest('tr')) return;
          selecting = true;
          containerRect = content.getBoundingClientRect();
          const tbody = e.querySelector('.archive-table tbody');
          bodyRect = tbody ? tbody.getBoundingClientRect() : containerRect;
          startX = Math.min(Math.max(ev.clientX, containerRect.left), containerRect.right);
          startY = Math.min(Math.max(ev.clientY, bodyRect.top), containerRect.bottom);
          baseSelection = ev.ctrlKey ? new Set(selectedRows) : new Set();
          if (!ev.ctrlKey) selectedRows.clear();
          applySelectionStyling();
          box = document.createElement('div');
          prevPos = getComputedStyle(e).position;
          if (prevPos === 'static') e.style.position = 'relative';
          e.style.overflow = 'hidden';
          box.style.position = 'absolute';
          box.style.zIndex = '3';
          box.style.pointerEvents = 'none';
          box.style.border = '1px solid rgba(88,153,255,0.9)';
          box.style.background = 'rgba(88,153,255,0.2)';
          box.style.left = (startX - containerRect.left) + 'px'; box.style.top = (startY - containerRect.top) + 'px';
          box.style.width = '0px'; box.style.height = '0px';
          e.appendChild(box);
          content.style.userSelect = 'none';
          ev.preventDefault();
          document.addEventListener('mousemove', onMouseMove, true);
          document.addEventListener('mouseup', onMouseUp, true);
        });
      }
    }

  async function renderPath(path) {
        currentPath = path;
    const q = encodeURIComponent(path || '');
    const response = await get(`files/archive/list/${file}?path=${q}`);
        currentFiles = JSON.parse(response);
        renderTable();
        if (key && globalData["openedWindows"][key]) {
            globalData["openedWindows"][key]["archivePath"] = currentPath;
            saveOpenedWindowsState();
        }
    }

  let isMinimized = false;
  const win = new WinBox({
        title: title,
        width: windowData.width,
        height: windowData.height,
        top: 50,
        minheight: 200,
        minwidth: 300,
        right: 0,
        x: windowData.x,
        y: windowData.y,
        bottom: 50,
        left: 0,
        mount: e,
        icon: "/static/icons/archive.png",
        class: ["modern", "no-full"],
        onresize: (width, height) => {
      setTimeout(() => { setWindowSize('archive', key, width, height); }, 100);
        },
    onmove: (x, y) => {
      setTimeout(() => { setWindowPosition('archive', key, x, y); }, 100);
        },
        onclose: (force) => {
            delete globalData["openedWindows"][key];
            window.localStorage.setItem("globalData_windows", JSON.stringify(globalData["openedWindows"]));
            return false;
        },
    onminimize: () => {
      if (isMinimized) return;
      isMinimized = true;
      globalData["mTab"][key] = true;
    },
    onfocus: () => {
      isMinimized = false;
      globalData["mTab"][key] = false;
    },
        oncreate: () => {
            globalData["openedWindows"][key] = { "file": file, "extension": "Archive", "size": { "width": windowData.width, "height": windowData.height }, "position": { "x": windowData.x, "y": windowData.y }, "archivePath": savedPath };
      saveOpenedWindowsState();
        }
    });

    renderPath(savedPath);
};


const Button = videojs.getComponent('Button');

class RepeatToggle extends Button {
  constructor(player, options) {
    super(player, options);
    this.controlText('Repeat');
    this.addClass('vjs-repeat-toggle');
    this.isRepeating = false;

    const img = document.createElement('img');
    img.src = '/static/icons/repeat.png';
    img.className = 'repeat-icon';
    this.el().appendChild(img);
  }

  handleClick() {
    this.isRepeating = !this.isRepeating;
    this.player().loop(this.isRepeating);

    this.el().classList.toggle('active', this.isRepeating);
  }
}

async function openFolder(folderPath, key) {
  const e = document.createElement('div');
  e.style.height = '100%';
  e.style.display = 'flex';
  e.style.flexDirection = 'column';
  e.classList.add('folder-window');
  e.setAttribute("id", "folder-win-" + key);

  const windowData = getWindowData('archive', key);
  const title = folderPath.replace(/\/$/, '') || 'Folder';
  let currentPath = folderPath.replace(/\/$/, '');
  let currentFiles = [];
  let selectedRows = new Set();
  e.dataset.path = currentPath;

  if (key == null) {
    key = (Math.random() + 1).toString(36).substring(7);
  }

  function renderTable() {
    let table = `
      <div class="archive-content">
        <table class="archive-table">
          <thead><tr>
            <th>Name</th><th>Size</th><th>Modified</th>
          </tr></thead>
          <tbody>
    `;
    if (currentPath && currentPath.includes('/')) {
      const icon = '<img src="/static/icons/folder.png" class="archive-icon" style="width:14px;height:14px;">';
      table += `<tr data-path=".." data-isdir="true"><td>${icon}..</td><td>-</td><td>-</td></tr>`;
    }
    currentFiles.forEach(f => {
      let icon;
      if (f.is_dir) {
        icon = '<img src="/static/icons/folder.png" class="archive-icon" style="width:14px;height:14px;">';
      } else {
        const fileName = (f.display && f.display.length > 0) ? f.display : (f.name ? f.name.split('/').pop() : '');
        const fileType = getTypeForFilename(fileName);
        const iconName = globalData['extensions'][fileType] || 'unknown_.png';
        icon = `<img src="/static/icons/${iconName}" class="archive-icon" style="width:14px;height:14px;">`;
      }
      const label = (f.display && f.display.length > 0) ? f.display : (f.name ? (f.name.endsWith('/') ? f.name.slice(0, -1).split('/').pop() : f.name.split('/').pop()) : '');
      table += `<tr data-path="${f.name}" data-isdir="${f.is_dir}"><td>${icon}${label}</td><td>${f.size}</td><td>${f.modified}</td></tr>`;
    });
    table += '</tbody></table></div>';
    e.innerHTML = table;

    async function createNewInFolder(type) {
      const tbody = e.querySelector('.archive-table tbody');
      if (!tbody) return;
      const icon = type === 'folder' ? '<img src="/static/icons/folder.png" class="archive-icon" style="width:14px;height:14px;">'
                                     : '<img src="/static/icons/unknown_.png" class="archive-icon" style="width:14px;height:14px;">';
      const tr = document.createElement('tr');
      tr.dataset.isdir = (type === 'folder');
      const tdName = document.createElement('td');
      const tdSize = document.createElement('td');
      const tdMod = document.createElement('td');
      tdName.innerHTML = icon;
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = type === 'folder' ? 'new_folder' : 'new_file';
      input.style.display = 'inline-block';
      input.style.minWidth = '100px';
      input.style.maxWidth = '240px';
      input.style.boxSizing = 'border-box';
      input.style.background = 'rgba(0,0,0,0.2)';
      input.style.color = 'inherit';
      input.style.border = 'none';
      input.style.outline = '1px solid rgba(255,255,255,0.3)';
      input.style.borderRadius = '3px';
      input.style.padding = '1px 2px';
      input.style.fontSize = 'inherit';
      input.style.fontFamily = 'inherit';
      input.style.verticalAlign = 'middle';
      tdName.appendChild(input);
      tdSize.textContent = '-';
      tdMod.textContent = '-';
      tr.appendChild(tdName); tr.appendChild(tdSize); tr.appendChild(tdMod);
      const firstRow = tbody.querySelector('tr[data-path=".."]');
      const folderRows = Array.from(tbody.querySelectorAll('tr[data-isdir="true"]')).filter(r => (r.dataset.path || '') !== '..');
      const lastFolderRow = folderRows.length ? folderRows[folderRows.length - 1] : null;
      if (lastFolderRow) {
        if (lastFolderRow.nextSibling) {
          tbody.insertBefore(tr, lastFolderRow.nextSibling);
        } else {
          tbody.appendChild(tr);
        }
      } else if (firstRow) {
        if (firstRow.nextSibling) {
          tbody.insertBefore(tr, firstRow.nextSibling);
        } else {
          tbody.appendChild(tr);
        }
      } else {
        tbody.insertBefore(tr, tbody.firstChild);
      }
      setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);

      let finished = false;
      const cleanup = () => { if (finished) return; finished = true; tr.remove(); document.removeEventListener('click', handleDocumentClick); };
      const commit = async (cancel) => {
        document.removeEventListener('click', handleDocumentClick);
        if (finished) return;
        if (cancel) { cleanup(); return; }
        let name = (input.value || '').trim();
        if (!name) { cleanup(); return; }
        if (name.includes('/') || name.includes('\\') || name.includes(':') || name.startsWith('.') || name.includes(';') || name.includes('*') || name.includes('?') || name.includes('"') || name.includes('<') || name.includes('>') || name.includes('|') || name.includes("'")) {
          cleanup();
          await prompt('Name cannot contain illegal characters', `Create ${type}`, 'Ok');
          return;
        }
        let fullPath = currentPath ? `${currentPath}/${name}` : name;
        try {
          let resp;
          if (type === 'folder') {
            if (!fullPath.endsWith('/')) fullPath += '/';
            resp = await post('files/folders/create', { path: fullPath });
          } else {
            resp = await post('files/upload', { file: fullPath, data: '' });
          }
          try {
            const j = JSON.parse(resp);
            if (j && (j.file || j.status)) {
              finished = true;
              renderPath(currentPath);
              return;
            }
          } catch {}
          if (resp === 'Updated' || resp.includes('created')) {
            finished = true;
            renderPath(currentPath);
            return;
          }
          await prompt(resp || `Failed to create ${type}`, `Create ${type}`, 'Ok');
          setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);
        } catch (err) {
          await prompt('Unexpected error', `Create ${type}`, 'Ok');
        }
      };
      input.addEventListener('keydown', async (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); await commit(false); }
        else if (ev.key === 'Escape') { ev.preventDefault(); commit(true); }
      });
      const handleDocumentClick = (ev) => {
        if (ev.target !== input && !input.contains(ev.target)) {
          document.removeEventListener('click', handleDocumentClick);
          commit(false);
        }
      };
      document.addEventListener('click', handleDocumentClick);
    }

    const applySelectionStyling = () => {
      e.querySelectorAll('.archive-table tbody tr').forEach(row => {
        const key = row.dataset.path || row.dataset.name;
        if (!key || key === '..') return;
        const sel = selectedRows.has(key);
        row.classList.toggle('selected-once', sel);
        row.style.background = '';
        row.querySelectorAll('td').forEach(td => {
          td.style.background = '';
        });
      });
    };

    e.querySelectorAll('.archive-table tbody tr').forEach(row => {
      row.addEventListener('click', (ev) => {
        const p = row.dataset.path || row.dataset.name;
        if (!p || p === '..') return;
        if (ev.ctrlKey) {
          if (selectedRows.has(p)) selectedRows.delete(p); else selectedRows.add(p);
        } else {
          selectedRows.clear();
          selectedRows.add(p);
        }
        applySelectionStyling();
      });
      row.ondblclick = () => {
        const isDir = row.dataset.isdir === 'true';
        const internalPath = row.dataset.path;
        if (isDir) {
          if (internalPath === '..') {
            const parts = currentPath.split('/');
            parts.pop();
            renderPath(parts.join('/'));
          } else {
            renderPath(internalPath.replace(/\/$/, ''));
          }
        } else {
          const fileName = internalPath.split('/').pop();
          const type = getTypeForFilename(fileName);
          if (type !== 'Unknown') {
            Fopen(internalPath, type);
          } else {
            prompt('This file type is not supported','Error','Ok');
          }
        }
      };
      row.addEventListener('contextmenu', (ev) => {
        try {
          ev.preventDefault(); ev.stopPropagation();
          hideContext();
          const p = row.dataset.path || row.dataset.name;
          if (!p || p === '..') return;

          const isMultiSelected = selectedRows.size > 1;
          let hasFolderSelected = false;
          if (isMultiSelected) {
            for (const s of selectedRows) {
              const r = e.querySelector(`tr[data-path="${s}"]`);
              if (r && r.dataset.isdir === 'true') { hasFolderSelected = true; break; }
            }
          } else {
            hasFolderSelected = (row.dataset.isdir === 'true');
          }

          const menuEl = document.createElement('context');
          const addBtn = (label, handler) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.addEventListener('click', async (e2) => {
              e2.stopPropagation();
              hideContext();
              await handler();
            });
            menuEl.appendChild(b);
          };

          if (!isMultiSelected && !hasFolderSelected) {
            const fname = (p.split('/').pop() || p);
            const ftype = getTypeForFilename(fname);
            addBtn('Open', async () => { Fopen(p, ftype); });
          }
          if (!hasFolderSelected) {
            if (isMultiSelected) {
              addBtn(`Download (${selectedRows.size})`, async () => {
                const sel = Array.from(selectedRows);
                for (const s of sel) { await Fdownload(s); }
              });
            } else {
              addBtn('Download', async () => { await Fdownload(p); });
            }
          }
          if (!isMultiSelected) {
            addBtn('Rename', async () => { await FrenameInPath(p, key); });
          }
          addBtn('New file', async () => { await createNewInFolder('file'); });
          addBtn('New folder', async () => { await createNewInFolder('folder'); });
          if (isMultiSelected) {
            addBtn(`Remove (${selectedRows.size})`, async () => {
              const sel = Array.from(selectedRows);
              for (const s of sel) { await FremoveInPath(s, key); }
              await Frefresh();
              try { await renderPath(currentPath); } catch {}
            });
          } else {
            addBtn('Remove', async () => {
              await FremoveInPath(p, key);
              await Frefresh();
              try { await renderPath(currentPath); } catch {}
            });
          }

          menuEl.style.position = 'fixed';
          menuEl.style.left = ev.clientX + 'px';
          menuEl.style.top = ev.clientY + 'px';
          menuEl.style.zIndex = '99999';
          document.body.appendChild(menuEl);

          try {
            const rect = menuEl.getBoundingClientRect();
            let nx = rect.left, ny = rect.top;
            if (rect.right > window.innerWidth) nx = Math.max(0, window.innerWidth - rect.width - 4);
            if (rect.bottom > window.innerHeight) ny = Math.max(0, window.innerHeight - rect.height - 4);
            if (nx !== rect.left) menuEl.style.left = nx + 'px';
            if (ny !== rect.top) menuEl.style.top = ny + 'px';
          } catch {}
        } catch (e) { }
      });
  applySelectionStyling();

      row.addEventListener('mousedown', (downEvent) => {
        if (downEvent.button !== 0) return;
        const isDir = row.dataset.isdir === 'true';
        const internalPath = row.dataset.path;
        if (!internalPath || internalPath === '..') return;

        let dragging = false; let ghost = null;
        const sx = downEvent.clientX, sy = downEvent.clientY;
        let draggedFiles = [];
        if (selectedRows.has(internalPath)) {
          selectedRows.forEach(key => {
            const fullPath = key;
            draggedFiles.push({ originalFileName: fullPath });
          });
        } else {
          const fullPath = internalPath;
          draggedFiles.push({ originalFileName: fullPath });
        }
        const draggedSet = new Set(draggedFiles.map(df => (df.originalFileName || '').replace(/\/$/, '')));
        const updateGhost = (x, y) => {
          if (!ghost) {
            ghost = document.createElement('div');
            ghost.className = 'archive-drag-ghost';
            ghost.style.position = 'fixed';
            ghost.style.zIndex = '2000';
            ghost.style.pointerEvents = 'none';
            ghost.style.padding = '6px 10px';
            ghost.style.borderRadius = '6px';
            ghost.style.background = 'rgba(30,30,30,0.9)';
            ghost.style.color = '#fff';
            ghost.style.fontSize = '12px';
            ghost.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            const count = draggedFiles.length;
            const label = count > 1 ? `${count} files` : (draggedFiles[0].originalFileName.split('/').pop() || draggedFiles[0].originalFileName);
            ghost.textContent = `Move: ${label}`;
            document.body.appendChild(ghost);
          }
          ghost.style.left = (x + 12) + 'px';
          ghost.style.top = (y + 12) + 'px';
        };
        const onMouseMove = (mv) => {
          const dx = Math.abs(mv.clientX - sx), dy = Math.abs(mv.clientY - sy);
          if (!dragging && (dx > 8 || dy > 8)) dragging = true;
          if (dragging) updateGhost(mv.clientX, mv.clientY);
        };
        const onMouseUp = async (up) => {
          document.removeEventListener('mousemove', onMouseMove, true);
          document.removeEventListener('mouseup', onMouseUp, true);
          if (dragging) {
            up.preventDefault(); up.stopPropagation();
            const elAt = document.elementFromPoint(up.clientX, up.clientY);
            const targetRow = elAt && elAt.closest('tr[data-isdir="true"]');
            if (targetRow && targetRow.dataset.path && targetRow.dataset.path !== '..') {
              const targetPath = targetRow.dataset.path.replace(/\/$/, '');
              const targetRaw = targetRow.dataset.path;
              const targetIsSelected = selectedRows && (selectedRows.has(targetRaw) || selectedRows.has(targetPath) || selectedRows.has(targetPath + '/'));
              if (draggedSet.has(targetPath) || targetIsSelected) {
                if (ghost) { ghost.remove(); ghost = null; }
                return;
              } else {
              (async () => {
                for (const df of draggedFiles) {
                  const orig = df.originalFileName;
                  if (!orig) continue;
                  if (orig.endsWith('/') && targetPath.startsWith(orig.replace(/\/$/, ''))) continue;
                  const base = orig.replace(/\/$/, '').split('/').pop();
                  const newPath = `${targetPath}/${base}` + (orig.endsWith('/') ? '/' : '');
                  try { await post('files/move', { old: orig, new: newPath }); } catch {}
                }
                renderPath(currentPath);
              })();
              }
            } else if (targetRow && targetRow.dataset.path === '..') {
              const parentPath = currentPath && currentPath.includes('/') ? currentPath.split('/').slice(0, -1).join('/') : '';
              (async () => {
                for (const df of draggedFiles) {
                  const orig = df.originalFileName;
                  if (!orig) continue;
                  const base = orig.replace(/\/$/, '').split('/').pop();
                  const newPath = (parentPath ? `${parentPath}/${base}` : base) + (orig.endsWith('/') ? '/' : '');
                  try { await post('files/move', { old: orig, new: newPath }); } catch {}
                }
                renderPath(currentPath);
              })();
            } else {
              const filesContainer = document.getElementById('Files');
              const containerRect = filesContainer.getBoundingClientRect();
              if (up.clientX < containerRect.left || up.clientX > containerRect.right || up.clientY < containerRect.top || up.clientY > containerRect.bottom) {
              } else if (elAt && elAt.closest('.winbox')) {
              } else {
              const dropX = up.clientX - containerRect.left;
              const dropY = up.clientY - containerRect.top;
              const snapped = snapToGrid(dropX, dropY);
              const movedNames = [];
              let offset = 0;
              (async () => {
                for (const df of draggedFiles) {
                  const orig = df.originalFileName;
                  const base = orig.replace(/\/$/, '').split('/').pop();
                  const newPath = base + (orig.endsWith('/') ? '/' : '');
                  try {
                    const resp = await post('files/move', { old: orig, new: newPath });
                    let finalName = newPath;
                    try { const j = JSON.parse(resp); if (j && j.file) finalName = j.file; } catch {}
                    const startCol = snapped.col + (offset % 3);
                    const startRow = snapped.row + Math.floor(offset / 3);
                    const targetPos = findNearestFreeSlot(startCol, startRow, finalName);
                    globalData["filePositions"][finalName] = targetPos;
                    movedNames.push(finalName);
                    offset++;
                  } catch (err) {
                  }
                }
                if (movedNames.length) await saveFilePositions(movedNames);
                await Frefresh();
                renderPath(currentPath);
              })();
              }
            }
          }
          if (ghost) { ghost.remove(); ghost = null; }
        };
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseup', onMouseUp, true);
      });
    });

  const content = e.querySelector('.archive-content') || e;
    if (content) {
      let selecting = false; let startX = 0; let startY = 0; let box = null; let baseSelection = null; let containerRect = null; let bodyRect = null; let prevPos = '';
      const onMouseMove = (mv) => {
        if (!selecting) return;
        const cx = Math.min(Math.max(mv.clientX, containerRect.left), containerRect.right);
        const cy = Math.min(Math.max(mv.clientY, bodyRect.top), containerRect.bottom);
        const x1v = Math.min(startX, cx); const y1v = Math.min(startY, cy);
        const x2v = Math.max(startX, cx); const y2v = Math.max(startY, cy);
        box.style.left = (x1v - containerRect.left) + 'px';
        box.style.top = (y1v - containerRect.top) + 'px';
        box.style.width = (x2v - x1v) + 'px';
        box.style.height = (y2v - y1v) + 'px';

        const nextSel = new Set(baseSelection);
        e.querySelectorAll('.archive-table tbody tr').forEach(r => {
          const p = r.dataset.path || r.dataset.name;
          if (!p || p === '..') return;
          const rr = r.getBoundingClientRect();
          const intersects = !(rr.right < x1v || rr.left > x2v || rr.bottom < y1v || rr.top > y2v);
          if (intersects) nextSel.add(p);
        });
        selectedRows = nextSel;
        applySelectionStyling();
      };
      const onMouseUp = () => {
        if (!selecting) return;
        selecting = false;
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('mouseup', onMouseUp, true);
        if (box) { box.remove(); box = null; }
        content.style.userSelect = '';
        e.style.overflow = '';
        if (prevPos) e.style.position = prevPos;
      };
      content.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0) return;
        if (ev.target.closest('tr')) return;
        selecting = true;
        containerRect = content.getBoundingClientRect();
        const tbody = e.querySelector('.archive-table tbody');
        bodyRect = tbody ? tbody.getBoundingClientRect() : containerRect;
        startX = Math.min(Math.max(ev.clientX, containerRect.left), containerRect.right);
        startY = Math.min(Math.max(ev.clientY, bodyRect.top), containerRect.bottom);
        baseSelection = ev.ctrlKey ? new Set(selectedRows) : new Set();
        if (!ev.ctrlKey) selectedRows.clear();
        applySelectionStyling();
        box = document.createElement('div');
        prevPos = getComputedStyle(e).position;
        if (prevPos === 'static') e.style.position = 'relative';
        e.style.overflow = 'hidden';
        box.style.position = 'absolute';
        box.style.zIndex = '3';
        box.style.pointerEvents = 'none';
        box.style.border = '1px solid rgba(88,153,255,0.9)';
        box.style.background = 'rgba(88,153,255,0.2)';
        box.style.left = (startX - containerRect.left) + 'px'; box.style.top = (startY - containerRect.top) + 'px';
        box.style.width = '0px'; box.style.height = '0px';
        e.appendChild(box);
        content.style.userSelect = 'none';
        ev.preventDefault();
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseup', onMouseUp, true);
      });
      content.addEventListener('contextmenu', (ev) => {
        if (ev.target.closest('tr')) return;
        ev.preventDefault(); ev.stopPropagation();
        hideContext();
        const menuEl = document.createElement('context');
        const addBtn = (label, handler) => {
          const b = document.createElement('button');
          b.textContent = label;
          b.addEventListener('click', async (e2) => { e2.stopPropagation(); hideContext(); await handler(); });
          menuEl.appendChild(b);
        };
        addBtn('New file', async () => { await createNewInFolder('file'); });
        addBtn('New folder', async () => { await createNewInFolder('folder'); });
        menuEl.style.position = 'fixed';
        menuEl.style.left = ev.clientX + 'px';
        menuEl.style.top = ev.clientY + 'px';
        menuEl.style.zIndex = '99999';
        document.body.appendChild(menuEl);
      });
    }
  }

  async function renderPath(path) {
    currentPath = path || '';
    e.dataset.path = currentPath;
    selectedRows.clear();
    const q = encodeURIComponent(currentPath);
    const response = await get(`files/folders/list?path=${q}`);
    try { currentFiles = JSON.parse(response); } catch { currentFiles = []; }
    renderTable();
  }

  e.addEventListener('folder:refresh', (ev) => {
    try {
      const p = ev.detail && ev.detail.path !== undefined ? ev.detail.path : null;
      if (p == null || p === currentPath) {
        renderPath(currentPath);
      }
    } catch { renderPath(currentPath); }
  });

  let isMinimized = false;
  const win = new WinBox({
    title: title,
    width: windowData.width,
    height: windowData.height,
    top: 50,
    minheight: 200,
    minwidth: 300,
    right: 0,
    x: windowData.x,
    y: windowData.y,
    bottom: 50,
    left: 0,
    mount: e,
    icon: '/static/icons/folder.png',
    class: ['modern', 'no-full'],
    onresize: (w,h)=>{ setWindowSize('archive', key, w, h); },
    onmove: (x,y)=>{ setWindowPosition('archive', key, x, y); },
    onclose: ()=>{ delete globalData['openedWindows'][key]; window.localStorage.setItem('globalData_windows', JSON.stringify(globalData['openedWindows'])); return false; },
    onminimize: ()=>{ if (isMinimized) return; isMinimized = true; globalData['mTab'][key] = true; },
    onfocus: ()=>{ isMinimized = false; globalData['mTab'][key] = false; },
    oncreate: ()=>{ globalData['openedWindows'][key] = { file: folderPath, extension: 'Folder', size: { width: windowData.width, height: windowData.height }, position: { x: windowData.x, y: windowData.y } }; saveOpenedWindowsState(); }
  });

  renderPath(currentPath);
}

videojs.registerComponent('repeatToggle', RepeatToggle);

function openImage(file,key, title) {
  var e = document.createElement("div");
  var windowData = getWindowData("image",key);

  if (key == null) {
    key = (Math.random() + 1).toString(36).substring(7);
  }
  
  const imageUrl = file.startsWith('files/archive/get/') ? file : `/files/get/${file}`;
  const windowTitle = title || file;

  e.innerHTML = `
      <img src="${imageUrl}" style="width: 100%; height: 100%;" alt="${windowTitle}">
  `;

  let isMinimized = false;
  new WinBox({
    title: windowTitle,
    width: windowData.width,
    height: windowData.height,
    top: 50,
    minheight: 85,
    minwidth: 200,
    x: windowData.x,
    y: windowData.y,
    right: 0,
    bottom: 50,
    left: 0,
    mount: e,
    class: ["modern", "no-full"],
    icon: "/static/icons/image.png",
    onclose: function () {
      const img = e.querySelector("img");
      if (img) {
        img.remove();
      }
      delete globalData["openedWindows"][key];
      window.localStorage.setItem("globalData_windows", JSON.stringify(globalData["openedWindows"]));
      return false;
    },
    onresize: (width, height) => {
      setTimeout(() => { setWindowSize('image', key, width, height); },100);
    },
    onmove: (x, y) => {
      setTimeout(() => { setWindowPosition('image', key, x, y); },100);
    },
    onminimize: () => {
      if (isMinimized) return;
      isMinimized = true;
      globalData["mTab"][key] = true;
    },
    onfocus: () => {
      isMinimized = false;
      globalData["mTab"][key] = false;
    },
    oncreate: () => {
      globalData["openedWindows"][key] = {"file": file, "extension": "Image", "size": {"width": windowData.width, "height": windowData.height}, "position": {"x": windowData.x, "y": windowData.y}};
      saveOpenedWindowsState();
    }
   });
};

async function openVideo(file,file_type,key, title) {
  var e = document.createElement("div");
  var windowData = getWindowData(file_type,key);
  const videoId = `video_${Date.now()}`;

  if (key == null) {
    key = (Math.random() + 1).toString(36).substring(7);
  }
  
  const mediaUrl = file.startsWith('files/archive/get/') ? file : `/files/get/${file}`;
  const windowTitle = title || file;
  const mediaType = file_type === 'video' ? 'video/mp4' : 'audio/mp3';

  if (file_type == "video") {
    var cl = ["modern", "no-full"];
    var ch = ['playToggle','volumePanel','currentTimeDisplay','timeDivider','durationDisplay','progressControl','fullscreenToggle']
    e.innerHTML = `
        <video id="${videoId}" class="video-js vjs-default-skin" data-setup='{}' preload="auto" style="position: relative; width: 100%; height: 100%;" controls autoplay>
            <source src="${mediaUrl}" type="${mediaType}">
            Your browser does not support the video tag.
        </video>
    `;
  } else if (file_type == "audio") {
    var cl = ["modern", "no-full", "no-max"];
    var ch = ['playToggle','volumePanel','repeatToggle','currentTimeDisplay','timeDivider','durationDisplay','progressControl']
    e.innerHTML = `
      <div class="video-wrapper">
        <video id="${videoId}" class="video-js vjs-default-skin" data-setup='{}' preload="auto" style="position: relative; width: 100%; height: 100%;" controls autoplay>
            <source src="${mediaUrl}" type="${mediaType}">
            Your browser does not support the video tag.
        </video>
        <div class="poster" id="poster_${videoId}">
          <img src="/static/icons/audio.png">
        </div>
      </div>
    `;
  }
  let isMinimized = false;
  new WinBox({
    title: windowTitle,
    width: windowData.width,
    height: windowData.height,
    top: 50,
    minheight: 85,
    minwidth: 200,
    x: windowData.x,
    y: windowData.y,

    right: 0,
    bottom: 50,
    left: 0,
    mount: e,
    onresize: (width, height) => {
      setTimeout(() => { setWindowSize(file_type, key, width, height); },100);
    },
    onmove: (x, y) => {
      setTimeout(() => { setWindowPosition(file_type, key, x, y); },100);
    },
    icon: "/static/icons/video.png",
    class: cl,
    onclose: function () {
      const player = videojs(videoId);
      if (player) player.dispose();
      delete globalData["openedWindows"][key];
      window.localStorage.setItem("globalData_windows", JSON.stringify(globalData["openedWindows"]));
      return false;
    },
    onminimize: () => {
      if (isMinimized) return;
      isMinimized = true;
      globalData["mTab"][key] = true;
    },
    onfocus: () => {
      isMinimized = false;
      globalData["mTab"][key] = false;
    },
    oncreate: () => {
      globalData["openedWindows"][key] = {"file": file, "extension": file_type.charAt(0).toUpperCase() + file_type.slice(1), "size": {"width": windowData.width, "height": windowData.height}, "position": {"x": windowData.x, "y": windowData.y}};
      saveOpenedWindowsState();
    }
   });

  var player = videojs(videoId, {
    controls: true,
    loop: false,
    autoplay: true,
    controlBar: {
      children: ch
    }
  });

  player.ready(function() {
      var volume = localStorage.getItem(`${file_type}-volume`);
      if (volume == null) {
        volume = 0.5;
      };
      this.volume(parseFloat(volume));
  });

  player.on('volumechange', function() {
      localStorage.setItem(`${file_type}-volume`, player.volume());
  });
};


document.addEventListener("dragstart", async (event)=> { 
  event.preventDefault();
});

document.addEventListener("click", async (event)=> { 
  hideContext();
  if (event.target.hasAttribute("data-name")) {
    const fileName = event.target.getAttribute("data-name");
    const fileElement = document.getElementById("F" + fileName);

    if (globalData["focused"] == fileElement) {
      let extension = event.target.getAttribute("extension");

      if (fileElement && (fileElement.getAttribute('data-temp-new') === '1' || fileElement.querySelector('input'))) {
        return;
      }

      if (document.getElementById(fileName)) {return};
      Fopen(fileName, extension);
      
      globalData["focused"] = "none";
      clearSelection();
    } else {
      globalData["focused"] = fileElement;
    };
  } else {
    if (!event.ctrlKey && !globalData["hasSelectedFiles"]) {
      clearSelection();
    }
    globalData["focused"] = "none";
  };
  if (event.target.id != "menuBtn" && event.target.id != "menu" && event.target.id != "rightMenu" && event.target.id != "leftMenu" && document.getElementById("menu").style.display == "block") {
    var menu_el = document.getElementById("menu");

    menu_el.style.transform = "translateY(-100%)";
    setTimeout(() => {
        menu_el.style.display = "none";
    }, 500);
  };
  if (event.target.id == "menuNotepad") {
    openNotepad();
  } else if (event.target.id == "menuCalculator") {
    openCalculator();
  } else if (event.target.id == "power") {
    document.getElementById("menu").style.display = "none";
    document.getElementById("logout").style.display = "block";
    setTimeout(() => {
      document.getElementById("logout").style.transform = "translateX(100%)";
    }, 10);
    setTimeout(() => {
      document.cookie.split(";").forEach(function(c) { document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); });
      window.location = `${window.location.origin}/`;
    }, 390);
  };
});

function prompt(text, title, b1, b2) {
  return new Promise((resolve) => {
  const e = document.createElement("div");
  let id = (Math.random() + 1).toString(36).substring(7);

      e.innerHTML = `
            <p class="promptText">${text}</p>

            <button id="${id}-1" class="promptBtn">${b1}</button>
            <button id="${id}-2" class="promptBtn">${b2}</button>
      `;

      const prompt = new WinBox({
        title: title,
        width: 260,
        height: 120,
        top: 50,
        minheight: 75,
        x:"42%",
        y:"43%",
        right: 0,
        bottom: 50,
        left: 0,
        mount: e,
        class: ["modern", "no-full", "no-min", "no-max", "no-resize"],
        
        onclose: (force) => {
          if (force) {
            return false;
          }

          function promptInput(title, placeholder) {
            return new Promise((resolve) => {
              const e = document.createElement('div');
              let id = (Math.random() + 1).toString(36).substring(7);
              e.innerHTML = `
                <p class="promptText">${title}</p>
                <input id="${id}-in" class="promptInput" type="text" placeholder="${placeholder || ''}" style="width: 100%; box-sizing: border-box; margin-bottom: 8px;"/>
                <button id="${id}-1" class="promptBtn">Ok</button>
                <button id="${id}-2" class="promptBtn">Cancel</button>
              `;
              const wb = new WinBox({
                title: 'Input',
                width: 260,
                height: 150,
                top: 50,
                minheight: 100,
                x: '42%',
                y: '43%',
                mount: e,
                class: ["modern", "no-full"]
              });
              setTimeout(() => { document.getElementById(`${id}-in`)?.focus(); }, 50);
              document.getElementById(`${id}-1`).addEventListener('click', () => {
                const val = document.getElementById(`${id}-in`).value.trim();
                wb.close(true);
                resolve(val || null);
              });
              document.getElementById(`${id}-2`).addEventListener('click', () => {
                wb.close(true);
                resolve(null);
              });
            });
          }
          resolve("Close");
          return false;
        }
      });

      if (b2 == undefined) {
          document.getElementById(id+"-2").style.display = "none";
      }
      document.getElementById(id+"-1").onclick = function() {
          prompt.close(true);
          resolve(b1);
      };
      document.getElementById(id+"-2").onclick = function() {
          prompt.close(true);
          resolve(b2);
      };
  });
};

function updateTime() {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[now.getMonth()];
  const day = now.getDate();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  document.getElementById("Clock").innerHTML = `${month} ${day} ${hours}:${minutes}`;
  setTimeout(() => {
    updateTime();
  }, 1000);
};

updateTime();

let resizeTimeout;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const filesContainer = document.getElementById("Files");
    if (!filesContainer) return;
    document.querySelectorAll('file[data-name]').forEach(fileEl => {
      const fileName = fileEl.getAttribute('data-name');
      if (globalData["filePositions"][fileName]) {
        const pos = globalData["filePositions"][fileName];
        setFilePosition(fileEl, pos.col, pos.row);
      }
    });
  }, 150);
});
