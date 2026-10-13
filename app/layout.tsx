import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { AppDialogHost } from "@/components/AppDialogHost";

// Axis şablonunun yazı tipi
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${geistMono.variable} font-sans font-light antialiased min-h-screen bg-background text-foreground flex flex-col`}
      >
        <Script id="axis-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
          strategy="beforeInteractive"
        />
        <div aria-hidden="true" className="axis-orb" />
        <div className="relative z-[1] flex min-h-screen flex-col">{children}</div>
        <AppDialogHost />
      </body>
    </html>
  );
}
