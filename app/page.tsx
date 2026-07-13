"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Globe,
  Users,
  MessageCircle,
  TrendingUp,
  Heart,
  Share2,
  Bookmark,
  Video,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Bell,
  Play,
  Star,
  ArrowRight,
  Check,
  Plus,
  Minus,
  Quote,
  Zap,
  MoreHorizontal,
  Send,
  Icon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Slider, { Settings } from "react-slick";


/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */

const features = [
  {
    icon: Share2,
    title: "Share Your Story",
    description:
      "Post photos, videos and ideas to a feed built for every voice. Your culture, your perspective, your stage.",
    accent: "from-orange-500 to-amber-500",
  },
  {
    icon: MessageCircle,
    title: "Real-time Messaging",
    description:
      "Chat one-on-one or in groups with instant delivery, voice notes, calls and reactions that keep you close.",
    accent: "from-sky-500 to-blue-600",
  },
  {
    icon: Users,
    title: "Communities & Groups",
    description:
      "Find your people across borders and time zones. Join groups around politics, culture, business and more.",
    accent: "from-emerald-500 to-green-600",
  },
  {
    icon: Globe,
    title: "Networking",
    description:
      "Build meaningful connections with creators, entrepreneurs and changemakers shaping a better world.",
    accent: "from-violet-500 to-purple-600",
  },
  {
    icon: Video,
    title: "Memories & Video",
    description:
      "Share short-form videos and live moments. Discover stories from every corner of the world as they happen.",
    accent: "from-rose-500 to-pink-600",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description:
      "Buy and sell with confidence. Discover authentic products and grow your business with secure payments.",
    accent: "from-amber-500 to-orange-600",
  },
];

const stats = [
  { number: "190+", label: "Countries" },
  { number: "10k+", label: "Active Members" },
  { number: "25k+", label: "Discussions" },
  { number: "50+", label: "Communities" },
];

const benefits = [
  "Built for a global community — wherever you are",
  "Lightning-fast, real-time interactions everywhere",
  "Private by design with secure, encrypted messaging",
  "Free to join — no hidden fees, ever",
];

const testimonials = [
  {
    quote:
      "ConnectAfrik finally feels like home online. I've met incredible people from all over the world and found communities that truly get me.",
    name: "Sofia Reyes",
    role: "Creator, Mexico City",
    initials: "SR",
    color: "from-orange-500 to-amber-500",
    image_url: "/assets/images/avatar-1.png",
  },
  {
    quote:
      "The communities here are alive. Real conversations about culture, ideas and current events that actually go somewhere. I'm hooked.",
    name: "James Chen",
    role: "Entrepreneur, Singapore",
    initials: "JC",
    color: "from-emerald-500 to-green-600",
    image_url: "/assets/images/avatar-2.png",

  },
  {
    quote:
      "I grew my small business through the marketplace in weeks. Reaching customers worldwide who share my values changed everything.",
    name: "Emma Laurent",
    role: "Seller, Paris",
    initials: "EL",
    color: "from-sky-500 to-blue-600",
    image_url: "/assets/images/avatar-4.png",
  },
  {
    quote:
      "Finally a platform where distance doesn't matter. I've built friendships across continents and learned so much from people I'd never have met otherwise.",
    name: "Marcus Webb",
    role: "Developer, Toronto",
    initials: "MW",
    color: "from-violet-500 to-purple-600",
    image_url: "/assets/images/avatar-5.png",
  },
];

const faqs = [
  {
    q: "Is ConnectAfrik free to use?",
    a: "Yes. Creating an account, posting, messaging and joining communities are completely free — no matter where you are in the world. Optional premium features may be added later, but the core experience will always be free.",
  },
  {
    q: "Who is ConnectAfrik for?",
    a: "Everyone. Whether you're a creator in Tokyo, a student in Nairobi, an entrepreneur in Berlin or simply someone who wants meaningful connection — ConnectAfrik is the social home for the world.",
  },
  {
    q: "How is my privacy protected?",
    a: "Your data is yours. We use secure, encrypted messaging and give you granular control over who sees your content. We never sell your personal information to third parties.",
  },
  {
    q: "Can I sell products on the platform?",
    a: "Absolutely. Our marketplace lets you list products, reach customers around the world and accept secure payments — all in one place.",
  },
  {
    q: "What can I do on ConnectAfrik?",
    a: "Share posts and videos, message friends across borders, join global communities, follow discussions on topics you care about, discover memories and reels, and buy or sell in the marketplace.",
  },
  {
    q: "Is ConnectAfrik available in my country?",
    a: "Yes. ConnectAfrik is built for a global audience. You can sign up, connect and participate from virtually anywhere — we're here to bring people together for a better world.",
  },
];


const settings: Settings = {
  dots: true,
  infinite: true,
  speed: 500,
  slidesToShow: 3,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 3000,
  arrows: false,
  responsive: [
    {
      breakpoint: 1024,
      settings: {
        slidesToShow: 2,
      },
    },
    {
      breakpoint: 768,
      settings: {
        slidesToShow: 1,
      },
    },
  ],
};
/* ------------------------------------------------------------------ */
/*  Scroll-reveal helper                                               */
/* ------------------------------------------------------------------ */

const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: 1 | 2 | 3 | 4 | 5;
}> = ({ children, className = "", delay }) => {
  return (
    <div className={`lp-reveal ${delay ? `lp-delay-${delay}` : ""} ${className}`}>
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const Home: React.FC = () => {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".lp-reveal");
    if (!els || els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const users = [
    { name: "Sofia Reyes", avatarUrl: "/assets/images/avatar-1.png" },
    { name: "James Chen", avatarUrl: "/assets/images/avatar-2.png" },
    { name: "Emma Laurent", avatarUrl: "/assets/images/avatar-4.png" },
    { name: "Marcus Webb", avatarUrl: "/assets/images/avatar-5.png" }
  ];
  return (
    <div ref={rootRef} className="overflow-x-hidden ">
      {/* ============================== HERO ============================== */}
      <section className="relative isolate overflow-hidden">

        <div className="max-w-full 4xl:max-w-screen-2xl mx-auto px-1 sm:px-10  2xl:px-6 mx-auto py-18 ">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: copy */}
            <div className="text-center lg:text-left">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/70 px-4 py-1.5 text-sm font-medium text-orange-700 shadow-sm backdrop-blur dark:border-border dark:bg-surface dark:text-orange-300">
                  <Sparkles className="h-4 w-4" />
                  Connecting people for a better world
                </span>
              </Reveal>
              <div className="max-w-2xl">
                <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                  The social home for the world
                </h1>
              </div>
              <Reveal delay={2}>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-600 lg:mx-0">
                  Share your story, join vibrant communities, message in
                  real time and discover the culture, ideas and people shaping
                  our world. One platform, endless connection.
                </p>
              </Reveal>

              <Reveal delay={3}>
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center">
                  {!user ? (
                    <>
                      <Link
                        href="/signup"
                        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/40 sm:w-auto"
                      >
                        Join the Community
                        <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                      </Link>
                      <Link
                        href="/signin"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-7 py-3.5 text-base font-semibold text-gray-800 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md sm:w-auto dark:border-border dark:bg-surface dark:text-content"
                      >
                        Sign In
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/feed"
                      className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                    >
                      Go to your feed
                      <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  )}
                </div>
              </Reveal>

              {/* Trust row */}
              <Reveal delay={4}>
                <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start justify-center">
                  <div className="flex -space-x-3">
                    {users.map((user, i) => (
                      <div
                        key={i}
                        className="h-10 w-10 rounded-full border-2 border-white overflow-hidden dark:border-surface"
                      >
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-xs font-semibold text-white dark:border-surface">
                      10k+
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center justify-center gap-1 lg:justify-start">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                    <span>Loved by members around the world</span>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right: floating feed preview mockup */}
            <Reveal delay={2} className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative">
                {/* Glow */}
                <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-orange-500/20 via-transparent to-emerald-500/20 blur-2xl" />

                {/* Main post card */}
                <div className="lp-animate-float rounded-3xl border border-white/60 bg-white/90 p-5 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-border dark:bg-surface">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold text-white">
                      SR
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        Sofia Reyes
                      </p>
                      <p className="text-xs text-gray-500">Mexico City · 2h ago</p>
                    </div>
                    <MoreHorizontal className="h-5 w-5 text-gray-400" />
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-gray-700">
                    Golden hour in the city never gets old. Grateful for a
                    community that brings the whole world a little closer.
                  </p>

                  <div className="mt-3 aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 via-amber-400 to-rose-400">
                    <img
                      src="/assets/images/hero2.png"
                      alt="A scenic view shared by the ConnectAfrik community worldwide"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-gray-500">
                    <div className="flex items-center gap-5 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-rose-500">
                        <Heart className="h-4 w-4 fill-rose-500" /> 1.2k
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageCircle className="h-4 w-4" /> 348
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Share2 className="h-4 w-4" /> 86
                      </span>
                    </div>
                    <Bookmark className="h-4 w-4" />
                  </div>
                </div>

                {/* Floating notification chip */}
                <div className="lp-animate-float-slow absolute -left-4 top-10 hidden items-center gap-2 rounded-2xl border border-white/60 bg-white/90 px-3.5 py-2.5 shadow-xl backdrop-blur-xl sm:flex dark:border-border dark:bg-surface">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      New follower
                    </p>
                    <p className="text-[11px] text-gray-500">James started following you</p>
                  </div>
                </div>

                {/* Floating message chip */}
                <div className="lp-animate-float absolute -right-3 bottom-12 hidden items-center gap-2 rounded-2xl border border-white/60 bg-white/90 px-3.5 py-2.5 shadow-xl backdrop-blur-xl sm:flex dark:border-border dark:bg-surface [animation-delay:1.5s]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      Emma
                    </p>
                    <p className="text-[11px] text-gray-500">Sent you a message ✨</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>


      {/* =========================== FEATURES =========================== */}
      <section className="py-12 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-orange-700 dark:bg-surface-secondary dark:text-orange-300">
              <Zap className="h-4 w-4" /> Everything in one place
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Built for the way the world connects
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From real-time chat to thriving communities and a trusted
              marketplace — every tool you need to share, connect and grow.
            </p>
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Reveal
                  key={feature.title}
                  delay={((i % 3) + 1) as 1 | 2 | 3}
                  className="h-full"
                >
                  <div className="group relative h-full overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl dark:border-border dark:bg-surface">
                    <div
                      className={`absolute inset-x-0 -top-px h-1 scale-x-0 bg-gradient-to-r ${feature.accent} transition-transform duration-300 group-hover:scale-x-100`}
                    />
                    <div
                      className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="mt-3 leading-relaxed text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>

        </div>
      </section>

      {/* ====================== FEED SHOWCASE / SPLIT ==================== */}
      <section className="relative overflow-hidden py-12 sm:py-10">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-orange-50/40 to-transparent dark:via-surface-secondary/30" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Copy */}
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-surface-secondary dark:text-emerald-300">
                <Play className="h-4 w-4" /> A feed that feels alive
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                See what your community is talking about
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                A rich, fast feed packed with photos, videos and real
                conversations from every time zone. React, comment and share —
                engagement that actually means something.
              </p>

              <ul className="my-8 space-y-4">
                {[
                  {
                    icon: Heart,
                    text: "Express yourself with reactions, likes and saves",
                  },
                  {
                    icon: MessageCircle,
                    text: "Threaded comments that keep discussions flowing",
                  },
                  {
                    icon: TrendingUp,
                    text: "Discover trending topics from every corner of the globe",
                  },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-surface-secondary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-gray-700">{text}</span>
                  </li>
                ))}
              </ul>

              {!user && (
                <Link
                  href="/signup"
                  className="btn-primary"
                >
                  Start exploring
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              )}
            </Reveal>

            {/* Mock feed cards */}
            <Reveal delay={2} className="space-y-5">
              {/* Politics card */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-border dark:bg-surface">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      🏛️ Politics
                    </span>
                    <p className="mt-0.5 text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900">
                  The Role of Youth in Global Democracy
                </h3>
                <p className="mt-1.5 text-sm text-gray-600">
                  Young people everywhere are driving democratic change —
                  from the streets to the ballot box.
                </p>
                <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-4 w-4" /> 234
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" /> 45
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Share2 className="h-4 w-4" /> 12
                  </span>
                </div>
              </div>

              {/* Culture card */}
              <div className="ml-auto w-[92%] rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg dark:border-border dark:bg-surface">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      🎭 Culture
                    </span>
                    <p className="mt-0.5 text-xs text-gray-500">4 hours ago</p>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900">
                  Celebrating Cultures That Connect the World
                </h3>
                <p className="mt-1.5 text-sm text-gray-600">
                  From festivals to family traditions — discover the stories,
                  art and heritage people share across borders.
                </p>
                <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-4 w-4" /> 189
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" /> 32
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Share2 className="h-4 w-4" /> 18
                  </span>
                </div>
              </div>

              {/* Quick comment composer */}
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-border dark:bg-surface">
                {/* <div className="h-9 w-9 flex-none rounded-full bg-gradient-to-br from-violet-400 to-purple-500" /> */}
                <button type="button" className="flex h-8 w-8 items-center justify-center pointer-events-none rounded-full bg-transparent text-content-secondary hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40 ring-1 ring-[#25d366] text-[#128c7e]" aria-label="Attach" aria-expanded="true">
                  <Plus className="h-4 w-4" />
                  </button>
                <div className="flex-1 truncate rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-400 dark:bg-surface-secondary">
                  Share something with your community…
                </div>
                <button className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-orange-500 text-white">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* =========================== BENEFITS =========================== */}
      <section className="py-12 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-8 sm:p-12 lg:p-16">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/30 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">
                  <ShieldCheck className="h-4 w-4" /> Why ConnectAfrik
                </span>
                <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Connecting people for a better world
                </h2>
                <p className="mt-4 text-lg text-gray-300">
                  We're not just another social network. We're a global home
                  built with care for every voice — fast, private and genuinely
                  yours.
                </p>
              </Reveal>

              <Reveal delay={2}>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {benefits.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-colors hover:bg-white/10"
                    >
                      <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="text-sm text-gray-100">{b}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ========================= TESTIMONIALS ========================= */}
      <section className="py-12 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-surface-secondary dark:text-emerald-300">
              <Heart className="h-4 w-4" /> Loved by the community
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Real stories from real members
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Thousands of people around the world are already building
              their home here.
            </p>
          </Reveal>

          {/* <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={((i % 3) + 1) as 1 | 2 | 3} className="h-full">
                <figure className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-border dark:bg-surface">
                  <Quote className="h-8 w-8 text-orange-300" />
                  <blockquote className="mt-4 flex-1 text-gray-700">
                    “{t.quote}”
                  </blockquote>
                  <div className="mt-5 flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, s) => (
                      <Star key={s} className="h-4 w-4 fill-amber-400" />
                    ))}
                  </div>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-5 dark:border-border">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-sm font-bold text-white`}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{t.name}</div>
                      <div className="text-sm text-gray-500">{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div> */}
          <Slider {...settings}>
            {testimonials.map((t, i) => (
              <div key={t.name} className="px-3 py-4">
                <Reveal delay={((i % 3) + 1) as 1 | 2 | 3}>
                  <figure className="flex min-h-[300px] flex-col rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-border dark:bg-surface">
                    <Quote className="h-8 w-8 text-orange-300" />

                    <blockquote className="mt-4 flex-1 text-gray-700">
                      "{t.quote}"
                    </blockquote>

                    <div className="mt-5 flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, s) => (
                        <Star key={s} className="h-4 w-4 fill-amber-400" />
                      ))}
                    </div>

                    <figcaption className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-5 dark:border-border">
                      {/* <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-sm font-bold text-white`}
                      >
                        {t.initials}
                      </div> */}
                      <img src={t.image_url} alt={t.name} className="h-11 w-11 rounded-full border-2 border-orange-500" />

                      <div>
                        <div className="font-semibold text-gray-900">
                          {t.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {t.role}
                        </div>
                      </div>
                    </figcaption>
                  </figure>
                </Reveal>
              </div>
            ))}
          </Slider>
        </div>
      </section>

      {/* ============================== FAQ ============================= */}
      <section className="py-12 sm:py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Everything you need to know before joining the global community.
            </p>
          </Reveal>

          <Reveal delay={1} className="space-y-4">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow dark:border-border dark:bg-surface"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-gray-900">{faq.q}</span>
                    <span
                      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors ${isOpen
                        ? "bg-orange-500 text-white"
                        : "bg-orange-100 text-orange-600 dark:bg-surface-secondary"
                        }`}
                    >
                      {isOpen ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                      }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-5 text-gray-600">{faq.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* ============================== CTA ============================= */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-7xl">
          <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 px-6 py-16 text-center  sm:px-12 sm:py-20 lp-animate-gradient">
            <div className="absolute -left-10 -top-10 -z-10 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 -z-10 h-48 w-48 rounded-full bg-emerald-300/30 blur-3xl" />
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-primary-600 sm:text-4xl lg:text-5xl">
              Ready to connect with the world?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600 ">
              Connect with people everywhere sharing their stories, ideas
              and culture. Your voice matters in shaping a better world.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {!user ? (
                <>
                  <Link
                    href="/signup"
                    className="btn-primary"
                  >
                    Get Started — it's free
                    <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/signin"
                    className="btn-secondary"
                  >
                    Sign In
                  </Link>
                </>
              ) : (
                <Link
                  href="/feed"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-orange-600 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Go to your feed
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Home;
