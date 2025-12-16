'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Heart, Globe, Users, Target, Star, Lightbulb } from 'lucide-react'

const OurStory: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Story</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From vision to reality: Building the premier platform for African voices worldwide
          </p>
        </div>

        {/* Hero Story */}
        <div className="bg-white rounded-lg shadow-sm mb-12">
          <div className="p-8">
            <div className="flex items-center mb-6">
              <Heart className="w-8 h-8 text-red-500 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">The Genesis</h2>
            </div>
            <div className="prose prose-lg max-w-none text-gray-700">
              <p className="text-xl leading-relaxed mb-6">
                ConnectAfrik was born from a simple yet powerful realization: despite being home to over 1.4 billion people 
                across 54 nations, Africa's diverse voices were scattered across different platforms, often losing their 
                unique context and power in the global digital noise.
              </p>
              <p className="leading-relaxed">
                In 2024, a group of African technologists, diaspora leaders, and cultural advocates came together with a 
                shared vision—to create a digital home where African political discourse could flourish, cultural heritage 
                could be preserved and celebrated, and meaningful connections could bridge the gap between the continent 
                and its global diaspora.
              </p>
            </div>
          </div>
        </div>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-8">
              <div className="flex items-center mb-6">
                <Target className="w-8 h-8 text-blue-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">Our Mission</h2>
              </div>
              <p className="text-gray-700 leading-relaxed">
                To amplify African voices, foster meaningful political dialogue, preserve cultural heritage, 
                and build bridges that connect Africans across continents—creating a digital ecosystem where 
                every African story matters and every voice is heard.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-8">
              <div className="flex items-center mb-6">
                <Lightbulb className="w-8 h-8 text-yellow-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">Our Vision</h2>
              </div>
              <p className="text-gray-700 leading-relaxed">
                A world where African perspectives shape global conversations, where cultural diversity is celebrated, 
                and where the African diaspora remains deeply connected to their roots while building bridges to their future.
              </p>
            </div>
          </div>
        </div>

        {/* Our Journey */}
        <div className="bg-white rounded-lg shadow-sm mb-12">
          <div className="p-8">
            <div className="flex items-center mb-6">
              <Globe className="w-8 h-8 text-green-500 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Our Journey</h2>
            </div>
            <div className="space-y-8">
              <div className="border-l-4 border-primary-500 pl-6">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-primary-500 rounded-full mr-3"></div>
                  <h3 className="text-lg font-semibold text-gray-900">The Awakening (2023)</h3>
                </div>
                <p className="text-gray-700">
                  Recognizing the fragmentation of African voices across global platforms, we began research into 
                  what African communities truly needed from a digital platform.
                </p>
              </div>

              <div className="border-l-4 border-blue-500 pl-6">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                  <h3 className="text-lg font-semibold text-gray-900">The Foundation (Early 2024)</h3>
                </div>
                <p className="text-gray-700">
                  We assembled a diverse team of developers, cultural experts, and community leaders from across 
                  Africa and the diaspora to build the foundation of what would become ConnectAfrik.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-6">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <h3 className="text-lg font-semibold text-gray-900">The Launch (Mid 2024)</h3>
                </div>
                <p className="text-gray-700">
                  After months of development and community testing, ConnectAfrik launched with its core features: 
                  political discussions, cultural sharing, and community building tools.
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-6">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                  <h3 className="text-lg font-semibold text-gray-900">The Growth (Late 2024)</h3>
                </div>
                <p className="text-gray-700">
                  Today, ConnectAfrik continues to evolve, adding new features and expanding our community 
                  while staying true to our core mission of celebrating and connecting African voices.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="bg-white rounded-lg shadow-sm mb-12">
          <div className="p-8">
            <div className="flex items-center mb-6">
              <Star className="w-8 h-8 text-yellow-500 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Our Values</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-primary-600">Ubuntu</h3>
                <p className="text-gray-700">
                  "I am because we are" - We believe in the interconnectedness of all African people and 
                  the power of collective success.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 text-blue-600">Authenticity</h3>
                <p className="text-gray-700">
                  We celebrate genuine African experiences, stories, and perspectives without dilution or appropriation.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-600">Diversity</h3>
                <p className="text-gray-700">
                  Africa's strength lies in its diversity. We embrace and amplify voices from all 54 countries 
                  and every corner of the diaspora.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 text-purple-600">Innovation</h3>
                <p className="text-gray-700">
                  We continuously evolve our platform to better serve our community while pioneering new ways 
                  to connect and engage.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-600">Respect</h3>
                <p className="text-gray-700">
                  Every voice matters. We maintain a respectful environment where constructive dialogue can flourish.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 text-yellow-600">Empowerment</h3>
                <p className="text-gray-700">
                  We provide tools and opportunities for African individuals and communities to grow, connect, and succeed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Impact */}
        <div className="bg-white rounded-lg shadow-sm mb-12">
          <div className="p-8">
            <div className="flex items-center mb-6">
              <Users className="w-8 h-8 text-blue-500 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Our Impact</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600 mb-2">10,000+</div>
                <p className="text-gray-700">Active Community Members</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">54</div>
                <p className="text-gray-700">African Countries Represented</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">500+</div>
                <p className="text-gray-700">Cultural Stories Shared</p>
              </div>
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="bg-white rounded-lg shadow-sm mb-12">
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Meet Our Team</h2>
            <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
              ConnectAfrik is built by a passionate team of African technologists, cultural advocates, 
              and community leaders from across the continent and diaspora.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-primary-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold">
                  ST
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Senyo Komla Tsedze</h3>
                <p className="text-gray-600">Founder & CEO</p>
              </div>
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold">
                  CT
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Community Team</h3>
                <p className="text-gray-600">Pan-African Collective</p>
              </div>
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold">
                  DT
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Development Team</h3>
                <p className="text-gray-600">Global African Diaspora</p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Join Our Story</h2>
            <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
              ConnectAfrik's story is just beginning, and we want you to be part of it. Together, 
              we can amplify African voices and build bridges that span continents.
            </p>
            <div className="space-x-4">
              <Link href="/signup" className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
                Join ConnectAfrik
              </Link>
              <Link href="/support" className="inline-block px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OurStory

