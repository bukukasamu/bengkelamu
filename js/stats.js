// Perhitungan ringkasan penjualan (dipakai Beranda, Laporan, Performa Mekanik).
import { S } from './state.js';

export const trxIn = (from, to, list = S.trx) => list.filter(t => t.tgl.slice(0, 10) >= from && t.tgl.slice(0, 10) <= to);

export function sums(list) {
  let part = 0, jasa = 0, biaya = 0, dis = 0, laba = 0, qty = 0, klaim = 0, ksg = 0;
  list.forEach(t => {
    t.items.forEach(x => { part += x.qty * x.harga; laba += x.qty * (x.harga - (x.beli || 0)); qty += x.qty; });
    (t.jasa || []).forEach(j => jasa += j.harga);
    (t.biaya || []).forEach(b => biaya += b.jumlah);
    klaim += t.jasaKlaim || 0; if (t.jenisServis === 'KSG') ksg++;
    dis += t.diskon || 0;
  });
  // jasa = yang ditagih ke konsumen; klaim = jasa KSG yang ditagihkan ke main dealer
  return { part, jasa, biaya, klaim, ksg, dis, laba: laba + jasa + biaya + klaim - dis, qty, total: part + jasa + biaya - dis, n: list.length };
}
