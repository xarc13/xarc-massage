# Xarc Massage v1.0.0 

Massage privat dengan enkripsi sisi browser AES-256-GCM. Frontend statis dipublikasikan,

## Fitur

- Create Private Room dan kapasitas 2–100 anggota.
- Kode undangan dan room sementara.
- Nama peserta anonim, status anggota, dan typing indicator.
- Pesan teks terenkripsi AES-256-GCM di browser.
- Berbagi file/foto/video, kamera, lokasi, QR code, dan pencarian room.
- Server hanya merelay ciphertext untuk pesan; tidak mendekripsi konten.

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
