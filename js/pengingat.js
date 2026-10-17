// Menu Pengingat Servis: kendaraan yang jadwal ganti olinya sudah dekat / lewat.
// Petugas mengingatkan konsumen lewat WhatsApp (1 klik, pesan sudah terisi), mencatat bila konsumen sudah ganti
// oli di tempat lain, menunda pengingat, atau menghentikannya (motor dijual/pindah kota).
// Jadwal dihitung otomatis saat kasir membayar servis yang berisi oli mesin (lihat km-oli.js).
import { $, esc, dkey, stamp, toast, errMsg, waLink, konfirmasi } from './util.js';
import { S, st, views, refreshers, actions, isRole, namaPetugas } from './state.js';
import { db, doc, collection, query, where, getDocs, setDoc, writeBatch } from './firebase.js';
import { APP_NAME } from './config.js';
import { cekLink } from './nota.js';
import { namaCabang, multiCabang, CABANG_UTAMA } from './cabang.js';
import { mintaPassword } from './otorisasi.js';
import { loaderHTML } from './brand.js';
import { aturanOli, statusOli, teksJadwal, tglPendek, fmtKm, angkaKm, catatOliLuar, adaGantiOli, jadwalOli, oliKePantau, oliLengkap } from './km-oli.js';
import { nopolKey } from './cari-kendaraan.js';
import { sah } from './data-trx.js';

const PG = { tab: 'perlu', data: null, muat: false, jangka: 14 };
const hariIni = () => dkey(new Date());
const tambahHari = n => { const d = new Date(); d.setDate(d.getDate() + n); return dkey(d); };

async function muat() {
  PG.muat = true; render();
  try {
    // Jadwal ≤ 14 hari ke depan (termasuk yang sudah lewat). Kunci cabang: karyawan hanya kendaraan yang servis oli di cabangnya.
    const s = await getDocs(query(collection(db, 'kendaraan'), where('oli.tglBerikut', '<=', tambahHari(PG.jangka))));
    PG.data = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(k => !k.pindahKe && (isRole('admin') || (k.oli?.cabang || CABANG_UTAMA) === st.cabang))
      .sort((a, b) => a.oli.tglBerikut.localeCompare(b.oli.tglBerikut));
  } catch (e) { PG.data = []; toast('Gagal memuat pengingat: ' + errMsg(e)); }
  PG.muat = false; render();
}

const kategori = k => {
  const p = k.pengingat || {};
  if (p.stop) return 'stop';
  if (p.tundaSampai && p.tundaSampai > hariIni()) return 'tunda';
  if (p.dihubungi && hariAntara(p.dihubungi) < 7) return 'dihubungi';   // sudah dihubungi dalam 7 hari terakhir
  return 'perlu';
};
const hariAntara = t => Math.round((new Date(hariIni()) - new Date(String(t).slice(0, 10))) / 86400000);

const pesanWa = k => `Halo ${k.nama || 'Bapak/Ibu'}, kami dari ${APP_NAME}${k.oli?.cabang ? ' ' + namaCabang(k.oli.cabang) : ''}. Motor ${k.nopol}${k.tipe ? ' (' + k.tipe + ')' : ''} ${k.oli.tglBerikut > hariIni() ? 'sebentar lagi jadwal' : 'sudah waktunya'} ganti oli: terakhir ganti ${tglPendek(k.oli.tgl)}${k.oli.km ? ' di KM ' + fmtKm(angkaKm(k.oli.km)) : ''}, jadwal berikutnya ${teksJadwal(k.oli)}.
Silakan mampir untuk servis, atau balas pesan ini untuk booking.
Bila sudah ganti oli di tempat lain, mohon balas dengan tanggal & KM saat ini supaya pengingat kami perbarui. Terima kasih 🙏
Riwayat servis: ${cekLink(k.nopol)}`;

function baris(k) {
  const o = k.oli, s = statusOli(o), p = k.pengingat || {};
  const wa = waLink(k.hp, pesanWa(k));
  return `<tr>
    <td><b class="mono">${esc(k.nopol)}</b><div class="small muted">${esc(k.tipe || '')}</div></td>
    <td>${esc(k.nama || '–')}<div class="small muted">${esc(k.hp || 'tanpa no. HP')}</div></td>
    <td class="small">${esc(tglPendek(o.tgl))}${o.km ? `<div class="muted">KM ${fmtKm(angkaKm(o.km))}</div>` : ''}<div class="muted">${o.sumber === 'luar' ? 'di luar' + (o.ket ? ': ' + esc(o.ket) : '') : esc(o.nota || '')}${multiCabang() && o.cabang ? ' · ' + esc(namaCabang(o.cabang)) : ''}</div></td>
    <td class="small">${esc(teksJadwal(o))}${o.rataKmHari ? `<div class="muted">±${o.rataKmHari} km/hari</div>` : ''}</td>
    <td>${s ? `<span class="pill ${s.kelas}">${esc(s.teks)}</span>` : ''}${p.n ? `<div class="small muted">dihubungi ${p.n}× · ${esc(String(p.dihubungi).slice(5, 16).replace('-', '/'))}${p.oleh ? ' · ' + esc(p.oleh) : ''}</div>` : ''}${p.tundaSampai && p.tundaSampai > hariIni() ? `<div class="small muted">ditunda s/d ${esc(tglPendek(p.tundaSampai))}</div>` : ''}${p.stop ? `<div class="small muted">dihentikan: ${esc(p.alasan || '')}</div>` : ''}</td>
    <td class="r" style="white-space:nowrap">
      ${wa ? `<a class="btn sm pri" href="${wa}" target="_blank" rel="noopener" data-act="pg-wa" data-id="${esc(k.id)}">WA ingatkan</a>` : '<span class="small muted">no. HP tidak valid</span>'}
      <button class="btn sm" type="button" data-act="pg-luar" data-id="${esc(k.id)}" title="Konsumen sudah ganti oli di bengkel lain">Ganti di luar</button>
      ${p.stop ? `<button class="btn sm ghost" type="button" data-act="pg-aktif" data-id="${esc(k.id)}">Aktifkan lagi</button>` : `<button class="btn sm ghost" type="button" data-act="pg-tunda" data-id="${esc(k.id)}" title="Konsumen minta diingatkan nanti">Tunda 14 hari</button><button class="btn sm ghost" type="button" data-act="pg-stop" data-id="${esc(k.id)}" title="Motor dijual, pindah kota, atau konsumen tidak mau diingatkan">Stop</button>`}
    </td></tr>`;
}

function render() {
  if (st.view !== 'pengingat') return;
  const a = aturanOli();
  if (!PG.data && !PG.muat) { muat(); return; }
  const list = PG.data || [], grup = { perlu: [], dihubungi: [], tunda: [], stop: [] };
  list.forEach(k => grup[kategori(k)].push(k));
  const lewat = grup.perlu.filter(k => k.oli.tglBerikut < hariIni()).length;
  const TAB = [['perlu', 'Perlu diingatkan'], ['dihubungi', 'Sudah dihubungi'], ['tunda', 'Ditunda'], ['stop', 'Dihentikan']];
  const l = grup[PG.tab] || [];
  $('#view').innerHTML = `<div class="grid">
   <div class="panel"><div class="row spread"><h3>Pengingat ganti oli</h3><button class="btn sm" type="button" data-act="pg-muat">↻ Muat ulang</button></div>
    <p class="small muted" style="margin:0">Jadwal dihitung otomatis saat servis yang berisi <b>oli mesin</b> dibayar: setiap <b>${fmtKm(a.km)} km</b> atau <b>${a.hari} hari</b>, mana yang lebih dulu (tanggal dari KM diperkirakan dari rata-rata pemakaian motor). Daftar ini berisi jadwal yang sudah lewat dan yang jatuh tempo dalam ${PG.jangka} hari.</p>
    <div class="tiles"><div class="tile"><span class="lbl">Perlu diingatkan</span><span class="val">${grup.perlu.length}</span><span class="sub">${lewat} sudah lewat jadwal</span></div><div class="tile"><span class="lbl">Sudah dihubungi (7 hari)</span><span class="val">${grup.dihubungi.length}</span><span class="sub">menunggu konsumen datang</span></div></div>
    <div class="seg" role="group" aria-label="Saring">${TAB.map(([k, lbl]) => `<button type="button" data-act="pg-tab" data-t="${k}" aria-pressed="${k === PG.tab}">${lbl} (${grup[k].length})</button>`).join('')}</div>
    ${PG.muat ? loaderHTML('Memuat jadwal oli…') : l.length ? `<div class="tw"><table class="rw-tabel"><thead><tr><th>Kendaraan</th><th>Konsumen</th><th>Ganti oli terakhir</th><th>Jadwal berikut</th><th>Status</th><th></th></tr></thead><tbody>${l.map(baris).join('')}</tbody></table></div>` : '<div class="empty">Tidak ada kendaraan di daftar ini.</div>'}
   </div>
   ${st.petugas?.super ? `<div class="panel"><h3>Pengaturan pengingat <span class="h-sub">super admin</span></h3>
    <div class="row"><label class="f" for="pg-km">Interval KM<input id="pg-km" data-num value="${a.km}" style="width:120px"></label><label class="f" for="pg-hari">Interval hari<input id="pg-hari" type="number" data-raw min="7" max="365" value="${a.hari}" style="width:100px"></label><button class="btn pri" type="button" data-act="pg-atur" style="align-self:flex-end">Simpan</button></div>
    <p class="small muted" style="margin:0">Berlaku untuk jadwal yang dihitung sesudah disimpan. Oli mesin dikenali dari nama part/jasa yang mengandung "OLI", "OIL", atau "YAMALUBE" (oli gardan tidak dihitung).</p>
    <div class="row"><button class="btn" type="button" data-act="pg-bangun">Bangun jadwal dari nota lama</button><span class="small muted">Sekali saja setelah update: membaca semua nota servis untuk mengisi jadwal kendaraan yang belum punya.</span></div>
   </div>` : ''}
  </div>`;
}

const cari = id => (PG.data || []).find(k => k.id === id);
async function simpanPengingat(k, patch, pesan) {
  const pengingat = { ...(k.pengingat || {}), ...patch };
  try { await setDoc(doc(db, 'kendaraan', k.id), { pengingat }, { merge: true }); k.pengingat = pengingat; if (pesan) toast(pesan); render(); }
  catch (e) { toast(errMsg(e)); }
}

async function bangun() {
  if (!(await mintaPassword('Bangun jadwal oli dari nota lama', 'Membaca semua nota servis (memakai kuota baca Firebase sesuai jumlah nota).'))) return;
  const el = document.querySelector('[data-act="pg-bangun"]'); if (el) { el.disabled = true; el.textContent = 'Membaca nota…'; }
  try {
    const s = await getDocs(query(collection(db, 'trx'), where('jenis', '==', 'SERVIS')));
    const per = new Map();
    s.docs.map(d => d.data()).filter(sah).sort((a, b) => a.tgl.localeCompare(b.tgl)).forEach(t => {
      const key = nopolKey(t.nopol); if (!key) return;
      const g = per.get(key) || { prev: null, oli: null };
      if (adaGantiOli(t)) g.oli = oliLengkap({ ...jadwalOli({ km: t.km, tgl: t.tgl }, g.prev), sumber: 'bengkel', nota: t.no, cabang: t.cabang || '' });
      if (t.km) g.prev = { km: t.km, tgl: t.tgl };
      g.hp = t.hp || g.hp; g.nopol = t.nopol;
      per.set(key, g);
    });
    const tulis = [...per.entries()].filter(([, g]) => g.oli);
    let n = 0;
    for (let i = 0; i < tulis.length; i += 200) {
      const b = writeBatch(db);
      tulis.slice(i, i + 200).forEach(([key, g]) => b.set(doc(db, 'kendaraan', key), { oli: g.oli }, { merge: true }));
      await b.commit(); n += Math.min(200, tulis.length - i);
      if (el) el.textContent = `Menulis ${n}/${tulis.length}…`;
    }
    for (const [, g] of tulis) await oliKePantau(g.nopol, g.hp, g.oli);
    toast(`Jadwal oli ${tulis.length} kendaraan dibuat dari ${s.size ?? s.docs.length} nota`); PG.data = null; render();
  } catch (e) { toast(errMsg(e)); if (el) { el.disabled = false; el.textContent = 'Bangun jadwal dari nota lama'; } }
}

views.pengingat = () => { PG.data = null; render(); };
refreshers.pengingat = () => {};
Object.assign(actions, {
  'pg-tab': el => { PG.tab = el.dataset.t; render(); },
  'pg-muat': () => muat(),
  'pg-wa': el => { const k = cari(el.dataset.id); if (k) simpanPengingat(k, { dihubungi: stamp(new Date()), oleh: namaPetugas(), n: (k.pengingat?.n || 0) + 1 }); },
  'pg-luar': el => { const k = cari(el.dataset.id); if (k) catatOliLuar(k.nopol, oli => { k.oli = oli; k.pengingat = null; PG.data = PG.data.filter(x => x.oli.tglBerikut <= tambahHari(PG.jangka)); render(); }); },
  'pg-tunda': el => { const k = cari(el.dataset.id); if (k) simpanPengingat(k, { tundaSampai: tambahHari(14), oleh: namaPetugas() }, `Pengingat ${k.nopol} ditunda 14 hari`); },
  'pg-stop': async el => {
    const k = cari(el.dataset.id); if (!k) return;
    if (!(await konfirmasi('Hentikan pengingat ' + k.nopol + '?', 'Untuk motor yang sudah dijual, pindah kota, atau konsumen tidak mau diingatkan. Pengingat aktif lagi otomatis bila motor ini ganti oli di bengkel.', { ya: 'Ya, hentikan', bahaya: true }))) return;
    simpanPengingat(k, { stop: true, alasan: 'dihentikan ' + namaPetugas(), oleh: namaPetugas() }, 'Pengingat ' + k.nopol + ' dihentikan');
  },
  'pg-aktif': el => { const k = cari(el.dataset.id); if (k) simpanPengingat(k, { stop: false, alasan: '' }, 'Pengingat ' + k.nopol + ' aktif lagi'); },
  'pg-atur': async () => {
    const km = angkaKm($('#pg-km').value), hari = +$('#pg-hari').value || 0;
    if (km < 500 || km > 20000 || hari < 7 || hari > 365) { toast('Interval KM 500–20.000 dan hari 7–365'); return; }
    try { await setDoc(doc(db, 'meta', 'settings'), { pengingatOli: { km, hari } }, { merge: true }); S.settings.pengingatOli = { km, hari }; toast('Pengaturan pengingat disimpan'); render(); } catch (e) { toast(errMsg(e)); }
  },
  'pg-bangun': bangun
});
