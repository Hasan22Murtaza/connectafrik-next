import React from 'react'
import { X, Heart, Globe, Users, Star, Map, Zap, Target } from 'lucide-react'

interface OurStoryModalProps {
  isOpen: boolean
  onClose: () => void
}

const OurStoryModal: React.FC<OurStoryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative">
          {/* Hero Background */}
          <div className="h-64 bg-gradient-to-r from-african-green via-primary-600 to-orange-500 relative overflow-hidden rounded-t-lg">
            {/* African Pattern Overlay */}
            <div className="absolute inset-0 opacity-20">
              <svg className="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="african-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="2" fill="white" />
                    <polygon points="5,5 15,5 10,15" fill="white" opacity="0.5" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#african-pattern)" />
              </svg>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center text-white text-center">
              <div>
                <h1 className="text-4xl font-bold mb-2">Our Story</h1>
                <p className="text-xl opacity-90">Connecting Africa, Empowering Voices</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-10">
          {/* Introduction */}
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="text-3xl">🌍</span>
              <h2 className="text-2xl font-bold text-gray-900">From Vision to Reality</h2>
              <span className="text-3xl">✊</span>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              ConnectAfrik was born from a simple yet powerful belief: that the voices, stories, and dreams of 
              Africa's 1.4 billion people and its global diaspora deserve a platform that truly understands 
              our rich heritage, complex politics, and boundless potential.
            </p>
          </div>

          {/* The Challenge */}
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg">
            <div className="flex items-center space-x-3 mb-4">
              <Target className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-semibold text-red-800">The Challenge We Saw</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-red-700">
              <div>
                <h4 className="font-medium mb-2">Fragmented Voices</h4>
                <p className="text-sm">
                  African perspectives were scattered across platforms not designed for our unique political 
                  landscapes, cultural nuances, and socio-economic realities.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Diaspora Disconnect</h4>
                <p className="text-sm">
                  Millions of Africans living abroad struggled to maintain meaningful connections with 
                  their heritage and contribute to continental development.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Political Discourse</h4>
                <p className="text-sm">
                  Democratic progress across Africa needed safe spaces for constructive political dialogue 
                  and youth engagement in governance.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Cultural Preservation</h4>
                <p className="text-sm">
                  Rich traditions, languages, and wisdom risked being lost without dedicated platforms 
                  for sharing and preservation.
                </p>
              </div>
            </div>
          </div>

          {/* Our Journey */}
          <div className="space-y-8">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <Map className="w-6 h-6 text-primary-600" />
                <h3 className="text-2xl font-bold text-gray-900">Our Journey</h3>
              </div>
            </div>

            <div className="relative">
              {/* Timeline */}
              <div className="absolute left-1/2 transform -translate-x-0.5 h-full w-1 bg-gradient-to-b from-african-green via-primary-600 to-orange-500"></div>
              
              <div className="space-y-12">
                {/* Vision */}
                <div className="flex items-center">
                  <div className="w-1/2 pr-8 text-right">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-800 mb-2">The Vision</h4>
                      <p className="text-green-700 text-sm">
                        Create a digital home where every African voice matters, where political discourse 
                        drives democratic progress, and where cultural heritage thrives in the modern world.
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center relative z-10">
                    <span className="text-white text-xl">💡</span>
                  </div>
                  <div className="w-1/2 pl-8"></div>
                </div>

                {/* Research */}
                <div className="flex items-center">
                  <div className="w-1/2 pr-8"></div>
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center relative z-10">
                    <span className="text-white text-xl">📚</span>
                  </div>
                  <div className="w-1/2 pl-8">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2">Deep Research</h4>
                      <p className="text-blue-700 text-sm">
                        We studied political systems across all 54 African nations, analyzed cultural 
                        preservation needs, and interviewed diaspora communities worldwide.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Development */}
                <div className="flex items-center">
                  <div className="w-1/2 pr-8 text-right">
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-800 mb-2">Thoughtful Development</h4>
                      <p className="text-purple-700 text-sm">
                        Built with African-first design principles, ensuring cultural sensitivity, 
                        multi-language support, and features that address our specific needs.
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center relative z-10">
                    <span className="text-white text-xl">⚡</span>
                  </div>
                  <div className="w-1/2 pl-8"></div>
                </div>

                {/* Launch */}
                <div className="flex items-center">
                  <div className="w-1/2 pr-8"></div>
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center relative z-10">
                    <span className="text-white text-xl">🚀</span>
                  </div>
                  <div className="w-1/2 pl-8">
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-orange-800 mb-2">Community Launch</h4>
                      <p className="text-orange-700 text-sm">
                        ConnectAfrik goes live with features for political discourse, cultural sharing, 
                        group formation, and diaspora connection.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Our Values */}
          <div className="bg-gradient-to-br from-african-green/10 to-primary-600/10 rounded-xl p-8">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <Heart className="w-6 h-6 text-primary-600" />
                <h3 className="text-2xl font-bold text-gray-900">Our Core Values</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🌱</span>
                </div>
                <h4 className="font-semibold text-green-800 mb-2">Ubuntu Philosophy</h4>
                <p className="text-green-700 text-sm">"I am because we are" - collective responsibility and interconnectedness</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🗳️</span>
                </div>
                <h4 className="font-semibold text-blue-800 mb-2">Democratic Progress</h4>
                <p className="text-blue-700 text-sm">Fostering transparent governance and youth political engagement</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎭</span>
                </div>
                <h4 className="font-semibold text-purple-800 mb-2">Cultural Pride</h4>
                <p className="text-purple-700 text-sm">Celebrating our rich heritage while embracing modern innovation</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🤝</span>
                </div>
                <h4 className="font-semibold text-orange-800 mb-2">Pan-African Unity</h4>
                <p className="text-orange-700 text-sm">Building bridges across borders and bridging diaspora connections</p>
              </div>
            </div>
          </div>

          {/* Impact Stories */}
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <Star className="w-6 h-6 text-yellow-500" />
                <h3 className="text-2xl font-bold text-gray-900">Stories of Impact</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-xl">🏛️</span>
                  </div>
                  <h4 className="font-semibold text-gray-800">Political Engagement</h4>
                </div>
                <p className="text-gray-600 text-sm text-center">
                  "Young Africans are using ConnectAfrik to organize grassroots political movements, 
                  discuss policy reforms, and hold leaders accountable through constructive dialogue."
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-xl">🌍</span>
                  </div>
                  <h4 className="font-semibold text-gray-800">Diaspora Connection</h4>
                </div>
                <p className="text-gray-600 text-sm text-center">
                  "African professionals in New York, London, and Toronto are collaborating on 
                  development projects back home, sharing resources and expertise across continents."
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-xl">🎨</span>
                  </div>
                  <h4 className="font-semibold text-gray-800">Cultural Revival</h4>
                </div>
                <p className="text-gray-600 text-sm text-center">
                  "Traditional artisans are finding new markets for their crafts while young people 
                  rediscover ancestral wisdom through cultural exchange groups."
                </p>
              </div>
            </div>
          </div>

          {/* Vision for the Future */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl p-8">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <Zap className="w-6 h-6 text-yellow-400" />
                <h3 className="text-2xl font-bold">Our Vision for 2030</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-4 text-yellow-400">Political Transformation</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• Youth-led political movements across all 54 nations</li>
                  <li>• Digital democracy tools for transparent governance</li>
                  <li>• Cross-border policy collaboration and learning</li>
                  <li>• Enhanced civic education and participation</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-4 text-yellow-400">Economic Empowerment</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• Diaspora investment in African startups</li>
                  <li>• Cultural industry development and promotion</li>
                  <li>• Skills exchange and professional development</li>
                  <li>• Sustainable development project coordination</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-4 text-yellow-400">Cultural Renaissance</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• Digital archives of African languages and traditions</li>
                  <li>• Global celebration of African heritage months</li>
                  <li>• Intergenerational knowledge transfer programs</li>
                  <li>• Modern expression of traditional values</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-4 text-yellow-400">Global Influence</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>• Unified African voice in international affairs</li>
                  <li>• Diaspora advocacy for continental interests</li>
                  <li>• Cultural diplomacy and soft power projection</li>
                  <li>• Leadership in global development solutions</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center bg-gradient-to-r from-african-green to-primary-600 text-white rounded-xl p-8">
            <div className="max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold mb-4">Join the Movement</h3>
              <p className="text-lg opacity-90 mb-6">
                ConnectAfrik is more than a platform—it's a movement toward African unity, democratic progress, 
                and cultural renaissance. Every voice matters. Every story shapes our future.
              </p>
              <div className="flex items-center justify-center space-x-1 text-xl font-medium">
                <span>Together, we are</span>
                <span className="bg-white text-primary-600 px-3 py-1 rounded-full">ConnectAfrik</span>
              </div>
              <div className="mt-4 text-sm opacity-75">
                "Sankofa: Learning from the past, living in the present, building the future"
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Globe className="w-4 h-4" />
              <span>Proudly African. Globally Connected.</span>
            </div>
            <button
              onClick={onClose}
              className="btn-primary"
            >
              Be Part of Our Story
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OurStoryModal