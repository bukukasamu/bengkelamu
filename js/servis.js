// Menu Servis Bengkel: work order motor, jasa + part, pembayaran.
import { $, esc, rp, stamp, clone, toast, modal, closeModal, errMsg } from './util.js';
import { S, st, part, JASA, MEKANIK, TIPE, STATUS, namaPetugas, views, refreshers, actions, changeHandlers, inputHandlers, fkeys, go, partPicker, pickedKode } from './state.js';
import { db, doc, runTransaction, updateDoc, serverTimestamp } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { showNota } from './nota.js';

const blankWo = () => ({ no: null, tgl: stamp(new Date()), nopol: '', nama: '', hp: '', tipe: '', km: '', keluhan: '', mekanik: '', jasa: [], parts: [], status: 'Antri' });
const woCalc = w => {
  const p = w.parts.reduce((a, x) => a + x.qty * (part(x.kode)?.jual || 0), 0);
  const j = w.jasa.reduce((a, n) => a + (JASA.find(x => x[0] === n) || [0, 0])[1], 0);
  return { p, j, total: p + j };
};

function renderWoList() {
  const el = $('#wo-list'); if (!el) return; const w = st.woDraft;
  el.innerHTML = [...S.wo].reverse().map(o => `<button class="wo" type="button" data-act="open-wo" data-no="${esc(o.no)}" aria-current="${o.no === w.no}"><span class="row spread"><span class="np">${esc(o.nopol)}</span><span class="pill ${STATUS[o.status]}">${o.status}</span></span><span>${esc(o.tipe)} · ${esc(o.nama || '–')}</span><span class="small muted">${esc(o.no)} · ${o.tgl.slice(5).replace('-', '/')} · ${esc(o.mekanik || 'belum ada mekanik')}</span></button>`).join('') || '<div class="empty">Belum ada work order.</div>';
}

function renderServis() {
  if (!st.woDraft) st.woDraft = blankWo();
  const w = st.woDraft, locked = w.status === 'Lunas', dis = locked ? 'disabled' : '';
  $('#view').innerHTML = `<div class="grid g-servis">
   <div class="panel"><div class="row spread"><h3>Work order</h3><button class="btn sm" data-act="wo-new" type="button">+ Motor masuk [F1]</button></div>
    <div class="wolist" id="wo-list"></div>
   </div>
   <div class="panel"><div class="row spread"><h2>${w.no ? esc(w.no) : 'Work order baru'}</h2>${w.no ? `<span class="pill ${STATUS[w.status]}">${w.status}</span>` : ''}</div>
    <h3>Pemilik &amp; kendaraan</h3>
    <div class="form">
     <label class="f" for="w-nopol">No. Polisi<input id="w-nopol" data-f="nopol" class="mono" placeholder="BL 1234 XX" value="${esc(w.nopol)}" ${dis}></label>
     <label class="f" for="w-nama">Nama pemilik<input id="w-nama" data-f="nama" value="${esc(w.nama)}" ${dis}></label>
     <label class="f" for="w-hp">No. HP<input id="w-hp" data-f="hp" inputmode="tel" value="${esc(w.hp)}" ${dis}></label>
     <label class="f" for="w-tipe">Tipe motor Yamaha<select id="w-tipe" data-f="tipe" ${dis}><option value="">Pilih tipe</option>${TIPE.map(t => `<option ${t === w.tipe ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
     <label class="f" for="w-km">Kilometer<input id="w-km" data-f="km" class="num" inputmode="numeric" placeholder="mis. 12.500" value="${esc(w.km)}" ${dis}></label>
     <label class="f" for="w-mek">Mekanik<select id="w-mek" data-f="mekanik" ${dis}><option value="">Belum ditentukan</option>${MEKANIK.map(m => `<option ${m === w.mekanik ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
     <label class="f wide" for="w-kel">Keluhan<textarea id="w-kel" data-f="keluhan" ${dis}>${esc(w.keluhan)}</textarea></label>
    </div>
    <h3>Jasa servis</h3>
    <div class="checks">${JASA.map(([n, h], i) => `<label for="w-j${i}"><input type="checkbox" id="w-j${i}" data-jasa="${n}" ${w.jasa.includes(n) ? 'checked' : ''} ${dis}>${n}<span class="hr">${h / 1000}rb</span></label>`).join('')}</div>
    <h3>Sparepart dipakai</h3>
    ${locked ? '' : S.parts.length ? `<div class="row">${partPicker('w-pcari', 'Cari part')}<input id="w-pq" type="number" min="1" value="1" aria-label="Jumlah" style="width:70px"><button class="btn" type="button" data-act="wo-addpart">Tambah</button></div>` : '<div class="small muted">Belum ada data part di Stok Part.</div>'}
    <div id="w-parts"></div>
    <div id="w-tot"></div>
    <div class="row" style="justify-content:flex-end">
     ${w.no && !locked ? `<label class="f" for="w-st" style="flex-direction:row;align-items:center;gap:6px">Status<select id="w-st" data-f="status" style="width:auto">${['Antri', 'Dikerjakan', 'Selesai'].map(s => `<option ${s === w.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
     ${locked ? `<button class="btn" type="button" data-act="wo-nota">Lihat nota</button>` : `<button class="btn" type="button" data-act="wo-save">Simpan WO [F2]</button><button class="btn pri" type="button" data-act="wo-pay">Selesai &amp; Bayar</button>`}
    </div>
   </div></div>`;
  renderWoList(); renderWoParts();
}

function renderWoParts() {
  const w = st.woDraft, locked = w.status === 'Lunas';
  $('#w-parts').innerHTML = w.parts.length ? `<div class="tw"><table><thead><tr><th>Part</th><th class="r">Qty</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>${w.parts.map((x, i) => { const p = part(x.kode) || { nama: x.kode + ' (dihapus)', jual: 0 }; return `<tr><td>${esc(p.nama)}<br><span class="small muted mono">${esc(x.kode)}</span></td><td class="r num">${x.qty}</td><td class="r num">${rp(p.jual * x.qty)}</td><td>${locked ? '' : `<button class="btn sm ghost" type="button" data-act="wo-rmpart" data-i="${i}" aria-label="Hapus">✕</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada part.</div>';
  const c = woCalc(w);
  $('#w-tot').innerHTML = `<div class="totals"><span class="muted">Sparepart</span><span class="num">${rp(c.p)}</span><span class="muted">Jasa</span><span class="num">${rp(c.j)}</span><span style="font-weight:600">Estimasi total</span><span class="big num">${rp(c.total)}</span></div>`;
}

async function woSave(silent) {
  if (st.saving) return false;
  const w = st.woDraft; w.nopol = w.nopol.trim().toUpperCase();
  if (!w.nopol) { toast('Isi nomor polisi dulu'); $('#w-nopol')?.focus(); return false; }
  if (!w.tipe) { toast('Pilih tipe motor'); $('#w-tipe')?.focus(); return false; }
  st.saving = true;
  try {
    if (!w.no) {
      w.no = await runTransaction(db, async tx => {
        const cs = await tx.get(counterRef());
        const { no, counter } = nextNumber(cs, 'WO');
        tx.set(counterRef(), counter);
        tx.set(doc(db, 'wo', no), { ...clone({ ...w, no }), dibuatOleh: namaPetugas() });
        return no;
      });
    } else {
      const { no, ...data } = clone(w);
      await updateDoc(doc(db, 'wo', no), data);
    }
    if (!silent) { toast('Work order ' + w.no + ' disimpan'); renderServis(); }
    return true;
  } catch (e) { toast(errMsg(e)); return false; } finally { st.saving = false; }
}

async function woPayModal() {
  if (!(await woSave(true))) return;
  const w = st.woDraft, c = woCalc(w);
  const kurang = w.parts.find(x => !part(x.kode) || part(x.kode).stok < x.qty);
  if (kurang) { toast('Stok ' + (part(kurang.kode)?.nama || kurang.kode) + ' tidak cukup'); renderServis(); return; }
  if (!c.total) { toast('Tambahkan jasa atau part dulu'); renderServis(); return; }
  renderServis();
  modal(`<h2>Pembayaran ${esc(w.no)}</h2><p class="small muted" style="margin:0">${esc(w.nopol)} · ${esc(w.tipe)} · ${esc(w.nama || 'Umum')}</p>
   <div class="totals"><span class="muted">Sparepart</span><span class="num">${rp(c.p)}</span><span class="muted">Jasa</span><span class="num">${rp(c.j)}</span></div>
   <div class="form"><label class="f" for="pay-dis">Diskon (Rp)<input id="pay-dis" type="number" min="0" step="1000" class="num" value="0"></label><label class="f" for="pay-bayar">Dibayar (Rp)<input id="pay-bayar" type="number" min="0" step="1000" class="num" data-autofocus value="${Math.ceil(c.total / 10000) * 10000}"></label></div>
   <div id="pay-tot"></div>
   <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="wo-confirm">Bayar &amp; Cetak Nota</button></div>`);
  const upd = () => { const d = +$('#pay-dis').value || 0, b = +$('#pay-bayar').value || 0, t = c.total - d; $('#pay-tot').innerHTML = `<div class="totals"><span style="font-weight:600">Total</span><span class="big num">${rp(t)}</span><span class="muted">Kembalian</span><span class="num" style="color:${b < t ? 'var(--bad)' : 'inherit'}">${b < t ? 'Kurang ' + rp(t - b) : rp(b - t)}</span></div>`; };
  $('#pay-dis').oninput = upd; $('#pay-bayar').oninput = upd; upd();
}

async function woConfirm() {
  if (st.saving) return;
  const w = st.woDraft, d = +$('#pay-dis').value || 0, b = +$('#pay-bayar').value || 0;
  st.saving = true;
  try {
    const t = await runTransaction(db, async tx => {
      const cs = await tx.get(counterRef());
      const woRef = doc(db, 'wo', w.no), ws = await tx.get(woRef);
      if (ws.data().status === 'Lunas') throw new Error('Work order ini sudah dibayar');
      const refs = w.parts.map(x => doc(db, 'parts', x.kode));
      const ps = await Promise.all(refs.map(r => tx.get(r)));
      const items = w.parts.map((x, i) => {
        if (!ps[i].exists()) throw new Error('Part ' + x.kode + ' sudah dihapus');
        const p = ps[i].data();
        if (p.stok < x.qty) throw new Error('Stok ' + p.nama + ' tinggal ' + p.stok);
        return { kode: p.kode, nama: p.nama, qty: x.qty, harga: p.jual, beli: p.beli || 0 };
      });
      const jasa = w.jasa.map(n => ({ nama: n, harga: JASA.find(x => x[0] === n)[1] }));
      const total = items.reduce((a, x) => a + x.qty * x.harga, 0) + jasa.reduce((a, x) => a + x.harga, 0) - d;
      if (b < total) throw new Error('Uang dibayar kurang dari total');
      const { no, counter } = nextNumber(cs, 'SV');
      const trx = { no, tgl: stamp(new Date()), jenis: 'SERVIS', pelanggan: w.nama || 'Umum', nopol: w.nopol, mekanik: w.mekanik, wo: w.no, items, jasa, diskon: d, total, bayar: b, kasir: namaPetugas() };
      tx.set(counterRef(), counter);
      items.forEach((x, i) => tx.update(refs[i], { stok: ps[i].data().stok - x.qty }));
      tx.set(doc(db, 'trx', no), { ...trx, dibuat: serverTimestamp() });
      tx.update(woRef, { status: 'Lunas', nota: no });
      return trx;
    });
    w.status = 'Lunas'; w.nota = t.no; st.lastNota = t;
    closeModal(); renderServis(); showNota(t);
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

views.servis = renderServis;
refreshers.servis = renderWoList;
fkeys.servis = { baru: 'wo-new', simpan: 'wo-save' };
Object.assign(actions, {
  'open-wo': el => { const o = S.wo.find(x => x.no === el.dataset.no); if (o) { st.woDraft = clone(o); go('servis'); } },
  'wo-new': () => { st.woDraft = blankWo(); renderServis(); $('#w-nopol').focus(); },
  'wo-addpart': () => {
    const k = pickedKode('w-pcari'), p = part(k);
    if (!p) { toast('Pilih part dari daftar yang muncul saat mengetik'); $('#w-pcari').focus(); return; }
    const q = Math.max(1, +$('#w-pq').value || 1), ex = st.woDraft.parts.find(x => x.kode === k), tot = (ex ? ex.qty : 0) + q;
    if (tot > p.stok) { toast('Stok ' + p.nama + ' tinggal ' + p.stok); return; }
    ex ? ex.qty = tot : st.woDraft.parts.push({ kode: k, qty: q });
    $('#w-pcari').value = ''; renderWoParts();
  },
  'wo-rmpart': el => { st.woDraft.parts.splice(+el.dataset.i, 1); renderWoParts(); },
  'wo-save': () => woSave(),
  'wo-pay': woPayModal,
  'wo-confirm': woConfirm,
  'wo-nota': () => { const w = st.woDraft; showNota(S.trx.find(t => t.no === w.nota) || (st.lastNota && st.lastNota.no === w.nota ? st.lastNota : null)); }
});
inputHandlers.push(e => { const t = e.target; if (t.dataset.f && st.woDraft && t.dataset.f !== 'status') st.woDraft[t.dataset.f] = t.value; });
changeHandlers.push(e => {
  const t = e.target, w = st.woDraft; if (!w) return;
  if (t.dataset.jasa) { const n = t.dataset.jasa; w.jasa = t.checked ? [...w.jasa, n] : w.jasa.filter(x => x !== n); renderWoParts(); }
  if (t.dataset.f === 'status') { w.status = t.value; woSave(); }
  if (t.id === 'w-nopol' && !w.no) {
    const np = t.value.trim().toUpperCase(); t.value = np; w.nopol = np;
    const prev = [...S.wo].reverse().find(o => o.nopol === np);
    if (prev) { Object.assign(w, { nama: w.nama || prev.nama, hp: w.hp || prev.hp, tipe: w.tipe || prev.tipe }); renderServis(); toast('Pelanggan lama: data ' + prev.nama + ' diisi otomatis'); }
  }
});
