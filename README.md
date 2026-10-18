# Xarc Massage v1.0.0 — Vercel + Render

Chat privat anonim dengan enkripsi sisi browser AES-256-GCM. Frontend statis dipublikasikan melalui Vercel, sedangkan Express + Socket.IO berjalan sebagai Render Web Service. Desain dan alur fitur aplikasi dipertahankan; perubahan utama adalah konfigurasi koneksi lintas-origin dan deployment.

## Fitur yang dipertahankan

- Create Private Room dan kapasitas 2–100 anggota.
- Kode undangan dan room sementara.
- Nama peserta anonim, status anggota, dan typing indicator.
- Pesan teks terenkripsi AES-256-GCM di browser.
- Berbagi file/foto/video, kamera, lokasi, QR code, dan pencarian room.
- Server hanya merelay ciphertext untuk pesan; tidak mendekripsi konten.

## 1. Deploy backend ke Render

1. Ekstrak ZIP dan push seluruh folder proyek ke repository GitHub.
2. Di Render pilih **New → Web Service**, lalu hubungkan repository.
3. Root Directory: kosong (folder root proyek ini).
4. Runtime: Node. Build Command: `npm install`. Start Command: `npm start`.
5. Setelah layanan dibuat, catat URL publik, misalnya `https://xarc-massage-api.onrender.com`.
6. Buka **Environment** di Render dan tambahkan:
   - `FRONTEND_URL` = URL utama Vercel, misalnya `https://xarc-massage.vercel.app`.
   - `CORS_ORIGINS` = daftar origin tambahan dipisahkan koma, jika diperlukan (misalnya domain preview Vercel). Jangan beri slash di akhir URL.
7. Redeploy layanan. Tes `https://URL-RENDER/health`; hasil yang diharapkan: `{"ok":true,"service":"xarc-massage"}`.

`render.yaml` tersedia sebagai blueprint opsional. Nilai `FRONTEND_URL` dan `CORS_ORIGINS` sengaja harus diisi manual.

## 2. Hubungkan frontend ke Render

Sebelum deploy Vercel, edit `public/config.js` dan isi URL Render:

```js
window.XARC_MASSAGE_CONFIG = {
  SOCKET_URL: 'https://xarc-massage-api.onrender.com'
};
```

Ganti contoh URL dengan URL layanan Render milikmu. Jangan menambahkan `/` di akhir. File ini bukan tempat menyimpan secret/API key; URL backend memang publik.

## 3. Deploy frontend ke Vercel

1. Import repository yang sama ke Vercel.
2. Biarkan **Root Directory** kosong (root repository).
3. Framework Preset: **Other**.
4. Build Command: kosongkan/nonaktifkan build command.
5. Output Directory: `public`.
6. Deploy.
7. Pastikan `public/config.js` telah menunjuk ke URL Render sebelum deployment.
8. Jika domain Vercel berubah, perbarui `FRONTEND_URL` di Render dan redeploy backend. Untuk preview domains tambahan, masukkan daftar origin yang benar ke `CORS_ORIGINS`.

`vercel.json` berada di root repository; frontend statis yang dipublikasikan adalah isi folder `public`.

## Pengembangan lokal

```bash
npm install
npm start
```

Buka `http://localhost:3000`. Biarkan `SOCKET_URL` kosong di `public/config.js` untuk menggunakan server lokal yang sama.

## Pengujian

```bash
npm install
npm run check
npm start
```

Lalu buka `http://localhost:3000/health`. Untuk pengujian fitur, buka situs dari dua browser/perangkat berbeda, buat room, gabung dengan kode undangan, lalu tes pesan teks dan file.

## Batasan penting

- **Room disimpan di memori proses** dan tidak menggunakan database. Restart/deploy Render atau spin-down layanan dapat menghapus semua room aktif; satu instance backend dianjurkan untuk MVP ini.
- Paket gratis Render dapat mengalami spin-down dan menyebabkan jeda saat permintaan pertama. Room sementara bisa hilang jika proses berhenti.
- Socket.IO membutuhkan backend Node.js yang hidup; jangan deploy `server.js` sebagai Vercel Function.
- Socket.IO client dimuat dari jsDelivr CDN. Jika CDN diblokir, frontend tidak dapat tersambung.
- Web Crypto, kamera, geolokasi, dan akses media memerlukan browser yang mendukung API terkait; kamera/geolokasi umumnya membutuhkan HTTPS atau localhost.
- Ini MVP yang belum diaudit keamanan. Link undangan lengkap mengandung informasi untuk mengakses room/dekripsi. Jangan menganggapnya cocok untuk data sensitif tanpa audit independen.

## Tema visual dan prompt proyek

Tema visual Xarc Massage menggunakan palet cyberpunk ungu-hitam dengan aksen ungu neon. Override visual ditambahkan di akhir `public/style.css` agar struktur layout dan fitur yang ada tetap dipertahankan. Prompt lengkap untuk pengembangan/deployment berikutnya tersedia di `PROMPT-DEPLOYMENT.txt`.
