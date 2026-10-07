// Membaca baris Excel menjadi data part. Tidak bergantung pada Firebase, jadi bisa diuji terpisah.
// Mengenali dua format:
//  1. Ekspor DMS Yamaha  : Parts | (nama) | Superseding Parts | ... | On Hand Qty | ... | Average Cost | ... | Retail Price | Category | Product Category | ABC Category
//  2. Template toko      : kode | nama | kategori | cocok | rak | harga_beli | harga_jual | stok | stok_min

// Urutan alias = prioritas (mis. stok memakai "On Hand Qty" sebelum "Total Stock Qty").
export const ALIASES = {
  kode: ['kode', 'kode part', 'parts', 'part no', 'part number', 'no part', 'nomor part', 'partno', 'part_no'],
  nama: ['nama', 'nama part', 'nama barang', 'part name', 'description', 'deskripsi'],
  kategori: ['kategori', 'product category', 'category'],
  cocok: ['cocok', 'cocok untuk', 'cocok_untuk', 'tipe motor', 'model'],
  rak: ['rak', 'lokasi', 'location', 'bin'],
  beli: ['harga_beli', 'harga beli', 'average cost', 'hpp', 'cost', 'last receipt cost'],
  jual: ['harga_jual', 'harga jual', 'retail price', 'het', 'price', 'harga'],
  stok: ['stok', 'on hand qty', 'stock', 'qty', 'jumlah', 'total stock qty'],
  min: ['stok_min', 'stok minimum', 'min stock', 'minimum', 'min'],
  pengganti: ['pengganti', 'part pengganti', 'superseding parts'],
  abc: ['abc', 'abc category']
};
export const LABEL = { kode: 'Kode', nama: 'Nama', kategori: 'Kategori', cocok: 'Cocok untuk', rak: 'Rak', beli: 'Harga beli', jual: 'Harga jual', stok: 'Stok', min: 'Stok minimum', pengganti: 'Pengganti', abc: 'ABC' };
const NUM_FIELDS = ['beli', 'jual', 'stok', 'min'];
export const KODE_RE = /^[A-Z0-9._-]+$/;

const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export function detectColumns(header) {
  const h = header.map(norm), cols = {}, used = new Set();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const a of aliases) {
      const i = h.indexOf(a);
      if (i >= 0 && !used.has(i)) { cols[field] = i; used.add(i); break; }
    }
  }
  // Ekspor DMS: kolom nama tidak punya judul, letaknya tepat setelah kolom kode.
  if (cols.nama == null && cols.kode != null && !h[cols.kode + 1]) cols.nama = cols.kode + 1;
  return cols;
}

export function parseNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).replace(/rp/i, '').replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');   // 1.250.000 atau 1.250,50
  else s = s.replace(/,/g, '.');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

// rows = array of array (baris pertama yang berisi judul kolom kode dianggap header)
export function parseSheet(rows) {
  let hi = rows.slice(0, 15).findIndex(r => r && detectColumns(r).kode != null);
  if (hi < 0) return { error: 'Kolom kode part tidak ditemukan. Judul kolom harus "kode" (template) atau "Parts" (ekspor DMS Yamaha).' };
  const cols = detectColumns(rows[hi]);
  const byKode = new Map(), skipped = [];
  let dup = 0;
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const raw = row[cols.kode];
    if (raw == null || String(raw).trim() === '') continue;            // baris kosong / baris total
    const kode = String(raw).trim().toUpperCase().replace(/\s+/g, '');
    if (!KODE_RE.test(kode)) { skipped.push({ baris: r + 1, kode, alasan: 'kode berisi karakter tidak valid' }); continue; }
    const item = { kode };
    for (const f of Object.keys(cols)) {
      if (f === 'kode') continue;
      const v = row[cols[f]];
      if (NUM_FIELDS.includes(f)) item[f] = Math.max(0, Math.round(parseNum(v)));
      else item[f] = v == null ? '' : String(v).trim();
    }
    if (cols.nama != null && !item.nama) { skipped.push({ baris: r + 1, kode, alasan: 'nama part kosong' }); continue; }
    if (byKode.has(kode)) dup++;
    byKode.set(kode, item);
  }
  return { headerRow: hi + 1, cols, items: [...byKode.values()], skipped, dup };
}

// Stok minimum awal untuk part baru dari kategori ABC DMS (A = paling laku).
export const minFromAbc = abc => ({ A: 2, B: 1 }[String(abc || '').toUpperCase()] || 0);

// Bandingkan dengan data yang sudah ada -> daftar tulis ke Firestore.
// mode 'all' = tambah baru + perbarui yang ada; 'new' = hanya tambah part baru.
export function planImport(items, cols, existingMap, mode) {
  const baru = [], ubah = [], sama = [], tanpaNama = [];
  for (const it of items) {
    const ex = existingMap.get(it.kode);
    if (!ex) {
      if (!it.nama) { tanpaNama.push(it.kode); continue; }
      baru.push({ kode: it.kode, nama: it.nama, kategori: it.kategori || '', cocok: it.cocok || '', rak: it.rak || '', beli: it.beli || 0, jual: it.jual || 0, stok: it.stok || 0, min: cols.min != null ? it.min : minFromAbc(it.abc), ...(it.pengganti ? { pengganti: it.pengganti } : {}), ...(it.abc ? { abc: it.abc } : {}) });
    } else if (mode === 'all') {
      const patch = {};
      for (const [k, v] of Object.entries(it)) if (k !== 'kode' && ex[k] !== v && !(v === '' && ex[k] == null)) patch[k] = v;
      Object.keys(patch).length ? ubah.push({ kode: it.kode, patch }) : sama.push(it.kode);
    } else sama.push(it.kode);
  }
  return { baru, ubah, sama, tanpaNama };
}
