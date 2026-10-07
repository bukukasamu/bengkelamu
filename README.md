# Aceh Mitra Utama POS

Aplikasi web kasir sparepart dan bengkel Yamaha untuk Aceh Mitra Utama.
Data tersimpan di **Cloud Firestore** (realtime, bisa dipakai beberapa kasir sekaligus) dan login petugas memakai **Firebase Authentication**.

Fitur: Beranda (omzet, antrian, stok menipis), Kasir Sparepart, Servis Bengkel (work order), Stok Part + barang masuk, Laporan. Shortcut F1 Baru, F2 Simpan, F8 Cetak Nota.

## Isi folder

| File | Fungsi |
|---|---|
| `index.html` | Halaman utama |
| `style.css` | Tampilan |
| `app.js` | Logika aplikasi + Firestore |
| `firebase-config.js` | Konfigurasi project `bengkel-amu` |
| `firestore.rules` | Aturan keamanan database (WAJIB dipasang) |

## Setup Firebase (sekali saja)

1. **Firestore**: Firebase Console → Build → Firestore Database → *Create database* → pilih lokasi `asia-southeast2 (Jakarta)` → mode *production*.
2. **Rules**: Firestore → tab *Rules* → hapus isinya, tempel isi `firestore.rules` → *Publish*.
3. **Login**: Build → Authentication → *Get started* → Sign-in method → aktifkan **Email/Password**.
4. **Buat akun petugas**: Authentication → Users → *Add user* (email + kata sandi).
5. **Daftarkan sebagai petugas**: Firestore → *Start collection* → Collection ID `staff` → Document ID = **email petugas persis** (mis. `kasir1@gmail.com`) → field:
   - `nama` (string) : `Kasir 1`
   - `peran` (string) : `admin` atau `kasir`

   Akun yang login tapi tidak ada di `staff` akan otomatis ditolak.
6. **Domain GitHub Pages**: Authentication → Settings → *Authorized domains* → *Add domain* → `USERNAME.github.io`.

## Deploy ke GitHub Pages

1. Buat repository baru di GitHub (mis. `bengkel-amu`).
2. Upload semua file di folder ini ke repository (branch `main`, di root).
3. Repository → Settings → Pages → Source: *Deploy from a branch* → Branch `main` / `(root)` → Save.
4. Tunggu ±1 menit, buka `https://USERNAME.github.io/bengkel-amu/`.

Catatan: jangan buka `index.html` langsung dengan klik dua kali (alamat `file://`), karena modul JavaScript tidak jalan. Pakai link GitHub Pages, atau untuk coba di komputer: `npx serve .` lalu buka `http://localhost:3000`.

## Pertama kali dipakai

Database awalnya kosong. Di Beranda ada tombol **Isi 20 part contoh** untuk mencoba; atau langsung tambah part asli lewat **Stok Part → + Part baru**.

## Struktur data Firestore

- `parts/{kode}` : kode, nama, kategori, cocok, rak, beli, jual, stok, min
- `trx/{no}` : nota penjualan (`PJ-yymmdd-001`) dan servis (`SV-yymmdd-001`)
- `wo/{no}` : work order bengkel (`WO-0001`)
- `masuk/{auto}` : riwayat barang masuk dari supplier
- `meta/counter` : penomoran nota otomatis
- `staff/{email}` : daftar petugas yang boleh login

Simpan transaksi, potong stok, dan penomoran nota dilakukan dalam satu *transaction*, jadi dua kasir yang menjual barang yang sama di waktu bersamaan tidak membuat stok minus atau nomor nota ganda.

## Menyesuaikan

Daftar jasa + harga, nama mekanik, tipe motor, dan kategori part ada di bagian atas `app.js` (konstanta `JASA`, `MEKANIK`, `TIPE`, `KAT`).

## Keamanan

`apiKey` Firebase di `firebase-config.js` memang boleh terlihat publik; yang melindungi data adalah `firestore.rules`. Pastikan langkah 2 dan 5 sudah dilakukan sebelum aplikasi dipakai.
