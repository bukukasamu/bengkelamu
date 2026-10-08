// Menu Riwayat Kendaraan (petugas): cari kendaraan/konsumen, lihat data pemilik & STNK, tracking servis yang
// sedang berjalan, dan seluruh riwayat servis dari semua cabang (jasa, sparepart, mekanik, kilometer, lama servis, nota).
import { $, esc, rp, toast, errMsg, waButton } from './util.js';
import { S, st, views, refreshers, actions, go, can } from './state.js';
import { db, doc, getDoc, getDocs, query, collection, where } from './firebase.js';
import { cariKendaraan, nopolKey } from './cari-kendaraan.js';
import { AKTIF, statusPill, jenisBadge, timelineHTML, mekanikNama, woCalc, normJasa, fmtAntri, pantauKey } from './wo-common.js';
import { sah } from './data-trx.js';
import { stepperHTML, kartuRiwayat, ringkasRiwayat, tglID } from './riwayat-ui.js';
import { showNota, cekLink } from './nota.js';
import { namaCabang, cabangOf, multiCabang } from './cabang.js';
import { loaderHTML } from './brand.js';
import { APP_NAME } from './config.js';

let hasil = null, detail = null, cariKe = 0;

function renderRiwayat() {
  $('#view').innerHTML = `<div class="grid">
   <div class="panel"><h3>Cari kendaraan</h3>
    <div class="row"><input id="rw-q" placeholder="No. polisi, nama, no. HP, NIK, no. rangka/mesin — boleh sebagian" value="${esc(st.rwQ || '')}" style="flex:1 1 260px" autocomplete="off" aria-label="Cari kendaraan"><button class="btn pri" type="button" data-act="rw-cari">Cari</button></div>
    <div id="rw-hasil"></div>
   </div>
   <div id="rw-detail"></div>
  </div>`;
  renderHasil(); renderDetail();
  if (st.rwBuka) { const np = st.rwBuka; st.rwBuka = null; muat(np); }
}

function renderHasil() {
  const el = $('#rw-hasil'); if (!el) return;
  if (!hasil) { el.innerHTML = ''; return; }
  el.innerHTML = hasil.length ? `<div class="cari-hasil">${hasil.map(k => `<button type="button" class="cari-item rw-item" data-act="rw-buka" data-np="${esc(k.nopol)}"><div><b class="mono">${esc(k.nopol)}</b> · ${esc(k.tipe || '')} ${esc(k.warna || '')}<div class="small muted">${esc(k.nama || '–')}${k.hp ? ' · ' + esc(k.hp) : ''}</div></div><span class="small muted">Lihat riwayat ›</span></button>`).join('')}</div>`
    : '<div class="small muted">Tidak ditemukan. Coba ketik bagian lain (angka plat saja, nama, atau no. HP).</div>';
}

async function cari() {
  st.rwQ = $('#rw-q')?.value || '';
  const el = $('#rw-hasil'); if (el) el.innerHTML = '<div class="small muted">Mencari…</div>';
  const r = await cariKendaraan(st.rwQ);
  if (!r) { if (el) el.innerHTML = ''; toast('Ketik minimal 3 huruf/angka'); return; }
  hasil = r; renderHasil();
  if (r.length === 1) muat(r[0].nopol);
}

// Muat satu kendaraan: data pemilik, servis aktif (dari WO), dan riwayat nota servis semua cabang
async function muat(nopol) {
  const key = nopolKey(nopol), ke = ++cariKe;
  detail = { key, nopol, loading: true };
  renderDetail(); $('#rw-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  try {
    const ks = await getDoc(doc(db, 'kendaraan', key)), kend = ks.exists() ? ks.data() : null;
    let trx;
    if (st.role === 'admin') {
      const varian = [...new Set([nopol, kend?.nopol, key, String(nopol).toUpperCase().replace(/\s+/g, ' ')].filter(Boolean))].slice(0, 10);
      const ts = await getDocs(query(collection(db, 'trx'), where('nopol', 'in', varian)));
      trx = ts.docs.map(d => d.data()).filter(sah);
    } else {
      // Karyawan hanya boleh membaca nota cabangnya; riwayat lintas cabang diambil dari ringkasan cek servis konsumen
      const hp = kend?.hp || woKendaraan(key)[0]?.hp, pk = hp ? await pantauKey(kend?.nopol || nopol, hp) : '';
      const ps = pk ? await getDoc(doc(db, 'pantau', pk)) : null;
      const dariPantau = ps?.exists() ? (ps.data().riwayat || []) : [];
      const lokal = S.trx.filter(t => nopolKey(t.nopol) === key && !dariPantau.some(x => x.no === t.no));
      trx = [...dariPantau, ...lokal];
    }
    if (ke !== cariKe) return;
    detail = { key, nopol: kend?.nopol || nopol, kend, trx: trx.sort((a, b) => b.tgl.localeCompare(a.tgl)), loading: false };
  } catch (e) { if (ke === cariKe) detail = { key, nopol, error: errMsg(e) }; }
  renderDetail();
}

const woKendaraan = key => (S.woSemua.length ? S.woSemua : S.wo).filter(w => nopolKey(w.nopol) === key).sort((a, b) => b.tgl.localeCompare(a.tgl));

function renderDetail() {
  const el = $('#rw-detail'); if (!el) return;
  if (!detail) { el.innerHTML = ''; return; }
  if (detail.loading) { el.innerHTML = `<div class="panel">${loaderHTML('Memuat riwayat ' + esc(detail.nopol) + '…')}</div>`; return; }
  if (detail.error) { el.innerHTML = `<div class="panel"><div class="err">Gagal memuat: ${esc(detail.error)}</div></div>`; return; }
  const terbuka = new Set([...el.querySelectorAll('.riw-card[open]')].map(x => x.dataset.no));
  const wos = woKendaraan(detail.key), aktif = wos.find(w => AKTIF.includes(w.status));
  const k = { ...(wos[0] || {}), ...(detail.kend || {}) }, trx = detail.trx;
  const alamat = [k.alamat, k.rtrw ? 'RT/RW ' + k.rtrw : '', k.kelurahan, k.kecamatan, k.kabupaten, k.provinsi].filter(Boolean).join(', ');
  const waMsg = `Halo ${k.nama || 'Bapak/Ibu'}, berikut status & riwayat servis motor ${detail.nopol} di ${APP_NAME}: ${cekLink(detail.nopol)}`;
  const baris = (l, v) => v ? `<span class="muted">${l}</span><span>${v}</span>` : '';
  el.innerHTML = `<div class="panel">
    <div class="row spread"><div><div class="mono cek-nopol">${esc(detail.nopol)}</div><div class="muted small">${esc([k.tipe, k.warna, k.tahun].filter(Boolean).join(' · '))}</div></div>
     <div class="row">${k.hp ? waButton(k.hp, waMsg, 'Kirim link cek servis') : ''}</div></div>
    <div class="grid g2">
     <div><h3>Pemilik <span class="h-sub">sesuai KTP</span></h3><div class="totals small">${baris('Nama', esc(k.nama || '–'))}${baris('NIK', esc(k.nik || ''))}${baris('No. HP', k.hp ? esc(k.hp) + ' ' + waButton(k.hp, `Halo ${k.nama || 'Bapak/Ibu'}, kami dari ${APP_NAME} mengenai motor ${detail.nopol}. `) : '')}${baris('Alamat', esc(alamat))}</div></div>
     <div><h3>Kendaraan <span class="h-sub">sesuai STNK</span></h3><div class="totals small">${baris('Nama di STNK', esc(k.namaStnk || k.nama || ''))}${baris('No. rangka', `<span class="mono">${esc(k.noRangka || '')}</span>`)}${baris('No. mesin', `<span class="mono">${esc(k.noMesin || '')}</span>`)}${baris('KM terakhir', k.km ? esc(Number(k.km).toLocaleString('id-ID')) + ' km' : '')}</div></div>
    </div>
   </div>
   ${aktif ? `<div class="panel"><div class="row spread"><h3>Servis saat ini</h3><span class="row">${aktif.antrian ? `<span class="antri-no">${fmtAntri(aktif.antrian)}</span>` : ''}${jenisBadge(aktif)}${statusPill(aktif.status)}</span></div>
     ${stepperHTML(aktif)}
     ${timelineHTML(aktif)}
     <div class="totals small">
      ${multiCabang() ? baris('Cabang', esc(namaCabang(cabangOf(aktif)))) : ''}
      ${baris('No. WO', `<span class="mono">${esc(aktif.no)}</span>`)}
      ${baris('Mekanik', esc(mekanikNama(aktif) || 'belum ada'))}
      ${baris('Keluhan', esc(aktif.keluhan || ''))}
      ${baris('Jasa', esc(normJasa(aktif).map(j => j.nama).join(', ')))}
      ${baris('Sparepart', esc((aktif.parts || []).map(x => (S.map.get(x.kode)?.nama || x.kode) + ' ×' + x.qty).join(', ')))}
      ${baris(aktif.status === 'Selesai' ? 'Total biaya' : 'Estimasi biaya', `<b class="num">${rp(Math.max(0, woCalc(aktif).total - (aktif.diskon || 0)))}</b>`)}
     </div></div>` : ''}
   <div class="panel"><h3>Riwayat servis</h3>
    ${trx.length ? ringkasRiwayat(trx) + `<div class="riw-list">${trx.map((t, i) => kartuRiwayat(t, { petugas: true, buka: terbuka.has(t.no) || (!terbuka.size && i === 0), notaAttr: `data-act="rw-nota" data-i="${i}"` })).join('')}</div>` : '<div class="small muted">Belum ada riwayat servis yang dibayar.</div>'}
   </div>`;
}

views.riwayat = renderRiwayat;
refreshers.riwayat = () => { if (detail && !detail.loading) renderDetail(); };
Object.assign(actions, {
  'rw-cari': cari,
  'rw-buka': el => { const np = el.dataset.np; if (!np) return; if (st.view === 'riwayat') muat(np); else { st.rwBuka = np; go('riwayat'); } },
  'rw-nota': el => showNota(detail?.trx?.[+el.dataset.i])
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'rw-q') { e.preventDefault(); cari(); } });
