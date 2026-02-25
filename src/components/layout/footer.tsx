'use client';

import Link from 'next/link';
import {
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    movies: [
      { href: '/movies', label: 'Բոլոր ֆիլմերը' },
      { href: '/movies/premiere', label: 'Պրեմիերաներ' },
    ],
    info: [
      { href: '/about', label: 'Մեր մասին' },
      { href: '/contacts', label: 'Կոնտակտներ' },
    ],
    support: [
      { href: '/faq', label: 'Հաճախակի հարցեր' },
      { href: '/rules', label: 'Կանոններ' },
      { href: '/refund', label: 'Վերադարձի քաղաքականություն' },
      { href: '/privacy', label: 'Գաղտնիություն' },
    ],
  };

  return (
    <footer className="bg-gradient-to-b from-slate-900 to-black text-white pb-4">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              GoCinema
            </h3>
            <p className="text-gray-400 mb-4">
              Ձեր կինոփորձը սկսվում է այստեղ:
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Movies */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Ֆիլմեր</h4>
            <ul className="space-y-2">
              {footerLinks.movies.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Տեղեկություն</h4>
            <ul className="space-y-2">
              {footerLinks.info.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Կոնտակտ</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-400">
                <Phone className="w-5 h-5" />
                <a
                  href="tel:+37477769668"
                  className="hover:text-purple-400 transition-colors"
                >
                  +374 77 769 668
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400">
                <Mail className="w-5 h-5" />
                <a
                  href="mailto:info@gocinema.am"
                  className="hover:text-purple-400 transition-colors"
                >
                  info@gocinema.am
                </a>
              </li>
              <li className="flex items-start gap-2 text-gray-400">
                <MapPin className="w-5 h-5 mt-1" />
                <span>Ք․ Մարտունի, Հայաստան</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © {currentYear} GoCinema. Բոլոր իրավունքները պաշտպանված են:
            </p>
            <div className="flex gap-6 text-sm">
              {footerLinks.support.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-400 hover:text-purple-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-4 flex-je-c gap-4">
        <Image
          src="/images/idram-logo.svg"
          alt="Idram"
          width={200}
          height={100}
          className="w-[120px] h-auto!"
        />
        <Image
          src="/images/idbank-logo.svg"
          alt="Idram"
          width={200}
          height={100}
          className="w-[120px] h-auto!"
        />
      </div>
    </footer>
  );
}
