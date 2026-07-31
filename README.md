# MBS Admin Panel
**CV Mahkota Berkah Semesta** — Sistem Manajemen Bisnis

---

## Cara Buka
1. Ekstrak ZIP ke folder mana saja
2. Buka `index.html` di browser (Chrome / Edge / Firefox)
3. Tidak perlu install apa pun — berjalan langsung offline

> **Electron / file://**  
> Jika dibuka via Electron, aktifkan `webSecurity: false` di BrowserWindow agar Supabase bisa terkoneksi.

---

## Koneksi Supabase
Kredensial sudah tertanam di `js/core.js`. Untuk mengganti:
- Buka **Pengaturan → Koneksi Supabase**
- Isi API URL dan API Key baru → klik **Simpan & Tes Koneksi**
- Pengaturan disimpan di `localStorage` browser

---

## Modul yang Tersedia

| Modul | Fitur |
|---|---|
| **Dashboard** | KPI omzet, laba, piutang · grafik 6 bulan · invoice terbaru |
| **Master Produk** | CRUD produk · kode otomatis PK/PC/PL · foto produk |
| **HPP & Margin Project** | Kalkulasi HPP · margin bidireksional · export PDF/CSV |
| **Pengeluaran** | Biaya operasional · filter kategori · export PDF/CSV |
| **Laporan Keuangan** | Laba rugi · arus kas · PPN Keluaran · export PDF/CSV |
| **Invoice** | Status bayar · PPN opsional · cetak PDF |
| **Quotation** | Penawaran harga · cetak PDF |
| **Purchase Order** | Order ke vendor · tanpa PPN · cetak PDF |
| **Surat Jalan** | Dokumen pengiriman · cetak PDF |
| **Desain Approval** | Per project · 1 halaman/produk · upload gambar desain |
| **Pengaturan** | Logo · TTD · rekening bank · penomoran dokumen |

---

## Catatan PPN
- MBS berstatus **PKP** — PPN **opsional** per invoice
- Tarif efektif **11%** (DPP Nilai Lain: 12% × 11/12 harga)
- **PO tidak mencantumkan PPN** — pembelian dicatat inklusif
- Laporan Keuangan menampilkan **PPN Keluaran saja** (yang disetor)

---

## Struktur File
```
mbs-admin/
├── index.html          Shell utama
├── css/
│   └── main.css        Design system "Warm Premium"
├── js/
│   ├── core.js         Supabase client + utilities
│   └── app.js          Router + sidebar
└── pages/
    ├── pengaturan.js
    ├── dashboard.js
    ├── master-produk.js
    ├── hpp-project.js
    ├── pengeluaran.js
    ├── laporan.js
    ├── invoice.js
    ├── quotation.js
    ├── po.js
    ├── suratjalan.js
    └── desain-approval.js
```

---

*Dibuat untuk CV Mahkota Berkah Semesta · 2026*
