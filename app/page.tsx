"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Send,
  Phone,
  Video,
  Bell,
  ArrowRight,
  Users,
  Camera,
  Image as ImageIcon,
} from "@/shared/icons";
import { useAuth } from "@/contexts/AuthContext";

/* ------------------------------------------------------------------ */
/*  Preview content (visual only — no API calls)                       */
/* ------------------------------------------------------------------ */

const LP = "/assets/images/landing";

const avatars = {
  maya: `${LP}/avatar-maya.png`,
  daniel: `${LP}/avatar-daniel.png`,
  sophia: `${LP}/avatar-sophia.png`,
  alex: `${LP}/avatar-alex.png`,
  emma: `${LP}/avatar-emma.png`,
  marcus: `${LP}/avatar-marcus.png`,
} as const;

const stories: {
  name: string;
  avatar: string;
}[] = [
    { name: "Maya", avatar: avatars.maya },
    { name: "Daniel", avatar: avatars.daniel },
    { name: "Sophia", avatar: avatars.sophia },
    { name: "Alex", avatar: avatars.alex },
    { name: "Noah", avatar: avatars.marcus },
  ];

const discoverItems = [
  { title: "Photography", image: `${LP}/discover-photo.png` },
  { title: "Technology", image: `${LP}/discover-tech.png` },
  { title: "Travel", image: `${LP}/discover-travel.png` },
  { title: "Music", image: `${LP}/discover-music.png` },
  { title: "Fitness", image: `${LP}/discover-fitness.png` },
  { title: "Food", image: `${LP}/discover-food.png` },
  { title: "Gaming", image: `${LP}/discover-gaming.png` },
  { title: "Business", image: `${LP}/discover-business.png` },
] as const;

const communityCards = [
  {
    name: "Technology",
    description: "Discuss the latest ideas in technology, AI and software.",
    members: "12.4K",
    image: `${LP}/discover-tech.png`,
  },
  {
    name: "Travel Stories",
    description: "Share places, experiences, and travel inspiration with fellow travelers.",
    members: "8.2K",
    image: `${LP}/discover-travel.png`,
  },
  {
    name: "Photography",
    description: "Capture light, moments, and stories worth keeping.",
    members: "9.1K",
    image: `${LP}/discover-photo.png`,
  },
  {
    name: "Music Lounge",
    description: "Playlists, live sessions, and conversations about sound.",
    members: "15.8K",
    image: `${LP}/discover-music.png`,
  },
  {
    name: "Fitness",
    description: "Workouts, habits, and people who keep you going every single day.",
    members: "7.6K",
    image: `${LP}/discover-fitness.png`,
  },
  {
    name: "Food & Kitchen",
    description: "Recipes, kitchen wins, and meals worth sharing with friends and family.",
    members: "6.9K",
    image: `${LP}/discover-food.png`,
  },
] as const;

const marketplaceListings = [
  {
    title: "Mid-century lounge chair",
    price: "$180",
    location: "Brooklyn",
    category: "Furniture",
    image: `${LP}/market-furniture.png`,
    seller: "Sofia",
    avatar: avatars.maya,
  },
  {
    title: "Wireless headphones",
    price: "$95",
    location: "Austin",
    category: "Electronics",
    image: `${LP}/market-electronics.png`,
    seller: "James",
    avatar: avatars.daniel,
  },
  {
    title: "Linen summer set",
    price: "$42",
    location: "Lisbon",
    category: "Clothing",
    image: `${LP}/market-clothing.png`,
    seller: "Emma",
    avatar: avatars.emma,
  },
  {
    title: "Wooden play kitchen",
    price: "$65",
    location: "Toronto",
    category: "Baby & Kids",
    image: `${LP}/market-kids.png`,
    seller: "Marcus",
    avatar: avatars.marcus,
  },
  {
    title: "Road bike — lightly used",
    price: "$220",
    location: "Denver",
    category: "Sports",
    image: `${LP}/market-sports.png`,
    seller: "Daniel",
    avatar: avatars.daniel,
  },
  {
    title: "Compact espresso machine",
    price: "$110",
    location: "Seattle",
    category: "Appliances",
    image: `${LP}/market-appliances.png`,
    seller: "Maya",
    avatar: avatars.maya,
  },
] as const;

const conversations = [
  {
    name: "Emma Laurent",
    avatar: avatars.emma,
    preview: "Are we still on for Friday?",
    time: "2m",
    online: true,
    active: true,
  },
  {
    name: "Photography Crew",
    avatar: avatars.daniel,
    preview: "James: Sending the shots now",
    time: "18m",
    online: false,
    active: false,
  },
  {
    name: "Marcus Webb",
    avatar: avatars.marcus,
    preview: "Loved that post 🔥",
    time: "1h",
    online: true,
    active: false,
  },
  {
    name: "Travel Stories",
    avatar: avatars.maya,
    preview: "Sofia: New album is up",
    time: "3h",
    online: false,
    active: false,
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Shared UI                                                          */
/* ------------------------------------------------------------------ */

const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: 1 | 2 | 3 | 4 | 5;
}> = ({ children, className = "", delay }) => (
  <div className={`lp-reveal ${delay ? `lp-delay-${delay}` : ""} ${className}`}>
    {children}
  </div>
);

const PrimaryCta: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
}> = ({ href, children, className = "" }) => (
  <Link
    href={href}
    className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#F97316] px-7 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#EA580C] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 focus-visible:ring-offset-2 sm:text-base ${className}`}
  >
    {children}
  </Link>
);

const SecondaryCta: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
}> = ({ href, children, className = "" }) => (
  <Link
    href={href}
    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-7 py-3 text-sm font-semibold text-[#111827] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#F9FAFB] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 focus-visible:ring-offset-2 sm:text-base ${className}`}
  >
    {children}
  </Link>
);

const SectionHeading: React.FC<{
  title: string;
  description?: string;
  align?: "left" | "center";
}> = ({ title, description, align = "center" }) => (
  <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
    <h2 className="text-[1.75rem] font-bold tracking-tight text-[#111827] sm:text-4xl">
      {title}
    </h2>
    {description ? (
      <p className="mt-4 text-base leading-relaxed text-[#4B5563] sm:text-lg">
        {description}
      </p>
    ) : null}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const Home: React.FC = () => {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const joinHref = user ? "/feed" : "/signup";

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".lp-reveal");
    if (!els || els.length === 0) return;

    const reveal = (el: Element) => {
      el.classList.add("is-visible");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );

    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const inView =
        rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
      if (inView) {
        reveal(el);
      } else {
        observer.observe(el);
      }
    });

    // Safety net: never leave content permanently invisible
    const fallback = window.setTimeout(() => {
      els.forEach((el) => reveal(el));
    }, 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div ref={rootRef} className="overflow-x-hidden bg-white text-[#111827]">
      {/* ============================== HERO ============================== */}
      <section className="relative isolate overflow-hidden bg-[#FBF6EF]">
        {/* Banner image */}
        <div className="pointer-events-none absolute inset-0 -z-20">
          <img
            src={`${LP}/hero-banner-curves.png`}
            alt=""
            className="h-full w-full object-cover object-center"
            loading="eager"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#FBF6EF]/95 via-[#FBF6EF]/75 to-[#FBF6EF]/35 sm:via-[#FBF6EF]/70 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#FBF6EF]/40 via-transparent to-[#FBF6EF]/20" />
        </div>

        {/* Soft organic curves */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <svg
            className="absolute -right-[18%] top-[-12%] h-[70%] w-[70%] text-[#F97316]/15"
            viewBox="0 0 600 600"
            fill="currentColor"
          >
            <path d="M480 40C560 120 620 240 560 340C500 440 360 480 240 440C120 400 60 280 90 170C120 60 300 -40 480 40Z" />
          </svg>
          <svg
            className="absolute -left-[20%] bottom-[-8%] h-[55%] w-[65%] text-orange-200/40"
            viewBox="0 0 600 600"
            fill="currentColor"
          >
            <path d="M80 420C20 300 40 160 150 90C260 20 420 40 490 140C560 240 520 380 410 450C300 520 140 540 80 420Z" />
          </svg>
          <div className="absolute right-[8%] top-[18%] h-40 w-40 rounded-full bg-[#F97316]/10 blur-3xl sm:h-56 sm:w-56" />
          <div className="absolute bottom-[22%] left-[12%] h-36 w-36 rounded-full bg-amber-200/30 blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10 lg:min-h-[calc(100svh-72px)] lg:px-8 lg:pb-28 lg:pt-14">
          <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 xl:gap-16">
            {/* Copy */}
            <div className="relative z-10 flex flex-col text-center lg:text-left">
              <Reveal>
                <p className="text-sm font-semibold tracking-[0.14em] text-[#F97316]">
                  CONNECT · SHARE · BELONG
                </p>
              </Reveal>

              <Reveal delay={1}>
                <h1 className="mt-2  font-extrabold sm:leading-[1.02] tracking-tight text-[#111827] sm:mt-3 sm:text-[3.5rem] lg:text-[4.5rem] text-[1.8rem] ">
                  Bringing People and Communities Together.
                </h1>
              </Reveal>

              <Reveal delay={2}>
                <p className="mx-auto sm:mt-4 max-w-lg text-base leading-relaxed text-[#4B5563] sm:mt-5 sm:text-lg lg:mx-0">
                  A place for your people, your stories, your conversations, and
                  the communities you care about.
                </p>
              </Reveal>

              <Reveal delay={3}>
                <div className="mt-6 flex flex-row flex-wrap items-center gap-3 sm:mt-7 lg:justify-start">
                  {!user ? (
                    <>
                      <PrimaryCta
                        href="/signup"
                        className="shrink-0 whitespace-nowrap"
                      >
                        Join CribsTalk
                        <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </PrimaryCta>

                      <SecondaryCta
                        href="/signin"
                        className="shrink-0 whitespace-nowrap"
                      >
                        Sign In
                      </SecondaryCta>
                    </>
                  ) : (
                    <PrimaryCta
                      href="/feed"
                      className="shrink-0 whitespace-nowrap"
                    >
                      Go to your feed
                      <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </PrimaryCta>
                  )}
                </div>
              </Reveal>

              {/* People strip */}
              <Reveal delay={4} className="mt-7 sm:mt-9">
                <div className="flex items-center justify-center gap-3 lg:justify-start">
                  <div className="flex -space-x-3">
                    {stories.map((story) => (
                      <img
                        key={story.name}
                        src={story.avatar}
                        alt={story.name}
                        className="h-10 w-10 rounded-full border-[2.5px] border-white object-cover shadow-sm sm:h-11 sm:w-11"
                      />
                    ))}
                  </div>
                  <p className="max-w-[11rem] text-left text-sm leading-snug text-[#6B7280]">
                    People already sharing moments on CribsTalk
                  </p>
                </div>
              </Reveal>
            </div>

            {/* Social composition — denser, fills banner */}
            <Reveal delay={2} className="relative z-10 mx-auto mt-2 w-full max-w-[520px] sm:mt-4 lg:mt-0 lg:max-w-none">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[480px] sm:aspect-[5/6] lg:aspect-auto lg:min-h-[560px] lg:max-w-none">
                {/* Curved glass plate behind cards */}
                <div
                  className="absolute inset-[4%] bg-white/55 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-[2px] sm:inset-[3%]"
                  style={{
                    borderRadius: "42% 58% 48% 52% / 48% 42% 58% 52%",
                  }}
                />
                <div
                  className="absolute inset-[10%] border border-white/70 bg-gradient-to-br from-white/70 to-[#FBF6EF]/50 sm:inset-[8%]"
                  style={{
                    borderRadius: "48% 52% 55% 45% / 45% 55% 45% 55%",
                  }}
                />

                {/* Main post card */}
                <article className="lp-animate-float-slow absolute right-[2%] top-[2%] z-20 w-[72%] max-w-[320px] rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] transition-shadow duration-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.16)] sm:right-[4%] sm:top-[4%] sm:p-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={avatars.daniel}
                      alt="Daniel Carter"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#111827]">
                        Daniel Carter
                      </p>
                      <p className="text-xs text-[#6B7280]">@danielc · 2h</p>
                    </div>
                    <MoreHorizontal className="h-4 w-4 text-[#9CA3AF]" />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#374151]">
                    Weekend hike with friends — some places become memories.
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl">
                    <img
                      src={`${LP}/feed-hike.png`}
                      alt="Photo shared in the CribsTalk feed"
                      className="aspect-[16/10] h-full w-full object-cover"
                      loading="eager"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#6B7280]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-medium text-rose-500 transition-transform hover:scale-105"
                      aria-label="Like"
                    >
                      <Heart className="h-4 w-4 fill-rose-500" /> 248
                    </button>
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" /> 32
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Share2 className="h-4 w-4" /> Share
                    </span>
                  </div>
                </article>

                {/* Profile card */}
                <div className="lp-animate-float absolute left-[1%] top-[12%] z-20 w-[48%] max-w-[210px] rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.10)] transition-transform duration-300 hover:-translate-y-0.5 sm:left-[2%] sm:top-[14%] sm:p-4">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={avatars.maya}
                      alt="Maya Johnson"
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-[#F97316]/25"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">
                        Maya Johnson
                      </p>
                      <p className="text-xs text-[#6B7280]">@mayaj</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-[#6B7280]">
                    <span className="font-semibold text-[#111827]">1.2K</span>{" "}
                    followers
                  </p>
                  <button
                    type="button"
                    className="mt-2.5 inline-flex h-9 w-full items-center justify-center rounded-full bg-[#F97316] text-xs font-semibold text-white transition-colors hover:bg-[#EA580C]"
                  >
                    Follow
                  </button>
                </div>

                {/* Notification */}
                <div className="lp-animate-float-slow absolute bottom-[28%] right-[0%] z-30 flex max-w-[210px] items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5 shadow-xl sm:bottom-[30%] sm:right-[2%]">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-orange-50 text-[#F97316]">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">
                      Someone liked your post
                    </p>
                    <p className="text-[11px] text-[#6B7280]">Just now</p>
                  </div>
                </div>

                {/* Message preview */}
                <div className="lp-animate-float absolute bottom-[14%] left-[0%] z-30 w-[52%] max-w-[220px] rounded-2xl border border-black/[0.06] bg-white p-3 shadow-xl sm:bottom-[16%] sm:left-[2%] sm:p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <img
                        src={avatars.sophia}
                        alt="Sophia"
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#111827]">
                        Sophia
                      </p>
                      <p className="truncate text-[11px] text-[#6B7280]">
                        That photo is beautiful ✨
                      </p>
                    </div>
                  </div>
                </div>

                {/* Community card */}
                <div className="lp-animate-float absolute bottom-[1%] right-[4%] z-20 flex w-[64%] max-w-[260px] items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-3 shadow-lg sm:bottom-[2%] sm:right-[6%]">
                  <img
                    src={`${LP}/discover-travel.png`}
                    alt="Travel Stories community"
                    className="h-11 w-11 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#111827]">
                      Travel Stories
                    </p>
                    <p className="text-[11px] text-[#6B7280]">8.2K members</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-[#F97316] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#EA580C]"
                  >
                    Join
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Bottom wave curve into next section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 leading-[0]" aria-hidden="true">
          <svg
            className="relative block h-[48px] w-full text-white sm:h-[64px] lg:h-[80px]"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,48 C240,80 480,8 720,32 C960,56 1200,80 1440,40 L1440,80 L0,80 Z" />
          </svg>
        </div>
      </section>

      {/* ======================== SOCIAL FEED ======================== */}


      {/* ======================== DISCOVER ======================== */}


      {/* ======================== COMMUNITIES ======================== */}
      <section id="communities" className="scroll-mt-24 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              title="Find your people."
              description="Join conversations built around the things you care about."
            />
          </Reveal>

          <Reveal delay={1} className="mt-10 sm:mt-14">
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {communityCards.map((community) => (
                <article
                  key={community.name}
                  className="w-[78%] flex-none overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:w-auto"
                >
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={community.image}
                      alt={community.name}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4 sm:p-5">
                    <h3 className="text-base font-semibold text-[#111827]">
                      {community.name}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">
                      {community.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-sm text-[#6B7280]">
                        <span className="font-semibold text-[#111827]">
                          {community.members}
                        </span>{" "}
                        members
                      </span>
                      <Link
                        href={user ? "/groups" : "/signup"}
                        className="inline-flex h-9 items-center justify-center rounded-full bg-[#F97316] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40"
                      >
                        Join
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================== MESSAGING ======================== */}
      <section
        id="messaging"
        className="scroll-mt-24 bg-[#FAFAF9] py-16 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              title="Keep the conversation going."
              description="From one-on-one conversations to group chats, stay close to the people who matter."
            />
          </Reveal>

          <Reveal delay={2} className="mx-auto mt-10 max-w-4xl sm:mt-14">
            <div className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <div className="grid lg:grid-cols-[280px_1fr]">
                {/* Conversation list */}
                <div className="border-b border-[#F3F4F6] lg:border-b-0 lg:border-r sm:block hidden">
                  <div className="flex items-center justify-between border-b border-[#F3F4F6] px-4 py-4">
                    <p className="font-semibold text-[#111827]">Messages</p>
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-[#EA580C]">
                      3 new
                    </span>
                  </div>
                  <ul className="divide-y divide-[#F3F4F6]">
                    {conversations.map((chat) => (
                      <li
                        key={chat.name}
                        className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${chat.active ? "bg-[#FBF6EF]/80" : "hover:bg-[#F9FAFB]"
                          }`}
                      >
                        <div className="relative flex-none">
                          <img
                            src={chat.avatar}
                            alt={chat.name}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                          {chat.online ? (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[#111827]">
                              {chat.name}
                            </p>
                            <span className="flex-none text-[11px] text-[#9CA3AF]">
                              {chat.time}
                            </span>
                          </div>
                          <p className="truncate text-sm text-[#6B7280]">
                            {chat.preview}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Active conversation */}
                <div className="flex min-h-[360px] flex-col">
                  <div className="flex items-center justify-between border-b border-[#F3F4F6] px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={avatars.emma}
                          alt="Emma Laurent"
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#111827]">
                          Emma Laurent
                        </p>
                        <p className="text-xs text-emerald-600">Online</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FBF6EF] text-[#F97316]">
                        <Phone className="h-4 w-4" />
                      </span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F97316] text-white">
                        <Video className="h-4 w-4" />
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 bg-[#FAFAF9]/60 px-4 py-5 sm:px-5">
                    <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm text-[#374151] shadow-sm">
                      The group call yesterday was great — we should do that
                      again.
                    </div>
                    <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-[#F97316] px-4 py-3 text-sm text-white shadow-sm">
                      Absolutely. I&apos;ll send the invite for Friday.
                    </div>
                    <div className="overflow-hidden rounded-2xl rounded-tl-md bg-white shadow-sm">
                      <img
                        src={`${LP}/chat-share.png`}
                        alt="Shared photo in chat"
                        className="aspect-[16/10] w-full  object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="max-w-[75%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm text-[#374151] shadow-sm">
                      Perfect{" "}
                      <span className="inline-flex align-middle text-rose-500">
                        <Heart className="inline h-3.5 w-3.5 fill-rose-500" />
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-[#F3F4F6] px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2.5">
                      <span className="flex-1 text-sm text-[#9CA3AF]">
                        Message…
                      </span>
                      <Send className="h-4 w-4 text-[#F97316]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================== PROFILE ======================== */}


      {/* ======================== MARKETPLACE ======================== */}

      {/* ======================== GLOBAL COMMUNITY ======================== */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              title="Different stories. One community."
              description="Connect with people from different places, backgrounds, interests, and communities."
            />
          </Reveal>

          <Reveal delay={2} className="relative mx-auto mt-10 max-w-4xl sm:mt-14">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="col-span-2 row-span-2 overflow-hidden rounded-2xl">
                <img
                  src={`${LP}/discover-travel.png`}
                  alt="Shared travel moment"
                  className="h-full min-h-[220px] w-full object-cover sm:min-h-[280px]"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-3 shadow-sm sm:p-4">
                <img
                  src={avatars.maya}
                  alt="Sofia"
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-[#F97316]/30"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Sofia</p>
                  <p className="truncate text-xs text-[#6B7280]">
                    Shared a new photo
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl">
                <img
                  src={avatars.daniel}
                  alt="James"
                  className="h-full min-h-[100px] w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="rounded-2xl border border-black/[0.06] bg-[#FBF6EF] p-3 sm:p-4">
                <p className="text-xs font-semibold text-[#111827]">
                  Photography
                </p>
                <p className="mt-1 text-[11px] text-[#6B7280]">8.1K members</p>
                <span className="mt-3 inline-flex rounded-full bg-[#F97316] px-2.5 py-1 text-[11px] font-semibold text-white">
                  Join
                </span>
              </div>
              <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white p-3 shadow-sm sm:p-4">
                <div className="flex -space-x-2">
                  {[
                    avatars.emma,
                    avatars.marcus,
                    avatars.maya,
                  ].map((src) => (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className="h-8 w-8 rounded-full border-2 border-white object-cover"
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#6B7280]">
                  <span className="font-semibold text-rose-500">♡ 128</span> new
                  reactions today
                </p>
              </div>
              <div className="col-span-2 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <img
                    src={avatars.marcus}
                    alt="Marcus"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">
                      Marcus Webb
                    </p>
                    <p className="mt-1 text-sm text-[#4B5563]">
                      Built something new this week and shared it with the
                      community — the feedback already feels like friends.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================== MOBILE ======================== */}
      <section className="bg-[#FAFAF9] py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <SectionHeading
                align="left"
                title="CribsTalk goes wherever you go."
                description="Your feed, profile, messages, and communities — ready whenever you are."
              />
              <ul className="mt-8 space-y-3">
                {[
                  { icon: ImageIcon, label: "Your feed on the go" },
                  { icon: Camera, label: "Profiles and moments" },
                  { icon: MessageCircle, label: "Messages and calls" },
                  { icon: Users, label: "Communities that travel with you" },
                ].map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 text-[15px] text-[#374151]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#F97316] shadow-sm ring-1 ring-black/[0.04]">
                      <Icon className="h-4 w-4" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal
              delay={2}
              className="relative mx-auto flex w-full max-w-lg justify-center gap-3 sm:gap-5"
            >
              {/* Phone — feed */}
              <div className="relative w-[42%] max-w-[180px] rounded-[2rem] border-[6px] border-[#111827] bg-white shadow-2xl">
                <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[#111827]/80" />
                <div className="space-y-2.5 overflow-hidden rounded-[1.55rem] bg-[#FBF6EF] p-2.5 pt-6">
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <img
                        src={avatars.maya}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                      <span className="text-[10px] font-semibold">Maya</span>
                    </div>
                    <div className="aspect-[4/3] overflow-hidden rounded-lg">
                      <img
                        src={`${LP}/feed-hike.png`}
                        alt="Mobile feed preview"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-1.5 flex gap-2 text-[9px] text-[#6B7280]">
                      <span className="text-rose-500">♡ 48</span>
                      <span>💬 6</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <p className="text-[10px] leading-snug text-[#4B5563]">
                      Daniel asked: one skill everyone should learn?
                    </p>
                  </div>
                </div>
              </div>

              {/* Phone — messages / community */}
              <div className="relative mt-8 w-[42%] max-w-[180px] rounded-[2rem] border-[6px] border-[#111827] bg-white shadow-2xl sm:mt-10">
                <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-[#111827]/80" />
                <div className="space-y-2 overflow-hidden rounded-[1.55rem] bg-white p-2.5 pt-6">
                  <div className="mb-1 flex items-center gap-2 border-b border-[#F3F4F6] pb-2">
                    <img
                      src={avatars.emma}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                    />
                    <span className="text-[11px] font-semibold">Emma</span>
                  </div>
                  <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-[#F3F4F6] px-2 py-1.5 text-[10px] text-[#374151]">
                    Free later for a quick call?
                  </div>
                  <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-[#F97316] px-2 py-1.5 text-[10px] text-white">
                    Yes — sending invite.
                  </div>
                  <div className="mt-3 rounded-xl bg-[#FBF6EF] p-2">
                    <p className="text-[10px] font-semibold text-[#111827]">
                      Travel Stories
                    </p>
                    <p className="text-[9px] text-[#6B7280]">8.2K members</p>
                  </div>
                  <div className="flex justify-center gap-2 pt-1">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FBF6EF] text-[#F97316]">
                      <Phone className="h-3 w-3" />
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F97316] text-white">
                      <Video className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ======================== FINAL CTA ======================== */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-[#FBF6EF] px-6 py-14 text-center sm:px-10 sm:py-16 lg:px-16 lg:py-20">
            <h2 className="relative mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-[#111827] sm:text-4xl lg:text-5xl">
              Your people. Your stories. Your Crib.
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-base text-[#4B5563] sm:text-lg">
              Join CribsTalk and start building your corner of the community.
            </p>

            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {!user ? (
                <>
                  <PrimaryCta href="/signup" className="w-full sm:w-auto">
                    Join CribsTalk
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </PrimaryCta>
                  <SecondaryCta href="/signin" className="w-full sm:w-auto">
                    Sign In
                  </SecondaryCta>
                </>
              ) : (
                <PrimaryCta href="/feed" className="w-full sm:w-auto">
                  Go to your feed
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </PrimaryCta>
              )}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Home;
