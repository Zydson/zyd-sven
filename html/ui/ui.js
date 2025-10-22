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
      
      console.log("Loaded positions from files:", globalData["filePositions"]);
      
      loadFiles(JSON.stringify(files));
      
      setupSelectionRectangle();
    }
  } catch (e) {
    console.error("Failed to load files and positions:", e);
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
    console.error("Failed to save file positions:", e);
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
  
  const onMouseDown = function(e) {
    if (e.target.tagName === 'INPUT') return;
    
    if (e.button !== 0) return;
    
    const fileName = fileElement.getAttribute('data-name');
    
    if (!e.ctrlKey && !globalData["selectedFiles"].has(fileName)) {
      clearSelection();
      globalData["selectedFiles"].add(fileName);
      fileElement.classList.add('selected');
    } else if (e.ctrlKey) {
      toggleFileSelection(fileName, true);
    }
    
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
    
    isDragging = false;
    draggedFiles.forEach(df => {
      df.element.style.zIndex = '';
      df.element.style.opacity = '';
    });
    
    if (hasMoved) {
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
  const response = await fetch(`${window.location.origin}/${q}`);
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
      headers: headers
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
    const d = items[i], el = document.createElement("file"), lab = computeDisplayNames(d.file), ic = globalData["extensions"][d.type];
    el.setAttribute("id", "F" + d.file);
    el.setAttribute("data-name", d.file);
    el.setAttribute("extension", d.type);
    el.setAttribute("draggable", "true");
    el.innerHTML = `
      <img extension="${d.type}" data-name="${d.file}" src="/static/icons/${ic}">
      <span extension="${d.type}" data-name="${d.file}">${lab.name}</span>
      <div extension="${d.type}" data-name="${d.file}" class="tooltip">Name: ${lab.nameL}<br>Type: ${d.type}<br>Size: ${d.size}<br>Changed: ${d.last_change}</div>
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
  let initialSelection = new Set();
  globalData["hasSelectedFiles"] = false;
  
  document.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    
    const isOnFile = e.target.closest('file[data-name]');
    if (isOnFile) return;
    
    const containerRect = filesContainer.getBoundingClientRect();
    const isInContainer = e.clientX >= containerRect.left && 
                         e.clientX <= containerRect.right && 
                         e.clientY >= containerRect.top && 
                         e.clientY <= containerRect.bottom;
    
    if (!isInContainer) return;
    
    initialSelection = new Set(globalData["selectedFiles"]);
    
    if (!e.ctrlKey) {
      clearSelection();
    }
    
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
    
    globalData["selectedFiles"] = new Set(initialSelection);
    document.querySelectorAll('file.selected').forEach(el => {
      if (!initialSelection.has(el.getAttribute('data-name'))) {
        el.classList.remove('selected');
      }
    });
    
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
    var id = event.target.getAttribute("data-name");
    var extension = event.target.getAttribute("extension");
    var e = document.createElement("context");
    
    const isMultiSelected = globalData["selectedFiles"].size > 1 && globalData["selectedFiles"].has(id);
    const removeLabel = isMultiSelected ? `Remove (${globalData["selectedFiles"].size} files)` : 'Remove';
    const downloadLabel = isMultiSelected ? `Download (${globalData["selectedFiles"].size} files)` : 'Download';
    
    let menuHTML = '';
    if (!isMultiSelected) {
        menuHTML += `<button onclick='Fopen("${id}", "${extension}")'>Open</button>`;
    }
    menuHTML += `<button onclick='Fdownload("${id}")'>${downloadLabel}</button>`;
    if (!isMultiSelected) {
        menuHTML += `<button onclick='Frename("${id}")'>Rename</button>`;
    }
    menuHTML += `<button onclick='Fremove("${id}")'>${removeLabel}</button>`;
    
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
  };
});

document.getElementById("file_upload").addEventListener("change", handleFiles, false);
async function handleFiles() {
  const formData = new FormData();

  formData.append('file', this.files[0]);
  var response = await fetch('/files/upload', {
    method: 'POST',
    body: formData
  });
  response = await response.text();
  if (response != "Updated") {
    loadFiles("["+response+"]");
  };
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
  } else {
    prompt("This file type is not supported","Error","Ok");
  }
};

async function Fsetwallpaper(file) {
  await post(`set/wallpaper`,{"file":file});
  document.getElementById("wallpaper").style.backgroundImage = `url("wallpaper?a=${Math.random()}")`;
};

async function Fdownload(file) {
  if (globalData["selectedFiles"].size > 1 && globalData["selectedFiles"].has(file)) {
    const filesToDownload = Array.from(globalData["selectedFiles"]);
    for (const fname of filesToDownload) {
      const response = await fetch(`${window.location.origin}/files/get/${fname}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fname;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } else {
    const response = await fetch(`${window.location.origin}/files/get/${file}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = file;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  }
};

async function Fcreate() {
  hideContext();
  
  const tempName = `new_file_${Date.now()}`;
  const tempType = "Unknown";
  
  const el = document.createElement("file");
  el.setAttribute("id", "F" + tempName);
  el.setAttribute("data-name", tempName);
  el.setAttribute("extension", tempType);
  el.setAttribute("draggable", "true");
  
  const ic = globalData["extensions"][tempType];
  el.innerHTML = `
    <img extension="${tempType}" data-name="${tempName}" src="/static/icons/${ic}">
    <span extension="${tempType}" data-name="${tempName}">new_file</span>
    <div extension="${tempType}" data-name="${tempName}" class="tooltip">Name: new_file<br>Type: ${tempType}<br>Size: 0 B<br>Changed: -</div>
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
  
  const spanRect = span.getBoundingClientRect();
  const spanStyles = window.getComputedStyle(span);
  const input = document.createElement('input');
  input.type = 'text';
  input.value = '';
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
  
  setTimeout(() => { try { input.focus(); } catch {} }, 10);
  
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
    
    if (img) {
      img.setAttribute('data-name', newName);
      img.setAttribute('extension', newType);
      const icon = globalData["extensions"][newType] || globalData["extensions"]["Unknown"];
      img.src = `/static/icons/${icon}`;
    }
    
    const labels = computeDisplayNames(newName);
    const newSpan = document.createElement('span');
    newSpan.setAttribute('extension', newType);
    newSpan.setAttribute('data-name', newName);
    newSpan.innerText = labels.name;
    input.replaceWith(newSpan);
    
    if (tooltip) {
      tooltip.setAttribute('data-name', newName);
      tooltip.setAttribute('extension', newType);
      tooltip.innerHTML = `Name: ${labels.nameL}<br>Type: ${newType}<br>Size: 0 B<br>Changed: -`;
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
    
    if (newName.includes('/') || newName.includes('\\')) {
      await prompt('Name cannot contain path separators', 'Create file', 'Ok');
      setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);
      return;
    }
    
    if (document.getElementById("F" + newName)) {
      await prompt('File with that name already exists', 'Create file', 'Ok');
      setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);
      return;
    }
    
    const resp = await post('files/upload', { file: newName, data: '' });
    try {
      const data = JSON.parse(resp);
      if (data && data.file) {
        finished = true;
        const newType = getTypeForFilename(newName);
        applyDomUpdate(newName, newType);
        
        if (tooltip) {
          tooltip.innerHTML = `Name: ${computeDisplayNames(newName).nameL}<br>Type: ${data.type || newType}<br>Size: ${data.size || '0 B'}<br>Changed: ${data.last_change || '-'}`;
        }
        return;
      }
    } catch {}
    
    if (resp === 'Updated' || resp.includes('file')) {
      finished = true;
      const newType = getTypeForFilename(newName);
      applyDomUpdate(newName, newType);
      return;
    } else {
      await prompt(resp || 'Failed to create file', 'Create file', 'Ok');
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
};

async function Fremove(file) {
    if (globalData["selectedFiles"].size > 1) {
      const filesToRemove = Array.from(globalData["selectedFiles"]);
      for (const fname of filesToRemove) {
        const response = await post("files/remove",{"file":fname});
        if (response == "Removed" || response == "File not found") {
          document.getElementById("F"+fname)?.remove();
          delete globalData["filePositions"][fname];
          globalData["selectedFiles"].delete(fname);
        }
      }
      saveFilePositions();
    } else {
      const response = await post("files/remove",{"file":file});
      if (response == "Removed" || response == "File not found") {
        document.getElementById("F"+file)?.remove();
        delete globalData["filePositions"][file];
        globalData["selectedFiles"].delete(file);
        saveFilePositions();
      }
    }
};

function hideContext() {
  try {
    var elements = document.getElementsByTagName("context");

    for(let i = 0;i < elements.length; i++) {
        elements[i].remove();
    };
  }catch{};
};

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

    const spanRect = span.getBoundingClientRect();
    const spanStyles = window.getComputedStyle(span);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
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

    const lastDot = oldName.lastIndexOf('.');
    const baseLen = lastDot > 0 ? lastDot : oldName.length;
    setTimeout(() => { try { input.focus(); input.setSelectionRange(0, baseLen); } catch {} }, 10);

    let finished = false;
    const restore = () => {
      if (finished) return;
      finished = true;
      const newSpan = document.createElement('span');
      newSpan.setAttribute('extension', el.getAttribute('extension'));
      newSpan.setAttribute('data-name', oldName);
      const labels = computeDisplayNames(oldName);
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

      const labels = computeDisplayNames(newName);
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
      if (!newName || newName === oldName) { restore(); return; }
      if (oldName.indexOf('.') !== -1 && newName.indexOf('.') === -1) {
        newName += oldName.substring(oldName.lastIndexOf('.'));
      }
      if (newName.includes('/') || newName.includes('\\')) {
        await prompt('Name cannot contain path separators', 'Rename', 'Ok');
        setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);
        return;
      }

      const resp = await post('files/rename', { old: oldName, new: newName });
      try {
        const data = JSON.parse(resp);
        if (data && data.status === 'Renamed') {
          finished = true;
          const newType = getTypeForFilename(newName);
          applyDomUpdate(newName, newType);
          return;
        } else if (data && data.error) {
          await prompt(data.error, 'Rename', 'Ok');
          setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 10);
          return;
        }
      } catch {}
      if (resp === 'Renamed') {
        finished = true;
        const newType = getTypeForFilename(newName);
        applyDomUpdate(newName, newType);
        return;
      } else {
        await prompt(resp || 'Failed to rename', 'Rename', 'Ok');
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
    input.addEventListener('blur', () => { commit(false); });
  } catch (e) {
    await prompt('Unexpected error during rename', 'Rename', 'Ok');
  }
}

document.onkeydown = async function(event) {
  if (event.ctrlKey && event.keyCode === 83) {
    const tgt = event.target;
    if (tgt && tgt.classList && tgt.classList.contains('ace_text-input')) {
      return;
    }
    event.preventDefault();
    try {
      if (document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("id") && document.activeElement.getAttribute("id").indexOf("Text") != -1) {
        var id = document.activeElement.getAttribute("id").split("Text")[0];
        await saveNotepad(id);
      };
    } catch {};
  };
  if (event.ctrlKey && event.keyCode === 65) {
    event.preventDefault();
    clearSelection();
    document.querySelectorAll('file[data-name]').forEach(fileEl => {
      const fileName = fileEl.getAttribute('data-name');
      globalData["selectedFiles"].add(fileName);
      fileEl.classList.add('selected');
    });
  };
  if (event.keyCode === 46) {
    event.preventDefault();
    if (globalData["selectedFiles"].size > 0) {
      const filesToRemove = Array.from(globalData["selectedFiles"]);
      for (const fname of filesToRemove) {
        await Fremove(fname);
      }
    } else if (globalData["focused"] != "none") {
      await Fremove(globalData["focused"].getAttribute("data-name"));
    }
  };
  if (event.keyCode == 116) {
    event.preventDefault();
    await Frefresh();
  };
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
    document.getElementById("Files").appendChild(e);
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
  var e = document.createElement("div");
  var windowData = getWindowData("notepad",key);
  globalData["mTab"][key] = false;
  title = file;

  if (file==null) {
    text = "";
    title="Notepad";
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
      console.log("minimalized", key)
    },
    onfocus: () => {
      isMinimized = false;
      globalData["mTab"][key] = false;
    },
    oncreate: () => {
      globalData["openedWindows"][key] = {"file": file, "extension": "Text document", "size": {"width": windowData.width, "height": windowData.height}, "position": {"x": windowData.x, "y": windowData.y}};
      saveOpenedWindowsState();
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
            const label = (f.display && f.display.length > 0) ? f.display : (f.name ? f.name.split('/').pop() : '');
            table += `<tr data-path="${f.name}" data-isdir="${f.is_dir}"><td>${icon}${label}</td><td>${f.size}</td><td>${f.modified}</td></tr>`;
        });
        
        table += '</tbody></table></div>';
        e.innerHTML = table;

        e.querySelectorAll('.archive-table thead th.sortable').forEach(th => {
            th.style.cursor = 'pointer';
            th.onclick = () => sortFiles(th.dataset.column);
        });

        let selectedRow = null;
        
    e.querySelectorAll('.archive-table tbody tr').forEach(row => {
      row.onclick = () => {
        if (selectedRow) {
          selectedRow.classList.remove('selected-once');
        }
        selectedRow = row;
        row.classList.add('selected-once');
      };

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
    });
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