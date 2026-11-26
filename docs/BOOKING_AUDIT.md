# Audit Booking Coach — RATA

Tanggal audit: **26 November 2026, WITA**. Ruang lingkup: aturan jadwal, kapasitas coach lintas private/Kuyy, perubahan penawaran dan availability, penerimaan bersamaan, serta perlindungan booking lama.

## Kesimpulan

Implementasi awal memiliki celah double booking: private booking memeriksa `slot_requests`, sedangkan penugasan coach pada sesi lain berada di `play_sessions`. Kedua jalur belum menggunakan pemeriksaan bentrok dan penguncian transaksi yang sama. Penawaran juga dapat diterima setelah availability berubah, dan perubahan sesi private dapat membuat jadwal sesi berbeda dari request asalnya.

Patch menambahkan pemeriksaan kapasitas bersama, transaksi yang menyerialkan perubahan kalender, validasi ulang sebelum mengirim/menerima harga, dan identitas penawaran untuk menolak persetujuan terhadap harga yang sudah berubah. Booking yang sudah diterima tetap dipertahankan. Migrasi hanya menambahkan metadata penugasan; tidak membatalkan, memindahkan, atau menulis ulang booking lama.

**Seluruh 230 baris seed cocok dengan spreadsheet. Slot 30 menit dan batas waktu akhir eksklusif sudah benar pada baseline.** Keduanya dipertahankan dan dilindungi regression test.

Audit ini memeriksa sumber dan database pengujian lokal. **Tidak ada deploy, pembacaan database produksi, atau perubahan database produksi.** Kesamaan seed dengan spreadsheet tidak membuktikan bahwa seluruh data produksi masih sama dengan seed.

## Sumber dan baseline

- [PR #14 — fitur booking coach](https://github.com/marsverse77/ratateamtennis/pull/14).
- [Commit baseline 25 November 2026: `0809ec7f54eb80a9d0668e0fae19db38e76332a0`](https://github.com/marsverse77/ratateamtennis/commit/0809ec7f54eb80a9d0668e0fae19db38e76332a0).
- [Implementasi booking pada baseline](https://github.com/marsverse77/ratateamtennis/blob/0809ec7f54eb80a9d0668e0fae19db38e76332a0/public/api/lib/booking.php).
- [RATA | Jadwal Coach & Data App](https://docs.google.com/spreadsheets/d/18KQuD4NE54kxcAMSGYD8lDHlIORo4qJd3up9iirbnls/edit): metadata dan seluruh isi relevan dari empat tab dibaca pada 26 November 2026. Timezone sumber adalah `Asia/Makassar`.

Tab **Data App**, `sheetId=365055272`, merupakan sumber jadwal: header `A1:M1`, data `A2:M231`. Tab **Aturan App**, `sheetId=936111478`, memuat 19 aturan pada `A5:B23`. Tab **Degung & Jordy** (`516398608`) dan **Anjas** (`925960376`) merupakan preview visual, bukan sumber yang mengalahkan Data App.

## Audit seluruh aturan spreadsheet

Referensi sel di tabel berikut mengacu pada tab **Aturan App**. Kolom hasil membedakan perilaku yang sudah benar, perbaikan patch, dan hal yang belum dapat dikonfirmasi dari sumber.

| Sel | Aturan | Hasil audit dan penanganan |
| --- | --- | --- |
| A5:B5 | Impor Data App mulai header baris 1; refresh preview setelah data berubah. | Seed cocok dengan Data App. Impor dilakukan saat inisialisasi; setelah itu admin mengedit jadwal di aplikasi. Tidak ada sinkronisasi Sheets otomatis. |
| A6:B6 | WITA/Asia/Makassar; jam `HH:mm`; Senin=1, Minggu=7. | Timezone aplikasi dan representasi seed sesuai. Patch juga menolak tanggal kalender yang tidak valid, bukan hanya format yang benar. |
| A7:B7 | Satu baris satu slot, maksimal 60 menit; pertahankan `:30` dan sisa 30 menit; jam akhir tidak termasuk. | Sudah benar di seed, request, sesi, dan tampilan. Patch mempertahankan interval asli dan menambah validasi rentang sebelum request/harga/accept. |
| A8:B8 | `degung_jordy` adalah satu kapasitas gabungan. | Seed dan pilihan coach menggunakan satu key. Pemetaan penugasan ke Degung atau Jordy tetap memakai kapasitas gabungan tersebut. |
| A9:B9 | Data mencakup 06:00–22:00, termasuk default; jangan auto-buka di luar itu. | Tidak ada slot hasil fabrikasi di UI. Validasi request menolak interval di luar batas tersebut. |
| A10:B10 | `AVAILABLE_FIXED` dapat diminta, lapangan sudah ditentukan, belum berarti confirmed. | Request mempertahankan lapangan sumber. Status available tidak mengunci; validasi ulang menolak lapangan yang berubah atau fixed court yang kosong. |
| A11:B11 | `AVAILABLE_FIND_COURT` dapat diminta; pemesan mencari lapangan; court kosong disengaja. | Seed mempertahankan court kosong. Form meminta lokasi dari pemesan; lokasi itu menjadi bagian syarat booking. |
| A12:B12 | `BLOCKED_REGULAR` tidak bisa dibooking, termasuk private/regular/kids/program venue. | Bukan anggota `SLOT_OPEN`; request langsung ditolak. Penawaran lama tidak dapat melewati perubahan ke status blocked. |
| A13:B13 | `BLOCKED_KUYY` tidak boleh ditawarkan sebagai booking langsung. | Status tetap tertutup dan diperlakukan sebagai komitmen Kuyy mingguan; penugasan bertanggal juga diperiksa melalui kapasitas sesi yang tercatat di aplikasi. |
| A14:B14 | `NOT_AVAILABLE` tidak tersedia. | Tidak dapat diminta; pengecekan ulang dilakukan saat harga/accept. |
| A15:B15 | `OFF` adalah libur; Minggu untuk kedua jadwal. | Seluruh 32 slot Minggu sesuai sumber dan tertutup. |
| A16:B16 | Degung/Jordy: Minggu off; waktu tanpa agenda Senin–Sabtu available dengan court dicari sendiri. | Seluruh default sudah eksplisit dalam seed dan cocok dengan sumber; tidak diubah oleh patch. |
| A17:B17 | Anjas: Minggu off; Selasa/Jumat di luar jadwal tidak tersedia; Sabtu sebelum 12:00 tidak tersedia tanpa entri eksplisit. | Seluruh default sesuai Data App. Patch tidak membuka hari/jam tambahan. |
| A18:B18 | Anjas: Senin/Rabu/Kamis dan Sabtu setelah 12:00 tanpa agenda dapat diminta dengan court dicari sendiri. | Sesuai seed; tetap menggunakan slot eksplisit. |
| A19:B19 | Konfirmasi interpretasi sebelum go-live: Udayana Senin 07:00–09:00 untuk Degung/Jordy dianggap available; CTC Selasa “5–9” untuk Anjas dianggap 17:00–21:00. | **Belum ada bukti konfirmasi tambahan.** Interpretasi dan catatan sumber dipertahankan, tidak diam-diam dinyatakan sudah disetujui. |
| A20:B20 | Nama murid tidak dimasukkan; nama sesi, court, status tetap ada. | Seed tidak memuat nama murid. Kalender publik hanya mengungkap waktu sibuk. Patch juga menutup akses detail private lewat ID langsung; detail request/sesi dibatasi ke pemesan/admin. |
| A21:B21 | `AVAILABLE_PRIVATE_OR_KUYY` adalah satu kapasitas Anjas: private atau penugasan pada sesi Kuyy yang sudah ada. | Celah lintas tabel diperbaiki: private request dan penugasan sesi memakai kapasitas coach yang sama. |
| A22:B22 | Request private belum mengunci; sebelum menerima private atau mengonfirmasi Kuyy, periksa kedua kanal. | Pending tetap tidak mengunci. Accept dan create/edit penugasan memakai pemeriksaan reciprocal dalam transaksi bersama; bentrok ditolak. |
| A23:B23 | Jika ditugaskan, kunci seluruh partisipasi Anjas: Rabu 19:30–21:00, Jumat 19:00–21:00. Rabu 21:00–22:00 private saja; Jumat di luar jadwal tidak tersedia. | Penugasan Anjas dengan kanal Kuyy memakai seluruh window tersebut. End-exclusive menjaga private Rabu 21:00–22:00 tetap dapat berdampingan. |

### Bukti kesesuaian seed dan slot 30 menit

Perbandingan mekanis mencocokkan semua 230 baris pada sepuluh field yang disimpan: slot key, coach key, nama coach, hari ISO, start, end, court, status, program, dan note. **Tidak ditemukan selisih.** Semua hari pada kedua jadwal menutup 06:00–22:00 secara berurutan tanpa gap atau overlap. Kolom sumber `minutes` konsisten dengan selisih end–start; nama hari dan durasi tidak perlu disimpan ulang untuk mempertahankan interval.

Sepuluh slot available berdurasi 30 menit berada pada Data App baris **27, 31, 54, 57, 61, 65, 133, 165, 176, dan 180**. Baris 130 dan 163 juga 30 menit, tetapi merupakan CTC `BLOCKED_REGULAR`.

| Data App | Slot Anjas | Status dan konsekuensi |
| --- | --- | --- |
| Baris 164 | Rabu 19:30–20:30 | Private atau Kuyy; satu kapasitas. |
| Baris 165 | Rabu 20:30–21:00 | Private atau Kuyy; **30 menit**, tidak diperpanjang menjadi 21:30. |
| Baris 166 | Rabu 21:00–22:00 | `AVAILABLE_FIXED`, private saja; tidak bentrok dengan Kuyy yang berakhir 21:00. |
| Baris 197–198 | Jumat 19:00–20:00 dan 20:00–21:00 | Private atau Kuyy; penugasan Kuyy mengunci seluruh 19:00–21:00. |
| Baris 199 | Jumat 21:00–22:00 | `NOT_AVAILABLE`. |

Frontend menggabungkan hanya baris **tertutup** yang bersebelahan dengan status/program/court sama. Slot available tetap ditampilkan satu per satu, sehingga penggabungan visual tidak menambah durasi atau kapasitas.

## Masalah baseline yang terkonfirmasi

| Masalah | Penyebab dan dampak | Perbaikan |
| --- | --- | --- |
| Double booking lintas kanal | `slot_taken()` hanya membaca request `approved`; `session_save()` tidak melakukan pemeriksaan reciprocal. Sesi Kuyy/ordinary coaching dan private dapat memakai coach bersamaan. | Pemeriksaan bersama terhadap request dan penugasan `play_sessions`, termasuk perubahan jadwal sesi. |
| Race pada accept dan keputusan request | `request_action()` membaca state sebelum transaksi tanpa membaca ulang setelah memperoleh lock. Accept bersamaan dapat membuat lebih dari satu sesi; aksi cancel/reject/decline/price yang memakai state lama dapat menimpa keputusan baru. | Semua penulis kalender memperoleh mutex sebelum membaca state kritis; validasi dan mutation berada dalam transaksi yang sama. |
| Penawaran bertahan setelah availability/court berubah | Price/accept tidak memastikan bahwa template saat ini masih memenuhi syarat request. | Validasi ulang template, interval, tanggal, status, dan court; perubahan syarat slot membatalkan penawaran lama untuk ditinjau kembali. |
| Persetujuan terhadap harga yang sudah diganti | Client hanya mengirim tindakan accept, tanpa mengikatnya pada penawaran yang dilihat. | `quote_token` mencakup syarat penawaran. Token lama/missing ditolak agar member melihat syarat terbaru sebelum menerima. |
| Sesi private dan request berbeda jadwal | Admin dapat mengedit waktu/court/coach sesi yang berasal dari request, sementara snapshot request masih mengunci waktu lama. | Kapasitas booking private yang sudah diterima tidak dapat diubah secara independen melalui editor sesi. |
| Booking lama hilang dari overlay | UI mencari booking hanya saat `slot.open` true; menutup template membuat booking lama tidak terlihat pada kalender. | Overlay booking tetap muncul di atas template tertutup, dengan batas privasi yang sama. |
| Detail private dapat dibuka langsung | Daftar sesi menyaring private, tetapi `GET sessions/:id` tidak memeriksa pemilik sebelum mengembalikan detail. | Endpoint detail memeriksa pemesan/admin sebelum membaca hasil dan melakukan perapian jadwal; akses pihak lain ditolak. |
| Tanggal tidak nyata lolos format | Regex tanggal dan `strtotime()` menerima tanggal yang dinormalisasi, misalnya tanggal di luar jumlah hari bulan. | Validasi kalender dengan round-trip tanggal yang ketat. |

Status **paid** bukan celah tersendiri: penyimpanan request tetap `approved`, sementara label paid dihitung dari pembayaran registrasi. Pemeriksaan kapasitas tetap harus menganggapnya terisi. Patch tidak mengubah aturan harga, jumlah pembayaran, reward, atau histori pembayaran.

## Desain patch dan kompatibilitas

### Satu transaksi untuk perubahan kalender

`booking_write()` memakai row `meta.schema` sebagai mutex kalender yang sama: row lock pada InnoDB dan writer lock pada SQLite. Lock diambil sebelum pembacaan request/slot/penugasan yang menentukan keputusan. Alur request, harga/accept, edit slot, serta create/edit/delete sesi melewati transaksi ini. Jika gagal, perubahan database dan notifikasi yang belum dikirim dibatalkan bersama.

Urutan write-lock sebelum read sesuai perilaku database yang didokumentasikan: pada InnoDB, pembacaan konsisten memakai snapshot, sedangkan UPDATE memperoleh lock pada row yang dituju; pada SQLite, write statement pertama memulai transaksi penulis. Referensi: [MySQL consistent reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html), [InnoDB locks](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html), dan [SQLite transactions](https://www.sqlite.org/lang_transaction.html).

Pemilihan mutex global sengaja sederhana dan dapat diaudit: dua penulis kalender tidak dapat sekaligus menganggap kapasitas yang sama masih kosong. Konsekuensinya, penulisan kalender coach berbeda juga bergiliran; ini dapat ditinjau kembali bila volume meningkat, dengan tetap mempertahankan invariant lintas kanal.

Perubahan eksplisit suatu slot Anjas menjadi `BLOCKED_KUYY` juga mengunci seluruh window partisipasi yang sesuai, termasuk bagian lain yang masih berlabel available. Perubahan menjadi komitmen mingguan ditolak jika menimpa booking private atau sesi non-Kuyy yang sudah ada; booking lama tidak dibatalkan sebagai efek samping. Status dual-use `AVAILABLE_PRIVATE_OR_KUYY` sendiri tetap belum merupakan penugasan.

### Identitas kapasitas dan kanal yang eksplisit

Schema 30 menambahkan `play_sessions.schedule_coach_keys` dan `schedule_channel`. Key jadwal tetap `anjas` atau `degung_jordy`; kanal membedakan sesi biasa, Kuyy, dan private yang berasal dari request. UI admin menyediakan pilihan kapasitas dan jenis penugasan. Metadata tersimpan menjaga blok kalender ketika judul sesi atau nama tampilan member kemudian berubah.

Untuk data lama, adapter kompatibilitas memakai nama coach yang cocok tepat setelah normalisasi dan member IDs yang dapat diresolusikan ke nama tersebut. Degung dan Jordy dipetakan ke satu kapasitas gabungan. Judul yang mengandung kata Kuyy hanya merupakan fallback data lama, **bukan bukti integrasi dengan layanan Kuyy**. Simpan pemetaan eksplisit untuk menghilangkan ketergantungan fallback itu. Mapping kosong yang sengaja disimpan berarti coach dilepas; field legacy tidak boleh menghidupkannya kembali.

### Booking dan data lama

Migrasi 29→30 bersifat aditif, mempertahankan mekanisme backup sebelum upgrade, dan tidak melakukan reseed atau backfill assignment. Request, sesi, registrasi, pembayaran, serta slot yang telah diedit admin tidak ditulis ulang. Perubahan availability tidak membatalkan booking accepted/paid yang sudah ada. Edit nonkapasitas pada sesi lama tetap diizinkan meskipun terdapat konflik historis; patch tidak mencoba menyelesaikan konflik lama secara diam-diam.

Jika race lama sudah meninggalkan sesi private tetapi request kembali berstatus requested/priced, patch menolak keputusan baru atas request itu. Sesi yang ada tetap dihitung sebagai occupancy melalui relasi `request_id`; aplikasi tidak membuat sesi kedua atau menghapus bukti masalah secara otomatis.

Migrasi baru **hanya disiapkan dan diuji pada database lokal sementara**. Aplikasi menjalankan migrasi saat membuka database setelah versi kode berubah; karena itu deploy patch ini juga merupakan langkah perubahan schema yang memerlukan persetujuan pemilik. Belum dilakukan deploy atau koneksi ke database produksi.

Client yang masih membuka versi lama halaman penawaran perlu refresh sebelum accept agar mengirim `quote_token`. Booking yang sudah accepted/paid tidak memerlukan token baru atau penerimaan ulang.

## Regression test dan verifikasi

Instruksi lengkap, dependensi, batas isolasi, serta cara menjalankan kasus individual tersedia di [tests/README.md](../tests/README.md).

```sh
python3 tests/booking_regression.py
python3 tests/booking_regression.py --backend mysql
```

Suite menjalankan API PHP asli dengan client terautentikasi terpisah pada salinan aplikasi dan database disposable. Mode MariaDB membuat datadir serta port loopback baru; runner tidak menerima DSN database produksi. Pengujian konkurensi menggunakan worker terpisah, termasuk overlap accept, Kuyy versus private, dan perubahan request/availability ketika acceptance sedang menunggu lock. Aplikasi tidak diberi delay atau hook khusus pengujian.

Cakupan meliputi 230 seed rows, kapasitas gabungan, slot 30 menit, adjacency, pending versus approved/paid, kedua arah private/Kuyy, full-window Anjas, stale quote, perubahan court, close/reopen, invalid date, perlindungan sesi private, mapping legacy/renamed, privacy, serta migrasi aditif yang mempertahankan data lama.

Hasil final pada patch yang diserahkan:

| Pemeriksaan | Hasil |
| --- | --- |
| MariaDB 11.8.9 / InnoDB, API asli | **45/45 kasus lulus** |
| SQLite, API asli | **42 lulus; 3 kasus lock InnoDB dilewati** dari 45 kasus |
| PHP 8.4.28 syntax check | **17 file lulus**, termasuk fixture CLI |
| JavaScript syntax check | **2 file lulus** (`app.js`, `i18n.js`) |
| `git diff --check` | Lulus |
| Kesesuaian kode dengan snapshot dua run final | Hash 31 file aplikasi identik; tidak ada perubahan aplikasi setelah snapshot test |

Pada baseline, pengujian berhasil mereproduksi dua accept HTTP 200 untuk satu request yang menghasilkan dua sesi private, accept private dan assignment Kuyy yang sama-sama berhasil, serta reprice yang meninggalkan fee sesi Rp175.000 tetapi harga request Rp225.000. GET detail private oleh member lain maupun anonymous juga mengembalikan 200; patch mengembalikan 403 untuk keduanya dan mempertahankan 200 bagi pemesan/admin. Semua ini terjadi pada database uji; bukan klaim bahwa kasus-kasus tersebut telah ditemukan di produksi.

Test migrasi menguji database schema 29 berisi booking approved/paid, registrasi, dan edit slot admin. Backup pra-upgrade dibandingkan dengan isi pasca-upgrade: baris request, pembayaran, slot, serta seluruh kolom lama sesi tetap sama; hanya dua kolom baru ditambahkan dengan default kosong.

## Batas audit dan tindak lanjut sebelum rollout

1. **Penugasan eksternal harus tercatat.** Repository tidak menyediakan API/feed Kuyy eksternal. Patch mencegah konflik untuk penugasan yang dikenal aplikasi; tidak dapat mengetahui assignment yang hanya berada di layanan lain, chat, atau catatan manual.
2. **Pemetaan legacy perlu diverifikasi.** Nama yang sudah berubah, alias yang tidak dikenal, atau identitas ambigu tidak dapat disimpulkan dari spreadsheet. Sebelum rollout, admin perlu memetakan penugasan aktif ke kapasitas yang tepat dan menandai kanal Kuyy secara eksplisit. Audit ini tidak membaca atau memperbaiki data produksi.
3. **Konflik historis tidak diselesaikan otomatis.** Booking lama dipertahankan. Daftar penugasan/booking aktif perlu direkonsiliasi sebelum pengguna bergantung pada kalender sebagai sumber kebenaran tunggal.
4. **Dua asumsi spreadsheet tetap terbuka.** Konfirmasi Udayana Senin 07:00–09:00 dan CTC Anjas Selasa 17:00–21:00 sesuai `Aturan App!B19` masih diperlukan. Patch mempertahankan interpretasi saat ini.
5. **Tidak mengarang aturan komersial.** Spreadsheet tidak mengatur tarif, expiry penawaran, pembayaran, refund, atau kebijakan cancellation. Perbaikan token/validasi menjaga konsistensi keputusan; tidak menetapkan aturan bisnis baru untuk hal tersebut.
6. **Persetujuan terpisah untuk penerapan.** Review patch, hasil test, pemetaan assignment, dan backup/migrasi terlebih dahulu. Deploy serta perubahan database produksi menunggu persetujuan pemilik.
