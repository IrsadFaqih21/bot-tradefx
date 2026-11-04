# ⚡ Bot TradeFX - Aplikasi Android Bot Trading Binary Option Real-Time

**Bot TradeFX** adalah aplikasi trading otomatis (*auto bot*) binary option real-time untuk Android yang dirancang dengan antarmuka modern, bersih, dan berfokus murni pada **laba profit atau rugi** tanpa menampilkan grafik candlestick pasar real-time.

---

## 📱 Fitur Utama Aplikasi

1. **Auto Open Posisi Real-Time (Mulai & Stop)**:
   - Tombol besar **"🚀 MULAI AUTO BOT"** untuk langsung memulai analisa dan eksekusi otomatis posisi *CALL* (Naik ↗) atau *PUT* (Turun ↘).
   - Tombol **"🛑 STOP AUTO BOT"** untuk menghentikan seluruh aktivitas trading secara instan.
2. **Tampilan Murni Laba Profit / Rugi (Tanpa Candlestick)**:
   - Kartu Hero Laba/Rugi Net real-time dengan kode warna hijau neon (*Profit*) dan merah neon (*Loss*).
   - Indikator floating posisi aktif (*In The Money* / *Out of The Money*), penghitung mundur detik kontrak, selisih pip harga buka vs harga berjalan.
   - Tanpa distraksi grafik candlestick, menjaga psikologi trading tetap tenang dan fokus pada hasil matematis.
3. **5 Sidebar Akses Navigasi Bawah (Bottom Navigation)**:
   - 📜 **1. Riwayat Trading**: Catatan lengkap setiap order, filter Menang/Kalah, ringkasan Win Rate, serta tombol *Unduh CSV* dan pembersihan riwayat.
   - 🔌 **2. Tempat Menyambungkan Broker**: Hubungkan akun broker binary option resmi (**Deriv / Binary.com WebSocket**, **Quotex API**, **Pocket Option**, **Olymp Trade**, atau **Mesin Simulasi Real-time Bebas Risiko**).
   - ⚡ **3. Terminal (Dashboard Utama)**: Pusat kendali untuk memulai bot, melihat laba/rugi berjalan, status kontrak aktif, dan konsol *Live Execution Feed*.
   - 🎯 **4. Settingan Strategi**: Pilihan preset siap pakai (*AI Confluence*, *Scalper 1M*, *Trend Follower EMA*, *Bollinger Reversal*, *Safe Flat*), pemilihan aset (EUR/USD, Crypto, OTC, Synthetic Index), Money Management (*Martingale 1-5 step*, *Flat*, *Compounding*), serta batas otomatis *Take Profit* dan *Stop Loss*.
   - 👤 **5. Akun**: Profil trader VIP, pengalihan Akun Demo vs Real, tombol isi ulang saldo demo $10,000, sakelar efek suara audio (Web Audio synthesizer), getaran haptik Android (*vibration*), dan peringatan manajemen risiko.

---

## 📂 Struktur Folder Proyek

```
c:\project app trade\BOT TRADE\
├── android/                         <-- Proyek Native Android Studio Lengkap
│   ├── app/
│   │   ├── build.gradle             <-- Konfigurasi build Gradle Android (SDK 34)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml  <-- Izin Internet, Vibrate, WakeLock
│   │       ├── java/com/bottradefx/app/
│   │       │   ├── MainActivity.java    <-- WebView Android & Fullscreen Controller
│   │       │   └── WebAppInterface.java <-- Bridge Native Java ke JS (Vibrate & Toast)
│   │       ├── assets/              <-- Berkas aplikasi web yang telah disinkronkan
│   │       └── res/                 <-- Ikon aplikasi, warna, dan tema gelap
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradle.properties
├── css/
│   └── style.css                    <-- Desain UI Dark Fintech Android responsif
├── js/
│   ├── app.js                       <-- Pengontrol UI utama & navigasi tab
│   ├── botEngine.js                 <-- Mesin auto-trading real-time & kalkulator sinyal
│   ├── brokerService.js             <-- Konektor Deriv WebSocket, Quotex, Pocket Option, & Simulasi
│   ├── historyService.js            <-- Penyimpanan lokal riwayat & ekspor CSV
│   ├── strategyService.js           <-- Manajemen parameter strategi & preset
│   ├── audioService.js              <-- Efek audio sintetis Web Audio API (Win/Loss/Order)
│   └── accountService.js            <-- Pengaturan profil, getar haptik HP, & keamanan
├── index.html                       <-- File tampilan utama aplikasi Android
├── manifest.json                    <-- Android PWA Web App Manifest
├── service-worker.js                <-- Dukungan offline cache di HP Android
├── server.js                        <-- Web server lokal berkecepatan tinggi tanpa dependensi
├── sync-android.js                  <-- Script otomatis sinkronisasi aset ke folder Android
├── package.json
└── README.md
```

---

## 🚀 2 Cara Menjalankan & Memasang Aplikasi di HP Android

### Cara 1: Menggunakan Google Chrome di HP (Instan PWA / WebAPK)
1. Di komputer Anda, buka terminal di folder `c:\project app trade\BOT TRADE` dan jalankan:
   ```powershell
   node server.js
   ```
   *(atau `npm start`)*
2. Di layar terminal akan muncul alamat jaringan lokal, contoh:
   ```
   http://192.168.1.15:3000
   ```
3. Buka browser **Google Chrome** di ponsel Android Anda (pastikan HP dan komputer terhubung ke jaringan Wi-Fi yang sama).
4. Masukkan alamat IP tersebut.
5. Klik menu titik tiga di pojok kanan atas Chrome, lalu pilih **"Tambahkan ke Layar Utama" (Add to Home screen)** atau **"Instal Aplikasi" (Install App)**.
6. Aplikasi **Bot TradeFX** akan terpasang di HP Anda dengan ikon aplikasi dan berjalan dalam mode layar penuh persis seperti aplikasi native!

---

### Cara 2: Membuka & Mengompilasi APK di Android Studio
1. Buka software **Android Studio**.
2. Pilih menu **File &gt; Open**, lalu arahkan ke folder:
   ```
   c:\project app trade\BOT TRADE\android
   ```
3. Tunggu hingga proses *Gradle Sync* selesai.
4. Hubungkan HP Android Anda via kabel USB (aktifkan *USB Debugging*) atau jalankan Android Emulator.
5. Klik tombol hijau **Run (▶)** di Android Studio.
6. Aplikasi akan langsung ter-install dan berjalan di HP Android Anda!

---

## 💡 Panduan Penggunaan & Strategi

1. **Memilih Akun (Demo vs Real)**:
   - Secara default aplikasi berada di **Akun Demo ($10,000.00)** agar Anda bebas menguji kinerja bot tanpa risiko uang asli.
   - Klik badge DEMO di pojok kanan atas untuk beralih ke Akun REAL setelah Anda yakin dengan settingan strategi Anda.
2. **Menyambungkan Broker**:
   - Buka tab **Broker** (tombol kedua di navigasi bawah).
   - Pilih broker Anda (contoh: **Deriv / Binary.com**).
   - Masukkan API Token dari akun broker Anda, lalu klik **Sambungkan Broker**.
   - Lampu status di header akan berubah menjadi hijau dengan indikator latensi ping yang stabil (contoh: `25 ms`).
3. **Mengatur Strategi**:
   - Buka tab **Strategi** (tombol keempat di navigasi bawah).
   - Pilih preset siap pakai seperti **AI Confluence** (akurasi tinggi) atau sesuaikan parameter manual:
     - **Durasi Expiry**: 1 Menit (60 detik) direkomendasikan.
     - **Money Management**: Martingale 2.2x dengan maksimal 3 step kompensasi.
     - **Take Profit**: Misal `$50.00` (bot akan otomatis berhenti jika profit mencapai batas ini).
     - **Stop Loss**: Misal `$30.00` (bot akan otomatis berhenti jika batas rugi tersentuh).
   - Klik **Simpan Pengaturan Strategi**.
4. **Menjalankan Bot**:
   - Buka tab **Terminal** (tombol tengah berlogo petir/terminal).
   - Klik tombol besar hijau **"🚀 MULAI AUTO BOT"**.
   - Bot akan memindai pasar, memicu open posisi otomatis sesuai sinyal, menghitung waktu mundur kontrak, dan memperbarui laba profit atau rugi secara real-time!
   - Hasil setiap open posisi otomatis dicatat rapi di tab **Riwayat**.

