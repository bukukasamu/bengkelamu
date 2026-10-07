// Fungsi bersama untuk work order (WO) servis: hitung biaya, tampilan ringkas, simpan.
import { esc, rp, clone } from './util.js';
import { S, part, mekanikById, namaPetugas } from './state.js';
import { db, doc, runTransaction, updateDoc } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';

// Antri = belum ada mekanik · Dikerjakan = mekanik sedang mengerjakan (mekanik sibuk)
// Ditunda = lanjut lama, mis. menunggu part (mekanik bebas lagi) · Selesai = menunggu bayar · Lunas = sudah dibayar
export const STATUS = { Antri: 'p-warn', Dikerjakan: 'p-info', Ditunda: 'p-bad', Selesai: 'p-good', Lunas: 'p-good' };
export const statusPill = s => `<span class="pill ${STATUS[s] || 'p-info'}">${esc(s)}</span>`;
export const AKTIF = ['Antri', 'Dikerjakan', 'Ditunda', 'Selesai'];

// Data lama menyimpan jasa sebagai nama saja; ubah ke {nama, harga}
export const normJasa = w => (w.jasa || []).map(j => typeof j === 'string' ? { nama: j, harga: S.jasa.find(x => x.nama === j)?.harga || 0 } : j);

export const jenisBadge = w => w.jenisServis === 'KSG' ? `<span class="badge b-ksg">KSG${w.ksgKe ? ' ke-' + w.ksgKe : ''}</span>`
  : w.jenisServis === 'KSB' ? '<span class="badge b-ksb">KSB</span>' : '<span class="badge b-reg">Reguler</span>';
export const jenisText = w => w.jenisServis === 'KSG' ? 'KSG' + (w.ksgKe ? ' ke-' + w.ksgKe : '') : w.jenisServis === 'KSB' ? 'KSB' : 'Reguler';

// Tarif klaim KSG dari main dealer: Master Data → Tarif KSG (per tipe motor, KSG ke-1..4)
export const tarifKsg = w => +(S.settings.ksgTarif?.[w.tipe]?.[(+w.ksgKe || 0) - 1] || 0);

// KSG: jasa tidak ditagih ke konsumen; nilai klaim = tarif main dealer. Sparepart & biaya tambahan tetap ditagih.
export function woCalc(w) {
  const parts = (w.parts || []).reduce((a, x) => a + x.qty * (part(x.kode)?.jual || 0), 0);
  const jasa = normJasa(w).reduce((a, j) => a + (+j.harga || 0), 0);
  const biaya = (w.biaya || []).reduce((a, b) => a + (+b.jumlah || 0), 0);
  const ksg = w.jenisServis === 'KSG';
  const jasaTagih = ksg ? 0 : jasa;
  return { parts, jasa, jasaTagih, klaim: ksg ? tarifKsg(w) : 0, biaya, total: parts + jasaTagih + biaya };
}

// Part yang sudah diorder untuk servis yang belum dibayar (stok baru dipotong saat bayar)
export function dipesan(kode, kecualiNo) {
  return S.wo.filter(w => AKTIF.includes(w.status) && w.no !== kecualiNo).reduce((a, w) => a + (w.parts || []).filter(x => x.kode === kode).reduce((b, x) => b + x.qty, 0), 0);
}

export const mekanikNama = w => (w.mekanikId && mekanikById(w.mekanikId)?.nama) || w.mekanik || '';

// Mekanik hanya mengerjakan 1 motor. Sibuk = punya WO berstatus Dikerjakan.
// Mekanik bebas lagi setelah kasir menandai motornya Selesai atau Ditunda (lanjut lama).
export function sibukMap() {
  const m = {};
  S.wo.filter(w => w.status === 'Dikerjakan' && (w.mekanikId || w.mekanik)).forEach(w => { m[w.mekanikId || w.mekanik] = w; });
  return m;
}
export const sibukOleh = (mek, kecualiNo) => { const w = sibukMap()[mek.id] || sibukMap()[mek.nama]; return w && w.no !== kecualiNo ? w : null; };

export function woCard(o, current, act = 'pick-wo') {
  return `<button class="wo" type="button" data-act="${act}" data-no="${esc(o.no)}" aria-current="${o.no === current}">
    <span class="row spread"><span class="np">${esc(o.nopol)}</span>${statusPill(o.status)}</span>
    <span>${esc(o.tipe)} · ${esc(o.nama || '–')}</span>
    <span class="row spread small muted"><span>${esc(o.no)} · ${o.tgl.slice(5).replace('-', '/')} · ${esc(mekanikNama(o) || 'belum ada mekanik')}</span>${jenisBadge(o)}</span>
  </button>`;
}

export function woHeader(w) {
  return `<div class="note"><div class="row spread"><b class="mono">${esc(w.nopol)}</b><span class="row">${jenisBadge(w)}${statusPill(w.status)}</span></div>
    <div>${esc(w.tipe)}${w.km ? ' · ' + esc(w.km) + ' km' : ''} · ${esc(w.nama || 'Umum')}${w.hp ? ' · ' + esc(w.hp) : ''}</div>
    <div class="small muted">Mekanik: ${esc(mekanikNama(w) || 'belum ditentukan')}${w.noKartu ? ' · No. kartu ' + esc(w.noKartu) : ''}</div>
    ${w.keluhan ? `<div class="small" style="margin-top:4px"><b>Keluhan:</b> ${esc(w.keluhan)}</div>` : ''}
    ${w.catatanPart ? `<div class="small"><b>Permintaan mekanik:</b> ${esc(w.catatanPart)}</div>` : ''}</div>`;
}

export function partsTable(w, removeAct) {
  if (!(w.parts || []).length) return '<div class="small muted">Belum ada order sparepart.</div>';
  return `<div class="tw"><table><thead><tr><th>Part</th><th class="r">Qty</th><th class="r">Stok</th><th class="r">Jumlah</th>${removeAct ? '<th></th>' : ''}</tr></thead><tbody>${w.parts.map((x, i) => {
    const p = part(x.kode) || { nama: x.kode + ' (tidak ada di master)', jual: 0, stok: 0 };
    return `<tr><td>${esc(p.nama)}<br><span class="small muted mono">${esc(x.kode)}</span></td><td class="r num">${x.qty}</td><td class="r">${p.stok < x.qty ? `<span class="pill p-bad">${p.stok}</span>` : `<span class="num">${p.stok}</span>`}</td><td class="r num">${rp(p.jual * x.qty)}</td>${removeAct ? `<td><button class="btn sm ghost" type="button" data-act="${removeAct}" data-i="${i}" aria-label="Hapus">✕</button></td>` : ''}</tr>`;
  }).join('')}</tbody></table></div>`;
}

// Simpan WO baru (nomor otomatis) atau perbarui WO yang sudah ada.
export async function saveWo(w) {
  if (!w.no) {
    return await runTransaction(db, async tx => {
      const cs = await tx.get(counterRef());
      const { no, counter } = nextNumber(cs, 'WO');
      tx.set(counterRef(), counter);
      tx.set(doc(db, 'wo', no), { ...clone({ ...w, no }), dibuatOleh: namaPetugas() });
      return no;
    });
  }
  const { no, ...data } = clone(w);
  await updateDoc(doc(db, 'wo', no), data);
  return no;
}
export const updateWo = (no, patch) => updateDoc(doc(db, 'wo', no), clone(patch));
export const findWo = no => S.wo.find(x => x.no === no);
