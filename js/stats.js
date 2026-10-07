// Perhitungan ringkasan penjualan (dipakai Beranda dan Laporan).
import { S } from './state.js';

export const trxIn = (from, to) => S.trx.filter(t => t.tgl.slice(0, 10) >= from && t.tgl.slice(0, 10) <= to);

export function sums(list) {
  let part = 0, jasa = 0, dis = 0, laba = 0, qty = 0;
  list.forEach(t => {
    t.items.forEach(x => { part += x.qty * x.harga; laba += x.qty * (x.harga - (x.beli || 0)); qty += x.qty; });
    t.jasa.forEach(j => jasa += j.harga);
    dis += t.diskon;
  });
  return { part, jasa, dis, laba: laba + jasa - dis, qty, total: part + jasa - dis, n: list.length };
}
