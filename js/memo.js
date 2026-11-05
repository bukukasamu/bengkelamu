// 5.19.0 — Penyimpanan sementara di memori (per sesi) untuk data yang sering dibuka ulang.
// Tujuannya: membuka menu yang sama untuk kedua kalinya terasa instan, tanpa menunggu internet lagi.
// - memo(kunci, umurMs, fn): hasil fn disimpan selama umurMs; permintaan bersamaan memakai janji (promise) yang sama.
// - lupakan(awalan): hapus simpanan yang kuncinya diawali teks tertentu (dipanggil setelah data berubah).
// Data yang dipakai untuk menyimpan/menghitung ulang di server tetap dibaca langsung, tidak lewat memo.
const simpan = new Map();

export function memo(kunci, umurMs, fn, { paksa = false } = {}) {
  const kini = Date.now(), ada = simpan.get(kunci);
  if (!paksa && ada && kini - ada.t < umurMs) return ada.p;
  const p = Promise.resolve().then(fn);
  simpan.set(kunci, { t: kini, p });
  // Gagal tidak disimpan: percobaan berikutnya langsung meminta ulang
  p.catch(() => { if (simpan.get(kunci)?.p === p) simpan.delete(kunci); });
  return p;
}
export function lupakan(awalan = '') {
  [...simpan.keys()].forEach(k => { if (!awalan || k.startsWith(awalan)) simpan.delete(k); });
}
