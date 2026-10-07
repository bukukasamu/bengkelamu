// 20 part contoh untuk mencoba aplikasi saat database masih kosong.
export const SEED_PARTS = [
  ['YML-SM08', 'Oli Yamalube Super Matic 0,8 L', 'Oli', 'Semua matic', 38000, 48000, 42, 12, 'A1'],
  ['YML-SP10', 'Oli Yamalube Sport 1 L', 'Oli', 'Vixion, R15, MX King', 52000, 65000, 18, 8, 'A1'],
  ['YML-GO10', 'Oli Gardan Yamalube 100 ml', 'Oli', 'Semua matic', 12000, 17000, 30, 10, 'A1'],
  ['KRD-NMX', 'Kampas Rem Depan NMAX/Aerox', 'Rem', 'NMAX, Aerox, Lexi', 58000, 78000, 9, 6, 'B2'],
  ['KRB-MIO', 'Kampas Rem Belakang Mio/Fino', 'Rem', 'Mio M3, Fino, Gear', 32000, 45000, 4, 6, 'B2'],
  ['VB-NMX', 'V-Belt NMAX 155', 'CVT', 'NMAX 155', 245000, 310000, 5, 3, 'C1'],
  ['VB-AEX', 'V-Belt Aerox 155', 'CVT', 'Aerox 155', 250000, 315000, 2, 3, 'C1'],
  ['RL-MIO', 'Roller Set Mio/Gear', 'CVT', 'Mio M3, Gear 125', 48000, 65000, 11, 5, 'C2'],
  ['KPL-MIO', 'Kampas Kopling Ganda Mio', 'CVT', 'Mio M3, Fino', 95000, 125000, 4, 3, 'C2'],
  ['BSI-CPR', 'Busi CPR8EA-9', 'Pengapian', 'Mio, Fino, Jupiter', 18000, 25000, 36, 10, 'D1'],
  ['BSI-LMR', 'Busi LMAR8A-9', 'Pengapian', 'NMAX, Aerox, R15', 42000, 58000, 14, 6, 'D1'],
  ['FU-NMX', 'Filter Udara NMAX', 'Filter', 'NMAX 155', 55000, 72000, 7, 4, 'D2'],
  ['FU-MIO', 'Filter Udara Mio M3', 'Filter', 'Mio M3, Gear', 38000, 52000, 3, 4, 'D2'],
  ['FO-VIX', 'Filter Oli Vixion/R15', 'Filter', 'Vixion, R15, MX King', 22000, 32000, 10, 5, 'D2'],
  ['AKI-5S', 'Aki GTZ5S', 'Kelistrikan', 'Mio, Fino, Gear, Lexi', 215000, 265000, 6, 3, 'E1'],
  ['AKI-6V', 'Aki GTZ6V', 'Kelistrikan', 'NMAX, Aerox', 285000, 345000, 3, 2, 'E1'],
  ['LMP-DPN', 'Bohlam Depan 12V 25/25W', 'Kelistrikan', 'Jupiter, Vega', 15000, 22000, 20, 8, 'E2'],
  ['RTS-VIX', 'Rantai Set Vixion', 'Penggerak', 'Vixion', 290000, 365000, 2, 2, 'F1'],
  ['BAN-9014', 'Ban Luar 90/90-14', 'Ban', 'Mio, Fino, Gear (belakang)', 185000, 230000, 8, 4, 'G1'],
  ['BAN-1113', 'Ban Luar 110/70-13', 'Ban', 'NMAX (depan)', 265000, 320000, 5, 3, 'G1']
].map(([kode, nama, kategori, cocok, beli, jual, stok, min, rak]) => ({ kode, nama, kategori, cocok, beli, jual, stok, min, rak }));
