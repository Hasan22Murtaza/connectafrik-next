"use client";

import React from "react";
import Link from "next/link";
import {
  Globe,
  Users,
  MessageCircle,
  TrendingUp,
  Heart,
  Share2,
} from "lucide-react";

const Home: React.FC = () => {
  const features = [
    {
      icon: TrendingUp,
      title: "Political Discourse",
      description:
        "Engage in meaningful discussions about African politics, governance, and democratic progress across the continent.",
    },
    {
      icon: Users,
      title: "Cultural Exchange",
      description:
        "Share and discover the rich cultural heritage of Africa - from traditional foods to contemporary art.",
    },
    {
      icon: MessageCircle,
      title: "Community Building",
      description:
        "Connect with fellow Africans and diaspora members to build lasting relationships and networks.",
    },
    {
      icon: Globe,
      title: "Continental Unity",
      description:
        "Bridge geographical gaps and promote unity among the 54 African nations and global diaspora.",
    },
  ];

  const stats = [
    { number: "54", label: "African Countries" },
    { number: "10k+", label: "Active Members" },
    { number: "25k+", label: "Discussions" },
    { number: "50+", label: "Cultural Groups" },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 pt-24 pb-20">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-8">
              <img src="/assets/images/logo_2.png" alt="" className="w-50" />
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Connect<span className="text-orange-500"> Afrik</span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              The premier platform for Africans worldwide to share political
              insights, celebrate cultural diversity, and build meaningful
              connections across the continent.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="btn-primary text-lg px-8 py-3">
                Join the Community
              </Link>
              <Link href="/signin" className="btn-secondary text-lg px-8 py-3">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-orange-500 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What Makes ConnectAfrik Special
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform is designed specifically for the African community,
              fostering meaningful conversations about our shared heritage and
              future.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={index}
                  className="text-center group bg-transparent
                    hover:bg-orange-200
                    hover:shadow-sm
                     p-3
                     rounded-[14px]
                    transition-all ease-in-out duration-400
                  "
                >
                  <div className="flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mx-auto mb-6 group-hover:bg-orange-200 transition-colors ease-in-out duration-400">
                    <IconComponent className="w-8 h-8 text-orange-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Sample Content Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Explore Our Community
            </h2>
            <p className="text-xl text-gray-600">
              See what our members are sharing and discussing
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Politics Preview */}
            <div className="card group hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    🏛️ Politics
                  </span>
                  <div className="text-sm text-gray-500 mt-1">2 hours ago</div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                The Role of Youth in African Democracy
              </h3>
              <p className="text-gray-700 mb-4">
                Young Africans are driving democratic change across the
                continent. From protests to political participation, the youth
                voice is stronger than ever...
              </p>

              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Heart className="w-4 h-4" />
                  <span>234</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>45</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Share2 className="w-4 h-4" />
                  <span>12</span>
                </div>
              </div>
            </div>

            {/* Culture Preview */}
            <div className="card group hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    🎭 Culture
                  </span>
                  <div className="text-sm text-gray-500 mt-1">4 hours ago</div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Celebrating Kente: The Art of Ghanaian Weaving
              </h3>
              <p className="text-gray-700 mb-4">
                Each pattern tells a story, each color has meaning. Discover the
                rich history and cultural significance of Kente cloth in West
                African tradition...
              </p>

              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Heart className="w-4 h-4" />
                  <span>189</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>32</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Share2 className="w-4 h-4" />
                  <span>18</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Join the Conversation?
          </h2>
          <p className="text-xl text-orange-100 mb-8 max-w-3xl mx-auto">
            Connect with thousands of Africans sharing their stories, insights,
            and culture. Your voice matters in shaping our continent's future.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center px-8 py-3 bg-white text-orange-500 font-semibold rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            Get Started Today
          </Link>
        </div>
      </section>
    </>
  );
};

export default Home;
