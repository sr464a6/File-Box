/* ===================== FileBox app logic ===================== */

const LS_NAV = 'filebox_nav_v1';
const LS_FILES = 'filebox_files_v1';

/* ---------- Icon auto-detect keywords ---------- */
const ICON_RULES = [
  { keys: ['it','laptop','komputer','tech','teknologi','coding','code','dev'], icon: 'fa-laptop' },
  { keys: ['foto','photo','gambar','image','img','galeri'], icon: 'fa-image' },
  { keys: ['musik','music','lagu','audio','sound'], icon: 'fa-music' },
  { keys: ['video','film','movie'], icon: 'fa-video' },
  { keys: ['invoice','uang','duit','keuangan','finance','money','bayar','tagihan'], icon: 'fa-file-invoice-dollar' },
  { keys: ['dokumen','doc','word','surat','laporan','report'], icon: 'fa-file-lines' },
  { keys: ['pdf'], icon: 'fa-file-pdf' },
  { keys: ['kerja','kantor','office','proyek','project','tugas','kuliah','sekolah','skripsi'], icon: 'fa-briefcase' },
  { keys: ['kontak','contact','orang','team','tim'], icon: 'fa-users' },
  { keys: ['setting','pengaturan','config'], icon: 'fa-gear' },
  { keys: ['arsip','archive','zip','compress'], icon: 'fa-box-archive' },
];
function detectIcon(name){
  const n = name.toLowerCase();
  for(const rule of ICON_RULES){
    if(rule.keys.some(k => n.includes(k))) return rule.icon;
  }
  return 'fa-folder';
}

/* ---------- Default nav (fixed system views) ---------- */
const SYSTEM_NAV = [
  { id:'home', label:'Beranda', icon:'fa-house', system:true },
  { id:'all', label:'Semua File', icon:'fa-folder-open', system:true },
  { id:'favorites', label:'Favorit', icon:'fa-star', system:true },
  { id:'compress', label:'Compress', icon:'fa-file-zipper', system:true },
];

/* ---------- State ---------- */
let navItems = loadNav();
let files = loadFiles();
let activeNav = 'home';
let convertDirection = 'pdf2word';
let convertFile = null;
let dragSrcId = null;

function loadNav(){
  try{
    const raw = JSON.parse(localStorage.getItem(LS_NAV));
    if(raw && Array.isArray(raw)) return raw;
  }catch(e){}
  return [];
}
function saveNav(){ localStorage.setItem(LS_NAV, JSON.stringify(navItems)); }

function loadFiles(){
  try{
    const raw = JSON.parse(localStorage.getItem(LS_FILES));
    if(raw && Array.isArray(raw)) return raw;
  }catch(e){}
  return [];
}
function saveFiles(){
  try{
    localStorage.setItem(LS_FILES, JSON.stringify(files));
  }catch(e){
    showToast('Penyimpanan penuh, hapus beberapa file.');
  }
  updateStorageWidget();
}

/* ---------- DOM refs ---------- */
const navList = document.getElementById('navList');
const dockList = document.getElementById('dockList');
const fileGrid = document.getElementById('fileGrid');
const viewTitle = document.getElementById('viewTitle');
const viewSubtitle = document.getElementById('viewSubtitle');
const dropHint = document.getElementById('dropHint');
const compressView = document.getElementById('compressView');
const searchInput = document.getElementById('searchInput');

/* ---------- Render sidebar (system items, garis 3) ---------- */
function renderNav(){
  navList.innerHTML = '';
  SYSTEM_NAV.forEach(item => {
    const li = document.createElement('li');
    li.className = 'nav-item' + (item.id === activeNav ? ' active' : '');
    li.dataset.id = item.id;

    const count = countForSystem(item.id);

    li.innerHTML = `
      <i class="fa-solid ${item.icon} nav-icon"></i>
      <span class="nav-label">${escapeHtml(item.label)}</span>
      <span class="nav-count">${count}</span>
    `;

    li.addEventListener('click', () => setActiveNav(item.id));
    navList.appendChild(li);
  });
  renderDock();
}

/* ---------- Render dock (kategori buatan user, icon only, glass) ---------- */
function renderDock(){
  dockList.innerHTML = '';
  navItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'dock-item' + (item.id === activeNav ? ' active' : '');
    li.dataset.id = item.id;
    li.draggable = true;

    const count = files.filter(f => f.navId === item.id).length;

    li.innerHTML = `
      <i class="fa-solid ${item.icon}"></i>
      <span class="dock-tooltip">${escapeHtml(item.label)}${count ? ' · ' + count : ''}</span>
      <button class="dock-remove" title="Hapus"><i class="fa-solid fa-xmark"></i></button>
    `;

    li.addEventListener('click', (e) => {
      if(e.target.closest('.dock-remove')) return;
      setActiveNav(item.id);
    });
    li.querySelector('.dock-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeNavItem(item.id);
    });
    attachDragHandlers(li, item.id);

    dockList.appendChild(li);
  });
}

function countForSystem(id){
  if(id === 'home') return Math.min(files.length, 12);
  if(id === 'all') return files.length;
  if(id === 'favorites') return files.filter(f => f.fav).length;
  if(id === 'compress') return '';
  return 0;
}

/* ---------- Drag & drop reorder (confined within nav container) ---------- */
function attachDragHandlers(li, id){
  li.addEventListener('dragstart', (e) => {
    dragSrcId = id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    document.querySelectorAll('.dock-item.drag-over').forEach(el => el.classList.remove('drag-over'));
  });
  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    if(dragSrcId && dragSrcId !== id) li.classList.add('drag-over');
  });
  li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    li.classList.remove('drag-over');
    if(!dragSrcId || dragSrcId === id) return;
    reorderNav(dragSrcId, id);
    dragSrcId = null;
  });
}
function reorderNav(srcId, targetId){
  const srcIdx = navItems.findIndex(n => n.id === srcId);
  const tgtIdx = navItems.findIndex(n => n.id === targetId);
  if(srcIdx === -1 || tgtIdx === -1) return;
  const [moved] = navItems.splice(srcIdx, 1);
  navItems.splice(tgtIdx, 0, moved);
  saveNav();
  renderDock();
}

function removeNavItem(id){
  navItems = navItems.filter(n => n.id !== id);
  files.forEach(f => { if(f.navId === id) f.navId = null; });
  saveNav();
  saveFiles();
  if(activeNav === id) setActiveNav('home');
  else renderNav();
}

/* ---------- Set active nav / render files ---------- */
function setActiveNav(id){
  activeNav = id;
  renderNav();
  renderView();
}

function renderView(){
  compressView.classList.add('hidden');
  fileGrid.classList.remove('hidden');
  dropHint.classList.remove('hidden');

  const custom = navItems.find(n => n.id === activeNav);
  const query = searchInput.value.trim().toLowerCase();

  let list = [];
  if(activeNav === 'home'){
    viewTitle.textContent = 'Beranda';
    viewSubtitle.textContent = 'File yang baru-baru ini dibuka';
    list = [...files].filter(f => f.lastOpened).sort((a,b) => b.lastOpened - a.lastOpened).slice(0, 12);
    if(list.length === 0) list = [...files].sort((a,b) => b.addedAt - a.addedAt).slice(0,12);
  } else if(activeNav === 'all'){
    viewTitle.textContent = 'Semua File';
    viewSubtitle.textContent = files.length + ' file tersimpan';
    list = [...files].sort((a,b) => b.addedAt - a.addedAt);
  } else if(activeNav === 'favorites'){
    viewTitle.textContent = 'Favorit';
    viewSubtitle.textContent = 'File yang kamu tandai';
    list = files.filter(f => f.fav).sort((a,b) => b.addedAt - a.addedAt);
  } else if(activeNav === 'compress'){
    viewTitle.textContent = 'Compress';
    viewSubtitle.textContent = 'Konversi PDF ke Word atau sebaliknya';
    fileGrid.classList.add('hidden');
    dropHint.classList.add('hidden');
    compressView.classList.remove('hidden');
    return;
  } else if(custom){
    viewTitle.textContent = custom.label;
    viewSubtitle.textContent = files.filter(f => f.navId === custom.id).length + ' file';
    list = files.filter(f => f.navId === custom.id).sort((a,b) => b.addedAt - a.addedAt);
  }

  if(query){
    list = list.filter(f => f.name.toLowerCase().includes(query));
  }

  renderFileGrid(list);
}

function renderFileGrid(list){
  fileGrid.innerHTML = '';
  if(list.length === 0){
    fileGrid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <p>Belum ada file di sini.</p>
      </div>`;
    return;
  }
  list.forEach(f => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <div class="file-card-top">
        <div class="file-icon"><i class="fa-solid ${fileIcon(f.name)}"></i></div>
        <button class="fav-btn ${f.fav ? 'active' : ''}" data-id="${f.id}">
          <i class="fa-${f.fav ? 'solid' : 'regular'} fa-star"></i>
        </button>
      </div>
      <div class="file-name">${escapeHtml(f.name)}</div>
      <div class="file-meta"><span>${formatSize(f.size)}</span><span>${formatDate(f.addedAt)}</span></div>
    `;
    card.addEventListener('click', (e) => {
      if(e.target.closest('.fav-btn')) return;
      openFileModal(f.id);
    });
    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(f.id);
    });
    fileGrid.appendChild(card);
  });
}

function fileIcon(name){
  const ext = name.split('.').pop().toLowerCase();
  if(['pdf'].includes(ext)) return 'fa-file-pdf';
  if(['doc','docx'].includes(ext)) return 'fa-file-word';
  if(['xls','xlsx','csv'].includes(ext)) return 'fa-file-excel';
  if(['ppt','pptx'].includes(ext)) return 'fa-file-powerpoint';
  if(['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return 'fa-file-image';
  if(['mp3','wav','ogg'].includes(ext)) return 'fa-file-audio';
  if(['mp4','mov','avi','mkv'].includes(ext)) return 'fa-file-video';
  if(['zip','rar','7z'].includes(ext)) return 'fa-file-zipper';
  return 'fa-file';
}

/* ---------- Favorites ---------- */
function toggleFav(id){
  const f = files.find(x => x.id === id);
  if(!f) return;
  f.fav = !f.fav;
  saveFiles();
  renderNav();
  renderView();
}

/* ---------- File modal ---------- */
const fileModalBackdrop = document.getElementById('fileModalBackdrop');
let activeFileId = null;

function openFileModal(id){
  const f = files.find(x => x.id === id);
  if(!f) return;
  activeFileId = id;
  f.lastOpened = Date.now();
  saveFiles();

  document.getElementById('fileModalIcon').className = `fa-solid ${fileIcon(f.name)}`;
  document.getElementById('fileModalName').textContent = f.name;
  document.getElementById('fileModalMeta').textContent = `${formatSize(f.size)} · ditambahkan ${formatDate(f.addedAt)}`;
  const favBtn = document.getElementById('fileModalFav');
  favBtn.innerHTML = `<i class="fa-${f.fav ? 'solid' : 'regular'} fa-star"></i> ${f.fav ? 'Batal Favorit' : 'Favorit'}`;
  document.getElementById('fileModalDownload').href = f.data;
  document.getElementById('fileModalDownload').setAttribute('download', f.name);

  fileModalBackdrop.classList.add('show');
  renderView();
}
document.getElementById('fileModalClose').addEventListener('click', () => fileModalBackdrop.classList.remove('show'));
fileModalBackdrop.addEventListener('click', (e) => { if(e.target === fileModalBackdrop) fileModalBackdrop.classList.remove('show'); });
document.getElementById('fileModalFav').addEventListener('click', () => { if(activeFileId){ toggleFav(activeFileId); openFileModal(activeFileId);} });
document.getElementById('fileModalDelete').addEventListener('click', () => {
  if(!activeFileId) return;
  files = files.filter(f => f.id !== activeFileId);
  saveFiles();
  fileModalBackdrop.classList.remove('show');
  renderNav();
  renderView();
  showToast('File dihapus.');
});

/* ---------- Upload files ---------- */
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(fileListRaw){
  const custom = navItems.find(n => n.id === activeNav);
  const navId = custom ? custom.id : null;
  const arr = Array.from(fileListRaw);
  let pending = arr.length;
  if(pending === 0) return;

  arr.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      files.push({
        id: 'f' + Date.now() + Math.random().toString(16).slice(2),
        name: file.name,
        size: file.size,
        data: reader.result,
        navId: navId,
        fav: false,
        addedAt: Date.now(),
        lastOpened: null,
      });
      pending--;
      if(pending === 0){
        saveFiles();
        renderNav();
        renderView();
        showToast(arr.length > 1 ? `${arr.length} file ditambahkan.` : 'File ditambahkan.');
      }
    };
    reader.readAsDataURL(file);
  });
}

/* Drag & drop onto main area */
['dragover','drop'].forEach(evt => {
  document.addEventListener(evt, (e) => e.preventDefault());
});
dropHint.addEventListener('dragover', (e) => { e.preventDefault(); dropHint.classList.add('drag-active'); });
dropHint.addEventListener('dragleave', () => dropHint.classList.remove('drag-active'));
dropHint.addEventListener('drop', (e) => {
  e.preventDefault();
  dropHint.classList.remove('drag-active');
  if(activeNav === 'compress') return;
  handleFiles(e.dataTransfer.files);
});

/* ---------- Add nav modal ---------- */
const navModalBackdrop = document.getElementById('navModalBackdrop');
const navNameInput = document.getElementById('navNameInput');
const navIconPreview = document.getElementById('navIconPreview');
const navIconLabel = document.getElementById('navIconLabel');

document.getElementById('addNavBtn').addEventListener('click', () => {
  navNameInput.value = '';
  navIconPreview.className = 'fa-solid fa-folder';
  navIconLabel.textContent = 'Ikon otomatis';
  navModalBackdrop.classList.add('show');
  setTimeout(() => navNameInput.focus(), 50);
  closeSidebarMobile();
});
document.getElementById('navModalCancel').addEventListener('click', () => navModalBackdrop.classList.remove('show'));
navModalBackdrop.addEventListener('click', (e) => { if(e.target === navModalBackdrop) navModalBackdrop.classList.remove('show'); });

navNameInput.addEventListener('input', () => {
  const val = navNameInput.value.trim();
  const icon = val ? detectIcon(val) : 'fa-folder';
  navIconPreview.className = `fa-solid ${icon}`;
  navIconLabel.textContent = val ? 'Ikon terdeteksi' : 'Ikon otomatis';
});

document.getElementById('navModalSave').addEventListener('click', () => {
  const label = navNameInput.value.trim();
  if(!label) { showToast('Nama navbar tidak boleh kosong.'); return; }
  const icon = detectIcon(label);
  const id = 'nav' + Date.now();
  navItems.push({ id, label, icon, system:false });
  saveNav();
  navModalBackdrop.classList.remove('show');
  setActiveNav(id);
  showToast('Kategori ditambahkan ke dock.');
});

/* ---------- Mobile sidebar toggle ---------- */
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
document.getElementById('menuToggle').addEventListener('click', () => {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.add('show');
});
sidebarBackdrop.addEventListener('click', closeSidebarMobile);
function closeSidebarMobile(){
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('show');
}
document.getElementById('searchToggle').addEventListener('click', () => {
  const q = prompt('Cari file:');
  if(q !== null){ searchInput.value = q; renderView(); }
});

/* ---------- Search ---------- */
searchInput.addEventListener('input', renderView);

/* ---------- Storage widget ---------- */
function updateStorageWidget(){
  const bytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const mb = bytes / (1024*1024);
  document.getElementById('storageText').textContent = mb < 0.1 ? Math.round(bytes/1024) + ' KB' : mb.toFixed(1) + ' MB';
  const pct = Math.min(100, (mb / 10) * 100); // assume ~10MB soft cap visual
  document.getElementById('storageFill').style.width = Math.max(pct, 2) + '%';
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Helpers ---------- */
function formatSize(bytes){
  if(bytes < 1024) return bytes + ' B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}
function formatDate(ts){
  if(!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', { day:'numeric', month:'short' });
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ===================== Compress / Convert PDF <-> Word ===================== */
if(window['pdfjsLib']){
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

document.querySelectorAll('.dir-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    convertDirection = btn.dataset.dir;
    convertFile = null;
    document.getElementById('convertFileInfo').classList.add('hidden');
    document.getElementById('convertBtn').disabled = true;
    document.getElementById('convertStatus').textContent = '';
    document.getElementById('convertDropText').textContent =
      convertDirection === 'pdf2word' ? 'Pilih atau taruh file PDF di sini' : 'Pilih atau taruh file Word (.docx) di sini';
  });
});

const convertDrop = document.getElementById('convertDrop');
const convertInput = document.getElementById('convertInput');
convertDrop.addEventListener('click', (e) => { if(e.target.id !== 'convertInput') convertInput.click(); });
convertInput.addEventListener('change', (e) => setConvertFile(e.target.files[0]));
convertDrop.addEventListener('dragover', (e) => { e.preventDefault(); convertDrop.style.borderColor = '#c9a24b'; });
convertDrop.addEventListener('dragleave', () => convertDrop.style.borderColor = '');
convertDrop.addEventListener('drop', (e) => {
  e.preventDefault();
  convertDrop.style.borderColor = '';
  if(e.dataTransfer.files[0]) setConvertFile(e.dataTransfer.files[0]);
});

function setConvertFile(file){
  if(!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if(convertDirection === 'pdf2word' && ext !== 'pdf'){
    showToast('Pilih file PDF ya.'); return;
  }
  if(convertDirection === 'word2pdf' && !['doc','docx'].includes(ext)){
    showToast('Pilih file Word (.docx) ya.'); return;
  }
  convertFile = file;
  document.getElementById('convertFileName').textContent = file.name;
  document.getElementById('convertFileInfo').classList.remove('hidden');
  document.getElementById('convertBtn').disabled = false;
  document.getElementById('convertStatus').textContent = '';
}
document.getElementById('convertRemove').addEventListener('click', () => {
  convertFile = null;
  document.getElementById('convertFileInfo').classList.add('hidden');
  document.getElementById('convertBtn').disabled = true;
});

document.getElementById('convertBtn').addEventListener('click', async () => {
  if(!convertFile) return;
  const statusEl = document.getElementById('convertStatus');
  const btn = document.getElementById('convertBtn');
  statusEl.className = 'convert-status';
  statusEl.textContent = 'Memproses...';
  btn.disabled = true;
  try{
    if(convertDirection === 'pdf2word'){
      await convertPdfToWord(convertFile);
    } else {
      await convertWordToPdf(convertFile);
    }
    statusEl.className = 'convert-status ok';
    statusEl.textContent = 'Selesai! File hasil konversi otomatis terunduh.';
  }catch(err){
    console.error(err);
    statusEl.className = 'convert-status err';
    statusEl.textContent = 'Gagal memproses file. Coba file lain.';
  } finally {
    btn.disabled = false;
  }
});

async function convertPdfToWord(file){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const paragraphs = [];
  for(let i=1; i<=pdf.numPages; i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(it => it.str).join(' ');
    paragraphs.push(new docx.Paragraph({ children:[ new docx.TextRun(text) ] }));
    paragraphs.push(new docx.Paragraph({ text: '' }));
  }
  const doc = new docx.Document({ sections: [{ children: paragraphs }] });
  const blob = await docx.Packer.toBlob(doc);
  const outName = file.name.replace(/\.pdf$/i, '') + '.docx';
  downloadBlob(blob, outName);
  addResultToFiles(blob, outName);
}

async function convertWordToPdf(file){
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  const text = result.value || '';
  const { jsPDF } = window.jspdf;
  const pdfDoc = new jsPDF({ unit:'pt', format:'a4' });
  const margin = 48;
  const maxWidth = 595 - margin*2;
  const lines = pdfDoc.splitTextToSize(text || '(dokumen kosong)', maxWidth);
  let y = margin;
  const lineHeight = 16;
  const pageHeight = 842;
  lines.forEach(line => {
    if(y > pageHeight - margin){
      pdfDoc.addPage();
      y = margin;
    }
    pdfDoc.text(line, margin, y);
    y += lineHeight;
  });
  const blob = pdfDoc.output('blob');
  const outName = file.name.replace(/\.docx?$/i, '') + '.pdf';
  downloadBlob(blob, outName);
  addResultToFiles(blob, outName);
}

function downloadBlob(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function addResultToFiles(blob, name){
  const reader = new FileReader();
  reader.onload = () => {
    files.push({
      id: 'f' + Date.now() + Math.random().toString(16).slice(2),
      name,
      size: blob.size,
      data: reader.result,
      navId: null,
      fav: false,
      addedAt: Date.now(),
      lastOpened: null,
    });
    saveFiles();
    renderNav();
  };
  reader.readAsDataURL(blob);
}

/* ---------- Init ---------- */
renderNav();
renderView();
updateStorageWidget();
