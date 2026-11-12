// Nomor antrian konsumen servis: jendela nomor setelah registrasi, kirim WA, dan cetak tiket kecil (58 mm).
import { esc, modal, waButton, stamp } from './util.js';
import { APP_NAME } from './config.js';
import { actions } from './state.js';
import { fmtAntri } from './wo-common.js';
import { cekLink } from './nota.js';
import { qrSvg } from './qr.js';

let terakhir = null;
export const waAntri = w => `Halo ${w.nama || 'Bapak/Ibu'}, motor ${w.nopol} sudah terdaftar di ${APP_NAME}.\nNomor antrian Anda: *${fmtAntri(w.antrian)}*\nNomor ini akan dipanggil di layar saat motor selesai.\nPantau status servis: ${cekLink(w.nopol)}`;

export function showAntrian(w) {
  terakhir = { ...w };
  modal(`<div class="antri-modal">
      <div class="small muted">Nomor antrian</div>
      <div class="antri-big" id="antri-big">${fmtAntri(w.antrian)}</div>
      <div class="mono antri-np">${esc(w.nopol)}</div>
      <div class="small muted">${esc(w.tipe || '')}${w.tipe ? ' · ' : ''}${esc(w.no)}</div>
      ${w.dataKurang ? '<div class="note small">Data konsumen belum lengkap. Pilih motor ini di daftar lalu lengkapi sebelum diberi mekanik.</div>' : ''}
    </div>
    <div class="row" style="justify-content:flex-end">${w.hp ? waButton(w.hp, waAntri(w), 'Kirim nomor via WA') : ''}<button class="btn" type="button" data-act="antri-cetak">Cetak tiket</button><button class="btn pri" type="button" data-close="1" data-autofocus>Tutup</button></div>`, 'sm');
}

function tiketHTML(w, qr) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Antrian ${fmtAntri(w.antrian)}</title><style>
    @page{size:58mm auto;margin:3mm}
    body{margin:0;width:52mm;font-family:Arial,Helvetica,sans-serif;text-align:center;color:#000}
    .t{font-weight:700;font-size:11pt}.s{font-size:8pt}.n{font-size:40pt;font-weight:700;letter-spacing:2px;line-height:1;margin:2mm 0 1mm}
    .np{font-family:monospace;font-size:13pt;font-weight:700}hr{border:0;border-top:1px dashed #000;margin:2mm 0}
    svg{width:28mm;height:28mm;display:block;margin:1mm auto}
  </style></head><body>
    <div class="t">${esc(APP_NAME.toUpperCase())}</div><div class="s">Nomor antrian servis</div>
    <div class="n">${fmtAntri(w.antrian)}</div><div class="np">${esc(w.nopol)}</div>
    <div class="s">${esc(w.tipe || '')}</div><div class="s">${esc(stamp(new Date()))}</div>
    <hr><div class="s">Nomor dipanggil di layar saat motor selesai.</div>
    ${qr ? `<div class="s" style="margin-top:2mm">Pantau servis dari HP:</div>${qr}` : ''}
  </body></html>`;
}
export async function cetakTiket(w) {
  let qr = ''; try { qr = await qrSvg(cekLink(w.nopol)); } catch (e) { /* tiket tetap dicetak tanpa QR */ }
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(tiketHTML(w, qr)); f.contentDocument.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 2000); } }, 250);
}
actions['antri-cetak'] = () => terakhir && cetakTiket(terakhir);
