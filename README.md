# 📦 FileBox
Ebook bawaan (folder `pdf/`, subfolder = kategori), cari judul & isi ebook, favorit, riwayat baca (halaman, jam, durasi), upload file + kategori/ikon sendiri, AI tanya istilah, musik/podcast YouTube, notifikasi ajakan lanjut baca. Wajib login.

    npm install
    cp .env.example .env    # isi ANTHROPIC_API_KEY
    npm start               # http://localhost:3000

Start pertama: indeks isi ebook dibuat di background (~30 dtk) lalu disimpan di `data/index.json`.
