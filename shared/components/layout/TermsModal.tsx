import React from 'react'
import { X, FileText, Scale, Users, Shield, AlertTriangle, CheckCircle } from 'lucide-react'

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Terms of Service</h2>
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
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Scale className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Terms of Service Agreement</h3>
            <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Welcome to ConnectAfrik! These terms govern your use of our platform and outline our mutual rights and responsibilities. 
              By using ConnectAfrik, you agree to these terms and become part of our vibrant African community.
            </p>
            <div className="mt-4 text-sm text-gray-500">
              <strong>Last Updated:</strong> January 2025 | <strong>Effective Date:</strong> January 2025
            </div>
          </div>

          {/* Agreement Acceptance */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold text-purple-800">Agreement to Terms</h3>
            </div>
            <p className="text-purple-700 mb-4">
              By accessing or using ConnectAfrik ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree to these terms, you may not use the Platform.
            </p>
            <div className="bg-purple-100 rounded-lg p-4">
              <h4 className="font-semibold text-purple-800 mb-2">Who Can Use ConnectAfrik</h4>
              <ul className="space-y-1 text-purple-700 text-sm">
                <li>• Individuals 13 years of age or older</li>
                <li>• People of African heritage or allies of the African community</li>
                <li>• Users who respect our community guidelines and values</li>
                <li>• Those committed to constructive dialogue and cultural exchange</li>
              </ul>
            </div>
          </div>

          {/* Platform Services */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Users className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">Platform Services</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-semibold text-blue-800 mb-3">Core Features</h4>
                <ul className="space-y-2 text-blue-700 text-sm">
                  <li>• Create and share posts, stories, and media</li>
                  <li>• Join and create community groups</li>
                  <li>• Participate in political and cultural discussions</li>
                  <li>• Connect with African diaspora worldwide</li>
                  <li>• Access live events and educational content</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h4 className="font-semibold text-green-800 mb-3">Community Benefits</h4>
                <ul className="space-y-2 text-green-700 text-sm">
                  <li>• Safe space for African voices and perspectives</li>
                  <li>• Cultural preservation and celebration tools</li>
                  <li>• Political engagement and civic education</li>
                  <li>• Professional networking opportunities</li>
                  <li>• Cross-border collaboration platform</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <h4 className="font-semibold text-yellow-800">Service Availability</h4>
              </div>
              <p className="text-yellow-700 text-sm">
                We strive to maintain 99.9% uptime but cannot guarantee uninterrupted service. 
                The Platform may be temporarily unavailable for maintenance, updates, or due to circumstances beyond our control.
              </p>
            </div>
          </div>

          {/* User Responsibilities */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Shield className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-semibold text-gray-900">User Responsibilities</h3>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h4 className="font-semibold text-red-800 mb-4">Account Security</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-red-800 mb-2">Your Obligations</h5>
                  <ul className="space-y-1 text-red-700 text-sm">
                    <li>• Provide accurate registration information</li>
                    <li>• Maintain the security of your password</li>
                    <li>• Notify us of unauthorized account access</li>
                    <li>• Take responsibility for all account activity</li>
                    <li>• Update information when it changes</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-red-800 mb-2">Prohibited Actions</h5>
                  <ul className="space-y-1 text-red-700 text-sm">
                    <li>• Sharing account credentials with others</li>
                    <li>• Creating multiple accounts for the same person</li>
                    <li>• Impersonating other individuals or entities</li>
                    <li>• Using automated tools without permission</li>
                    <li>• Circumventing security measures</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-800 mb-4">Content Standards</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-gray-800 mb-2">Encouraged Content</h5>
                  <ul className="space-y-1 text-gray-600 text-sm">
                    <li>• Authentic African perspectives and experiences</li>
                    <li>• Constructive political and social commentary</li>
                    <li>• Cultural heritage sharing and education</li>
                    <li>• Professional networking and collaboration</li>
                    <li>• Community building and positive engagement</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-gray-800 mb-2">Prohibited Content</h5>
                  <ul className="space-y-1 text-gray-600 text-sm">
                    <li>• Hate speech, discrimination, or harassment</li>
                    <li>• False information or misinformation</li>
                    <li>• Spam, scams, or fraudulent activities</li>
                    <li>• Copyrighted material without permission</li>
                    <li>• Illegal, harmful, or threatening content</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Intellectual Property */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <FileText className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold text-gray-900">Intellectual Property Rights</h3>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-purple-800 mb-3">Your Content Rights</h4>
                  <ul className="space-y-2 text-purple-700 text-sm">
                    <li>• You retain ownership of content you create</li>
                    <li>• Grant us license to host and display your content</li>
                    <li>• Can delete your content at any time</li>
                    <li>• Responsible for ensuring you have rights to share</li>
                    <li>• Must respect others' intellectual property</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-800 mb-3">Platform Rights</h4>
                  <ul className="space-y-2 text-purple-700 text-sm">
                    <li>• ConnectAfrik brand and platform design</li>
                    <li>• Software, algorithms, and technical systems</li>
                    <li>• Platform features and functionality</li>
                    <li>• Aggregated and anonymized data insights</li>
                    <li>• Right to moderate and curate content</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-800 mb-2">Copyright Policy</h4>
              <p className="text-orange-700 text-sm">
                We respect intellectual property rights and will respond to valid copyright notices. 
                If you believe your copyright has been infringed, contact us at <strong>wlivinston21@gmail.com</strong> 
                with detailed information about the alleged infringement.
              </p>
            </div>
          </div>

          {/* Community Guidelines Enforcement */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Scale className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-semibold text-gray-900">Community Guidelines & Enforcement</h3>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h4 className="font-semibold text-green-800 mb-4">Moderation Process</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 font-bold">1</span>
                    </div>
                    <h5 className="font-medium text-green-800 mb-1">Report</h5>
                    <p className="text-green-700 text-xs">Community members report violations</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 font-bold">2</span>
                    </div>
                    <h5 className="font-medium text-green-800 mb-1">Review</h5>
                    <p className="text-green-700 text-xs">Our team reviews within 24 hours</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-green-600 font-bold">3</span>
                    </div>
                    <h5 className="font-medium text-green-800 mb-1">Action</h5>
                    <p className="text-green-700 text-xs">Appropriate measures taken</p>
                  </div>
                </div>

                <div className="bg-green-100 rounded-lg p-4">
                  <h5 className="font-medium text-green-800 mb-2">Possible Actions</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-green-700 text-sm">
                    <div>• Warning</div>
                    <div>• Content removal</div>
                    <div>• Temporary suspension</div>
                    <div>• Account termination</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Liability & Disclaimers */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              <h3 className="text-xl font-semibold text-gray-900">Liability & Disclaimers</h3>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-orange-800 mb-2">Service Disclaimer</h4>
                  <p className="text-orange-700 text-sm">
                    ConnectAfrik is provided "as is" without warranties of any kind. We do not guarantee 
                    the accuracy, completeness, or reliability of user-generated content, and we are not 
                    responsible for the actions or opinions of our users.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-orange-800 mb-2">Limitation of Liability</h4>
                  <p className="text-orange-700 text-sm">
                    To the maximum extent permitted by law, ConnectAfrik shall not be liable for any 
                    indirect, incidental, special, consequential, or punitive damages, including but not 
                    limited to loss of profits, data, use, or other intangible losses.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-orange-800 mb-2">User Responsibility</h4>
                  <p className="text-orange-700 text-sm">
                    Users are solely responsible for their interactions with other users and any 
                    consequences thereof. We recommend exercising caution and good judgment when 
                    sharing personal information or meeting other users.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Termination */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-4">Account Termination</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-red-800 mb-2">By You</h4>
                <ul className="space-y-1 text-red-700 text-sm">
                  <li>• Delete your account at any time</li>
                  <li>• Download your data before deletion</li>
                  <li>• Some content may remain in backups for 90 days</li>
                  <li>• Public posts may remain visible unless deleted</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-red-800 mb-2">By ConnectAfrik</h4>
                <ul className="space-y-1 text-red-700 text-sm">
                  <li>• Violations of terms or community guidelines</li>
                  <li>• Illegal activities or harmful behavior</li>
                  <li>• Repeated warnings without improvement</li>
                  <li>• At our discretion for platform protection</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Governing Law */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Scale className="w-6 h-6 text-yellow-400" />
              <h3 className="text-xl font-semibold">Governing Law & Dispute Resolution</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-yellow-400">Applicable Law</h4>
                <p className="text-gray-300 text-sm">
                  These terms are governed by the laws of Ghana and international law where applicable. 
                  For users in other African countries, local consumer protection laws may also apply.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-yellow-400">Dispute Resolution</h4>
                <p className="text-gray-300 text-sm">
                  We encourage resolution through direct communication. For formal disputes, 
                  we prefer mediation or arbitration before litigation, following African 
                  traditional conflict resolution principles where possible.
                </p>
              </div>
            </div>
          </div>

          {/* Changes to Terms */}
          <div className="border-l-4 border-purple-400 pl-6">
            <h4 className="font-semibold text-gray-800 mb-2">Changes to These Terms</h4>
            <p className="text-gray-600 text-sm mb-3">
              We may update these terms from time to time to reflect changes in our services, 
              applicable laws, or for other operational reasons. We will provide at least 30 days' 
              notice of material changes via email and platform notifications.
            </p>
            <p className="text-gray-600 text-sm">
              Continued use of the Platform after changes take effect constitutes acceptance of 
              the new terms. If you do not agree to updated terms, you may terminate your account.
            </p>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Legal Questions</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Email: wlivinston21@gmail.com</p>
                  <p>Subject: "Legal/Terms Inquiry"</p>
                  <p>Response Time: Within 7 business days</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-2">General Support</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Ghana: +233 534 787 731</p>
                  <p>International: +1 914 433 7155</p>
                  <p>Hours: Mon-Fri, 9AM-6PM GMT</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Together, we build a stronger African community online.
            </p>
            <button
              onClick={onClose}
              className="btn-primary"
            >
              I Accept These Terms
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TermsModal