import React from 'react'
import { X, Mail, Phone, MessageCircle, Clock, Globe, Headphones, Users } from 'lucide-react'

interface SupportModalProps {
  isOpen: boolean
  onClose: () => void
}

const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <div className="flex items-center space-x-3">
            <Headphones className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Support & Help Center</h2>
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
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">We're Here to Help</h3>
            <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Our dedicated support team is committed to ensuring you have the best experience on ConnectAfrik. 
              Whether you need technical assistance, have questions about our platform, or want to provide feedback, 
              we're here to support the African community worldwide.
            </p>
          </div>

          {/* Contact Methods */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Support */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-800">Email Support</h4>
                  <p className="text-blue-600 text-sm">Get detailed assistance via email</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <a
                    href="mailto:wlivinston21@gmail.com"
                    className="text-blue-700 hover:text-blue-800 font-medium"
                  >
                    wlivinston21@gmail.com
                  </a>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-blue-700 text-sm">Response within 24 hours</span>
                </div>
                <p className="text-blue-600 text-sm">
                  Best for: Account issues, feature requests, detailed technical problems, partnerships
                </p>
              </div>
            </div>

            {/* Phone Support */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-800">Phone Support</h4>
                  <p className="text-green-600 text-sm">Direct assistance when you need it most</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-green-500" />
                  <a
                    href="tel:+233534787731"
                    className="text-green-700 hover:text-green-800 font-medium"
                  >
                    +233 534 787 731
                  </a>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Ghana</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-green-500" />
                  <a
                    href="tel:+19144337155"
                    className="text-green-700 hover:text-green-800 font-medium"
                  >
                    +1 914 433 7155
                  </a>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">USA</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <span className="text-green-700 text-sm">Mon-Fri, 9AM-6PM (GMT/EST)</span>
                </div>
                <p className="text-green-600 text-sm">
                  Best for: Urgent issues, billing questions, community safety concerns
                </p>
              </div>
            </div>
          </div>

          {/* Support Hours */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Clock className="w-6 h-6 text-gray-600" />
              <h4 className="text-lg font-semibold text-gray-800">Support Hours</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium text-gray-800 mb-2">🇬🇭 Ghana Time (GMT)</h5>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>Monday - Friday: 9:00 AM - 6:00 PM</li>
                  <li>Saturday: 10:00 AM - 4:00 PM</li>
                  <li>Sunday: Emergency support only</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-800 mb-2">🇺🇸 Eastern Time (EST)</h5>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>Monday - Friday: 4:00 AM - 1:00 PM</li>
                  <li>Saturday: 5:00 AM - 11:00 AM</li>
                  <li>Sunday: Emergency support only</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Common Questions */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-800">Frequently Asked Questions</h4>
            <div className="space-y-4">
              <details className="bg-gray-50 rounded-lg">
                <summary className="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-100 rounded-lg">
                  How do I create an account on ConnectAfrik?
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  Click "Join Community" on the homepage, provide your email, create a password, and complete your profile 
                  with your African country of origin or residence. Verify your email to start connecting with the community.
                </div>
              </details>

              <details className="bg-gray-50 rounded-lg">
                <summary className="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-100 rounded-lg">
                  How do I join or create groups for common goals?
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  Navigate to the "Groups" section, browse existing groups by category (Politics, Culture, Business, etc.), 
                  or click "Create Group" to start your own community around shared goals and interests.
                </div>
              </details>

              <details className="bg-gray-50 rounded-lg">
                <summary className="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-100 rounded-lg">
                  What should I do if I encounter inappropriate content?
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  Use the report button on any post or comment that violates our community guidelines. Our moderation team 
                  reviews all reports within 24 hours and takes appropriate action to maintain a safe environment.
                </div>
              </details>

              <details className="bg-gray-50 rounded-lg">
                <summary className="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-100 rounded-lg">
                  Can I use ConnectAfrik for business networking?
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  Absolutely! Create business-focused groups, share professional achievements, discuss economic policies, 
                  and connect with entrepreneurs across Africa and the diaspora. Just follow our guidelines for commercial activities.
                </div>
              </details>

              <details className="bg-gray-50 rounded-lg">
                <summary className="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-100 rounded-lg">
                  Is ConnectAfrik available on mobile devices?
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  Yes! ConnectAfrik is built as a Progressive Web App (PWA) that works seamlessly on mobile browsers 
                  and can be installed as an app on your phone for the best experience.
                </div>
              </details>
            </div>
          </div>

          {/* Community Resources */}
          <div className="bg-gradient-to-r from-african-green to-primary-600 text-white rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Globe className="w-6 h-6" />
              <h4 className="text-lg font-semibold">Community Resources</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <ul className="space-y-2">
                <li>• Community Guidelines & Rules</li>
                <li>• Getting Started Guide</li>
                <li>• Privacy & Safety Tips</li>
                <li>• Group Management Help</li>
              </ul>
              <ul className="space-y-2">
                <li>• Cultural Sharing Best Practices</li>
                <li>• Political Discussion Etiquette</li>
                <li>• Reporting & Moderation Process</li>
                <li>• Platform Feature Updates</li>
              </ul>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-red-600" />
              </div>
              <h4 className="font-semibold text-red-800">Emergency Support</h4>
            </div>
            <p className="text-red-700 text-sm mb-3">
              For urgent safety concerns, harassment, or immediate threats, contact us immediately via phone 
              or email with "URGENT" in the subject line.
            </p>
            <p className="text-red-600 text-xs">
              We take community safety seriously and will respond to emergency reports within 2 hours.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Need immediate help? Contact us now!
            </p>
            <div className="flex space-x-3">
              <a
                href="mailto:wlivinston21@gmail.com"
                className="btn-secondary"
              >
                Email Us
              </a>
              <button
                onClick={onClose}
                className="btn-primary"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupportModal