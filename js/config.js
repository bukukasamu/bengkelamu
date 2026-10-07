// Identitas aplikasi, peran pengguna, dan menu per peran.
export const APP_NAME = 'Aceh Mandiri Utama';
export const APP_SUB = 'Sparepart & Bengkel Yamaha';
export const APP_VERSION = '2.1.0';

// Super admin masuk dengan email + kata sandi; petugas lain masuk dengan pilih nama + PIN 6 digit.
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
  { id: 'order', label: 'Order Sparepart', group: 'Bengkel', roles: ['admin', 'sparepart'] },
  { id: 'bayar', label: 'Pembayaran & Status Servis', group: 'Bengkel', roles: ['admin', 'kasir'] },
  { id: 'mekanik', label: 'Performa Mekanik', group: 'Bengkel', roles: ['admin', 'mekanik'] },
  { id: 'kasir', label: 'Penjualan Sparepart', group: 'Sparepart', roles: ['admin', 'kasir'] },
  { id: 'stok', label: 'Stok Part', group: 'Sparepart', roles: ['admin', 'sparepart'] },
  { id: 'pembelian', label: 'Pembelian Stok', group: 'Sparepart', roles: ['admin', 'sparepart'] },
  { id: 'laporan', label: 'Laporan Penjualan', group: 'Keuangan', roles: ['admin', 'kasir'] },
  { id: 'master', label: 'Master Data', group: 'Pengaturan', roles: ['admin', 'registrasi'] }
];
// Halaman pertama setelah login
export const HOME = { admin: 'beranda', registrasi: 'registrasi', sparepart: 'order', kasir: 'bayar', mekanik: 'mekanik' };

// Jenis servis: KSG = Kartu Service Gratis (jasa tidak ditagih ke konsumen, diklaim ke main dealer)
//               KSB = Kartu Service Berkala (servis berkala berbayar, dicatat nomor kartunya)
export const JENIS_SERVIS = { Reguler: 'Reguler', KSB: 'KSB (Kartu Service Berkala)', KSG: 'KSG (Kartu Service Gratis)' };

// Data awal master (dibuat otomatis sekali saat admin pertama login dan master masih kosong)
export const DEFAULT_JASA = [['Ganti Oli', 15000], ['Servis Ringan', 45000], ['Servis CVT', 55000], ['Tune Up Injeksi', 85000], ['Ganti Kampas Rem', 20000], ['Servis Rem', 30000], ['Bongkar Pasang Ban', 20000], ['Cek Kelistrikan', 35000]];
export const DEFAULT_MEKANIK = ['Fauzan', 'Rizki', 'Mahdi', 'T. Iqbal'];
export const DEFAULT_TIPE = ['NMAX 155', 'Aerox 155', 'Lexi', 'Fazzio', 'Grand Filano', 'Gear 125', 'Mio M3', 'Fino', 'X-Ride', 'Jupiter Z1', 'Vega Force', 'MX King 150', 'Vixion', 'R15', 'XSR 155'];
export const KAT = ['Oli', 'Rem', 'CVT', 'Pengapian', 'Filter', 'Kelistrikan', 'Penggerak', 'Ban'];
