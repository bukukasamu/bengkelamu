// Identitas aplikasi, peran pengguna, dan menu per peran.
export const APP_NAME = 'Aceh Mandiri Utama';
export const APP_SUB = 'Sparepart & Bengkel Yamaha';
export const APP_VERSION = '3.3.0';

// Alamat web resmi. Link yang dikirim ke konsumen (WA, QR) mengikuti alamat yang sedang dibuka;
// GitHub Pages otomatis mengalihkan bukukasamu.github.io/bengkelamu ke alamat ini setelah domain aktif.
export const SITE_DOMAIN = 'www.amuservice.id';

// Super admin masuk dengan email + kata sandi; petugas lain masuk dengan pilih nama + PIN 6 digit.
export const COPYRIGHT = 'Copyright SRISP 2026';
export const SUPER_ADMIN = 'cashflow.amu@gmail.com';
// Domain akun PIN (tidak pernah dikirimi email, hanya penanda akun di Firebase)
export const PIN_DOMAIN = 'petugas.amu-pos.id';

export const ROLES = {
  admin: 'Admin / Pemilik',
  registrasi: 'Registrasi Servis',
  sparepart: 'Sparepart',
  kasir: 'Kasir',
  mekanik: 'Mekanik'
};

// Menu yang tampil di sidebar, dikelompokkan, beserta peran yang boleh membukanya.
export const MENUS = [
  { id: 'beranda', label: 'Beranda', group: 'Utama', roles: ['admin', 'registrasi', 'sparepart', 'kasir'] },
  { id: 'registrasi', label: 'Registrasi Servis', group: 'Bengkel', roles: ['admin', 'registrasi'] },
  { id: 'riwayat', label: 'Riwayat Kendaraan', group: 'Bengkel', roles: ['admin', 'registrasi', 'kasir', 'sparepart'] },
  { id: 'order', label: 'Order Sparepart', group: 'Bengkel', roles: ['admin', 'sparepart'] },
  { id: 'bayar', label: 'Pembayaran & Status Servis', group: 'Bengkel', roles: ['admin', 'kasir'] },
  { id: 'mekanik', label: 'Performa Mekanik', group: 'Bengkel', roles: ['admin', 'mekanik'] },
  { id: 'kasir', label: 'Penjualan Sparepart', group: 'Sparepart', roles: ['admin', 'kasir'] },
  { id: 'stok', label: 'Stok Part', group: 'Sparepart', roles: ['admin', 'sparepart'] },
  { id: 'pembelian', label: 'Pembelian Stok', group: 'Sparepart', roles: ['admin', 'sparepart'] },
  { id: 'penghasilan', label: 'Penghasilan', group: 'Keuangan', roles: ['admin', 'registrasi', 'sparepart', 'kasir', 'mekanik'] },
  { id: 'laporan', label: 'Laporan Penjualan', group: 'Keuangan', roles: ['admin', 'kasir'] },
  { id: 'master', label: 'Master Data', group: 'Pengaturan', roles: ['admin', 'registrasi'] }
];
// Halaman pertama setelah login
export const HOME = { admin: 'beranda', registrasi: 'registrasi', sparepart: 'order', kasir: 'bayar', mekanik: 'mekanik' };

// Jenis servis: KSG = Kartu Service Gratis (jasa tidak ditagih ke konsumen, diklaim ke main dealer)
//               KSB = Kartu Service Berkala (servis berkala berbayar, dicatat nomor kartunya)
export const JENIS_SERVIS = { Reguler: 'Reguler', KSB: 'KSB (Kartu Service Berkala)', KSG: 'KSG (Kartu Service Gratis)' };

// Data awal master (dibuat otomatis sekali saat admin pertama login dan master masih kosong)
export const DEFAULT_JASA = [['GANTI OLI', 15000], ['SERVIS RINGAN', 45000], ['SERVIS CVT', 55000], ['TUNE UP INJEKSI', 85000], ['GANTI KAMPAS REM', 20000], ['SERVIS REM', 30000], ['BONGKAR PASANG BAN', 20000], ['CEK KELISTRIKAN', 35000]];
export const DEFAULT_MEKANIK = ['FAUZAN', 'RIZKI', 'MAHDI', 'T. IQBAL'];
export const DEFAULT_TIPE = ['NMAX 155', 'AEROX 155', 'LEXI', 'FAZZIO', 'GRAND FILANO', 'GEAR 125', 'MIO M3', 'FINO', 'X-RIDE', 'JUPITER Z1', 'VEGA FORCE', 'MX KING 150', 'VIXION', 'R15', 'XSR 155'];
export const KAT = ['Oli', 'Rem', 'CVT', 'Pengapian', 'Filter', 'Kelistrikan', 'Penggerak', 'Ban'];
