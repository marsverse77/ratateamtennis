/* RATA Team: Bahasa Indonesia / English. The app is written in English; with Indonesian chosen,
   every piece of text that matches a phrase below is shown in Indonesian as soon as it appears on the page. */
(function () {
  'use strict';

  const KEY = 'bcs_lang';
  let lang = 'id';
  try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'id'; } catch (e) { /* storage blocked: Indonesian */ }

  const ID = {
    // Navigation and shell
    'Sessions': 'Sesi', 'Live Scores': 'Skor Live', 'Live': 'Live', 'Leaderboard': 'Leaderboard', 'Members': 'Member', 'Blog': 'Blog',
    'Rankings': 'Peringkat', 'Main': 'Utama', 'Tabs': 'Tab', 'Log in': 'Masuk', 'Log out': 'Keluar', 'Join': 'Gabung', 'the club': 'klub',
    'Join the club': 'Gabung klub', 'Join now': 'Gabung sekarang', 'My account': 'Akun saya', 'Activity': 'Aktivitas', 'Approvals': 'Persetujuan',
    'Finance': 'Keuangan', '+ New session': '+ Sesi baru', 'Member activity': 'Aktivitas member', 'Loading…': 'Memuat…',
    'Bali · Tennis Academy': 'Bali · Tennis Academy', 'Page not found': 'Halaman tidak ditemukan', 'Go home': 'Ke beranda', 'Hmm.': 'Hmm.',
    'Network error. Check your connection.': 'Gangguan jaringan. Cek koneksi kamu.', 'Logged in.': 'Berhasil masuk.', 'Logged out.': 'Berhasil keluar.',
    'Welcome back': 'Selamat datang kembali', 'New here?': 'Baru di sini?', 'Create one →': 'Buat akun →',

    // Home
    'Change photo': 'Ganti foto', 'Reset': 'Reset', 'Photo updated.': 'Foto diperbarui.', 'Go back to the original photo?': 'Kembali ke foto awal?',
    'Quality': 'Latihan', 'training': 'berkualitas', 'Real': 'Kompetisi', 'competition': 'sungguhan', 'Total RATA points': 'Total poin RATA',
    'Play session': 'Play session', 'Internal tournament': 'Turnamen internal', 'External tournament': 'Turnamen eksternal', 'Coaching session': 'Sesi coaching', 'Hitting session': 'Hitting session',
    'Good game.': 'Good game.', 'Good people.': 'Good people.', 'Good energy.': 'Good energy.', 'Pick a session, register, and play.': 'Pilih sesi, daftar, lalu main.',
    'Explore sessions': 'Lihat sesi', 'See sessions': 'Lihat sesi', 'Upcoming sessions': 'Sesi mendatang', 'Upcoming event': 'Acara mendatang',
    'View all sessions →': 'Lihat semua sesi →', 'Live now': 'Sedang live', 'Nothing live right now': 'Belum ada yang live',
    'No matches being played right now. Scores show up here as soon as a match starts.': 'Belum ada pertandingan berjalan. Skor muncul di sini begitu pertandingan dimulai.',
    'View live scores →': 'Lihat skor live →', 'Total points across all completed sessions': 'Total poin dari semua sesi yang selesai',
    'Points appear here once the first session is completed.': 'Poin muncul di sini setelah sesi pertama selesai.', 'Full rankings →': 'Peringkat lengkap →',
    'Meet the team.': 'Kenalan dengan tim.', 'Meet the members →': 'Lihat para member →', 'The people behind every great session.': 'Orang-orang di balik setiap sesi seru.',
    'Your next match starts here.': 'Pertandingan berikutnya mulai dari sini.', 'No upcoming sessions yet. Check back soon.': 'Belum ada sesi mendatang. Cek lagi nanti ya.',
    'No sessions scheduled yet.': 'Belum ada sesi terjadwal.', 'Watch live': 'Tonton live', "You're in ✓": 'Kamu terdaftar ✓', 'Find a session →': 'Cari sesi →',
    'A welcoming': 'Komunitas', 'community': 'yang ramah', 'Edit banner': 'Ubah banner', 'Homepage banner': 'Banner beranda',

    // Sessions
    'Upcoming': 'Mendatang', 'Past sessions': 'Sesi sebelumnya', 'No past sessions yet.': 'Belum ada sesi sebelumnya.', 'Create a session': 'Buat sesi',
    '+ Create a session': '+ Buat sesi', 'Create session': 'Buat sesi', 'Edit session': 'Ubah sesi', 'Duplicate session': 'Duplikat sesi', 'Duplicate': 'Duplikat',
    'Session': 'Sesi', 'Session type': 'Jenis sesi', 'Session status': 'Status sesi', 'Session date': 'Tanggal sesi', 'Date': 'Tanggal', 'Start time': 'Jam mulai',
    'End time': 'Jam selesai', 'Location': 'Lokasi', 'Court name, area': 'Nama lapangan, area', 'Courts': 'Lapangan', 'Court': 'Lapangan', 'Max players': 'Maks. pemain',
    'Fee': 'Biaya', 'Fee per player (Rp)': 'Biaya per pemain (Rp)', 'Notes': 'Catatan', 'Level, what to bring…': 'Level, apa yang perlu dibawa…', 'Title': 'Judul',
    'Format': 'Format', 'Game format': 'Format permainan', 'Singles': 'Singles', 'Doubles': 'Doubles', 'Scoring': 'Penilaian', 'Point system': 'Sistem poin',
    'Games to win': 'Game untuk menang', 'Points per match': 'Poin per pertandingan', 'Match length (minutes)': 'Durasi pertandingan (menit)', 'Rounds': 'Ronde', 'Round': 'Ronde',
    'Used to time each round in the schedule.': 'Dipakai untuk menghitung jam setiap ronde di jadwal.', 'Tiebreak': 'Tiebreak', 'Tiebreak to': 'Tiebreak sampai',
    'Tiebreak at games-all.': 'Tiebreak saat game sama.', 'No-ad (sudden death)': 'No-ad (sudden death)', 'At 40-40 the next point wins the game.': 'Saat 40-40, poin berikutnya memenangkan game.',
    'Normal tennis (15-30-40, games, tiebreak)': 'Tenis biasa (15-30-40, game, tiebreak)', 'Total points per match (Americano style)': 'Total poin per pertandingan (gaya Americano)',
    'Americano points (every point counts)': 'Poin Americano (setiap poin dihitung)', 'First to N points/games': 'Duluan mencapai N poin/game', 'Free scoring': 'Skor bebas',
    'Free (timed, no limit)': 'Bebas (berwaktu, tanpa batas)', 'Set the format and scoring below': 'Atur format dan penilaian di bawah',
    'Set the session. Generate the matches.': 'Atur sesinya. Buat pertandingannya.', 'Add results to overall leaderboard': 'Masukkan hasil ke leaderboard overall',
    'Session points will be added to each member\'s overall total.': 'Poin sesi akan ditambahkan ke total overall setiap member.',
    'Leave the fee at 0 for a free session. With a fee, players register by uploading their transfer proof.': 'Biarkan biaya 0 untuk sesi gratis. Kalau ada biaya, pemain mendaftar dengan mengunggah bukti transfer.',
    'Same settings, one week later. You can change the date and venue before saving.': 'Pengaturan sama, satu minggu kemudian. Tanggal dan tempat bisa diubah sebelum disimpan.',
    'Members only': 'Khusus member', 'Registration open': 'Pendaftaran dibuka', 'Registration closed': 'Pendaftaran ditutup', 'Close registration': 'Tutup pendaftaran',
    'Re-open registration': 'Buka lagi pendaftaran', 'Re-open session': 'Buka lagi sesi', 'Completed': 'Selesai', 'Finished': 'Selesai', 'Ended': 'Berakhir',
    'Draft': 'Draf', 'Drafts': 'Draf', 'Open': 'Buka', 'Disabled': 'Nonaktif', 'Status': 'Status', 'Session created.': 'Sesi dibuat.', 'Session updated.': 'Sesi diperbarui.',
    'Session deleted.': 'Sesi dihapus.', 'Session created. Now add players and generate the schedule.': 'Sesi dibuat. Sekarang tambahkan pemain dan buat jadwalnya.',
    'Delete this session and all its matches? This cannot be undone.': 'Hapus sesi ini beserta semua pertandingannya? Tidak bisa dibatalkan.',
    'Finish session ✓': 'Selesaikan sesi ✓', 'Finish this session? Points will be added to the overall leaderboard.': 'Selesaikan sesi ini? Poin akan masuk ke leaderboard overall.',
    'Start live session': 'Mulai sesi live', 'Notify members': 'Beri tahu member', 'Sends a push notification to every member who turned notifications on.': 'Mengirim notifikasi ke semua member yang mengaktifkan notifikasi.',
    'Session full': 'Sesi penuh', 'Full · join waiting list': 'Penuh · masuk daftar tunggu', 'Join the waiting list': 'Masuk daftar tunggu', 'Leave waiting list': 'Keluar dari daftar tunggu',
    'On the waiting list': 'Di daftar tunggu', 'Waiting list': 'Daftar tunggu', 'Waiting list (pay later)': 'Daftar tunggu (bayar nanti)', "You're on the waiting list.": 'Kamu masuk daftar tunggu.',
    "You're registered!": 'Kamu sudah terdaftar!', 'Registered': 'Terdaftar', 'Joined': 'Bergabung', 'Log in to register': 'Masuk untuk mendaftar', 'Log in to request to join': 'Masuk untuk minta bergabung',
    'Request to join': 'Minta bergabung', 'Request to join & upload proof': 'Minta bergabung & unggah bukti', 'Take the open spot': 'Ambil tempat yang kosong',
    'Cancel my spot': 'Batalkan tempat saya', 'Cancel your registration?': 'Batalkan pendaftaran kamu?', 'Cancel your spot? Refunds are handled by the admin.': 'Batalkan tempat kamu? Refund diurus oleh admin.',
    'Registration cancelled.': 'Pendaftaran dibatalkan.', 'Registered players': 'Pemain terdaftar', 'No players registered yet.': 'Belum ada pemain terdaftar.', 'No players yet.': 'Belum ada pemain.',
    'No one yet. Be the first!': 'Belum ada. Jadilah yang pertama!', 'Players': 'Pemain', 'Player': 'Pemain', 'Add a member…': 'Tambah member…', 'Add a member': 'Tambah member',
    'Choose a player…': 'Pilih pemain…', 'Player added.': 'Pemain ditambahkan.', 'Player removed.': 'Pemain dihapus.', 'Player confirmed.': 'Pemain dikonfirmasi.',
    'In this session': 'Di sesi ini', 'Other members (joins the session)': 'Member lain (ikut ke sesi)', 'Paid spots are full': 'Slot berbayar sudah penuh',
    'Paid spots full · join waiting list': 'Slot berbayar penuh · masuk daftar tunggu', 'Spots go to whoever uploads a transfer proof first.': 'Slot untuk yang duluan mengunggah bukti transfer.',
    'Members practise together. No games to score and no RATA points.': 'Member latihan bersama. Tanpa skor pertandingan dan tanpa poin RATA.',
    'Schedule': 'Jadwal', 'Generate schedule': 'Buat jadwal', 'Regenerate': 'Buat ulang', 'Schedule generated.': 'Jadwal dibuat.', 'Schedule updated.': 'Jadwal diperbarui.',
    'Schedule cleared.': 'Jadwal dihapus.', 'Clear': 'Hapus', 'Clear the whole schedule?': 'Hapus seluruh jadwal?', 'Replace the current schedule with a new one?': 'Ganti jadwal sekarang dengan yang baru?',
    'The match schedule will appear here once the admin generates it.': 'Jadwal pertandingan muncul di sini setelah admin membuatnya.', 'New round': 'Ronde baru', '+ Add a round': '+ Tambah ronde', 'Round added.': 'Ronde ditambahkan.',
    'Men only play men and women only play women. Courts are shared each round so both groups play about as often. Every player needs their gender set.': 'Pria hanya lawan pria dan wanita hanya lawan wanita. Lapangan dibagi tiap ronde supaya kedua grup main kurang lebih sama sering. Setiap pemain harus sudah diisi gendernya.',
    'Men': 'Pria', 'Women': 'Wanita', 'No gender set': 'Gender belum diisi',
    'Singles · Americano · Men vs men, women vs women': 'Single · Americano · Pria vs pria, wanita vs wanita',
    'Mexicano: round 1 is random. When a round is done, add the next round and players are paired by the current standings.': 'Mexicano: ronde 1 acak. Setelah satu ronde selesai, tambahkan ronde berikutnya dan pemain dipasangkan sesuai klasemen.',
    'Keeps the same gap between rounds.': 'Jarak antar ronde tetap sama.', 'Move the later rounds too': 'Geser juga ronde berikutnya', 'Keep it where it is': 'Biarkan di tempatnya',
    'Edit time': 'Ubah jam', 'Swap this match\'s time slot with': 'Tukar jam pertandingan ini dengan', 'Add a match': 'Tambah pertandingan', 'Add match': 'Tambah pertandingan',
    '+ Add a match (final, placement…)': '+ Tambah pertandingan (final, penentuan…)', 'Match added.': 'Pertandingan ditambahkan.', 'Match removed.': 'Pertandingan dihapus.', 'Remove match': 'Hapus pertandingan',
    'Remove this match from the schedule?': 'Hapus pertandingan ini dari jadwal?', 'Change players, swap or remove this match': 'Ganti pemain, tukar atau hapus pertandingan ini',
    'Pick anyone. Someone sitting out (or a member not in the session yet) is brought in. Someone on another court in this round swaps places with the player they replace.': 'Pilih siapa saja. Pemain yang sedang istirahat (atau member yang belum ada di sesi) akan dimasukkan. Pemain di lapangan lain pada ronde ini bertukar tempat dengan pemain yang digantikan.',
    'Up next': 'Berikutnya', 'Final': 'Final', 'Not started': 'Belum mulai', 'Playing': 'Sedang main', 'Court free': 'Lapangan kosong', 'Back to session': 'Kembali ke sesi', 'Back to schedule': 'Kembali ke jadwal',
    'Session leaderboard': 'Leaderboard sesi', 'Session rank': 'Peringkat sesi', 'Session history': 'Riwayat sesi', 'No completed sessions yet.': 'Belum ada sesi yang selesai.',
    'Live stream (YouTube / OBS)': 'Live stream (YouTube / OBS)', 'TV board · all courts': 'Papan TV · semua lapangan', 'Live view · updates automatically': 'Tampilan live · otomatis diperbarui',
    'Updates automatically every few seconds.': 'Otomatis diperbarui setiap beberapa detik.', 'When a session starts, live scores show up here for everyone.': 'Saat sesi dimulai, skor live muncul di sini untuk semua.',
    'No match in progress right now.': 'Belum ada pertandingan yang berjalan.', 'Live scores': 'Skor live', 'Just finished': 'Baru selesai', 'Score court': 'Skor lapangan',
    'Photos & reviews': 'Foto & ulasan', 'Reviews': 'Ulasan', 'Write a review': 'Tulis ulasan', 'How was it?': 'Gimana tadi?', 'How was it? Write a review': 'Gimana tadi? Tulis ulasan',
    'No photos or reviews yet. Played in this session? Tell us how it went and share your best shots.': 'Belum ada foto atau ulasan. Ikut main di sesi ini? Ceritakan dan bagikan foto terbaikmu.',
    'Nice community, great games…': 'Komunitasnya asik, permainannya seru…', 'Thanks for your review!': 'Terima kasih atas ulasannya!', 'Review deleted.': 'Ulasan dihapus.',
    'Delete this review and its photos?': 'Hapus ulasan ini beserta fotonya?', 'Write another': 'Tulis lagi', 'Add photos': 'Tambah foto', '+ Add photos': '+ Tambah foto',
    'Session page banner': 'Banner halaman sesi', 'Card banner': 'Banner kartu', 'Edit details & banner': 'Ubah detail & banner', 'Use banner': 'Pakai banner',
    'Optional. Pick one and crop it to fit.': 'Opsional. Pilih satu lalu potong agar pas.', 'Optional. Make them in Canva or similar at these sizes; you can adjust the crop after picking.': 'Opsional. Buat di Canva atau sejenisnya dengan ukuran ini; potongannya bisa diatur setelah dipilih.',
    'Saved, but the banner did not upload:': 'Tersimpan, tapi banner gagal diunggah:', 'Session #': 'Sesi #', 'Match #': 'Pertandingan #',

    // Session types
    'Session · Play Session': 'Sesi · Play Session', 'Coaching': 'Coaching', 'Hitting Session': 'Hitting Session', 'Tournament': 'Turnamen', 'Tournaments': 'Turnamen',
    '+1 RATA point for attending and every match won': '+1 poin RATA untuk hadir dan setiap menang', 'RATA points by final placement': 'Poin RATA dari peringkat akhir',
    'Sign up together; points from approved results': 'Daftar bersama; poin dari hasil yang disetujui', 'Attendance for rewards, no points': 'Kehadiran untuk reward, tanpa poin',
    'Practice with partners, no points': 'Latihan dengan partner, tanpa poin', 'Coaching · paid sessions count toward a free reward every 30': 'Coaching · setiap 30 sesi berbayar dapat 1 reward gratis',
    'External Tournament · RATA points from the result you submit after the event': 'External Tournament · poin RATA dari hasil yang kamu kirim setelah acara',
    'Hitting Session · no RATA points': 'Hitting Session · tanpa poin RATA', "Hitting Sessions don't give RATA points.": 'Hitting Session tidak memberi poin RATA.',
    'A tournament outside RATA that members sign up for together. There are no matches to score here: after the event, each player submits their result from the session page, and approved results add RATA points.': 'Turnamen di luar RATA yang diikuti member bersama. Tidak ada pertandingan yang dinilai di sini: setelah acara, setiap pemain mengirim hasilnya dari halaman sesi, dan hasil yang disetujui menambah poin RATA.',
    'Coaches': 'Coach', 'Coach': 'Coach', 'Other coaches (not members)': 'Coach lain (bukan member)', 'Names, separated by commas': 'Nama, pisahkan dengan koma',
    'Tick the coaches (one or more). For a coach who isn\'t a member, type the name. Coaches can confirm attendance.': 'Centang coach-nya (satu atau lebih). Untuk coach yang bukan member, ketik namanya. Coach bisa mengonfirmasi kehadiran.',
    'Coach (confirms coaching attendance)': 'Coach (mengonfirmasi kehadiran coaching)', 'Drills only': 'Drill saja', 'Drills': 'Drill', 'With games': 'Dengan game',
    'No games, no schedule or scoring': 'Tanpa game, tanpa jadwal atau skor', 'Games': 'Game', 'Hitting format': 'Format hitting', 'Hitting partner arrangement': 'Pengaturan partner hitting',
    'Skill level': 'Level skill', 'Tennis balls': 'Bola tenis', 'Provided': 'Disediakan', 'Bring your own': 'Bawa sendiri', 'Bring your own balls': 'Bawa bola sendiri', 'Tennis balls provided': 'Bola tenis disediakan',
    'Attendance': 'Kehadiran', 'Save attendance': 'Simpan kehadiran', 'Attendance saved.': 'Kehadiran disimpan.', 'Your attendance': 'Kehadiran kamu',

    // Payments
    'Registration fee': 'Biaya pendaftaran', 'Transfer to': 'Transfer ke', 'Bank': 'Bank', 'Account number': 'Nomor rekening', 'Account holder': 'Atas nama', 'Name on the account': 'Nama di rekening',
    'Account number copied.': 'Nomor rekening disalin.', 'Copy': 'Salin', 'BCA, Mandiri, BNI…': 'BCA, Mandiri, BNI…', 'Upload transfer proof': 'Unggah bukti transfer', 'Choose transfer proof': 'Pilih bukti transfer',
    'Upload & register': 'Unggah & daftar', 'Upload a screenshot or photo of the transfer.': 'Unggah screenshot atau foto transfernya.',
    'After you transfer, upload the proof. You\'re registered as soon as it\'s uploaded.': 'Setelah transfer, unggah buktinya. Kamu langsung terdaftar begitu bukti terunggah.',
    'Upload your transfer proof to take a spot. Spots go to whoever pays first.': 'Unggah bukti transfer untuk mengambil slot. Slot untuk yang duluan bayar.',
    "Your spot is held as soon as the proof is uploaded. If the admin can't match your transfer, you'll go back to the waiting list.": 'Slot kamu diamankan begitu bukti terunggah. Kalau admin tidak menemukan transfernya, kamu kembali ke daftar tunggu.',
    'We got your transfer proof. Your spot is held while the admin checks it.': 'Bukti transfer sudah diterima. Slot kamu diamankan selama admin mengecek.',
    'Proof uploaded. You\'re registered!': 'Bukti terunggah. Kamu sudah terdaftar!', 'Proof uploaded, waiting for admin check': 'Bukti terunggah, menunggu dicek admin',
    'Payment confirmed ✓': 'Pembayaran dikonfirmasi ✓', 'Your transfer proof was not accepted': 'Bukti transfer kamu tidak diterima', 'Transfer proof': 'Bukti transfer',
    'Payments': 'Pembayaran', 'Paid': 'Lunas', 'Not paid': 'Belum bayar', 'Proof to check': 'Bukti untuk dicek', 'Proofs to check': 'Bukti untuk dicek', 'To check': 'Perlu dicek', 'to check': 'perlu dicek',
    'View proof': 'Lihat bukti', 'Approve': 'Setujui', 'Reject': 'Tolak', 'Payment approved.': 'Pembayaran disetujui.', 'Payment cleared.': 'Pembayaran dihapus.', 'Proof rejected': 'Bukti ditolak',
    'Proof rejected. Player moved to the waiting list.': 'Bukti ditolak. Pemain dipindah ke daftar tunggu.', 'Why is the proof rejected? The player will see this.': 'Kenapa buktinya ditolak? Pemain akan melihat ini.',
    'Transfer not received': 'Transfer belum diterima', 'Mark paid (cash)': 'Tandai lunas (tunai)', 'Mark unpaid': 'Tandai belum bayar', 'Marked as paid.': 'Ditandai lunas.',
    'Clear this payment and move the player to the waiting list?': 'Hapus pembayaran ini dan pindahkan pemain ke daftar tunggu?', 'Free entry': 'Free entry', 'Remove free entry': 'Hapus free entry',
    'Free entries': 'Free entry', 'Free': 'Gratis', 'Registrations & payments': 'Pendaftaran & pembayaran', 'Finance recap': 'Rekap keuangan', 'Total received': 'Total diterima',
    'Registration fees paid by transfer or cash. Filter by session date or pick one session.': 'Biaya pendaftaran yang dibayar lewat transfer atau tunai. Filter berdasarkan tanggal sesi atau pilih satu sesi.',
    'All paid sessions': 'Semua sesi berbayar', 'No payments for this filter yet.': 'Belum ada pembayaran untuk filter ini.', 'Download CSV': 'Unduh CSV', 'Paid at': 'Dibayar',
    'Method': 'Metode', 'Amount': 'Jumlah', 'Transfer': 'Transfer', 'Cash': 'Tunai', 'cash': 'tunai', 'From': 'Dari', 'To': 'Sampai', 'This month': 'Bulan ini', 'Last month': 'Bulan lalu',
    'Refunds': 'Refund', 'Refunded': 'Sudah direfund', 'Mark refunded': 'Tandai sudah direfund', 'Marked as refunded.': 'Ditandai sudah direfund.', 'All paid back': 'Semua sudah dikembalikan',
    'Back to the refund list.': 'Kembali ke daftar refund.', 'Reason': 'Alasan', 'Removed by an admin': 'Dihapus oleh admin', 'Cancelled': 'Dibatalkan', 'Rp': 'Rp',

    // Leaderboard and points
    'By session': 'Per Aktivitas', 'Overall Ranking': 'Overall Ranking', 'Activity type': 'Jenis aktivitas', 'All': 'Semua', 'Overall': 'Overall',
    'RATA ranking points from Play Sessions (+1 for attending, +1 for every regular match you win), Internal Tournaments and External Tournaments. Points keep adding up.': 'Poin ranking RATA dari Play Session (+1 hadir, +1 setiap menang pertandingan reguler), Internal Tournament dan External Tournament. Poin terus terakumulasi.',
    'Total': 'Total',
    'Final tournament results': 'Hasil akhir turnamen', 'Approved achievements': 'Prestasi disetujui', 'Adjustment': 'Penyesuaian', 'By an admin': 'Oleh admin',
    'No RATA points here yet.': 'Belum ada poin RATA di sini.', 'matches': 'pertandingan', 'won': 'menang', 'lost': 'kalah', 'games won': 'game dimenangkan',
    'games won minus games lost': 'selisih game menang–kalah', 'ranking points. Tap the points to see the breakdown.': 'poin ranking. Ketuk poinnya untuk melihat rinciannya.',
    'RATA points': 'Poin RATA', '0 RATA points': '0 poin RATA', 'RATA ranking points': 'Poin ranking RATA', 'Overall rank': 'Peringkat overall', 'Overall ranking': 'Peringkat overall',
    'Total points': 'Total poin', 'Play Session points': 'Poin Play Session', 'Internal Tournament points': 'Poin Internal Tournament', 'External Tournament points': 'Poin External Tournament',
    'Regular matches won': 'Pertandingan reguler dimenangkan', 'Regular matches lost': 'Pertandingan reguler kalah', 'Games won': 'Game dimenangkan', 'Games lost': 'Game kalah',
    'Games won minus games lost': 'Selisih game menang dan kalah', 'How RATA points work': 'Cara kerja poin RATA', 'No points yet.': 'Belum ada poin.', 'No points that still count.': 'Belum ada poin yang masih berlaku.',
    'No RATA points yet. Play a Play Session to get your first one.': 'Belum ada poin RATA. Ikut Play Session untuk mendapatkan poin pertama.',
    'Play Session: +1 for attending and +1 for every regular match you win. Internal and External Tournaments: points for your final placement, and every player who takes part gets at least the participation points.': 'Play Session: +1 untuk hadir dan +1 setiap menang pertandingan reguler. Internal dan External Tournament: poin dari peringkat akhir, dan setiap peserta minimal mendapat poin partisipasi.',
    'W / L = regular matches won and lost · GW / GL = games won and lost · GD = GW minus GL · RATA pts = +1 for attending (Play Session) and +1 for every regular match won. Order: W, then GD, then GW, then head-to-head.': 'W / L = pertandingan reguler menang dan kalah · GW / GL = game menang dan kalah · GD = GW dikurangi GL · RATA pts = +1 hadir (Play Session) dan +1 setiap menang pertandingan reguler. Urutan: W, lalu GD, lalu GW, lalu head-to-head.',
    'W / L = regular matches won and lost · GW / GL = games won and lost · GD = GW minus GL · RATA pts = +1 for attending (Play Session) and +1 for every regular match won. Order: W, then GD, then GW, then head-to-head. The placement final decides the order between its players, with no points.': 'W / L = pertandingan reguler menang dan kalah · GW / GL = game menang dan kalah · GD = GW dikurangi GL · RATA pts = +1 hadir (Play Session) dan +1 setiap menang pertandingan reguler. Urutan: W, lalu GD, lalu GW, lalu head-to-head. Final penentuan menentukan urutan pemainnya, tanpa poin.',
    'Member': 'Member', 'Won': 'Menang', 'Lost': 'Kalah', 'Draw': 'Seri', 'pts': 'poin',

    // Placements and tournaments
    ', so nobody has RATA points from this tournament. When you mark the session Completed, places are given automatically from the final session leaderboard. Only open this to change them.': ', jadi belum ada yang dapat poin RATA dari turnamen ini. Saat sesi ditandai Selesai, peringkat diisi otomatis dari leaderboard sesi. Buka bagian ini hanya kalau mau mengubahnya.',
    'Final placements': 'Peringkat akhir', 'Confirm placements': 'Konfirmasi peringkat', 'Change placements': 'Ubah peringkat', 'Save draft': 'Simpan draf', 'Set placements (admin)': 'Atur peringkat (admin)',
    'Set placements from the leaderboard': 'Atur peringkat dari leaderboard', 'Draft saved. No points until you confirm.': 'Draf tersimpan. Belum ada poin sampai dikonfirmasi.', 'Draft saved.': 'Draf tersimpan.',
    'Placements confirmed. RATA points given.': 'Peringkat dikonfirmasi. Poin RATA diberikan.', 'Confirm the final placements? Players get their RATA points and a notification.': 'Konfirmasi peringkat akhir? Pemain mendapat poin RATA dan notifikasi.',
    'One player per place.': 'Satu pemain per peringkat.', 'Give both partners the same place; each gets the full points.': 'Beri kedua partner peringkat yang sama; masing-masing dapat poin penuh.',
    'With no 3rd-place match, use Joint 3rd for both semi-finalists. Everyone else gets Participation.': 'Tanpa perebutan juara 3, pakai Juara 3 bersama untuk kedua semifinalis. Yang lain dapat Partisipasi.',
    'Champion': 'Juara', 'Runner-up': 'Runner-up', '3rd place': 'Juara 3', 'Joint 3rd': 'Juara 3 bersama', '4th place': 'Juara 4', 'Participation': 'Partisipasi',
    'Semi-finalist': 'Semifinalis', 'Quarter-finalist': 'Perempat finalis', 'Placement final (no RATA points)': 'Final penentuan (tanpa poin RATA)', 'Final placement match · No RATA points': 'Pertandingan penentuan · Tanpa poin RATA',
    'An extra match to decide champion vs runner-up or another placing. It decides the order only: no point for the winner and no change to Played, W, L or games.': 'Pertandingan tambahan untuk menentukan juara vs runner-up atau peringkat lain. Hanya menentukan urutan: tanpa poin untuk pemenang dan tidak mengubah Played, W, L atau game.',
    'Make final': 'Jadikan final', 'Make regular': 'Jadikan reguler', 'Marked as a placement final: no RATA points.': 'Ditandai sebagai final penentuan: tanpa poin RATA.', 'Marked as a regular match.': 'Ditandai sebagai pertandingan reguler.',
    'Count this as a regular match (+1 RATA point per winner)': 'Hitung sebagai pertandingan reguler (+1 poin RATA per pemenang)', 'Make this an extra final that only decides placement (no RATA points)': 'Jadikan final tambahan yang hanya menentukan peringkat (tanpa poin RATA)',
    'Tournament results': 'Hasil turnamen', 'Your result': 'Hasil kamu', 'Submit my result': 'Kirim hasil saya', '+ Submit a result': '+ Kirim hasil', 'Submit a tournament result': 'Kirim hasil turnamen',
    'Add a tournament result': 'Tambah hasil turnamen', '+ Add a result': '+ Tambah hasil', '+ Add a result for a member': '+ Tambah hasil untuk member', 'Add result': 'Tambah hasil', 'Edit tournament result': 'Ubah hasil turnamen',
    'Played an outside tournament? Submit your result. Once an admin approves it, it adds RATA points.': 'Ikut turnamen di luar? Kirim hasilmu. Setelah disetujui admin, poin RATA bertambah.',
    'RATA points come from the result each player submits after the event. An admin approves it on the Approvals page.': 'Poin RATA berasal dari hasil yang dikirim setiap pemain setelah acara. Admin menyetujuinya di halaman Persetujuan.',
    'You can submit your result here once the tournament day comes.': 'Kamu bisa mengirim hasil di sini begitu hari turnamen tiba.', 'Submit for approval': 'Kirim untuk disetujui', 'Save and resubmit': 'Simpan dan kirim ulang',
    'Sent for approval. You will get a notification when it is checked.': 'Terkirim untuk disetujui. Kamu akan dapat notifikasi setelah dicek.', 'An admin checks it before it adds RATA points.': 'Admin mengecek dulu sebelum poin RATA bertambah.',
    'Saving sends it back to an admin for approval. Its RATA points are paused until it is approved again.': 'Menyimpan akan mengirimnya lagi ke admin untuk disetujui. Poin RATA-nya ditahan sampai disetujui lagi.',
    'Added by an admin, so it is approved straight away.': 'Ditambahkan oleh admin, jadi langsung disetujui.', 'Result added and approved.': 'Hasil ditambahkan dan disetujui.', 'Result updated.': 'Hasil diperbarui.',
    'Tournament approvals': 'Persetujuan turnamen', 'Approved External Tournament results': 'Hasil External Tournament yang disetujui', 'Waiting for approval': 'Menunggu persetujuan', 'Approved': 'Disetujui',
    'Not approved': 'Tidak disetujui', 'Needs changes': 'Perlu perbaikan', 'Ask for changes': 'Minta perbaikan', 'Approved. Points added.': 'Disetujui. Poin ditambahkan.',
    'What should the member change? They see this.': 'Apa yang perlu diperbaiki member? Mereka akan melihat ini.', 'Why is it not approved? The member sees this.': 'Kenapa tidak disetujui? Member akan melihat ini.',
    'Why are you changing this result? (kept in the audit log)': 'Kenapa hasil ini diubah? (disimpan di audit log)', 'Withdraw': 'Tarik', 'Withdraw this result?': 'Tarik hasil ini?', 'Withdrawn.': 'Ditarik.',
    'Delete this result? Any RATA points it gave are reversed.': 'Hapus hasil ini? Poin RATA yang sudah diberikan akan dibatalkan.', 'Delete (reverses points)': 'Hapus (poin dibatalkan)',
    'Tournament name, year, result. One per line, e.g. Bali Open 2025, semi final': 'Nama turnamen, tahun, hasil. Satu per baris, mis. Bali Open 2025, semifinal',
    'Tournament experience & achievements': 'Pengalaman & prestasi turnamen', 'Category': 'Kategori', 'Category level': 'Level kategori', 'Organizer': 'Penyelenggara', 'Club, federation…': 'Klub, federasi…',
    'Players or pairs in your category': 'Jumlah pemain atau pasangan di kategorimu', 'Result': 'Hasil', 'Results': 'Hasil', 'Proof': 'Bukti', 'Proof photo': 'Foto bukti', 'Or proof link': 'Atau link bukti',
    'Proof link ↗': 'Link bukti ↗', 'Draw, results board, certificate…': 'Bagan, papan hasil, sertifikat…', 'Partner (member)': 'Partner (member)', 'Partner name (if not a member)': 'Nama partner (kalau bukan member)',
    'Not a RATA member / no partner': 'Bukan member RATA / tanpa partner', 'Played with': 'Main bersama', 'Submitted by': 'Dikirim oleh', 'If approved:': 'Jika disetujui:', 'Not RATA points': 'Bukan poin RATA',
    'Notes for the admin': 'Catatan untuk admin', 'A photo is attached. Pick a new one to replace it.': 'Foto sudah terlampir. Pilih yang baru untuk menggantinya.', 'View event': 'Lihat acara',
    'Internal Tournaments with points': 'Internal Tournament dengan poin',
    'Proof photo (optional)': 'Foto bukti (opsional)', 'Or proof link (optional)': 'Atau link bukti (opsional)', '+ Add a tournament result': '+ Tambah hasil turnamen', 'Tournament result': 'Hasil turnamen',
    'Optional. Played outside tournaments? Add each result here. An admin checks it, and approved results add RATA points.': 'Opsional. Pernah ikut turnamen di luar? Tambahkan setiap hasilnya di sini. Admin akan mengecek, dan hasil yang disetujui menambah poin RATA.',
    'Your tournament results were sent to the admin for approval.': 'Hasil turnamen kamu sudah dikirim ke admin untuk disetujui.', 'Tournament experience (old notes)': 'Pengalaman turnamen (catatan lama)',
    'Written before results could be submitted. Add each one with “+ Submit a result” on the profile so it can earn RATA points, then clear this.': 'Ditulis sebelum hasil bisa dikirim. Tambahkan setiap hasil lewat “+ Kirim hasil” di profil supaya dapat poin RATA, lalu kosongkan ini.',

    // Scoring
    'Open scorer': 'Buka papan skor', 'Full screen': 'Layar penuh', 'Finish match': 'Selesaikan pertandingan', 'Finish this match with the current score?': 'Selesaikan pertandingan dengan skor sekarang?',
    'Match finished. Tap Reopen to change the score.': 'Pertandingan selesai. Ketuk Buka lagi untuk mengubah skor.', 'Reopen': 'Buka lagi', 'Reset': 'Reset', 'Reset this match to 0 : 0 and not started?': 'Reset pertandingan ini ke 0 : 0 dan belum mulai?',
    'Edit score': 'Ubah skor', 'Undo': 'Batalkan', 'Fault': 'Fault', 'Double fault': 'Double fault', 'Undo fault': 'Batalkan fault', 'Serving': 'Servis', 'Receiving': 'Menerima',
    'Change server': 'Ganti server', '🎾 Change server': '🎾 Ganti server', 'Set who is serving if it is wrong': 'Atur siapa yang servis kalau salah', 'Tap the player who is serving now': 'Ketuk pemain yang sedang servis',
    "Tap the name of the player who's serving.": 'Ketuk nama pemain yang servis.', 'Tap a player name to choose who serves first, then tap a side to score.': 'Ketuk nama pemain untuk memilih yang servis duluan, lalu ketuk satu sisi untuk menambah skor.',
    'Tap to add a point': 'Ketuk untuk menambah poin', 'Minus one for left team': 'Kurangi satu untuk tim kiri', 'Minus one for right team': 'Kurangi satu untuk tim kanan',
    '⇄ Switch sides': '⇄ Tukar sisi', 'Swap right and left': 'Tukar kanan dan kiri', 'Swap who plays on the right and left': 'Tukar siapa yang main di kanan dan kiri',
    'Switch the sides the players are shown on': 'Tukar sisi tampilan pemain', 'Switch court · players change ends': 'Pindah lapangan · pemain tukar sisi', 'Done, switched ⇄': 'Sudah, sudah tukar ⇄', 'Change ends': 'Tukar sisi',
    'Take over': 'Ambil alih', 'Take over scoring on this device? The other device stops scoring.': 'Ambil alih penilaian di perangkat ini? Perangkat lain berhenti menilai.', 'Start timer': 'Mulai timer',
    'Pause timer': 'Jeda timer', 'Resume timer': 'Lanjutkan timer', 'Timer paused · tap ▶ to carry on': 'Timer dijeda · ketuk ▶ untuk lanjut', 'Time!': 'Waktu habis!',
    'Time! Finish the point. If the games are level, tap Tiebreak.': 'Waktu habis! Selesaikan poinnya. Kalau game-nya sama, ketuk Tiebreak.', 'Game': 'Game', 'Left': 'Kiri', 'Right': 'Kanan',
    'This match is finished. Why are you changing it? (kept in the audit log)': 'Pertandingan ini sudah selesai. Kenapa diubah? (disimpan di audit log)', 'Saved live, everyone sees it': 'Tersimpan live, semua bisa melihat',
    'is scoring this match on another device': 'sedang menilai pertandingan ini di perangkat lain', 'Next:': 'Berikutnya:', 'vs': 'vs',

    // Members and profiles
    'Search members': 'Cari member', 'Search members…': 'Cari member…', 'Sort members': 'Urutkan member', 'Name A–Z': 'Nama A–Z', 'Most sessions': 'Sesi terbanyak', 'Newest members': 'Member terbaru',
    'No members found.': 'Member tidak ditemukan.', 'New member': 'Member baru', 'New members': 'Member baru', '+ New member': '+ Member baru', '+ Add member': '+ Tambah member', 'Edit member': 'Ubah member',
    'Delete member': 'Hapus member', 'Member deleted.': 'Member dihapus.', '‹ Members': '‹ Member', 'Player profile': 'Profil pemain', 'View profile': 'Lihat profil', 'Edit profile': 'Ubah profil',
    'Profile saved.': 'Profil disimpan.', 'Profile photo': 'Foto profil', 'Add a profile photo': 'Tambah foto profil', 'Change photo': 'Ganti foto', 'Use photo': 'Pakai foto', 'Adjust your photo': 'Atur foto kamu',
    'Drag to move, zoom to fit.': 'Geser untuk memindahkan, zoom agar pas.', 'Drag to move, zoom to fit. This square is exactly what shows on your member card and profile.': 'Geser untuk memindahkan, zoom agar pas. Kotak ini persis yang tampil di kartu member dan profilmu.',
    'Drag to move, zoom to fit. This frame is exactly what members will see.': 'Geser untuk memindahkan, zoom agar pas. Bingkai ini persis yang akan dilihat member.', 'Zoom': 'Zoom', 'Crop': 'Potong', 'Adjust crop': 'Atur potongan',
    'Full name': 'Nama lengkap', 'Name': 'Nama', 'Email': 'Email', 'Password': 'Kata sandi', 'New password': 'Kata sandi baru', 'At least 8 characters': 'Minimal 8 karakter', 'Leave empty to keep': 'Kosongkan jika tidak diubah',
    'WhatsApp number': 'Nomor WhatsApp', 'Instagram': 'Instagram', 'Gender': 'Jenis kelamin', 'Male': 'Laki-laki', 'Female': 'Perempuan', 'All genders': 'Semua gender', 'All levels': 'Semua level',
    'Tennis level': 'Level tenis', 'First Timer': 'First Timer', 'Newbie': 'Newbie', 'Beginner': 'Beginner', 'Intermediate': 'Intermediate', 'Advanced': 'Advanced', 'Role': 'Peran', 'Admin': 'Admin',
    'About you': 'Tentang kamu', 'Shown on your member card so people can find you.': 'Tampil di kartu member supaya orang bisa menemukanmu.', 'Optional. You can fill this in later.': 'Opsional. Bisa diisi nanti.',
    'Create account': 'Buat akun', 'Create an account': 'Buat akun', 'Create your member account to register for sessions and track your points.': 'Buat akun member untuk mendaftar sesi dan memantau poinmu.',
    'Log in to see your points and sessions.': 'Masuk untuk melihat poin dan sesimu.', "Account created, but the photo didn't upload:": 'Akun dibuat, tapi foto gagal diunggah:',
    'Email and password are optional. Add them so the member can log in. Members can also sign up themselves.': 'Email dan kata sandi opsional. Isi supaya member bisa masuk. Member juga bisa mendaftar sendiri.',
    'Scorekeeper (can score any match)': 'Pencatat skor (bisa menilai semua pertandingan)', 'Timeline': 'Timeline', 'Nothing here.': 'Belum ada apa-apa.', 'Nothing recorded yet.': 'Belum ada catatan.',
    'Nothing written yet.': 'Belum ada tulisan.', 'Show older': 'Tampilkan yang lama', 'Show recent only': 'Tampilkan yang terbaru saja', 'View full history': 'Lihat riwayat lengkap', 'Show everything': 'Tampilkan semua',
    'Write a comment…': 'Tulis komentar…', 'Comments': 'Komentar', 'You can follow it on your profile.': 'Kamu bisa memantaunya di profilmu.', 'Play at': 'Main di',

    // Rewards
    'Coaching rewards': 'Reward coaching', 'Rewards': 'Reward', 'Claim': 'Klaim', 'Claim a reward': 'Klaim reward', 'Reward claims': 'Klaim reward', 'Claimed by': 'Diklaim oleh', 'Claimed · waiting': 'Diklaim · menunggu',
    'Reward claimed. We will let you know when it is ready.': 'Reward diklaim. Kami kabari kalau sudah siap.', 'No reward claims waiting.': 'Tidak ada klaim reward yang menunggu.', 'Mark as given': 'Tandai sudah diberikan',
    'Marked as given.': 'Ditandai sudah diberikan.', 'Given': 'Sudah diberikan', 'Earned': 'Didapat', 'Available': 'Tersedia', 'Paid sessions': 'Sesi berbayar', 'paid sessions': 'sesi berbayar',
    'Only paid attendance counts toward rewards (1 reward every 30). A free reward session does not count.': 'Hanya kehadiran berbayar yang dihitung untuk reward (1 reward setiap 30). Sesi reward gratis tidak dihitung.',
    'to the next reward': 'lagi ke reward berikutnya', 'Cancelled. The reward is back in their wallet.': 'Dibatalkan. Reward kembali ke dompet mereka.',

    // Notifications
    'Notifications': 'Notifikasi', 'Turn on notifications': 'Aktifkan notifikasi', 'Turn on': 'Aktifkan', 'Turn off': 'Matikan', 'Notifications are off.': 'Notifikasi mati.',
    'Notifications are on. We\'ll let you know about new sessions.': 'Notifikasi aktif. Kami kabari kalau ada sesi baru.', 'Notifications are on for this device.': 'Notifikasi aktif di perangkat ini.',
    'Notifications were not allowed.': 'Notifikasi tidak diizinkan.', "Couldn't change notifications.": 'Gagal mengubah notifikasi.',
    'Get a notification on this device when a new session opens or your schedule is out.': 'Dapat notifikasi di perangkat ini saat sesi baru dibuka atau jadwalmu keluar.',
    'Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here.': 'Notifikasi diblokir untuk situs ini. Izinkan di pengaturan browser atau HP, lalu kembali ke sini.',
    "This browser can't show notifications. Try Chrome on Android, or Safari on iPhone after adding RATA to your home screen.": 'Browser ini tidak bisa menampilkan notifikasi. Coba Chrome di Android, atau Safari di iPhone setelah menambahkan RATA ke layar utama.',
    'Add to Home Screen': 'Tambahkan ke Layar Utama',

    // Admin
    'Everything members do on the site, newest first, with the date and time (WITA). It\'s kept for good. You also get a notification when someone signs up, joins or leaves a session, or sends a payment.': 'Semua yang dilakukan member di situs, terbaru di atas, dengan tanggal dan jam (WITA). Disimpan permanen. Kamu juga dapat notifikasi saat ada yang daftar, ikut atau keluar dari sesi, atau mengirim pembayaran.',
    'Everything': 'Semua', 'Only admins can see member activity.': 'Hanya admin yang bisa melihat aktivitas member.', 'Only admins see these': 'Hanya admin yang melihat ini', 'Audit log': 'Audit log',
    'Corrections and admin decisions, newest first. Points taps are kept in each match\'s own log.': 'Koreksi dan keputusan admin, terbaru di atas. Ketukan poin disimpan di log masing-masing pertandingan.',
    'Download data backup': 'Unduh cadangan data', 'A full copy of the app\'s data (members, sessions, matches, payments) as a JSON file': 'Salinan lengkap data aplikasi (member, sesi, pertandingan, pembayaran) dalam file JSON',
    'Banners': 'Banner', 'Cover photo': 'Foto sampul', 'No cover yet': 'Belum ada sampul', 'Remove photo': 'Hapus foto', 'Remove this photo from the banner?': 'Hapus foto ini dari banner?',
    'The photos slide every 5 seconds, in this order. Landscape photos work best (around 3:2); the sides may be cropped on phones. With no photos, the original picture is shown.': 'Foto berganti setiap 5 detik sesuai urutan ini. Foto landscape paling bagus (sekitar 3:2); sisi kiri-kanan bisa terpotong di HP. Tanpa foto, gambar awal yang ditampilkan.',
    'No photos yet: the original picture is shown.': 'Belum ada foto: gambar awal yang ditampilkan.', 'Photo added.': 'Foto ditambahkan.', 'Photo removed.': 'Foto dihapus.', 'Photo saved.': 'Foto disimpan.',
    'Photo deleted.': 'Foto dihapus.', 'Delete this photo?': 'Hapus foto ini?', 'Remove this photo?': 'Hapus foto ini?', 'Couldn\'t read that image.': 'Gambar tidak bisa dibaca.', "Couldn't load the photo.": 'Foto gagal dimuat.',
    'Uploading photo…': 'Mengunggah foto…', 'Uploading…': 'Mengunggah…', 'Upload': 'Unggah', 'Change image': 'Ganti gambar', 'Photo': 'Foto', 'Photo by': 'Foto oleh',

    // Blog
    'News, stories and press releases from the team.': 'Berita, cerita dan siaran pers dari tim.', 'Write a post': 'Tulis artikel', '+ Write a post': '+ Tulis artikel', 'Edit post': 'Ubah artikel',
    'No posts yet.': 'Belum ada artikel.', 'More posts': 'Artikel lainnya', 'View post': 'Lihat artikel', 'Post deleted.': 'Artikel dihapus.', 'Delete this post? This cannot be undone.': 'Hapus artikel ini? Tidak bisa dibatalkan.',
    'Publish': 'Terbitkan', 'Published.': 'Diterbitkan.', 'Unpublish (draft)': 'Batal terbit (draf)', 'Draft · only admins can see this': 'Draf · hanya admin yang bisa melihat', '‹ Blog': '‹ Blog',
    'Write your story. Leave an empty line between paragraphs.': 'Tulis ceritamu. Beri baris kosong di antara paragraf.', 'Summary': 'Ringkasan', 'Heading': 'Judul bagian', 'Quote': 'Kutipan', 'Text': 'Teks',
    'One or two sentences shown on the blog page and under the title': 'Satu atau dua kalimat yang tampil di halaman blog dan di bawah judul', 'Write the first one →': 'Tulis yang pertama →', 'Posting…': 'Mengirim…',
    'Leave an empty line between paragraphs. Photos go where the cursor is; the text in [ ] becomes the caption.': 'Beri baris kosong di antara paragraf. Foto masuk di posisi kursor; teks di [ ] jadi keterangan foto.',
    'Write': 'Tulis', 'Preview': 'Pratinjau', 'Only admins can write posts.': 'Hanya admin yang bisa menulis artikel.',

    // Common buttons and words
    'Save': 'Simpan', 'Save changes': 'Simpan perubahan', 'Save and confirm': 'Simpan dan konfirmasi', 'Saved.': 'Tersimpan.', 'Cancel': 'Batal', 'Cancel (back to wallet)': 'Batal (kembali ke dompet)',
    'Close': 'Tutup', 'Confirm': 'Konfirmasi', 'Confirmed': 'Terkonfirmasi', 'Not confirmed': 'Belum dikonfirmasi', 'Not confirmed yet': 'Belum dikonfirmasi', 'Delete': 'Hapus', 'Deleted.': 'Dihapus.',
    'Edit': 'Ubah', 'Update': 'Perbarui', 'Remove': 'Hapus', 'Add': 'Tambah', '+ Add': '+ Tambah', 'Apply': 'Terapkan', 'Done': 'Selesai', 'Send': 'Kirim', 'Post': 'Kirim', 'Share': 'Bagikan',
    'Change': 'Ubah', 'Hide': 'Sembunyikan', 'View': 'Lihat', 'Link': 'Link', 'Link copied.': 'Link disalin.', 'Pick one': 'Pilih satu', 'Choose…': 'Pilih…', 'Pick the member': 'Pilih member',
    'History': 'Riwayat', 'Before': 'Sebelum', 'After': 'Sesudah', 'When': 'Kapan', 'Who': 'Siapa', 'What': 'Apa', 'Browser': 'Browser',
    'session': 'sesi', 'players': 'pemain', 'joined': 'bergabung', 'member': 'member', 'other': 'lainnya', 'overall': 'overall', 'paid': 'lunas', 'proof': 'bukti', 'round': 'ronde', 'court': 'lapangan', 'reward': 'reward',
    'Only admins can create sessions.': 'Hanya admin yang bisa membuat sesi.', 'Only admins can review tournament results.': 'Hanya admin yang bisa meninjau hasil turnamen.',
    'May': 'Mei', 'Aug': 'Agu', 'Oct': 'Okt', 'Dec': 'Des', 'Sun': 'Min', 'Mon': 'Sen', 'Tue': 'Sel', 'Wed': 'Rab', 'Thu': 'Kam', 'Fri': 'Jum', 'Sat': 'Sab',
    // Chat
    'Chat': 'Chat', 'Chats': 'Chat', 'Create Chat Channel': 'Buat Chat Channel', 'Create channel': 'Buat channel', 'Chat channels': 'Chat channel', 'Session chats': 'Chat sesi',
    'Write a message…': 'Tulis pesan…', 'Send': 'Kirim', 'Delete this message?': 'Hapus pesan ini?', 'Delete channel': 'Hapus channel', 'Channel deleted.': 'Channel dihapus.',
    'Delete this channel and all its messages?': 'Hapus channel ini beserta semua pesannya?', 'Channel name': 'Nama channel', 'What is it about?': 'Tentang apa?', '(optional)': '(opsional)',
    'Only players in this session can see this': 'Hanya pemain di sesi ini yang bisa melihat', 'No messages yet': 'Belum ada pesan', 'No messages yet. Say hi!': 'Belum ada pesan. Sapa dulu!',
    'No messages yet. Say hi to the other players!': 'Belum ada pesan. Sapa pemain lainnya!', 'No messages yet. Start the conversation!': 'Belum ada pesan. Mulai obrolannya!',
    'No channels yet. Start the first one!': 'Belum ada channel. Buat yang pertama!', 'Join a session to chat with its players.': 'Ikut sesi untuk ngobrol dengan pemainnya.',
    'Chat channels are open to every member. Each session also has its own chat for the players in it.': 'Chat channel terbuka untuk semua member. Setiap sesi juga punya chat sendiri untuk pemainnya.',
    'A place to talk with all RATA members, like a forum. Every member can read and write in it.': 'Tempat ngobrol dengan semua member RATA, seperti forum. Semua member bisa membaca dan menulis di sini.',
    'Find a hitting partner, Sanur players…': 'Cari partner hitting, pemain Sanur…', '‹ Chats': '‹ Chat',
    'Only admins can see the audit log.': 'Hanya admin yang bisa melihat audit log.', 'Only admins can see the finance recap.': 'Hanya admin yang bisa melihat rekap keuangan.',
  };

  // Text with numbers or names in it.
  const MON = { May: 'Mei', Aug: 'Agu', Oct: 'Okt', Dec: 'Des' };
  const DAY = { Sun: 'Min', Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab' };
  const PATTERNS = [
    [/^(\d+) attended · (\d+) won$/, '$1 hadir · $2 menang'],
    [/^(\d+) tournaments · final results$/, '$1 turnamen · hasil akhir'],
    [/^(\d+) approved results$/, '$1 prestasi disetujui'],
    [/^RATA PTS breakdown · (.+)$/, 'Rincian RATA PTS · $1'],
    [/^(\d+) \/ (\d+) joined$/, '$1 / $2 bergabung'],
    [/^(\d+) waiting$/, '$1 menunggu'],
    [/^Opened by (.+) · open to all members$/, 'Dibuka oleh $1 · terbuka untuk semua member'],
    [/^(.+) joined$/, '$1 bergabung'],
    [/^(\d+) players$/, '$1 pemain'],
    [/^(\d+) sessions?$/, '$1 sesi'],
    [/^Recent 3 of (\d+) sessions$/, '3 terakhir dari $1 sesi'],
    [/^Registered players \((\d+)\)$/, 'Pemain terdaftar ($1)'],
    [/^Court (\d+) · Round (\d+)$/, 'Lapangan $1 · Ronde $2'],
    [/^Round (\d+)$/, 'Ronde $1'],
    [/^Court (\d+)$/, 'Lapangan $1'],
    [/^(\d+) courts?$/, '$1 lapangan'],
    [/^Score overlay · Court (\d+)$/, 'Overlay skor · Lapangan $1'],
    [/^Schedule · (.+)$/, 'Jadwal · $1'],
    [/^#(\d+) overall$/, '#$1 overall'],
  ];
  const DATES = [
    [/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m, d, n, mo) => `${DAY[d]}, ${n} ${MON[mo] || mo}`],
    [/\b(\d{1,2}) (May|Aug|Oct|Dec) (\d{4})\b/g, (m, n, mo, y) => `${n} ${MON[mo]} ${y}`],
  ];

  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  function tr(text) {
    if (lang !== 'id' || !text) return text;
    const key = norm(String(text));
    if (!key) return text;
    let out = ID[key];
    if (out === undefined) {
      for (const [re, to] of PATTERNS) if (re.test(key)) { out = key.replace(re, to); break; }
    }
    if (out === undefined) {
      let d = key;
      for (const [re, fn] of DATES) d = d.replace(re, fn);
      if (d !== key) out = d;
    }
    if (out === undefined || out === key) return text;
    const lead = /^\s*/.exec(text)[0];
    const tail = /\s*$/.exec(text)[0];
    return lead + out + tail;
  }

  // User writing (posts, reviews, comments, names in inputs) is never translated.
  const SKIP = 'script,style,textarea,[contenteditable],[data-notr],.post-body,.review-text,.comment-text';
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  function fixText(node) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP)) return;
    const t = tr(node.nodeValue);
    if (t !== node.nodeValue) node.nodeValue = t;
  }
  function fixAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); }
    }
    if (el.tagName === 'OPTGROUP' && el.label) { const t = tr(el.label); if (t !== el.label) el.label = t; }
  }
  function walk(root) {
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    fixAttrs(root);
    root.querySelectorAll('[placeholder],[title],[aria-label],optgroup').forEach(fixAttrs);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = it.nextNode(); n; n = it.nextNode()) fixText(n);
  }

  if (lang === 'id') {
    document.documentElement.lang = 'id';
    const start = () => {
      walk(document.body);
      new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === 'characterData') fixText(m.target);
          else if (m.type === 'attributes') fixAttrs(m.target);
          else m.addedNodes.forEach(walk);
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    const conf = window.confirm.bind(window);
    const prom = window.prompt.bind(window);
    const al = window.alert.bind(window);
    window.confirm = (m) => conf(tr(m));
    window.prompt = (m, d) => prom(tr(m), d);
    window.alert = (m) => al(tr(m));
  }

  window.BCS_LANG = {
    get: () => lang,
    t: tr,
    set(l) {
      try { localStorage.setItem(KEY, l); } catch (e) { /* not saved */ }
      location.reload();
    },
  };
})();
