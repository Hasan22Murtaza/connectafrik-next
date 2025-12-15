import React from 'react'
import { X, Shield, Users, Heart, Globe, AlertTriangle, CheckCircle } from 'lucide-react'

interface GuidelinesModalProps {
  isOpen: boolean
  onClose: () => void
}

const GuidelinesModal: React.FC<GuidelinesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-african-green to-primary-600 text-white rounded-t-lg">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6" />
            <h2 className="text-xl font-semibold">ConnectAfrik Community Guidelines</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Introduction */}
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-african-green to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Building a United African Community</h3>
            <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
              ConnectAfrik is a platform that celebrates African heritage, promotes meaningful political discourse, 
              and builds bridges across the continent and diaspora. Our guidelines ensure this remains a safe, 
              respectful, and empowering space for all Africans.
            </p>
          </div>

          {/* Core Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-semibold text-green-800">Unity in Diversity</h4>
              <p className="text-green-700 text-sm">Celebrating all 54 African nations and global diaspora</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <Globe className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <h4 className="font-semibold text-orange-800">Pan-African Vision</h4>
              <p className="text-orange-700 text-sm">Fostering continental integration and cooperation</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Heart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-semibold text-blue-800">Respectful Dialogue</h4>
              <p className="text-blue-700 text-sm">Promoting constructive conversations and understanding</p>
            </div>
          </div>

          {/* Guidelines Sections */}
          <div className="space-y-6">
            {/* Political Discussions */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold">🏛️</span>
                </div>
                <h4 className="text-lg font-semibold text-red-800">Political Discourse Guidelines</h4>
              </div>
              <ul className="space-y-2 text-red-700">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Focus on policies, ideas, and constructive criticism rather than personal attacks</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Share factual information with credible sources when discussing current events</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Respect different political viewpoints and encourage democratic dialogue</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Avoid hate speech, incitement to violence, or discriminatory language</span>
                </li>
              </ul>
            </div>

            {/* Cultural Sharing */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold">🎭</span>
                </div>
                <h4 className="text-lg font-semibold text-green-800">Cultural Heritage & Expression</h4>
              </div>
              <ul className="space-y-2 text-green-700">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Celebrate and share authentic African cultures, traditions, and art forms</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Respect cultural differences and avoid stereotyping or generalizations</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Credit original creators when sharing art, music, or cultural content</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Promote cultural exchange and learning between different African communities</span>
                </li>
              </ul>
            </div>

            {/* Community Behavior */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-blue-800">Community Standards</h4>
              </div>
              <ul className="space-y-2 text-blue-700">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Treat all community members with dignity and respect</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Use appropriate language and maintain professional conduct</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Support fellow Africans and celebrate their achievements</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Report inappropriate content or behavior to our moderation team</span>
                </li>
              </ul>
            </div>

            {/* Prohibited Content */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
                <h4 className="text-lg font-semibold text-yellow-800">Prohibited Content & Behavior</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-yellow-700">
                <ul className="space-y-2">
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                    <span className="text-sm">Hate speech or discrimination</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                    <span className="text-sm">Harassment or bullying</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                    <span className="text-sm">Misinformation or fake news</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                    <span className="text-sm">Spam or commercial exploitation</span>
                  </li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                    <span className="text-sm">Violence or threats</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                    <span className="text-sm">Adult or inappropriate content</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                    <span className="text-sm">Copyright infringement</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                    <span className="text-sm">Illegal activities or content</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Enforcement */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Enforcement & Moderation</h4>
              <div className="text-gray-700 space-y-3">
                <p className="text-sm">
                  Our community moderators review reported content and may take action including warnings, 
                  temporary suspensions, or permanent bans for serious violations.
                </p>
                <p className="text-sm">
                  We believe in education and rehabilitation rather than punishment, and will work with 
                  community members to understand and follow these guidelines.
                </p>
                <p className="text-sm">
                  Appeals can be submitted through our support channels if you believe an action was taken in error.
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center bg-gradient-to-r from-african-green to-primary-600 text-white rounded-lg p-6">
            <h4 className="text-lg font-semibold mb-2">Together We Build a Stronger Africa</h4>
            <p className="text-sm opacity-90 mb-4">
              By following these guidelines, you're contributing to a platform that empowers African voices, 
              preserves our heritage, and builds our collective future.
            </p>
            <div className="flex items-center justify-center space-x-1 text-sm">
              <span>Ubuntu:</span>
              <span className="italic">"I am because we are"</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Last updated: January 2025
            </p>
            <button
              onClick={onClose}
              className="btn-primary"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GuidelinesModal