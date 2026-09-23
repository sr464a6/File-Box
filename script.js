/* ===================== FileBox app logic ===================== */

const LS_NAV = 'filebox_nav_v1';
const LS_FILES = 'filebox_files_v1';

/* ============================================================
   GITHUB DEFAULT PDF LIBRARY
   ============================================================ */

const GITHUB_REPO_API =
  'https://api.github.com/repos/sr464a6/File-Box/contents/';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/sr464a6/File-Box/main/';

const GITHUB_PDF_FOLDER = 'pdf';

let githubNavItems = [];
let githubFiles = [];
 

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
    if(rule.keys.some(k => n.includes(k))){
      return rule.icon;
    }
  }

  return 'fa-folder';
}


/* ---------- Default nav ---------- */

const SYSTEM_NAV = [
  {
    id:'home',
    label:'Beranda',
    icon:'fa-house',
    system:true
  },
  {
    id:'all',
    label:'Semua File',
    icon:'fa-folder-open',
    system:true
  },
  {
    id:'favorites',
    label:'Favorit',
    icon:'fa-star',
    system:true
  },
  {
    id:'compress',
    label:'Compress',
    icon:'fa-file-zipper',
    system:true
  },
];


/* ---------- State ---------- */

let navItems = loadNav();
let files = loadFiles();

let activeNav = 'home';

let convertDirection = 'pdf2word';
let convertFile = null;

let dragSrcId = null;


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function loadNav(){

  try{

    const raw = JSON.parse(
      localStorage.getItem(LS_NAV)
    );

    if(raw && Array.isArray(raw)){
      return raw;
    }

  }catch(e){}

  return [];
}


function saveNav(){

  try{

    /*
      Hanya simpan kategori buatan user.

      Kategori dari GitHub tidak perlu disimpan karena
      setiap kali aplikasi dibuka akan dibaca ulang dari repo.
    */

    const userNav = navItems.filter(
      item => !item.github
    );

    localStorage.setItem(
      LS_NAV,
      JSON.stringify(userNav)
    );

  }catch(e){}

}


function loadFiles(){

  try{

    const raw = JSON.parse(
      localStorage.getItem(LS_FILES)
    );

    if(raw && Array.isArray(raw)){
      return raw;
    }

  }catch(e){}

  return [];
}


function saveFiles(){

  try{

    localStorage.setItem(
      LS_FILES,
      JSON.stringify(files)
    );

  }catch(e){

    showToast(
      'Penyimpanan penuh, hapus beberapa file.'
    );

  }

  updateStorageWidget();

}


/* ============================================================
   DOM REFS
   ============================================================ */

const navList =
  document.getElementById('navList');

const dockList =
  document.getElementById('dockList');

const fileGrid =
  document.getElementById('fileGrid');

const viewTitle =
  document.getElementById('viewTitle');

const viewSubtitle =
  document.getElementById('viewSubtitle');

const dropHint =
  document.getElementById('dropHint');

const compressView =
  document.getElementById('compressView');

const searchInput =
  document.getElementById('searchInput');


/* ============================================================
   GITHUB FOLDER LOADER
   ============================================================ */

/*
  Fungsi ini membaca semua isi ROOT repository.

  Folder:
    cysec/
    growth/
    lang/
    muslim/

  akan otomatis menjadi kategori dock.

  File:
    index.html
    script.js
    styles.css

  tidak dimasukkan sebagai kategori.
*/

/* ============================================================
   GITHUB FOLDER LOADER
   ============================================================ */

/*
  Struktur repository:

  pdf/
    cysec/
    growth/
    hack/
    lang/
    linux/
    muslim/
    network/
    oscp/
    penetration/
    wami/

  Setiap folder di dalam pdf/ otomatis menjadi
  kategori File-Box.
*/

async function loadGitHubFolders(){

  try{

    const pdfUrl =
      GITHUB_REPO_API +
      encodeURIComponent(GITHUB_PDF_FOLDER);

    const response =
      await fetch(
        pdfUrl,
        {
          cache: 'no-store'
        }
      );

    if(!response.ok){

      throw new Error(
        'GitHub PDF folder error: ' +
        response.status
      );

    }

    const items =
      await response.json();

    if(!Array.isArray(items)){
      return;
    }

    /*
      Ambil hanya folder di dalam pdf/
    */

    const folders =
      items.filter(
        item =>
          item.type === 'dir'
      );

    /*
      Buat kategori otomatis.
    */

    githubNavItems =
      folders.map(
        folder => {

          const folderName =
            folder.name;

          const safeId =
            folderName
              .toLowerCase()
              .replace(
                /[^a-z0-9]+/g,
                '-'
              );

          return {

            id:
              'github-' +
              safeId,

            label:
              formatFolderName(
                folderName
              ),

            icon:
              detectIcon(
                folderName
              ),

            system:
              false,

            github:
              true,

            githubFolder:
              folderName,

            githubPath:
              GITHUB_PDF_FOLDER +
              '/' +
              folderName

          };

        }
      );

    /*
      Gabungkan dengan kategori buatan user.
    */

    mergeNavigation();

    /*
      Setelah kategori ditemukan,
      ambil seluruh PDF dari setiap kategori.
    */

    await loadGitHubFiles();

    renderNav();

    renderView();

    updateStorageWidget();

  }catch(error){

    console.error(
      'Gagal membaca library PDF GitHub:',
      error
    );

  }

}


/* ============================================================
   LOAD PDF DARI GITHUB
   ============================================================ */

async function loadGitHubFiles(){

  githubFiles = [];

  /*
    Ambil file dari:

    pdf/cysec/
    pdf/growth/
    pdf/hack/
    dst.
  */

  for(
    const folder
    of githubNavItems
  ){

    try{

      const path =
        GITHUB_PDF_FOLDER +
        '/' +
        folder.githubFolder;

      const url =
        GITHUB_REPO_API +
        path
          .split('/')
          .map(
            part =>
              encodeURIComponent(part)
          )
          .join('/');

      const response =
        await fetch(
          url,
          {
            cache: 'no-store'
          }
        );

      if(!response.ok){

        console.error(
          'Gagal membaca folder GitHub:',
          path,
          response.status
        );

        continue;

      }

      const items =
        await response.json();

      if(!Array.isArray(items)){
        continue;
      }

      /*
        Hanya masukkan file PDF.

        File lain di folder pdf/
        tidak dianggap sebagai library PDF.
      */

      items
        .filter(
          item => {

            if(item.type !== 'file'){
              return false;
            }

            return (
              item.name
                .toLowerCase()
                .endsWith('.pdf')
            );

          }
        )
        .forEach(
          item => {

            const rawUrl =
              GITHUB_RAW_BASE +
              path
                .split('/')
                .map(
                  part =>
                    encodeURIComponent(part)
                )
                .join('/') +
              '/' +
              encodeURIComponent(
                item.name
              );

            githubFiles.push({

              id:
                'github-file-' +
                item.sha,

              name:
                item.name,

              size:
                item.size || 0,

              /*
                URL PDF asli dari GitHub.
              */

              data:
                item.download_url ||
                rawUrl,

              navId:
                folder.id,

              fav:
                false,

              addedAt:
                Date.now(),

              lastOpened:
                null,

              github:
                true,

              githubPath:
                item.path,

              htmlUrl:
                item.html_url,

              /*
                Tandai sebagai default library.
              */

              defaultFile:
                true

            });

          }
        );

    }catch(error){

      console.error(
        'Gagal membaca folder:',
        folder.label,
        error
      );

    }

  }

  console.log(
    'GitHub PDF library:',
    githubFiles.length,
    'PDF'
  );

}

function formatFolderName(name){

  return name

    .replace(/[-_]+/g, ' ')

    .replace(/\s+/g, ' ')

    .trim()

    .replace(/\b\w/g, char =>
      char.toUpperCase()
    );

}


/* ============================================================
   GABUNGKAN NAV GITHUB + USER
   ============================================================ */

function mergeNavigation(){

  const userNavItems = navItems.filter(
    item => !item.github
  );


  /*
    Buang kategori GitHub lama.

    Ini penting kalau GitHub berubah.
  */

  navItems = [

    ...githubNavItems,

    ...userNavItems

  ];

}


/* ============================================================
   LOAD FILE DARI FOLDER GITHUB
   ============================================================ */

async function loadGitHubFiles(){

  githubFiles = [];


  for(const folder of githubNavItems){

    try{

      const url =
        GITHUB_REPO_API +
        encodeURIComponent(
          folder.githubFolder
        );


      const response = await fetch(
        url,
        {
          cache: 'no-store'
        }
      );


      if(!response.ok){
        continue;
      }


      const items = await response.json();


      if(!Array.isArray(items)){
        continue;
      }


      /*
        Ambil file yang ada di folder.

        Tidak hanya PDF.
        Jadi PDF, DOCX, JPG, PNG, ZIP dll bisa masuk.
      */

      items

        .filter(item =>
          item.type === 'file'
        )

        .forEach(item => {

          githubFiles.push({

            id:
              'github-file-' +
              item.sha,

            name:
              item.name,

            size:
              item.size || 0,

            data:
              item.download_url ||
              (
                GITHUB_RAW_BASE +
                encodeURIComponent(
                  folder.githubFolder
                ) +
                '/' +
                encodeURIComponent(
                  item.name
                )
              ),

            navId:
              folder.id,

            fav:
              false,

            addedAt:
              Date.now(),

            lastOpened:
              null,

            github:
              true,

            githubPath:
              item.path,

            htmlUrl:
              item.html_url

          });

        });


    }catch(error){

      console.error(
        'Gagal membaca folder:',
        folder.label,
        error
      );

    }

  }

}


/* ============================================================
   RENDER SIDEBAR
   ============================================================ */

function renderNav(){

  navList.innerHTML = '';


  SYSTEM_NAV.forEach(item => {

    const li =
      document.createElement('li');


    li.className =
      'nav-item' +
      (
        item.id === activeNav
          ? ' active'
          : ''
      );


    li.dataset.id =
      item.id;


    const count =
      countForSystem(item.id);


    li.innerHTML = `

      <i
        class="fa-solid ${item.icon} nav-icon">
      </i>

      <span class="nav-label">
        ${escapeHtml(item.label)}
      </span>

      <span class="nav-count">
        ${count}
      </span>

    `;


    li.addEventListener(
      'click',
      () => setActiveNav(item.id)
    );


    navList.appendChild(li);

  });


  renderDock();

}


/* ============================================================
   RENDER DOCK
   ============================================================ */

function renderDock(){

  dockList.innerHTML = '';


  navItems.forEach(item => {

    const li =
      document.createElement('li');


    li.className =
      'dock-item' +
      (
        item.id === activeNav
          ? ' active'
          : ''
      );


    li.dataset.id =
      item.id;


    li.draggable =
      true;


    /*
      File lokal
      +
      file GitHub
    */

    const localCount =
      files.filter(
        f => f.navId === item.id
      ).length;


    const githubCount =
      githubFiles.filter(
        f => f.navId === item.id
      ).length;


    const count =
      localCount +
      githubCount;


    /*
      Kategori GitHub tidak punya tombol hapus.

      Kategori user tetap punya tombol X.
    */

    const removeButton =
      item.github
        ? ''
        : `
          <button
            class="dock-remove"
            title="Hapus">

            <i class="fa-solid fa-xmark"></i>

          </button>
        `;


    li.innerHTML = `

      <i class="fa-solid ${item.icon}"></i>

      <span class="dock-tooltip">

        ${escapeHtml(item.label)}

        ${count ? ' · ' + count : ''}

      </span>

      ${removeButton}

    `;


    li.addEventListener(
      'click',
      (e) => {

        if(
          e.target.closest('.dock-remove')
        ){
          return;
        }

        setActiveNav(item.id);

      }
    );


    /*
      Hanya kategori user yang bisa dihapus.
    */

    if(!item.github){

      const remove =
        li.querySelector('.dock-remove');


      if(remove){

        remove.addEventListener(
          'click',
          (e) => {

            e.stopPropagation();

            removeNavItem(item.id);

          }
        );

      }

    }


    attachDragHandlers(
      li,
      item.id
    );


    dockList.appendChild(li);

  });

}


/* ============================================================
   SYSTEM COUNTER
   ============================================================ */

function countForSystem(id){

 if(id === 'home'){

  return Math.min(
    files.length +
    githubFiles.length,
    12
  );

}


  if(id === 'all'){

    return (
      files.length +
      githubFiles.length
    );

  }


  if(id === 'favorites'){

    return files.filter(
      f => f.fav
    ).length;

  }


  if(id === 'compress'){

    return '';

  }


  return 0;

}


/* ============================================================
   DRAG & DROP REORDER
   ============================================================ */

function attachDragHandlers(
  li,
  id
){

  li.addEventListener(
    'dragstart',
    (e) => {

      /*
        Kategori GitHub tetap boleh dipindahkan
        posisinya, tetapi tidak bisa dihapus.
      */

      dragSrcId =
        id;

      li.classList.add(
        'dragging'
      );

      e.dataTransfer.effectAllowed =
        'move';

    }
  );


  li.addEventListener(
    'dragend',
    () => {

      li.classList.remove(
        'dragging'
      );

      document
        .querySelectorAll(
          '.dock-item.drag-over'
        )
        .forEach(
          el =>
            el.classList.remove(
              'drag-over'
            )
        );

    }
  );


  li.addEventListener(
    'dragover',
    (e) => {

      e.preventDefault();

      if(
        dragSrcId &&
        dragSrcId !== id
      ){

        li.classList.add(
          'drag-over'
        );

      }

    }
  );


  li.addEventListener(
    'dragleave',
    () =>
      li.classList.remove(
        'drag-over'
      )
  );


  li.addEventListener(
    'drop',
    (e) => {

      e.preventDefault();

      li.classList.remove(
        'drag-over'
      );


      if(
        !dragSrcId ||
        dragSrcId === id
      ){

        return;

      }


      reorderNav(
        dragSrcId,
        id
      );


      dragSrcId = null;

    }
  );

}


/* ============================================================
   REORDER NAV
   ============================================================ */

function reorderNav(
  srcId,
  targetId
){

  const srcIdx =
    navItems.findIndex(
      n => n.id === srcId
    );


  const tgtIdx =
    navItems.findIndex(
      n => n.id === targetId
    );


  if(
    srcIdx === -1 ||
    tgtIdx === -1
  ){

    return;

  }


  const [moved] =
    navItems.splice(
      srcIdx,
      1
    );


  navItems.splice(
    tgtIdx,
    0,
    moved
  );


  saveNav();

  renderDock();

}


/* ============================================================
   REMOVE NAV ITEM
   ============================================================ */

function removeNavItem(id){

  const item =
    navItems.find(
      n => n.id === id
    );


  /*
    Folder GitHub tidak boleh dihapus
    karena berasal dari repository.
  */

  if(item && item.github){

    showToast(
      'Kategori dari GitHub tidak bisa dihapus.'
    );

    return;

  }


  navItems =
    navItems.filter(
      n => n.id !== id
    );


  files.forEach(
    f => {

      if(f.navId === id){

        f.navId = null;

      }

    }
  );


  saveNav();

  saveFiles();


  if(activeNav === id){

    setActiveNav(
      'home'
    );

  }else{

    renderNav();

  }

}


/* ============================================================
   SET ACTIVE NAV
   ============================================================ */

function setActiveNav(id){

  activeNav =
    id;

  renderNav();

  renderView();

}


/* ============================================================
   RENDER VIEW
   ============================================================ */

function renderView(){

  compressView.classList.add(
    'hidden'
  );

  fileGrid.classList.remove(
    'hidden'
  );

  dropHint.classList.remove(
    'hidden'
  );


  const custom =
    navItems.find(
      n => n.id === activeNav
    );


  const query =
    searchInput.value
      .trim()
      .toLowerCase();


  let list = [];


  /* ---------- Home ---------- */
/* ---------- Home ---------- */

if(activeNav === 'home'){

  viewTitle.textContent =
    'Beranda';

  viewSubtitle.textContent =
    'Library PDF dan file yang baru-baru ini dibuka';

  /*
    Gabungkan:

    - file milik user
    - PDF default dari GitHub
  */

  const allFiles = [
    ...files,
    ...githubFiles
  ];

  /*
    Tampilkan file yang pernah dibuka.
  */

  list =
    allFiles
      .filter(
        f => f.lastOpened
      )
      .sort(
        (a,b) =>
          b.lastOpened -
          a.lastOpened
      )
      .slice(
        0,
        12
      );

  /*
    Kalau belum ada yang dibuka,
    tampilkan file terbaru dari library.
  */

  if(list.length === 0){

    list =
      allFiles
        .sort(
          (a,b) =>
            b.addedAt -
            a.addedAt
        )
        .slice(
          0,
          12
        );

  }

}

  else if(activeNav === 'all'){

    viewTitle.textContent =
      'Semua File';


    viewSubtitle.textContent =
      (
        files.length +
        githubFiles.length
      ) +
      ' file tersedia';


    list =
      [
        ...files,
        ...githubFiles
      ]

      .sort(
        (a,b) =>
          b.addedAt -
          a.addedAt
      );

  }


  /* ---------- Favorites ---------- */

  else if(activeNav === 'favorites'){

    viewTitle.textContent =
      'Favorit';


    viewSubtitle.textContent =
      'File yang kamu tandai';


    list =
      files

      .filter(
        f => f.fav
      )

      .sort(
        (a,b) =>
          b.addedAt -
          a.addedAt
      );

  }


  /* ---------- Compress ---------- */

  else if(activeNav === 'compress'){

    viewTitle.textContent =
      'Compress';


    viewSubtitle.textContent =
      'Konversi PDF ke Word atau sebaliknya';


    fileGrid.classList.add(
      'hidden'
    );

    dropHint.classList.add(
      'hidden'
    );

    compressView.classList.remove(
      'hidden'
    );

    return;

  }


  /* ---------- GitHub / User category ---------- */

  else if(custom){

    viewTitle.textContent =
      custom.label;


    /*
      Jika kategori berasal dari GitHub,
      tampilkan file GitHub + file lokal
      yang pernah dimasukkan user ke kategori itu.
    */

    const githubList =
      custom.github

        ? githubFiles.filter(
            f =>
              f.navId === custom.id
          )

        : [];


    const localList =
      files.filter(
        f =>
          f.navId === custom.id
      );


    list =
      [
        ...githubList,
        ...localList
      ]

      .sort(
        (a,b) =>
          b.addedAt -
          a.addedAt
      );


    viewSubtitle.textContent =
      list.length +
      ' file';

  }


  /* ---------- Search ---------- */

  if(query){

    list =
      list.filter(
        f =>
          f.name
            .toLowerCase()
            .includes(query)
      );

  }


  renderFileGrid(
    list
  );

}


/* ============================================================
   RENDER FILE GRID
   ============================================================ */

function renderFileGrid(list){

  fileGrid.innerHTML = '';


  if(list.length === 0){

    fileGrid.innerHTML = `

      <div class="empty-state">

        <i class="fa-solid fa-inbox"></i>

        <p>
          Belum ada file di sini.
        </p>

      </div>

    `;

    return;

  }


  list.forEach(f => {

    const card =
      document.createElement('div');


    card.className =
      'file-card';


    card.innerHTML = `

      <div class="file-card-top">

        <div class="file-icon">

          <i
            class="fa-solid ${fileIcon(f.name)}">
          </i>

        </div>


        <button
          class="fav-btn ${f.fav ? 'active' : ''}"
          data-id="${f.id}">

          <i
            class="fa-${f.fav ? 'solid' : 'regular'} fa-star">
          </i>

        </button>

      </div>


      <div class="file-name">

        ${escapeHtml(f.name)}

      </div>


      <div class="file-meta">

        <span>
          ${formatSize(f.size)}
        </span>

        <span>
          ${formatDate(f.addedAt)}
        </span>

      </div>

    `;


    card.addEventListener(
      'click',
      (e) => {

        if(
          e.target.closest(
            '.fav-btn'
          )
        ){

          return;

        }


        /*
          File GitHub dibuka langsung
          karena bukan DataURL localStorage.
        */

        if(f.github){

          openGitHubFile(
            f
          );

        }else{

          openFileModal(
            f.id
          );

        }

      }
    );


    card
      .querySelector(
        '.fav-btn'
      )
      .addEventListener(
        'click',
        (e) => {

          e.stopPropagation();


          /*
            Favorit hanya untuk file lokal.
          */

          if(f.github){

            showToast(
              'File GitHub hanya-baca.'
            );

            return;

          }


          toggleFav(
            f.id
          );

        }
      );


    fileGrid.appendChild(
      card
    );

  });

}


/* ============================================================
   OPEN GITHUB FILE
   ============================================================ */

function openGitHubFile(file){

  if(!file || !file.data){

    showToast(
      'File tidak tersedia.'
    );

    return;

  }


  /*
    PDF dibuka langsung di browser.

    File lain juga akan dibuka sesuai
    kemampuan browser.
  */

  window.open(
    file.data,
    '_blank',
    'noopener,noreferrer'
  );

}


/* ============================================================
   FILE ICON
   ============================================================ */

function fileIcon(name){

  const ext =
    name
      .split('.')
      .pop()
      .toLowerCase();


  if(
    ['pdf'].includes(ext)
  ){

    return 'fa-file-pdf';

  }


  if(
    ['doc','docx'].includes(ext)
  ){

    return 'fa-file-word';

  }


  if(
    ['xls','xlsx','csv'].includes(ext)
  ){

    return 'fa-file-excel';

  }


  if(
    ['ppt','pptx'].includes(ext)
  ){

    return 'fa-file-powerpoint';

  }


  if(
    ['png','jpg','jpeg','gif','webp','svg']
      .includes(ext)
  ){

    return 'fa-file-image';

  }


  if(
    ['mp3','wav','ogg']
      .includes(ext)
  ){

    return 'fa-file-audio';

  }


  if(
    ['mp4','mov','avi','mkv']
      .includes(ext)
  ){

    return 'fa-file-video';

  }


  if(
    ['zip','rar','7z']
      .includes(ext)
  ){

    return 'fa-file-zipper';

  }


  return 'fa-file';

}


/* ============================================================
   FAVORITES
   ============================================================ */

function toggleFav(id){

  const f =
    files.find(
      x => x.id === id
    );


  if(!f){

    return;

  }


  f.fav =
    !f.fav;


  saveFiles();

  renderNav();

  renderView();

}


/* ============================================================
   FILE MODAL
   ============================================================ */

const fileModalBackdrop =
  document.getElementById(
    'fileModalBackdrop'
  );


let activeFileId =
  null;


function openFileModal(id){

  const f =
    files.find(
      x => x.id === id
    );


  if(!f){

    return;

  }


  activeFileId =
    id;


  f.lastOpened =
    Date.now();


  saveFiles();


  document.getElementById(
    'fileModalIcon'
  ).className =
    `fa-solid ${fileIcon(f.name)}`;


  document.getElementById(
    'fileModalName'
  ).textContent =
    f.name;


  document.getElementById(
    'fileModalMeta'
  ).textContent =
    `${formatSize(f.size)} · ditambahkan ${formatDate(f.addedAt)}`;


  const favBtn =
    document.getElementById(
      'fileModalFav'
    );


  favBtn.innerHTML =
    `<i class="fa-${f.fav ? 'solid' : 'regular'} fa-star"></i> ${
      f.fav
        ? 'Batal Favorit'
        : 'Favorit'
    }`;


  document.getElementById(
    'fileModalDownload'
  ).href =
    f.data;


  document.getElementById(
    'fileModalDownload'
  ).setAttribute(
    'download',
    f.name
  );


  fileModalBackdrop.classList.add(
    'show'
  );


  renderView();

}


document.getElementById(
  'fileModalClose'
).addEventListener(
  'click',
  () =>
    fileModalBackdrop.classList.remove(
      'show'
    )
);


fileModalBackdrop.addEventListener(
  'click',
  (e) => {

    if(
      e.target ===
      fileModalBackdrop
    ){

      fileModalBackdrop.classList.remove(
        'show'
      );

    }

  }
);


document.getElementById(
  'fileModalFav'
).addEventListener(
  'click',
  () => {

    if(activeFileId){

      toggleFav(
        activeFileId
      );

      openFileModal(
        activeFileId
      );

    }

  }
);


document.getElementById(
  'fileModalDelete'
).addEventListener(
  'click',
  () => {

    if(!activeFileId){

      return;

    }


    files =
      files.filter(
        f =>
          f.id !== activeFileId
      );


    saveFiles();


    fileModalBackdrop.classList.remove(
      'show'
    );


    renderNav();

    renderView();


    showToast(
      'File dihapus.'
    );

  }
);


/* ============================================================
   UPLOAD FILES
   ============================================================ */

const uploadBtn =
  document.getElementById(
    'uploadBtn'
  );


const fileInput =
  document.getElementById(
    'fileInput'
  );


uploadBtn.addEventListener(
  'click',
  () =>
    fileInput.click()
);


fileInput.addEventListener(
  'change',
  (e) =>
    handleFiles(
      e.target.files
    )
);


function handleFiles(
  fileListRaw
){

  const custom =
    navItems.find(
      n => n.id === activeNav
    );


  const navId =
    custom
      ? custom.id
      : null;


  const arr =
    Array.from(
      fileListRaw
    );


  let pending =
    arr.length;


  if(pending === 0){

    return;

  }


  arr.forEach(
    file => {

      const reader =
        new FileReader();


      reader.onload =
        () => {

          files.push({

            id:
              'f' +
              Date.now() +
              Math.random()
                .toString(16)
                .slice(2),

            name:
              file.name,

            size:
              file.size,

            data:
              reader.result,

            navId:
              navId,

            fav:
              false,

            addedAt:
              Date.now(),

            lastOpened:
              null,

          };


          pending--;


          if(pending === 0){

            saveFiles();

            renderNav();

            renderView();


            showToast(
              arr.length > 1
                ? `${arr.length} file ditambahkan.`
                : 'File ditambahkan.'
            );

          }

        };


      reader.readAsDataURL(
        file
      );

    }
  );

}


/* ============================================================
   DRAG & DROP MAIN AREA
   ============================================================ */

[
  'dragover',
  'drop'
].forEach(
  evt => {

    document.addEventListener(
      evt,
      (e) =>
        e.preventDefault()
    );

  }
);


dropHint.addEventListener(
  'dragover',
  (e) => {

    e.preventDefault();

    dropHint.classList.add(
      'drag-active'
    );

  }
);


dropHint.addEventListener(
  'dragleave',
  () =>
    dropHint.classList.remove(
      'drag-active'
    )
);


dropHint.addEventListener(
  'drop',
  (e) => {

    e.preventDefault();


    dropHint.classList.remove(
      'drag-active'
    );


    if(
      activeNav === 'compress'
    ){

      return;

    }


    handleFiles(
      e.dataTransfer.files
    );

  }
);


/* ============================================================
   ADD NAV MODAL
   ============================================================ */

const navModalBackdrop =
  document.getElementById(
    'navModalBackdrop'
  );


const navNameInput =
  document.getElementById(
    'navNameInput'
  );


const navIconPreview =
  document.getElementById(
    'navIconPreview'
  );


const navIconLabel =
  document.getElementById(
    'navIconLabel'
  );


document.getElementById(
  'addNavBtn'
).addEventListener(
  'click',
  () => {

    navNameInput.value =
      '';


    navIconPreview.className =
      'fa-solid fa-folder';


    navIconLabel.textContent =
      'Ikon otomatis';


    navModalBackdrop.classList.add(
      'show'
    );


    setTimeout(
      () =>
        navNameInput.focus(),
      50
    );


    closeSidebarMobile();

  }
);


document.getElementById(
  'navModalCancel'
).addEventListener(
  'click',
  () =>
    navModalBackdrop.classList.remove(
      'show'
    )
);


navModalBackdrop.addEventListener(
  'click',
  (e) => {

    if(
      e.target ===
      navModalBackdrop
    ){

      navModalBackdrop.classList.remove(
        'show'
      );

    }

  }
);


navNameInput.addEventListener(
  'input',
  () => {

    const val =
      navNameInput.value.trim();


    const icon =
      val
        ? detectIcon(val)
        : 'fa-folder';


    navIconPreview.className =
      `fa-solid ${icon}`;


    navIconLabel.textContent =
      val
        ? 'Ikon terdeteksi'
        : 'Ikon otomatis';

  }
);


document.getElementById(
  'navModalSave'
).addEventListener(
  'click',
  () => {

    const label =
      navNameInput.value.trim();


    if(!label){

      showToast(
        'Nama navbar tidak boleh kosong.'
      );

      return;

    }


    const icon =
      detectIcon(label);


    const id =
      'nav' +
      Date.now();


    navItems.push({

      id,

      label,

      icon,

      system:false,

      github:false

    });


    saveNav();


    navModalBackdrop.classList.remove(
      'show'
    );


    setActiveNav(
      id
    );


    showToast(
      'Kategori ditambahkan ke dock.'
    );

  }
);


/* ============================================================
   MOBILE SIDEBAR
   ============================================================ */

const sidebar =
  document.getElementById(
    'sidebar'
  );


const sidebarBackdrop =
  document.getElementById(
    'sidebarBackdrop'
  );


document.getElementById(
  'menuToggle'
).addEventListener(
  'click',
  () => {

    sidebar.classList.add(
      'open'
    );

    sidebarBackdrop.classList.add(
      'show'
    );

  }
);


sidebarBackdrop.addEventListener(
  'click',
  closeSidebarMobile
);


function closeSidebarMobile(){

  sidebar.classList.remove(
    'open'
  );

  sidebarBackdrop.classList.remove(
    'show'
  );

}


document.getElementById(
  'searchToggle'
).addEventListener(
  'click',
  () => {

    const q =
      prompt(
        'Cari file:'
      );


    if(q !== null){

      searchInput.value =
        q;

      renderView();

    }

  }
);


/* ============================================================
   SEARCH
   ============================================================ */

searchInput.addEventListener(
  'input',
  renderView
);


/* ============================================================
   STORAGE WIDGET
   ============================================================ */

function updateStorageWidget(){

  const bytes =
    files.reduce(
      (sum, f) =>
        sum +
        (f.size || 0),
      0
    );


  const mb =
    bytes /
    (1024 * 1024);


  document.getElementById(
    'storageText'
  ).textContent =
    mb < 0.1
      ? Math.round(
          bytes / 1024
        ) +
        ' KB'
      : mb.toFixed(1) +
        ' MB';


  const pct =
    Math.min(
      100,
      (mb / 10) * 100
    );


  document.getElementById(
    'storageFill'
  ).style.width =
    Math.max(
      pct,
      2
    ) +
    '%';

}


/* ============================================================
   TOAST
   ============================================================ */

let toastTimer =
  null;


function showToast(msg){

  const t =
    document.getElementById(
      'toast'
    );


  t.textContent =
    msg;


  t.classList.add(
    'show'
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () =>
        t.classList.remove(
          'show'
        ),
      2400
    );

}


/* ============================================================
   HELPERS
   ============================================================ */

function formatSize(bytes){

  if(bytes < 1024){

    return bytes +
      ' B';

  }


  if(bytes <
     1024 * 1024){

    return (
      bytes / 1024
    ).toFixed(1) +
      ' KB';

  }


  return (
    bytes /
    (1024 * 1024)
  ).toFixed(1) +
    ' MB';

}


function formatDate(ts){

  if(!ts){

    return '-';

  }


  const d =
    new Date(ts);


  return d.toLocaleDateString(
    'id-ID',
    {
      day:'numeric',
      month:'short'
    }
  );

}


function escapeHtml(str){

  const div =
    document.createElement(
      'div'
    );


  div.textContent =
    str;


  return div.innerHTML;

}


/* ============================================================
   COMPRESS / CONVERT PDF <-> WORD
   ============================================================ */

if(window['pdfjsLib']){

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

}


document
  .querySelectorAll(
    '.dir-btn'
  )
  .forEach(
    btn => {

      btn.addEventListener(
        'click',
        () => {

          document
            .querySelectorAll(
              '.dir-btn'
            )
            .forEach(
              b =>
                b.classList.remove(
                  'active'
                )
            );


          btn.classList.add(
            'active'
          );


          convertDirection =
            btn.dataset.dir;


          convertFile =
            null;


          document
            .getElementById(
              'convertFileInfo'
            )
            .classList.add(
              'hidden'
            );


          document
            .getElementById(
              'convertBtn'
            )
            .disabled =
              true;


          document
            .getElementById(
              'convertStatus'
            )
            .textContent =
              '';


          document
            .getElementById(
              'convertDropText'
            )
            .textContent =
              convertDirection ===
              'pdf2word'

                ? 'Pilih atau taruh file PDF di sini'

                : 'Pilih atau taruh file Word (.docx) di sini';

        }
      );

    }
  );


const convertDrop =
  document.getElementById(
    'convertDrop'
  );


const convertInput =
  document.getElementById(
    'convertInput'
  );


convertDrop.addEventListener(
  'click',
  (e) => {

    if(
      e.target.id !==
      'convertInput'
    ){

      convertInput.click();

    }

  }
);


convertInput.addEventListener(
  'change',
  (e) =>
    setConvertFile(
      e.target.files[0]
    )
);


convertDrop.addEventListener(
  'dragover',
  (e) => {

    e.preventDefault();

    convertDrop.style.borderColor =
      '#c9a24b';

  }
);


convertDrop.addEventListener(
  'dragleave',
  () =>
    convertDrop.style.borderColor =
      ''
);


convertDrop.addEventListener(
  'drop',
  (e) => {

    e.preventDefault();

    convertDrop.style.borderColor =
      '';


    if(
      e.dataTransfer.files[0]
    ){

      setConvertFile(
        e.dataTransfer.files[0]
      );

    }

  }
);


function setConvertFile(file){

  if(!file){

    return;

  }


  const ext =
    file.name
      .split('.')
      .pop()
      .toLowerCase();


  if(
    convertDirection ===
    'pdf2word' &&
    ext !== 'pdf'
  ){

    showToast(
      'Pilih file PDF ya.'
    );

    return;

  }


  if(
    convertDirection ===
    'word2pdf' &&
    !['doc','docx'].includes(ext)
  ){

    showToast(
      'Pilih file Word (.docx) ya.'
    );

    return;

  }


  convertFile =
    file;


  document.getElementById(
    'convertFileName'
  ).textContent =
    file.name;


  document.getElementById(
    'convertFileInfo'
  ).classList.remove(
    'hidden'
  );


  document.getElementById(
    'convertBtn'
  ).disabled =
    false;


  document.getElementById(
    'convertStatus'
  ).textContent =
    '';

}


document.getElementById(
  'convertRemove'
).addEventListener(
  'click',
  () => {

    convertFile =
      null;


    document.getElementById(
      'convertFileInfo'
    ).classList.add(
      'hidden'
    );


    document.getElementById(
      'convertBtn'
    ).disabled =
      true;

  }
);


document.getElementById(
  'convertBtn'
).addEventListener(
  'click',
  async () => {

    if(!convertFile){

      return;

    }


    const statusEl =
      document.getElementById(
        'convertStatus'
      );


    const btn =
      document.getElementById(
        'convertBtn'
      );


    statusEl.className =
      'convert-status';


    statusEl.textContent =
      'Memproses...';


    btn.disabled =
      true;


    try{

      if(
        convertDirection ===
        'pdf2word'
      ){

        await convertPdfToWord(
          convertFile
        );

      }else{

        await convertWordToPdf(
          convertFile
        );

      }


      statusEl.className =
        'convert-status ok';


      statusEl.textContent =
        'Selesai! File hasil konversi otomatis terunduh.';

    }catch(err){

      console.error(err);


      statusEl.className =
        'convert-status err';


      statusEl.textContent =
        'Gagal memproses file. Coba file lain.';

    }finally{

      btn.disabled =
        false;

    }

  }
);


async function convertPdfToWord(file){

  const buf =
    await file.arrayBuffer();


  const pdf =
    await pdfjsLib
      .getDocument({
        data:buf
      })
      .promise;


  const paragraphs = [];


  for(
    let i = 1;
    i <= pdf.numPages;
    i++
  ){

    const page =
      await pdf.getPage(i);


    const content =
      await page.getTextContent();


    const text =
      content.items
        .map(it => it.str)
        .join(' ');


    paragraphs.push(
      new docx.Paragraph({
        children:[
          new docx.TextRun(text)
        ]
      })
    );


    paragraphs.push(
      new docx.Paragraph({
        text:''
      })
    );

  }


  const doc =
    new docx.Document({
      sections:[
        {
          children:
            paragraphs
        }
      ]
    });


  const blob =
    await docx.Packer
      .toBlob(doc);


  const outName =
    file.name.replace(
      /\.pdf$/i,
      ''
    ) +
    '.docx';


  downloadBlob(
    blob,
    outName
  );


  addResultToFiles(
    blob,
    outName
  );

}


async function convertWordToPdf(file){

  const buf =
    await file.arrayBuffer();


  const result =
    await mammoth.extractRawText({
      arrayBuffer:buf
    });


  const text =
    result.value || '';


  const { jsPDF } =
    window.jspdf;


  const pdfDoc =
    new jsPDF({
      unit:'pt',
      format:'a4'
    });


  const margin =
    48;


  const maxWidth =
    595 -
    margin * 2;


  const lines =
    pdfDoc.splitTextToSize(
      text ||
        '(dokumen kosong)',
      maxWidth
    );


  let y =
    margin;


  const lineHeight =
    16;


  const pageHeight =
    842;


  lines.forEach(
    line => {

      if(
        y >
        pageHeight -
        margin
      ){

        pdfDoc.addPage();

        y =
          margin;

      }


      pdfDoc.text(
        line,
        margin,
        y
      );


      y +=
        lineHeight;

    }
  );


  const blob =
    pdfDoc.output(
      'blob'
    );


  const outName =
    file.name.replace(
      /\.docx?$/i,
      ''
    ) +
    '.pdf';


  downloadBlob(
    blob,
    outName
  );


  addResultToFiles(
    blob,
    outName
  );

}


function downloadBlob(
  blob,
  name
){

  const url =
    URL.createObjectURL(
      blob
    );


  const a =
    document.createElement(
      'a'
    );


  a.href =
    url;


  a.download =
    name;


  document.body.appendChild(
    a
  );


  a.click();


  a.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    4000
  );

}


function addResultToFiles(
  blob,
  name
){

  const reader =
    new FileReader();


  reader.onload =
    () => {

      files.push({

        id:
          'f' +
          Date.now() +
          Math.random()
            .toString(16)
            .slice(2),

        name,

        size:
          blob.size,

        data:
          reader.result,

        navId:
          null,

        fav:
          false,

        addedAt:
          Date.now(),

        lastOpened:
          null,

      };


      saveFiles();

      renderNav();

    };


  reader.readAsDataURL(
    blob
  );

}


/* ============================================================
   INIT
   ============================================================ */

/*
  Render dulu supaya aplikasi langsung tampil.
*/

renderNav();

renderView();

updateStorageWidget();


/*
  Setelah itu ambil folder dari GitHub.

  Jadi user tidak perlu menunggu API GitHub
  sebelum UI muncul.
*/

loadGitHubFolders();
