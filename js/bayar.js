// Menu Pembayaran Servis (kasir): cek jasa, sparepart, biaya tambahan lain, diskon, terima pembayaran.
import { $, esc, rp, stamp, toast, errMsg } from './util.js';
import { S, st, views, refreshers, actions, inputHandlers, fkeys, namaPetugas } from './state.js';
import { db, doc, runTransaction, serverTimestamp } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { AKTIF, woCard, woHeader, woCalc, partsTable, normJasa, mekanikNama, findWo, jenisBadge } from './wo-common.js';
import { showNota } from './nota.js';

const ORDER = { Selesai: 0, Dikerjakan: 1, Antri: 2 };

function renderList() {
  const el = $('#bay-list'); if (!el) return;
  const l = [...S.wo].reverse().filter(w => AKTIF.includes(w.status)).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  el.innerHTML = l.map(o => woCard(o, st.bayarNo, 'bay-pick')).join('') || '<div class="empty">Tidak ada servis yang menunggu pembayaran.</div>';
}

function renderBayar() {
  $('#view').innerHTML = `<div class="grid g-servis">
   <div class="panel"><h3>Menunggu pembayaran</h3><p class="small muted" style="margin:0">Motor berstatus Selesai tampil paling atas.</p><div class="wolist" id="bay-list"></div></div>
   <div class="panel" id="bay-detail"><div class="empty">Pilih motor di sebelah kiri.</div></div>
  </div>`;
  renderList();
  if (st.bayarNo && findWo(st.bayarNo) && AKTIF.includes(findWo(st.bayarNo).status)) renderDetail(); else st.bayarNo = null;
}

const draftWo = () => ({ ...findWo(st.bayarNo), biaya: st.bayarDraft.biaya });

function renderDetail() {
  const w = draftWo(), c = woCalc(w), d = st.bayarDraft, ksg = w.jenisServis === 'KSG';
  const jasa = normJasa(w);
  $('#bay-detail').innerHTML = `<div class="row spread"><h2>${esc(w.no)}</h2>${jenisBadge(w)}</div>
    ${woHeader(w)}
    <h3>Jasa servis</h3>
    ${jasa.length ? `<div class="tw"><table><tbody>${jasa.map(j => `<tr><td>${esc(j.nama)}</td><td class="r num">${ksg ? `<s class="muted">${rp(j.harga)}</s> gratis` : rp(j.harga)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Tidak ada jasa.</div>'}
    ${ksg ? `<div class="note small">KSG ke-${esc(w.ksgKe || '?')}: jasa ${rp(c.klaim)} tidak ditagih ke konsumen, tercatat sebagai klaim ke main dealer.</div>` : ''}
    <h3>Order sparepart</h3>
    ${partsTable(w)}
    <div class="row spread"><h3>Biaya tambahan lain</h3><button class="btn sm" type="button" data-act="bay-addbiaya">+ Tambah biaya</button></div>
    ${d.biaya.length ? `<div class="tw"><table><thead><tr><th>Keterangan</th><th class="r">Jumlah (Rp)</th><th></th></tr></thead><tbody>${d.biaya.map((b, i) => `<tr><td><input class="inline-input" id="bi-k${i}" data-bi="${i}" data-bf="ket" value="${esc(b.ket)}" placeholder="mis. Cuci motor, las knalpot" aria-label="Keterangan biaya"></td><td><input class="inline-input num" id="bi-j${i}" data-bi="${i}" data-bf="jumlah" type="number" min="0" step="1000" value="${b.jumlah || ''}" aria-label="Jumlah biaya" style="text-align:right"></td><td><button class="btn sm ghost" type="button" data-act="bay-rmbiaya" data-i="${i}" aria-label="Hapus">✕</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Tidak ada biaya tambahan.</div>'}
    <div class="form"><label class="f" for="bay-dis">Diskon (Rp)<input id="bay-dis" type="number" min="0" step="1000" class="num" value="${d.diskon || ''}"></label><label class="f" for="bay-bayar">Dibayar (Rp)<input id="bay-bayar" type="number" min="0" step="1000" class="num" value="${d.bayar || ''}"></label></div>
    <div id="bay-tot"></div>
    <div class="row" style="justify-content:flex-end">${w.status === 'Selesai'
      ? '<button class="btn pri" type="button" data-act="bay-confirm">Terima pembayaran &amp; cetak nota [F2]</button>'
      : `<span class="small muted">Belum bisa dibayar: status masih ${esc(w.status)}. Menunggu mekanik menandai selesai.</span>`}</div>`;
  renderTot();
}

function renderTot() {
  const el = $('#bay-tot'); if (!el) return;
  const c = woCalc(draftWo()), d = st.bayarDraft, total = Math.max(0, c.total - (d.diskon || 0)), kb = (d.bayar || 0) - total;
  el.innerHTML = `<div class="totals"><span class="muted">Sparepart</span><span class="num">${rp(c.parts)}</span><span class="muted">Jasa ditagih</span><span class="num">${rp(c.jasaTagih)}</span><span class="muted">Biaya lain</span><span class="num">${rp(c.biaya)}</span><span class="muted">Diskon</span><span class="num">${d.diskon ? '−' + rp(d.diskon) : rp(0)}</span><span style="font-weight:600">Total bayar</span><span class="big num">${rp(total)}</span><span class="muted">Kembalian</span><span class="num" style="color:${d.bayar && kb < 0 ? 'var(--bad)' : 'inherit'}">${d.bayar ? (kb < 0 ? 'Kurang ' + rp(-kb) : rp(kb)) : '–'}</span></div>`;
}

async function confirm() {
  if (st.saving || !st.bayarNo) return;
  const w = draftWo(), d = st.bayarDraft;
  if (w.status !== 'Selesai') { toast('Motor belum ditandai selesai oleh mekanik'); return; }
  const biaya = d.biaya.filter(b => b.ket.trim() || b.jumlah).map(b => ({ ket: b.ket.trim() || 'Biaya lain', jumlah: +b.jumlah || 0 }));
  st.saving = true;
  try {
    const t = await runTransaction(db, async tx => {
      const cs = await tx.get(counterRef());
      const woRef = doc(db, 'wo', w.no), ws = await tx.get(woRef);
      if (ws.data().status === 'Lunas') throw new Error('Work order ini sudah dibayar');
      const parts = ws.data().parts || [];
      const refs = parts.map(x => doc(db, 'parts', x.kode));
      const ps = await Promise.all(refs.map(r => tx.get(r)));
      const items = parts.map((x, i) => {
        if (!ps[i].exists()) throw new Error('Part ' + x.kode + ' tidak ada di master');
        const p = ps[i].data();
        if (p.stok < x.qty) throw new Error('Stok ' + p.nama + ' tinggal ' + p.stok);
        return { kode: p.kode, nama: p.nama, qty: x.qty, harga: p.jual, beli: p.beli || 0 };
      });
      const ksg = w.jenisServis === 'KSG', jasaAsli = normJasa(ws.data());
      const jasa = jasaAsli.map(j => ({ nama: j.nama, harga: ksg ? 0 : +j.harga || 0 }));
      const jasaKlaim = ksg ? jasaAsli.reduce((a, j) => a + (+j.harga || 0), 0) : 0;
      const sub = items.reduce((a, x) => a + x.qty * x.harga, 0) + jasa.reduce((a, j) => a + j.harga, 0) + biaya.reduce((a, b) => a + b.jumlah, 0);
      const diskon = Math.min(d.diskon || 0, sub), total = sub - diskon, bayar = d.bayar || 0;
      if (bayar < total) throw new Error('Uang dibayar kurang dari total');
      const { no, counter } = nextNumber(cs, 'SV');
      const trx = { no, tgl: stamp(new Date()), jenis: 'SERVIS', pelanggan: w.nama || 'Umum', nopol: w.nopol, mekanik: mekanikNama(w), mekanikId: w.mekanikId || '', wo: w.no,
        jenisServis: w.jenisServis || 'Reguler', ksgKe: w.ksgKe || '', noKartu: w.noKartu || '', items, jasa, jasaKlaim, biaya, diskon, total, bayar, kasir: namaPetugas() };
      tx.set(counterRef(), counter);
      items.forEach((x, i) => tx.update(refs[i], { stok: ps[i].data().stok - x.qty }));
      tx.set(doc(db, 'trx', no), { ...trx, dibuat: serverTimestamp() });
      tx.update(woRef, { status: 'Lunas', nota: no, biaya });
      return trx;
    });
    st.lastNota = t; st.bayarNo = null; st.bayarDraft = null;
    renderBayar(); showNota(t);
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

views.bayar = renderBayar;
refreshers.bayar = () => { renderList(); if (st.bayarNo && !AKTIF.includes(findWo(st.bayarNo)?.status)) renderBayar(); };
fkeys.bayar = { simpan: 'bay-confirm' };
Object.assign(actions, {
  'bay-pick': el => {
    const o = findWo(el.dataset.no); if (!o) return;
    st.bayarNo = o.no; st.bayarDraft = { biaya: (o.biaya || []).map(b => ({ ...b })), diskon: 0, bayar: 0 };
    renderList(); renderDetail();
  },
  'bay-addbiaya': () => { st.bayarDraft.biaya.push({ ket: '', jumlah: 0 }); renderDetail(); $('#bi-k' + (st.bayarDraft.biaya.length - 1))?.focus(); },
  'bay-rmbiaya': el => { st.bayarDraft.biaya.splice(+el.dataset.i, 1); renderDetail(); },
  'bay-confirm': confirm
});
inputHandlers.push(e => {
  const t = e.target, d = st.bayarDraft; if (!d) return;
  if (t.dataset.bi != null) { const b = d.biaya[+t.dataset.bi]; b[t.dataset.bf] = t.dataset.bf === 'jumlah' ? (+t.value || 0) : t.value; renderTot(); }
  if (t.id === 'bay-dis') { d.diskon = +t.value || 0; renderTot(); }
  if (t.id === 'bay-bayar') { d.bayar = +t.value || 0; renderTot(); }
});
