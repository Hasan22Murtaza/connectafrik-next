"use client";

import React from "react";
import Link from "next/link";
import { Mail, Phone, Heart } from "@/shared/icons";

const productLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/#discover", label: "Discover" },
  { href: "/groups", label: "Communities" },
  { href: "/#messaging", label: "Messaging" },
  { href: "/marketplace", label: "Marketplace" },
];

const companyLinks = [
  { href: "/our-story", label: "About" },
  { href: "/support", label: "Contact" },
  { href: "/feedback", label: "Feedback" },
];

const legalLinks = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-of-service", label: "Terms" },
];

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-black/[0.06] bg-[#FAFAF9] text-[#111827]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="space-y-4">
            <img
              src="/assets/images/logo_2.png"
              alt="CribsTalk"
              className="w-32"
            />
            <p className="max-w-xs text-sm font-medium leading-relaxed text-[#4B5563]">
              Connect · Share · Belong
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-[#6B7280]">
              Our Crib. Our Culture. Our Roots.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#111827]">
              Product
            </h3>
            <ul className="space-y-2.5 text-sm">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center text-[#4B5563] transition-colors duration-300 hover:text-[#F97316]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#111827]">
              Company
            </h3>
            <ul className="space-y-2.5 text-sm">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center text-[#4B5563] transition-colors duration-300 hover:text-[#F97316]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#111827]">
              Legal
            </h3>
            <ul className="space-y-2.5 text-sm">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center text-[#4B5563] transition-colors duration-300 hover:text-[#F97316]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="space-y-2 pt-2 text-sm text-[#4B5563]">
              <a
                href="mailto:info@cribstalk.com"
                className="flex items-center gap-2.5 transition-colors duration-300 hover:text-[#F97316]"
              >
                <Mail className="h-4 w-4 flex-none" />
                info@cribstalk.com
              </a>
              <a
                href="tel:+233534787731"
                className="flex items-center gap-2.5 transition-colors duration-300 hover:text-[#F97316]"
              >
                <Phone className="h-4 w-4 flex-none" />
                +233 534 787 731
              </a>
              <a
                href="tel:+19144337155"
                className="flex items-center gap-2.5 transition-colors duration-300 hover:text-[#F97316]"
              >
                <Phone className="h-4 w-4 flex-none" />
                +1 914 433 7155
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-black/[0.06] pb-10 pt-6 sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-[#6B7280]">
            <span>© {currentYear} CribsTalk</span>
            <Heart className="h-3.5 w-3.5 fill-[#F97316] text-[#F97316]" />
            <span>Connect · Share · Belong</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#6B7280]">
            <Link
              href="/privacy-policy"
              className="transition-colors duration-300 hover:text-[#F97316]"
            >
              Privacy
            </Link>
            <Link
              href="/terms-of-service"
              className="transition-colors duration-300 hover:text-[#F97316]"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
