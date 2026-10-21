export const DEFAULT_CATEGORIES = {
    expense: [
        {
            name: "Makanan & Minum",
            slug: "food-drink",
            icon: "utensils",
            color: "#E9A12D",
            background_color: "#FFF0DB",
            subcategories: [
                {
                    name: "Sarapan",
                    icon: "sunrise",
                },
                {
                    name: "Makan Siang",
                    icon: "sun",
                },
                {
                    name: "Makan Malam",
                    icon: "moon",
                },
                {
                    name: "Tempat Makan",
                    icon: "utensils-crossed",
                },
                {
                    name: "Camilan",
                    icon: "cookie",
                },
                {
                    name: "Minuman",
                    icon: "glass-water",
                },
                {
                    name: "Sembako",
                    icon: "shopping-basket",
                },
                {
                    name: "Pesan Antar",
                    icon: "truck",
                },
                {
                    name: "Buah",
                    icon: "apple",
                },
                {
                    name: "Kopi",
                    icon: "coffee",
                },
                {
                    name: "Jajanan",
                    icon: "store",
                },
            ],
        },
        {
            name: "Bisnis",
            slug: "business-expense",
            icon: "briefcase-business",
            color: "#2994D6",
            background_color: "#E5F1FC",
            subcategories: [],
        },
        {
            name: "Belanja",
            slug: "shopping",
            icon: "shopping-bag",
            color: "#19A5DB",
            background_color: "#E5F5FC",
            subcategories: [
                {
                    name: "Pakaian",
                    icon: "shirt",
                },
                {
                    name: "Elektronik",
                    icon: "monitor",
                },
                {
                    name: "Rumah",
                    icon: "house",
                },
                {
                    name: "Kecantikan",
                    icon: "sparkles",
                },
                {
                    name: "Hadiah",
                    icon: "gift",
                },
                {
                    name: "Perangkat Lunak",
                    icon: "cpu",
                },
                {
                    name: "Peralatan",
                    icon: "wrench",
                },
                {
                    name: "Sepatu",
                    icon: "footprints",
                },
                {
                    name: "Belanja Online",
                    icon: "shopping-cart",
                },
                {
                    name: "Perawatan Kulit",
                    icon: "droplets",
                },
            ],
        },
        {
            name: "Transportasi",
            slug: "transportation",
            icon: "bus-front",
            color: "#8654C5",
            background_color: "#EFE8FA",
            subcategories: [
                {
                    name: "Bus",
                    icon: "bus-front",
                },
                {
                    name: "Kereta",
                    icon: "train-front",
                },
                {
                    name: "Taksi",
                    icon: "car-taxi-front",
                },
                {
                    name: "Bensin",
                    icon: "fuel",
                },
                {
                    name: "Parkir",
                    icon: "circle-parking",
                },
                {
                    name: "Perawatan",
                    icon: "wrench",
                },
                {
                    name: "Insurance",
                    icon: "shield-check",
                },
                {
                    name: "Tol",
                    icon: "route",
                },
                {
                    name: "Ojek Online",
                    icon: "bike",
                },
                {
                    name: "Pesawat",
                    icon: "plane",
                },
            ],
        },
        {
            name: "Tempat Tinggal",
            slug: "housing",
            icon: "house",
            color: "#5368BB",
            background_color: "#E9EBFA",
            subcategories: [
                {
                    name: "Sewa",
                    icon: "house",
                },
                {
                    name: "KPR",
                    icon: "landmark",
                },
                {
                    name: "Tagihan",
                    icon: "receipt",
                },
                {
                    name: "Internet",
                    icon: "wifi",
                },
                {
                    name: "Perawatan",
                    icon: "wrench",
                },
                {
                    name: "Perabotan",
                    icon: "armchair",
                },
                {
                    name: "Jasa",
                    icon: "handshake",
                },
                {
                    name: "Laundry",
                    icon: "washing-machine",
                },
                {
                    name: "Pulsa & Data",
                    icon: "smartphone",
                },
                {
                    name: "Listrik",
                    icon: "zap",
                },
                {
                    name: "Cleaning Supplies",
                    icon: "spray-can",
                },
            ],
        },
        {
            name: "Hiburan",
            slug: "entertainment",
            icon: "clapperboard",
            color: "#A5B828",
            background_color: "#F5F8DB",
            subcategories: [
                {
                    name: "Bioskop",
                    icon: "clapperboard",
                },
                {
                    name: "Game",
                    icon: "gamepad-2",
                },
                {
                    name: "Streaming",
                    icon: "tv",
                },
                {
                    name: "Acara",
                    icon: "calendar-days",
                },
                {
                    name: "Hobi",
                    icon: "palette",
                },
                {
                    name: "Perjalanan",
                    icon: "plane",
                },
                {
                    name: "Musik",
                    icon: "music-2",
                },
            ],
        },
        {
            name: "Kesehatan",
            slug: "health",
            icon: "heart-pulse",
            color: "#43A85C",
            background_color: "#E6F5E9",
            subcategories: [
                {
                    name: "Dokter",
                    icon: "hospital",
                },
                {
                    name: "Apotek",
                    icon: "pill",
                },
                {
                    name: "Gym",
                    icon: "dumbbell",
                },
                {
                    name: "Insurance",
                    icon: "shield-plus",
                },
                {
                    name: "Kesehatan Mental",
                    icon: "brain",
                },
                {
                    name: "Olahraga",
                    icon: "activity",
                },
            ],
        },
        {
            name: "Pendidikan",
            slug: "education",
            icon: "graduation-cap",
            color: "#8C685B",
            background_color: "#F0EAE7",
            subcategories: [
                {
                    name: "SPP",
                    icon: "school",
                },
                {
                    name: "Buku",
                    icon: "book-open",
                },
                {
                    name: "Kursus",
                    icon: "book-open-check",
                },
                {
                    name: "Perlengkapan",
                    icon: "backpack",
                },
                {
                    name: "Alat Tulis",
                    icon: "pencil",
                },
            ],
        },
        {
            name: "Pribadi",
            slug: "personal",
            icon: "user-round",
            color: "#8053BC",
            background_color: "#EEE8F8",
            subcategories: [
                {
                    name: "Potong Rambut",
                    icon: "scissors",
                },
                {
                    name: "Spa",
                    icon: "flower-2",
                },
                {
                    name: "Kosmetik",
                    icon: "paintbrush",
                },
            ],
        },
        {
            name: "Keuangan",
            slug: "finance",
            icon: "wallet",
            color: "#169E8A",
            background_color: "#E0F4F0",
            subcategories: [
                {
                    name: "Pajak",
                    icon: "receipt-text",
                },
                {
                    name: "Biaya Admin",
                    icon: "banknote",
                },
                {
                    name: "Denda",
                    icon: "gavel",
                },
                {
                    name: "Insurance",
                    icon: "shield-check",
                },
                {
                    name: "Donasi/Sedekah",
                    icon: "hand-heart",
                },
                {
                    name: "Zakat/Persepuluhan",
                    icon: "hand-coins",
                },
            ],
        },
        {
            name: "Keluarga",
            slug: "family",
            icon: "users-round",
            color: "#E36A60",
            background_color: "#FBE9E7",
            subcategories: [
                {
                    name: "Pengasuhan Anak",
                    icon: "baby",
                },
                {
                    name: "Mainan",
                    icon: "toy-brick",
                },
                {
                    name: "School",
                    icon: "school",
                },
                {
                    name: "Hewan Peliharaan",
                    icon: "paw-print",
                },
                {
                    name: "Baby Gear",
                    icon: "baby",
                },
            ],
        },
        {
            name: "Tidak Tercatat",
            slug: "uncategorized",
            icon: "settings",
            color: "#888888",
            background_color: "#ECECEC",
            subcategories: [
                {
                    name: "Adjustment",
                    icon: "sliders-horizontal",
                },
                {
                    name: "Biaya Admin",
                    icon: "receipt",
                },
            ],
        },
        {
            name: "Teman",
            slug: "friends",
            icon: "handshake",
            color: "#D8B526",
            background_color: "#FFF9DB",
            subcategories: [
                {
                    name: "Transfer",
                    icon: "send",
                },
                {
                    name: "Traktir",
                    icon: "utensils",
                },
                {
                    name: "Refund",
                    icon: "undo-2",
                },
                {
                    name: "Loan",
                    icon: "hand-coins",
                },
                {
                    name: "Gift",
                    icon: "gift",
                },
            ],
        },
        {
            name: "Hewan Peliharaan",
            slug: "pets",
            icon: "paw-print",
            color: "#E99C40",
            background_color: "#FFF0DF",
            subcategories: [
                {
                    name: "Hewan Peliharaan",
                    icon: "paw-print",
                },
                {
                    name: "Makanan Hewan",
                    icon: "bone",
                },
                {
                    name: "Dokter Hewan",
                    icon: "stethoscope",
                },
                {
                    name: "Mainan",
                    icon: "toy-brick",
                },
                {
                    name: "Aksesoris",
                    icon: "shirt",
                },
                {
                    name: "Perawatan Diri",
                    icon: "scissors",
                },
            ],
        },
    ],
    income: [
        {
            name: "Gaji",
            slug: "salary",
            icon: "banknote",
            color: "#43A85C",
            background_color: "#E6F5E9",
            subcategories: [
                {
                    name: "Bulanan",
                    icon: "calendar-days",
                },
                {
                    name: "Mingguan",
                    icon: "calendar",
                },
                {
                    name: "Bonus",
                    icon: "star",
                },
                {
                    name: "Lembur",
                    icon: "clock",
                },
            ],
        },
        {
            name: "Bisnis",
            slug: "business-income",
            icon: "store",
            color: "#169E8A",
            background_color: "#E1F3F0",
            subcategories: [
                {
                    name: "Penjualan",
                    icon: "tag",
                },
                {
                    name: "Jasa",
                    icon: "handshake",
                },
                {
                    name: "Keuntungan",
                    icon: "trending-up",
                },
                {
                    name: "Paket XL",
                    icon: "package",
                },
            ],
        },
        {
            name: "Investasi",
            slug: "investment-income",
            icon: "trending-up",
            color: "#8FB94B",
            background_color: "#EFF5E5",
            subcategories: [
                {
                    name: "Dividen",
                    icon: "chart-pie",
                },
                {
                    name: "Bunga",
                    icon: "hand-coins",
                },
                {
                    name: "Kripto",
                    icon: "bitcoin",
                },
                {
                    name: "Saham",
                    icon: "chart-no-axes-combined",
                },
                {
                    name: "Real Estate",
                    icon: "building-2",
                },
            ],
        },
        {
            name: "Hadiah",
            slug: "gift-income",
            icon: "gift",
            color: "#AB48B8",
            background_color: "#F5E7F7",
            subcategories: [
                {
                    name: "Ulang Tahun",
                    icon: "cake",
                },
                {
                    name: "Hari Raya",
                    icon: "party-popper",
                },
                {
                    name: "Uang Saku",
                    icon: "wallet",
                },
            ],
        },
        {
            name: "Other",
            slug: "other-income",
            icon: "ellipsis",
            color: "#888888",
            background_color: "#ECECEC",
            subcategories: [
                {
                    name: "Pengembalian Dana",
                    icon: "undo-2",
                },
                {
                    name: "Hibah",
                    icon: "hand-heart",
                },
                {
                    name: "Lotere",
                    icon: "ticket",
                },
                {
                    name: "Penjualan Barang",
                    icon: "shopping-bag",
                },
            ],
        },
    ],
};
