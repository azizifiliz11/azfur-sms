import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090a0f",
};

export const metadata: Metadata = {
  title: "AzFur • Telegram Onay Platformu",
  description: "AzFur ile yüksek hızlı, otomatik ve güvenli SMS onay platformu. Telegram Mini App altyapısıyla anında tek kullanımlık numara kiralayın.",
  keywords: ["telegram mini app", "sms onay", "azfur", "sanal numara", "otp doğrulama"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-[#090a0f] text-[#f4f4f5] flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300`}
      >
        <Script
          id="anti-bis"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var orig = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, val) {
                    if (name === 'bis_skin_checked' || name === 'bis_register') return;
                    return orig.apply(this, arguments);
                  };
                  var clean = function() {
                    var els = document.querySelectorAll('[bis_skin_checked],[bis_register]');
                    for (var i = 0; i < els.length; i++) {
                      els[i].removeAttribute('bis_skin_checked');
                      els[i].removeAttribute('bis_register');
                    }
                  };
                  clean();
                  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement) {
                    new MutationObserver(function(muts) {
                      for (var i = 0; i < muts.length; i++) {
                        var m = muts[i];
                        if (m.type === 'attributes' && (m.attributeName === 'bis_skin_checked' || m.attributeName === 'bis_register')) {
                          m.target.removeAttribute(m.attributeName);
                        }
                      }
                    }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['bis_skin_checked', 'bis_register'] });
                  }
                  window.addEventListener('DOMContentLoaded', clean);
                } catch(e) {}
              })();
            `,
          }}
        />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
