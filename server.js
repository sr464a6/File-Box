const fs = require('fs'), path = require('path'), crypto = require('crypto');

// Membaca file .env jika ada
if (fs.existsSync('.env')) {
    for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
        const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
        }
    }
}

const express = require('express'),
      Database = require('better-sqlite3'),
      bcrypt = require('bcryptjs'),
      jwt = require('jsonwebtoken'),
      multer = require('multer'),
      pdfParse = require('pdf-parse/lib/pdf-parse.js');

fs.mkdirSync('data/uploads', { recursive: true });

const SF = 'data/secret';
if (!fs.existsSync(SF)) fs.writeFileSync(SF, crypto.randomBytes(32).toString('hex'));
const SECRET = process.env.JWT_SECRET || fs.readFileSync(SF, 'utf8');

const db = new Database('data/filebox.db');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,hash TEXT);
CREATE TABLE IF NOT EXISTS favs(uid INT,key TEXT,PRIMARY KEY(uid,key));
CREATE TABLE IF NOT EXISTS progress(uid INT,key TEXT,title TEXT,page INTEGER,total INTEGER,ts INTEGER,PRIMARY KEY(uid,key));
CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY,uid INT,name TEXT,stored TEXT,size INT);
CREATE TABLE IF NOT EXISTS shares(token TEXT PRIMARY KEY,uid INT,key TEXT);
CREATE TABLE IF NOT EXISTS cats(uid INT,name TEXT,icon TEXT,PRIMARY KEY(uid,name))
`);

for (const a of [
    'ALTER TABLE progress ADD COLUMN secs INT DEFAULT 0',
    'ALTER TABLE progress ADD COLUMN snip TEXT',
    'ALTER TABLE files ADD COLUMN cat TEXT'
]) {
    try { db.exec(a); } catch {}
}

const PDF = path.resolve('pdf');

function scan(d, out = []) {
    if (!fs.existsSync(d)) return out;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
            scan(p, out);
        } else if (/\.pdf$/i.test(e.name)) {
            const rel = path.relative(PDF, p).split(path.sep).join('/');
            out.push({
                key: 'd:' + rel,
                title: e.name.replace(/\.pdf$/i, '').replace(/_/g, ' ').trim(),
                cat: rel.includes('/') ? rel.split('/')[0] : 'umum',
                ext: 'pdf'
            });
        }
    }
    return out;
}

const DEFAULT = scan(PDF);

/* Indeks isi ebook untuk pencarian materi */
const IF = 'data/index.json';
let INDEX = {}, READY = false;
try { INDEX = JSON.parse(fs.readFileSync(IF, 'utf8')); } catch {}

async function idx(key, p) {
    try {
        const r = await pdfParse(fs.readFileSync(p));
        INDEX[key] = r.text.replace(/\s+/g, ' ').toLowerCase().slice(0, 400000);
    } catch {
        INDEX[key] = '';
    }
}

(async () => {
    for (const b of DEFAULT) {
        if (INDEX[b.key] === undefined) await idx(b.key, path.join(PDF, b.key.slice(2)));
    }
    fs.writeFileSync(IF, JSON.stringify(INDEX));
    READY = true;
    console.log('Indeks pencarian siap');
})();

const app = express();
app.use(express.json({ limit: '1mb' }));

const up = multer({
    storage: multer.diskStorage({
        destination: 'data/uploads',
        filename: (r, f, cb) => cb(null, crypto.randomUUID())
    }),
    limits: { fileSize: 100 * 1024 * 1024 }
});

const tok = id => jwt.sign({ id }, SECRET, { expiresIn: '30d' });

function auth(req, res, next) {
    try {
        const t = (req.headers.authorization || '').slice(7) || req.query.t;
        req.uid = jwt.verify(t, SECRET).id;
        next();
    } catch {
        res.status(401).json({ error: 'Login dulu' });
    }
}

function cred(req, res) {
    const { username: u, password: p } = req.body || {};
    if (!/^[\w.]{3,24}$/.test(u || '') || (p || '').length < 6) {
        res.status(400).json({ error: 'Username 3-24 huruf/angka, password min 6' });
        return null;
    }
    return [u, p];
}

app.post('/api/register', (req, res) => {
    const c = cred(req, res);
    if (!c) return;
    try {
        const r = db.prepare('INSERT INTO users(username,hash) VALUES(?,?)').run(c[0], bcrypt.hashSync(c[1], 10));
        res.json({ token: tok(r.lastInsertRowid), username: c[0] });
    } catch {
        res.status(409).json({ error: 'Username sudah dipakai' });
    }
});

app.post('/api/login', (req, res) => {
    const c = cred(req, res);
    if (!c) return;
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(c[0]);
    if (!u || !bcrypt.compareSync(c[1], u.hash)) return res.status(401).json({ error: 'Username/password salah' });
    res.json({ token: tok(u.id), username: u.username });
});

const mineOf = uid => db.prepare('SELECT id,name,cat FROM files WHERE uid=? ORDER BY id DESC').all(uid).map(f => ({
    key: 'u:' + f.id,
    title: f.name.replace(/\.[^.]+$/, ''),
    cat: f.cat || 'pustakaku',
    own: true,
    ext: (f.name.split('.').pop() || '').toLowerCase()
}));

app.get('/api/library', auth, (req, res) => {
    const fav = new Set(db.prepare('SELECT key FROM favs WHERE uid=?').all(req.uid).map(r => r.key));
    const prog = Object.fromEntries(db.prepare('SELECT key,page,total FROM progress WHERE uid=?').all(req.uid).map(r => [r.key, r]));
    res.json([...DEFAULT, ...mineOf(req.uid)].map(b => ({
        ...b,
        fav: fav.has(b.key),
        page: prog[b.key]?.page || 0,
        total: prog[b.key]?.total || 0
    })));
});

app.get('/api/cats', auth, (req, res) => res.json(db.prepare('SELECT name,icon FROM cats WHERE uid=?').all(req.uid)));

app.post('/api/cats', auth, (req, res) => {
    const n = String(req.body.name || '').trim().toLowerCase().slice(0, 24),
          i = String(req.body.icon || '📁').slice(0, 300);
    if (!n) return res.sendStatus(400);
    db.prepare('INSERT INTO cats VALUES(?,?,?) ON CONFLICT(uid,name) DO UPDATE SET icon=excluded.icon').run(req.uid, n, i);
    res.json({ ok: 1 });
});

function resolve(uid, key) {
    if (key.startsWith('d:')) {
        const p = path.resolve(PDF, key.slice(2));
        return p.startsWith(PDF + path.sep) && fs.existsSync(p) ? { p, name: path.basename(p) } : null;
    }
    const f = db.prepare('SELECT * FROM files WHERE id=? AND uid=?').get(key.slice(2), uid);
    return f ? { p: path.resolve('data/uploads', f.stored), name: f.name } : null;
}

app.get('/api/file', auth, (req, res) => {
    const f = resolve(req.uid, String(req.query.key || ''));
    if (!f) return res.sendStatus(404);
    if (req.query.dl) return res.download(f.p, f.name);
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(f.p).on('error', () => res.end()).pipe(res);
});

app.post('/api/upload', auth, up.array('files', 20), (req, res) => {
    const ins = db.prepare('INSERT INTO files(uid,name,stored,size,cat) VALUES(?,?,?,?,?)');
    const cat = String(req.body.cat || '').trim().toLowerCase().slice(0, 24) || 'pustakaku';
    for (const f of req.files) {
        const n = Buffer.from(f.originalname, 'latin1').toString('utf8');
        const r = ins.run(req.uid, n, f.filename, f.size, cat);
        if (/\.pdf$/i.test(n)) idx('u:' + r.lastInsertRowid, f.path);
    }
    res.json({ ok: 1 });
});

app.delete('/api/file', auth, (req, res) => {
    const k = String(req.query.key || '');
    if (!k.startsWith('u:')) return res.sendStatus(403);
    const f = db.prepare('SELECT * FROM files WHERE id=? AND uid=?').get(k.slice(2), req.uid);
    if (f) {
        fs.rmSync('data/uploads/' + f.stored, { force: true });
        db.prepare('DELETE FROM files WHERE id=?').run(f.id);
        delete INDEX[k];
    }
    db.prepare('DELETE FROM favs WHERE uid=? AND key=?').run(req.uid, k);
    db.prepare('DELETE FROM progress WHERE uid=? AND key=?').run(req.uid, k);
    res.json({ ok: 1 });
});

app.post('/api/fav', auth, (req, res) => {
    const k = req.body.key;
    const h = db.prepare('SELECT 1 FROM favs WHERE uid=? AND key=?').get(req.uid, k);
    h ? db.prepare('DELETE FROM favs WHERE uid=? AND key=?').run(req.uid, k)
      : db.prepare('INSERT INTO favs VALUES(?,?)').run(req.uid, k);
    res.json({ fav: !h });
});

app.post('/api/progress', auth, (req, res) => {
    const { key, title, page, total, dsecs, snip } = req.body, n = Date.now();
    db.prepare(`INSERT INTO progress(uid,key,title,page,total,ts,secs,snip) VALUES(?,?,?,?,?,?,?,?) 
        ON CONFLICT(uid,key) DO UPDATE SET page=excluded.page,total=excluded.total,title=excluded.title,
        ts=excluded.ts,secs=COALESCE(secs,0)+excluded.secs,snip=COALESCE(NULLIF(excluded.snip,''),snip)`)
      .run(req.uid, key, String(title).slice(0, 200), page | 0, total | 0, n, Math.max(0, Math.min(dsecs | 0, 3600)), String(snip || '').slice(0, 400));
    res.json({ ok: 1 });
});

app.get('/api/history', auth, (req, res) => res.json(db.prepare('SELECT key,title,page,total,ts,COALESCE(secs,0) secs FROM progress WHERE uid=? ORDER BY ts DESC LIMIT 50').all(req.uid)));

app.get('/api/search', auth, (req, res) => {
    const q = String(req.query.q || '').toLowerCase().trim();
    if (q.length < 2) return res.json({ r: [], ready: READY });
    const r = [];
    for (const b of [...DEFAULT, ...mineOf(req.uid)]) {
        const t = INDEX[b.key] || '', i = t.indexOf(q);
        if (b.title.toLowerCase().includes(q) || i >= 0) {
            r.push({ ...b, snip: i >= 0 ? '…' + t.slice(Math.max(0, i - 50), i + 90).trim() + '…' : '' });
        }
    }
    res.json({ r: r.slice(0, 60), ready: READY });
});

app.post('/api/share', auth, (req, res) => {
    const k = req.body.key;
    if (!resolve(req.uid, k)) return res.sendStatus(404);
    const old = db.prepare('SELECT token FROM shares WHERE uid=? AND key=?').get(req.uid, k);
    const t = old?.token || crypto.randomBytes(12).toString('hex');
    if (!old) db.prepare('INSERT INTO shares VALUES(?,?,?)').run(t, req.uid, k);
    res.json({ url: `${req.protocol}://${req.get('host')}/s/${t}` });
});

app.get('/s/:t', (req, res) => {
    const s = db.prepare('SELECT * FROM shares WHERE token=?').get(req.params.t);
    const f = s && resolve(s.uid, s.key);
    f ? res.download(f.p, f.name) : res.status(404).send('Link tidak valid');
});

async function askAI(system, content, max = 700) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY belum diisi di server');
    
    // Menggunakan model terbaru sesuai peringatan Google: gemini-3.8-flash
    const r = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.8-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            contents: [
                { role: 'user', parts: [{ text: `${system}\n\nKonteks/Pertanyaan:\n${content}` }] }
            ],
            generationConfig: { maxOutputTokens: max }
        })
    });
    
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'Gemini AI error');
    return j.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

app.post('/api/ai', auth, async (req, res) => {
    const { q, ctx } = req.body;
    if (!q) return res.sendStatus(400);
    try {
        res.json({
            a: await askAI(
                'Kamu asisten baca ebook. Jelaskan istilah/pertanyaan pengguna dengan bahasa Indonesia sederhana, singkat (maks 5 kalimat), berdasar konteks halaman bila relevan.',
                `Konteks halaman:\n${String(ctx || '').slice(0, 6000)}\n\nPertanyaan: ${String(q).slice(0, 500)}`
            )
        });
    } catch (e) {
        res.status(e.message.includes('belum diisi') ? 503 : 502).json({ error: e.message });
    }
});

app.get('/api/nudge', auth, async (req, res) => {
    const p = db.prepare('SELECT * FROM progress WHERE uid=? ORDER BY ts DESC LIMIT 1').get(req.uid);
    if (!p || Date.now() - p.ts < 36e5) return res.json(null);
    let msg;
    try {
        msg = await askAI(
            'Kamu pengirim notifikasi ajakan membaca. Tulis 1-2 kalimat bahasa Indonesia santai & memotivasi, diawali "Kamu udah coba belum", yang menyinggung sedikit isi terakhir yang dibaca user. Tanpa tanda kutip pembuka.',
            `Judul: ${p.title}\nHalaman terakhir: ${p.page}\nCuplikan teks terakhir dibaca: ${p.snip || '-'}`,
            150
        );
    } catch {
        msg = `Kamu udah coba belum lanjutin "${p.title}" (hal. ${p.page})? ${p.snip ? p.snip.slice(0, 80) + '… ' : ''}Sedikit demi sedikit pasti tamat, yuk lanjut baca!`;
    }
    res.json({ msg, key: p.key });
});

app.get('/api/yt', auth, async (req, res) => {
    const q = String(req.query.q || '').slice(0, 100);
    if (!q) return res.json([]);
    try {
        const r = await fetch('https://www.youtube.com/results?hl=id&sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q + (req.query.pod ? ' podcast' : '')), {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
                'accept-language': 'id,en;q=0.8',
                cookie: 'CONSENT=YES+1; SOCS=CAI'
            }
        });
        const m = (await r.text()).match(/var ytInitialData = (\{.*?\});<\/script>/s);
        if (!m) return res.status(502).json({ error: 'Pencarian YouTube gagal' });
        const out = [];
        (function w(o) {
            if (!o || typeof o !== 'object' || out.length >= 25) return;
            const v = o.videoRenderer;
            if (v && v.videoId) {
                out.push({
                    id: v.videoId,
                    title: v.title?.runs?.[0]?.text || '',
                    by: v.ownerText?.runs?.[0]?.text || '',
                    len: v.lengthText?.simpleText || ''
                });
                return;
            }
            for (const k in o) w(o[k]);
        })(JSON.parse(m[1]));
        res.json(out);
    } catch {
        res.status(502).json({ error: 'YouTube tidak terjangkau' });
    }
});

app.use(express.static('public'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('FileBox jalan di http://localhost:' + (process.env.PORT || 3000), '|', DEFAULT.length, 'ebook bawaan'));