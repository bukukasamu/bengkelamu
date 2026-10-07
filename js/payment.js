// Pembayaran cash, transfer, atau campur. Rekening tujuan diambil dari Master Data → Rekening.
// Kembalian hanya dari uang cash, jadi nominal transfer tidak boleh melebihi total.
import { $, esc, rp } from './util.js';
import { S, actions, inputHandlers, changeHandlers } from './state.js';

export const emptyPay = () => ({ cash: 0, transfer: 0, rekeningId: '', ref: '' });
export const rekeningAktif = () => (S.settings.rekening || []).filter(r => r.aktif !== false);
export const rekLabel = r => r ? `${r.bank} ${r.noRek}${r.atasNama ? ' a.n. ' + r.atasNama : ''}` : '';

const ctxs = {};   // ctx -> { get: () => draftPay, total: () => number, onChange: fn }
export const registerPay = (ctx, cfg) => { ctxs[ctx] = cfg; };

export function payStatus(p, total) {
  const cash = +p.cash || 0, transfer = +p.transfer || 0, paid = cash + transfer;
  let err = '';
  if (transfer > total) err = 'Transfer melebihi total. Kembalian hanya bisa dari uang cash.';
  else if (transfer > 0 && !p.rekeningId) err = 'Pilih rekening tujuan transfer.';
  else if (paid < total) err = 'Kurang ' + rp(total - paid);
  return { cash, transfer, paid, kembali: Math.max(0, paid - total), err };
}

export function payRecord(p, total) {
  const s = payStatus(p, total), r = rekeningAktif().find(x => x.id === p.rekeningId) || (S.settings.rekening || []).find(x => x.id === p.rekeningId);
  return {
    bayar: s.paid, cash: s.cash, transfer: s.transfer, kembali: s.kembali,
    metode: s.cash && s.transfer ? 'Campur' : s.transfer ? 'Transfer' : 'Cash',
    ...(s.transfer ? { rekeningId: p.rekeningId, rekening: rekLabel(r), refTransfer: (p.ref || '').trim() } : {})
  };
}

export function payFields(ctx, p) {
  const rek = rekeningAktif();
  return `<div class="pay">
    <div class="form">
     <label class="f" for="${ctx}-cash">Cash (Rp)<input id="${ctx}-cash" data-pay="cash" data-pctx="${ctx}" type="number" min="0" step="1000" class="num" value="${p.cash || ''}"></label>
     <label class="f" for="${ctx}-tf">Transfer (Rp)<input id="${ctx}-tf" data-pay="transfer" data-pctx="${ctx}" type="number" min="0" step="1000" class="num" value="${p.transfer || ''}" ${rek.length ? '' : 'disabled title="Belum ada rekening di Master Data"'}></label>
     ${rek.length ? `<label class="f" for="${ctx}-rek">Rekening tujuan<select id="${ctx}-rek" data-pay="rekeningId" data-pctx="${ctx}"><option value="">Pilih rekening</option>${rek.map(r => `<option value="${esc(r.id)}" ${r.id === p.rekeningId ? 'selected' : ''}>${esc(rekLabel(r))}</option>`).join('')}</select></label>
     <label class="f" for="${ctx}-ref">No. referensi transfer<input id="${ctx}-ref" data-pay="ref" data-pctx="${ctx}" value="${esc(p.ref || '')}" placeholder="opsional"></label>` : ''}
    </div>
    <div class="row"><button class="btn sm" type="button" data-act="pay-pas" data-pctx="${ctx}" data-m="cash">Cash uang pas</button>${rek.length ? `<button class="btn sm" type="button" data-act="pay-pas" data-pctx="${ctx}" data-m="transfer">Transfer semua</button>` : '<span class="small muted">Transfer belum bisa: tambahkan rekening di Master Data → Rekening.</span>'}</div>
  </div>`;
}

export function payTotals(p, total) {
  const s = payStatus(p, total);
  return `<span class="muted">Dibayar</span><span class="num">${s.paid ? rp(s.paid) + (s.cash && s.transfer ? ` <span class="small muted">(cash ${rp(s.cash)} + transfer ${rp(s.transfer)})</span>` : '') : '–'}</span>
    <span class="muted">Kembalian</span><span class="num" style="color:${s.paid && s.err ? 'var(--bad)' : 'inherit'}">${!s.paid ? '–' : s.err ? esc(s.err) : rp(s.kembali)}</span>`;
}

function update(ctx, field, value) {
  const c = ctxs[ctx]; if (!c) return;
  const p = c.get(); if (!p) return;
  p[field] = field === 'cash' || field === 'transfer' ? Math.max(0, +value || 0) : value;
  c.onChange();
}
inputHandlers.push(e => { const t = e.target; if (t.dataset.pay && t.tagName === 'INPUT') update(t.dataset.pctx, t.dataset.pay, t.value); });
changeHandlers.push(e => { const t = e.target; if (t.dataset.pay && t.tagName === 'SELECT') update(t.dataset.pctx, t.dataset.pay, t.value); });
actions['pay-pas'] = el => {
  const ctx = el.dataset.pctx, c = ctxs[ctx]; if (!c) return;
  const p = c.get(), total = c.total();
  if (el.dataset.m === 'cash') { p.transfer = 0; p.cash = total; } else { p.cash = 0; p.transfer = total; if (!p.rekeningId && rekeningAktif().length === 1) p.rekeningId = rekeningAktif()[0].id; }
  ['cash', 'tf'].forEach(k => { const i = $(`#${ctx}-${k}`); if (i) i.value = (k === 'cash' ? p.cash : p.transfer) || ''; });
  const rs = $(`#${ctx}-rek`); if (rs) rs.value = p.rekeningId || '';
  c.onChange();
};
