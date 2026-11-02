// Perhitungan ringkasan penjualan (dipakai Beranda, Laporan, Performa Mekanik).
import { S } from './state.js';

export const trxIn = (from, to, list = S.trx) => list.filter(t => t.tgl.slice(0, 10) >= from && t.tgl.slice(0, 10) <= to);

export function sums(list) {
  let part = 0, jasa = 0, biaya = 0, dis = 0, laba = 0, qty = 0, klaim = 0, ksg = 0, cash = 0, transfer = 0;
  const rek = {};
  list.forEach(t => {
    const kembali = t.retur?.status === 'disetujui' ? (t.retur.items || []).reduce((m, x) => (m[x.kode] = (m[x.kode] || 0) + (+x.qty || 0), m), {}) : {};
    t.items.forEach(x => { const q = Math.max(0, (+x.qty || 0) - (kembali[x.kode] || 0)); part += q * x.harga; laba += q * (x.harga - (x.beli || 0)); qty += q; });
    (t.jasa || []).forEach(j => jasa += j.harga);
    (t.biaya || []).forEach(b => biaya += b.jumlah);
    klaim += t.jasaKlaim || 0; if (t.jenisServis === 'KSG') ksg++;
    dis += t.diskon || 0;
    // Uang masuk: cash bersih (setelah kembalian) dan transfer per rekening. Nota lama (sebelum v2.1) dihitung cash.
    const refund = t.retur?.status === 'disetujui' ? (t.retur.refundTotal || 0) : 0, refundCash = t.retur?.status === 'disetujui' ? ((t.retur.refundCash || 0)) : 0, refundTransfer = t.retur?.status === 'disetujui' ? ((t.retur.refundTransfer || 0)) : 0;
    if (t.cash == null) cash += t.total - refund;
    else { cash += (t.cash || 0) - (t.kembali || 0) - refundCash; transfer += (t.transfer || 0) - refundTransfer; if (t.transfer) { const k = t.rekeningId || '?'; rek[k] = rek[k] || { label: t.rekening || 'Rekening', total: 0, n: 0 }; rek[k].total += Math.max(0, (t.transfer || 0) - refundTransfer); rek[k].n++; } }
  });
  // jasa = yang ditagih ke konsumen; klaim = jasa KSG yang ditagihkan ke main dealer
  return { part, jasa, biaya, klaim, ksg, dis, cash, transfer, rek, laba: laba + jasa + biaya + klaim - dis - (list.reduce((a, t) => a + (t.retur?.status === 'disetujui' ? (t.retur.refundTotal || 0) : 0), 0)), qty, total: part + jasa + biaya - dis - list.reduce((a, t) => a + (t.retur?.status === 'disetujui' ? (t.retur.refundTotal || 0) : 0), 0), n: list.length }; 
}
