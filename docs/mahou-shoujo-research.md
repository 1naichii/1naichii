# Riset: Mahou Shoujo & Puella Magi Madoka Magica

Dokumen ini jadi dasar desain ulang `profile.svg` ke gaya **pixel art × mahou shoujo**.

## 1. Mahou shoujo (魔法少女) sebagai genre

### Garis waktu singkat

| Era | Karya kunci | Yang diwariskan ke genre |
| --- | --- | --- |
| 1966 | *Mahōtsukai Sally* (Toei) | Sering disebut anime magical girl pertama. Terinspirasi dub Jepang *Bewitched*. Sally penyihir sejak lahir dan tidak berubah wujud. |
| 1969 | *Himitsu no Akko-chan* | Kandidat "yang pertama" lainnya. Memperkenalkan **benda ajaib** (cermin kompak) untuk berubah wujud: cikal bakal *henshin item*. |
| 1973 | *Cutie Honey* | Urutan transformasi pertama yang menonjol. |
| 1980-an | *Minky Momo*, *Creamy Mami* | Gadis biasa diberi kekuatan oleh makhluk/peri pendamping. Transformasi jadi versi "dewasa" diri sendiri. |
| 1992 | *Sailor Moon* | Template modern: **tim** berwarna, maskot (Luna), *transformation sequence* panjang, nama jurus, monster mingguan, tema persahabatan. |
| 1998 | *Cardcaptor Sakura* | Koleksi kartu, kostum berganti, nada lembut. |
| 2004– | *Pretty Cure* | Magical girl yang bertarung fisik, franchise tahunan. |
| 2011 | *Puella Magi Madoka Magica* | **Dekonstruksi**: setiap konvensi di atas dibalik jadi biaya, kontrak, dan tragedi. |

### Konvensi visual & naratif

- **Maskot / makhluk pendamping**: imut, menawarkan kekuatan.
- **Benda transformasi**: kompak, tongkat, permata, bros.
- **Henshin**: siluet, pita, kilau, bintang, berakhir dengan pose.
- **Tim kode warna**: pink (pemimpin), biru, kuning, merah, ungu.
- **Motif**: pita, hati, bintang, permata, bulan, sayap.
- **Struktur episodik**: monster mingguan, lalu arc besar.

## 2. Puella Magi Madoka Magica (2011)

### Produksi

- Kreator: **Magica Quartet**, yaitu Akiyuki Shinbo (sutradara), Gen Urobuchi (skenario), Ume Aoki (desain karakter asli), dan Atsuhiro Iwakami (produser).
- Studio **Shaft**, didistribusikan Aniplex. Musik oleh **Yuki Kajiura**.
- Labirin witch digarap **Gekidan Inu Curry** (duo Ayumi Shiraishi "2-Shiroinu" & Yōsuke Anai "Doroinu"). Gayanya kolase kertas dan bahan sehari-hari yang terasa seperti stop-motion, terinspirasi animasi Rusia dan Ceko. Mereka diberi kebebasan penuh, termasuk menulis latar belakang setiap witch.

### Tema inti

- **Imut × gelap.** Produser Iwakami menyebut perpaduan kelucuan dan kegelapan sebagai tema sentral, dengan Kyubey sebagai lambangnya. Urobuchi menulis Kyubey bukan sebagai makhluk jahat, tapi makhluk tanpa perasaan, dan justru itu yang menakutkan (ia membandingkannya dengan monster Lovecraft).
- **Kontrak.** "僕と契約して魔法少女になってよ!" (*"Buat kontrak denganku dan jadilah magical girl!"*). Satu permohonan dikabulkan, tapi ditukar dengan bertarung melawan witch seumur hidup. Syarat penting tidak pernah disebutkan di awal.
- **Soul Gem.** Jiwa sang gadis dipindah ke dalam permata. Permata itu **keruh** karena memakai sihir dan karena keputusasaan, lalu dibersihkan dengan **Grief Seed** (dijatuhkan witch). Kalau keruh total, sang gadis berubah menjadi witch.
- **Harapan ↔ keputusasaan.** Siklusnya adalah harapan, lalu kontrak, keputusasaan, dan akhirnya menjadi witch. Sistem ini ada untuk memanen energi demi melawan **entropi** alam semesta.
- **Permohonan Madoka.** Di akhir, Madoka berharap untuk menghapus semua witch sebelum mereka lahir, di seluruh masa lalu dan masa depan. Permohonan itu **menulis ulang hukum alam semesta**, dan ia menjadi konsep (*Ultimate Madoka*).
- **Covert genre.** Tampilan awalnya terlihat seperti anime moe/CGDCT, padahal bukan.

### Bahasa visual

- **Desain karakter Ume Aoki**: bulat, chibi-ish, mata besar (Aoki juga pengarang *Hidamari Sketch*).
- **Soul gem tiap karakter** (warna versi anime): **Madoka pink**, **Homura ungu**, **Mami kuning**, **Sayaka biru**, **Kyoko merah**. Bentuknya permata berbentuk telur dengan mahkota/bingkai emas.
- **Pita merah** Madoka adalah hadiah ibunya, lalu diberikan ke Homura.
- **Kyubey**: tubuh putih, mata merah bulat, telinga kucing dengan bagian dalam pink, rumbai telinga panjang bercincin emas. Emotikon fandomnya `/人◕ ‿‿ ◕人\`.
- **Labirin witch**: kolase, potongan foto, gunting kertas, dan "runes" Inu Curry. Runes itu adalah sandi substitusi; menurut fandom teksnya dalam bahasa Jerman, dan pertama kali dipecahkan oleh fans Barat.
- **Kontras palet**: pastel cerah di dunia nyata, kolase saturasi tinggi di labirin.

## 3. Pixel art: aturan yang dipakai

- **Grid integer**: semua koordinat kelipatan ukuran pixel (2 px untuk teks, 3–8 px untuk sprite), plus `shape-rendering="crispEdges"`.
- **Bitmap font 5×7** digambar sebagai `<path>`. Font sistem tidak dipakai, jadi tampilannya identik di semua perangkat.
- **Palet terbatas** (± 20 warna), shading dengan **hard bands**, bukan gradient halus.
- **Sudut berundak** (notched corners) pada semua panel, seperti jendela JRPG.
- **Animasi diskret** (`calcMode="discrete"`) agar gerakannya patah-patah seperti sprite 8/16-bit.
- **Raster**: GIF diperkecil 3×, dikuantisasi ke 32 warna dengan palet bersama (tanpa dither agar tidak berkedip), lalu diperbesar dengan nearest-neighbor. Ikon tech dan avatar dipixelate langsung di SVG (filter `feFlood → feTile → feMorphology`, blok 3 px).

## 4. Pemetaan konsep → section profil

Semua section ada di **satu SVG** (`profile.svg`) yang digambar dari atas ke bawah, dengan palet serba pink. Body text memakai font pixel 3×5 proporsional, heading memakai 5×7.

**Aturan wording:** nuansanya terasa seperti Madoka Magica (kontrak, permohonan, soul gem, witch, harapan vs keputusasaan, makhluk putih tanpa nama), tapi **tidak pernah menyebut judul atau nama karakternya**. Data diri diambil dari CV dan dianonimkan, tanpa nama asli, lokasi, kontak pribadi, atau nama perusahaan dan kampus. Identitas yang dipakai hanya **Mochaa / naichii / 1naichii**.

| Section (tab) | Isi & konsep | Animasi |
| --- | --- | --- |
| **MAGICAL GIRL ID** | Dibuat sederhana dan lega: MOCHAA (font pixel polos, satu warna), a.k.a. naichii · 1naichii, *Versatile Software Engineer*. Kanan: wajah chibi sang heroine (rambut pink pendek, twin tail dengan pita merah, mata pink besar), tanpa nama dan tanpa kanji. | Bintang jatuh, wajah melayang naik-turun, dua sparkle berkedip |
| **THE CONTRACT** | Makhluk putih tanpa nama ("???"): *"Make a contract with me, and become a magical engineer!"*, syarat tidak diungkap. CLASS, ELEMENT, WISH. | Dialog mengetik, makhluk berkedip dan melompat, ▶ berkedip setelah dialog selesai, kursor ▶ berpindah baris |
| **TRANSFORMATION!** | GIF pixel. Caption: *A wish strong enough to rewrite fate*. | Sparkle burst di sekeliling bingkai |
| **GRIMOIRE.C** | `struct magical_girl` ringkas: class, element, ritual (SDD), spells, off_duty. Status bar dengan purity soul gem. | Kode mengetik baris demi baris, kursor status bar berkedip |
| **CURRENT ARC** | Arc 04 (sejak Aug 2026): Full-Stack Engineer untuk enterprise client. Misi: modernisasi web app internal, bot otomasi, cron job. | Charging bar per misi, tag ONGOING berkedip |
| **BATTLE LOG** | Timeline peran dari CV, satu baris per arc dan disamarkan: arc aktif (enterprise client), freelance AI security platform, news platform, backend intern, lab/teaching/research assistant, training arc bootcamp, origin arc (Computer Engineering, tanpa nama kampus/IPK). | Gem arc aktif melompat, tag ONGOING berkedip |
| **SIDE QUEST** | Open-source quest `ai-engineering-starter` (*"A practical starter for building reliable AI software."*), chip SPEC-DRIVEN / MULTI-AGENT / MIT, status IN PROGRESS. Kanan: spell chain CHANT: SPEC → CAST: BUILD → SEAL: REVIEW. | Penanda ◆ spell chain berputar, ▶ IN PROGRESS berkedip |
| **MAGIC ARSENAL** | Stack dari CV: Spells (TS, JS, PHP, Python), Charms (frontend), Wands (backend), Vaults (SQL, NoSQL & cache), Magic Circle, Familiars (dev & deploy). | Kursor pilihan melompat antar slot |
| **SOUL GEM STATUS** | Data GitHub: chip repos & followers, Transform Streak, Longest Battle, Spells / Year. Soul Gem Purity turun 15% per hari tanpa kontribusi. Heatmap DESPAIR → HOPE. | Kilau berjalan di purity bar, gem melayang |
| **JOIN THE TEAM** | *"Let's make something magical."*, X dan GitHub, pita, motto *"wish with intention, ship with confidence."* | Pita bergoyang |

Sepanjang margin ada **kelopak sakura berjatuhan**, dan di celah antar panel (dibuat lebih lebar agar lega) ada sparkle berkedip. Spasi antar kata di font kecil sengaja dibuat lebih lebar dari spasi antar huruf.

## Sumber

- [Puella Magi Madoka Magica (Wikipedia)](https://en.wikipedia.org/wiki/Puella_Magi_Madoka_Magica)
- [Kyubey (Wikipedia)](https://en.wikipedia.org/wiki/Kyubey)
- [Gekidan Inu Curry (Wikipedia)](https://en.wikipedia.org/wiki/Gekidan_Inu_Curry)
- [Madoka Magica: A Unique Animation Style](https://wherecreativityworks.com/madoka-magica-a-unique-animation-style/)
- [Puella Magi Wiki: Manga differences](https://wiki.puella-magi.net/Manga_differences) · [Science](https://wiki.puella-magi.net/Science)
- [Siliconera: soul gem keychains (warna per karakter)](https://www.siliconera.com/?p=1120698)
- [Fanlore: Magical Girl](https://www.fanlore.org/wiki/Magical_Girl)
- [TV Tropes: Magical Girl](https://tvtropes.org/pmwiki/pmwiki.php/Main/MagicalGirl) · [Cypher Language](https://tvtropes.org/pmwiki/pmwiki.php/Main/CypherLanguage)
- [Anime News Network: The Enduring History of Magical Girls](https://www.animenewsnetwork.com/watch/2021-06-04/the-enduring-history-of-magical-girls/.173513)
- [iFanboy: Pretty Transform, history of magical girl manga](https://ifanboy.com/articles/pretty-transform-the-definitive-history-to-magical-girl-manga/)
- [SF Encyclopedia: Puella Magi Madoka Magica](https://sf-encyclopedia.com/entry/puella_magi_madoka_magica)
