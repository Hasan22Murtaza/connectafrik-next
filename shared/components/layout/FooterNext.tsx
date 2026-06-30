"use client";

import React from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Heart,
  Globe,
} from "lucide-react";

const socials = [
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
];

const quickLinks = [
  { href: "/feed", label: "Community Feed" },
  { href: "/politics", label: "Political Discussions" },
  { href: "/culture", label: "Cultural Heritage" },
  { href: "/groups", label: "Community Groups" },
  { href: "/our-story", label: "Our Story" },
];

const supportLinks = [
  { href: "/support", label: "Support Center" },
  { href: "/guidelines", label: "Community Guidelines" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
];

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-20 border-t border-gray-100 bg-surface-secondary text-content dark:border-border">

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main content */}
        <div className="grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 xl:grid-cols-4 xl:gap-12">
          {/* Company Info */}
          <div className="space-y-4">
            <img
              src="/assets/images/logo_2.png"
              alt="ConnectAfrik"
              className="w-32"
            />
            <p className="max-w-xs text-sm leading-relaxed text-content-secondary">
              Connecting the African continent and diaspora through meaningful
              conversations about politics, culture, and community building.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {socials.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-content-secondary shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-orange-500 hover:text-white hover:shadow-md dark:bg-surface"
                >
                  <Icon className="h-4.5 w-4.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-content">
              Quick Links
            </h3>
            <ul className="space-y-2.5 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center text-content-secondary transition-colors duration-300 hover:text-orange-500"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support & Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-content">
              Support &amp; Info
            </h3>
            <ul className="space-y-2.5 text-sm">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center text-content-secondary transition-colors duration-300 hover:text-orange-500"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-content">
              Contact Us
            </h3>
            <div className="space-y-3 text-sm">
              <a
                href="mailto:info@connectafrik.com"
                className="flex items-center gap-2.5 text-content-secondary transition-colors duration-300 hover:text-orange-500"
              >
                <Mail className="h-4 w-4 flex-none" />
                info@connectafrik.com
              </a>
              <a
                href="tel:+233534787731"
                className="flex items-center gap-2.5 text-content-secondary transition-colors duration-300 hover:text-orange-500"
              >
                <Phone className="h-4 w-4 flex-none" />
                +233 534 787 731
              </a>
              <a
                href="tel:+19144337155"
                className="flex items-center gap-2.5 text-content-secondary transition-colors duration-300 hover:text-orange-500"
              >
                <Phone className="h-4 w-4 flex-none" />
                +1 914 433 7155
              </a>
              <div className="flex items-start gap-2.5 text-content-secondary">
                <Globe className="mt-0.5 h-4 w-4 flex-none" />
                <span>Serving Africa &amp; Global Diaspora</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-200 pb-16 pt-6 sm:pb-6 md:flex-row dark:border-border">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-content-secondary">
            <span>© {currentYear} ConnectAfrik. Made with</span>
            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            <span>for the African community worldwide.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-content-secondary">
            <Link
              href="/privacy-policy"
              className="transition-colors duration-300 hover:text-orange-500"
            >
              Privacy
            </Link>
            <Link
              href="/terms-of-service"
              className="transition-colors duration-300 hover:text-orange-500"
            >
              Terms
            </Link>
            <Link
              href="/guidelines"
              className="transition-colors duration-300 hover:text-orange-500"
            >
              Guidelines
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
