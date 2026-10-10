import { useState } from "react";
import { LinkShortener } from "@/components/link-shortener";
import { QrReader } from "@/components/qr-reader";
import { QrStudio } from "@/components/qr-studio";
import { WhatsAppTool } from "@/components/whatsapp-tool";
import { WifiTool } from "@/components/wifi-tool";
import { ToolNotes } from "@/components/tool-notes";
import { cn } from "@/lib/utils";

type Tool = "qr" | "short" | "whatsapp" | "wifi" | "scan";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "qr", label: "QR code" },
  { id: "short", label: "Short link" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "scan", label: "Scan" },
];

const COPY: Record<Tool, string> = {
  qr: "Buat kode QR dari tautan atau teks, lalu unduh sebagai PNG.",
  short: "Pendekkan tautan panjang supaya mudah dibagikan atau dijadikan kode QR.",
  whatsapp: "Buat tautan chat WhatsApp dari nomor dan pesan.",
  wifi: "Buat kode QR yang langsung menyambungkan tamu ke Wi-Fi.",
  scan: "Baca isi kode QR lewat kamera atau dari gambar.",
};

const NOTES: Record<Tool, string[]> = {
  qr: [
    "Ketik tautan, nomor, atau teks apa pun. Gambar kode berubah seketika, tanpa tombol simpan.",
    "Koreksi kesalahan menentukan seberapa rusak kode masih bisa dipindai. L membuat pola paling kecil. M cocok untuk tautan. Q dan H lebih aman untuk cetak yang bisa lecet, tetapi polanya lebih rapat.",
    "Ukuran adalah lebar file PNG dalam piksel, dari 128 sampai 1024, sudah termasuk batas putih di sekeliling kode. Batas itu jangan dipotong saat dicetak.",
    "Pakai warna gelap di atas warna terang. Kalau kontras di bawah 3:1, pemindai sering gagal, terutama di layar yang silau.",
    "Unduh PNG untuk poster, kartu nama, atau kemasan. Dari alat lain, tombol QR membawa hasilnya ke sini.",
  ],
  short: [
    "Tempel URL yang panjang. Aplikasi menyimpan tujuannya dan memberi alamat pendek berbentuk /s/nama.",
    "Akhiran boleh dikosongkan agar dibuat acak, atau diisi sendiri dengan 3–32 huruf, angka, dan tanda hubung. Akhiran yang sudah dipakai akan ditolak.",
    "Hanya tautan http dan https yang diterima. Saat dibuka, pengunjung langsung diarahkan ke alamat asli.",
    "Salin untuk dibagikan, buka untuk mencoba, atau buat kode QR dari tautan pendek itu.",
    "Di Netlify tautan tetap tersimpan. Di pratinjau, tautan berlaku selama sesi aplikasi ini.",
  ],
  whatsapp: [
    "Isi kode negara dan nomor. Kode 62 adalah Indonesia. Angka 0 di depan nomor lokal dihapus, jadi 0812 3456 7890 menjadi 6281234567890.",
    "Kalau nomor sudah diawali 62, kode negara tidak ditulis dua kali.",
    "Pesan boleh dikosongkan. Kalau diisi, WhatsApp membuka chat dengan teks itu siap dikirim.",
    "Hasilnya tautan wa.me. Bisa dibuka, disalin, dipendekkan, atau dijadikan kode QR untuk menu, poster, dan kartu nama.",
  ],
  wifi: [
    "Nama jaringan harus sama persis dengan nama Wi-Fi, termasuk huruf besar dan spasi.",
    "WPA untuk jaringan rumah, kafe, dan kantor yang memakai sandi. WEP untuk perangkat lama. None jika jaringan tanpa sandi.",
    "Centang jaringan tersembunyi hanya jika SSID tidak muncul di daftar Wi-Fi.",
    "Tamu memindai kode lalu ponsel menawarkan bergabung, tanpa mengetik sandi. Unduh PNG untuk dicetak.",
    "Edit in QR tool membuka pola yang sama di alat QR jika warna atau ukurannya ingin diubah. Untuk cetak biasa, hitam di atas putih paling aman.",
  ],
  scan: [
    "Use camera memakai kamera belakang. Browser akan meminta izin. Kalau ditolak, pakai Upload picture.",
    "Upload picture membaca kode dari foto, tangkapan layar, atau file PNG yang baru diunduh.",
    "Hasil teks ditampilkan utuh. Kalau isinya tautan http atau https, tautan itu bisa dibuka, dipendekkan, atau dijadikan kode QR lagi.",
    "Kalau isinya bukan tautan, misalnya catatan atau pengaturan Wi-Fi, salin teksnya atau buka di alat QR untuk dibuat ulang.",
  ],
};

export function StudioShell() {
  const [tool, setTool] = useState<Tool>("qr");
  const [contentSeed, setContentSeed] = useState<{ token: number; value: string } | null>(null);

  function openInQr(value: string) {
    setContentSeed({ token: Date.now(), value });
    setTool("qr");
  }

  return (
    <main className="page-shell mx-auto w-full max-w-5xl">
      <header className="mx-auto w-full max-w-xs">
        <h1>
          <img
            src="/logo.jpg"
            alt="QR Generator. Create your QR code instantly."
            width={1039}
            height={825}
            className="h-auto w-full"
          />
        </h1>
        <p className="mt-1 text-center text-pretty text-muted">{COPY[tool]}</p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 bg-background px-4 py-3">
        <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-3" role="tablist" aria-label="Tools">
          {TOOLS.map((item) => {
            const selected = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  "min-h-11 rounded-control border px-2 text-sm font-medium",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted",
                )}
                onClick={() => setTool(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <ToolNotes>
        {NOTES[tool].map((line) => (
          <p key={line}>{line}</p>
        ))}
      </ToolNotes>

      <div hidden={tool !== "qr"}>
        <QrStudio contentSeed={contentSeed} />
      </div>
      <div hidden={tool !== "short"}>
        <LinkShortener onMakeQr={openInQr} />
      </div>
      <div hidden={tool !== "whatsapp"}>
        <WhatsAppTool onMakeQr={openInQr} />
      </div>
      <div hidden={tool !== "wifi"}>
        <WifiTool onMakeQr={openInQr} />
      </div>
      <div hidden={tool !== "scan"}>
        <QrReader active={tool === "scan"} onMakeQr={openInQr} />
      </div>
    </main>
  );
}
