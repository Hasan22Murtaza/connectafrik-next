import React, { useState, useEffect } from 'react'
import { Smartphone, Save, Check, AlertCircle, Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  getMobileMoneyProviders,
  detectProviderFromPhone,
  formatPhoneForPaystack,
  validatePhoneNumber,
  MobileMoneyProvider
} from '@/features/marketplace/utils/mobileMoneyUtils'
import toast from 'react-hot-toast'
import { verifyMobileMoneyAccount } from '@/features/marketplace/services/paystackService'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

interface MobileMoneyDetails {
  phone: string
  provider: string
  provider_code: string
  account_name: string
  country: string
}

const MobileMoneySettings: React.FC = () => {
  const { user } = useAuth()
  const [selectedCountry, setSelectedCountry] = useState('GH')
  const [providers, setProviders] = useState<MobileMoneyProvider[]>([])
  const [mobileMoneyDetails, setMobileMoneyDetails] = useState<MobileMoneyDetails>({
    phone: '',
    provider: '',
    provider_code: '',
    account_name: '',
    country: 'GH'
  })
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    loadProviders(selectedCountry)
    loadUserMobileMoneyDetails()
  }, [user, selectedCountry])

  const loadProviders = (country: string) => {
    const countryProviders = getMobileMoneyProviders(country)
    setProviders(countryProviders)
  }

  const loadUserMobileMoneyDetails = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('mobile_money_phone, mobile_money_provider, mobile_money_provider_code, mobile_money_account_name, mobile_money_country')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data && data.mobile_money_phone) {
        setMobileMoneyDetails({
          phone: data.mobile_money_phone || '',
          provider: data.mobile_money_provider || '',
          provider_code: data.mobile_money_provider_code || '',
          account_name: data.mobile_money_account_name || '',
          country: data.mobile_money_country || 'GH'
        })
        setSelectedCountry(data.mobile_money_country || 'GH')
        setIsVerified(!!data.mobile_money_account_name)
      }
    } catch (error) {
      console.error('Error loading mobile money details:', error)
    }
  }

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country)
    loadProviders(country)
    setMobileMoneyDetails({
      phone: '',
      provider: '',
      provider_code: '',
      account_name: '',
      country
    })
    setIsVerified(false)
  }

  const handlePhoneChange = (phone: string) => {
    setMobileMoneyDetails({
      ...mobileMoneyDetails,
      phone,
      account_name: '' // Reset account name when phone changes
    })
    setIsVerified(false)

    // Auto-detect provider from phone number
    const detectedProvider = detectProviderFromPhone(phone, selectedCountry)
    if (detectedProvider) {
      const provider = providers.find(p => p.code === detectedProvider)
      if (provider) {
        setMobileMoneyDetails(prev => ({
          ...prev,
          phone,
          provider: provider.name,
          provider_code: provider.code
        }))
      }
    }
  }

  const handleProviderChange = (providerCode: string) => {
    const provider = providers.find(p => p.code === providerCode)
    if (provider) {
      setMobileMoneyDetails({
        ...mobileMoneyDetails,
        provider: provider.name,
        provider_code: provider.code,
        account_name: ''
      })
      setIsVerified(false)
    }
  }

  const handleVerifyAccount = async () => {
    // Validate phone number first
    const validation = validatePhoneNumber(mobileMoneyDetails.phone, selectedCountry)
    if (!validation.valid) {
      toast.error(validation.message || 'Invalid phone number')
      return
    }

    if (!mobileMoneyDetails.provider_code) {
      toast.error('Please select a mobile money provider')
      return
    }

    setIsVerifying(true)
    try {
      const formattedPhone = formatPhoneForPaystack(mobileMoneyDetails.phone, selectedCountry)

      const result = await verifyMobileMoneyAccount(
        formattedPhone,
        mobileMoneyDetails.provider_code
      )

      if (!result) {
        throw new Error('Failed to verify mobile money account')
      }

      if (result.is_registered) {
        setMobileMoneyDetails({
          ...mobileMoneyDetails,
          phone: formattedPhone,
          account_name: result.account_name
        })
        setIsVerified(true)
        toast.success('Mobile money account verified successfully!')
      } else {
        toast.error('This phone number is not registered with ' + mobileMoneyDetails.provider)
      }
    } catch (error: any) {
      console.error('Error verifying mobile money account:', error)
      toast.error(error.message || 'Failed to verify mobile money account')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSave = async () => {
    if (!isVerified) {
      toast.error('Please verify your mobile money account first')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          mobile_money_phone: mobileMoneyDetails.phone,
          mobile_money_provider: mobileMoneyDetails.provider,
          mobile_money_provider_code: mobileMoneyDetails.provider_code,
          mobile_money_account_name: mobileMoneyDetails.account_name,
          mobile_money_country: selectedCountry,
          mobile_money_verified: true,
          mobile_money_updated_at: new Date().toISOString(),
          payout_method: 'mobile_money' // Set as preferred payout method
        })
        .eq('id', user?.id)

      if (error) throw error

      toast.success('Mobile money details saved successfully!')
    } catch (error) {
      console.error('Error saving mobile money details:', error)
      toast.error('Failed to save mobile money details')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Smartphone className="w-6 h-6 text-primary-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Mobile Money Account</h2>
            <p className="text-sm text-gray-600 mt-1">
              Receive instant automated payouts to your mobile money wallet
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Info Alert */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <Zap className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-900">
            <p className="font-medium mb-1">⚡ Instant Automated Payouts</p>
            <p className="text-green-700">
              When a buyer confirms delivery, funds are instantly transferred to your mobile money account.
              No waiting for bank processing!
            </p>
          </div>
        </div>

        {/* Country Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country *
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="input-field"
          >
            <option value="GH">🇬🇭 Ghana</option>
            <option value="KE">🇰🇪 Kenya</option>
            <option value="RW">🇷🇼 Rwanda</option>
            <option value="UG">🇺🇬 Uganda</option>
            <option value="ZM">🇿🇲 Zambia</option>
            <option value="CI">🇨🇮 Ivory Coast</option>
          </select>
        </div>

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Money Provider *
          </label>
          <select
            value={mobileMoneyDetails.provider_code}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="input-field"
          >
            <option value="">Select provider</option>
            {providers.map((provider) => (
              <option key={provider.code} value={provider.code}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Money Phone Number *
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <PhoneInput
                international
                defaultCountry={selectedCountry as any}
                value={mobileMoneyDetails.phone}
                onChange={(value) => handlePhoneChange(value || '')}
                placeholder={
                  selectedCountry === 'GH' ? '0244123456' :
                  selectedCountry === 'KE' ? '0712345678' :
                  '0XXXXXXXXX'
                }
                className="w-full"
                numberInputProps={{
                  className: "input-field w-full"
                }}
              />
            </div>
            <button
              onClick={handleVerifyAccount}
              disabled={isVerifying || !mobileMoneyDetails.phone || !mobileMoneyDetails.provider_code}
              className="btn-secondary px-6 whitespace-nowrap"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                'Verify'
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Enter your {mobileMoneyDetails.provider || 'mobile money'} registered phone number
          </p>
        </div>

        {/* Account Name (after verification) */}
        {isVerified && mobileMoneyDetails.account_name && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Account Verified</p>
                <p className="text-lg font-semibold text-green-900 mt-1">
                  {mobileMoneyDetails.account_name}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  {mobileMoneyDetails.provider} • {mobileMoneyDetails.phone}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fee Comparison */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💰 Fee Comparison</h3>
          <div className="space-y-2 text-xs text-blue-800">
            <div className="flex justify-between">
              <span>Bank Transfer:</span>
              <span className="font-medium">~₦50/transfer (1-24 hours)</span>
            </div>
            <div className="flex justify-between">
              <span>Mobile Money:</span>
              <span className="font-medium">~1-2% (Instant ⚡)</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={!isVerified || isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Mobile Money Details</span>
              </>
            )}
          </button>
        </div>

        {/* Security Note */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900 mb-2">🔒 Security Notice</p>
          <ul className="space-y-1 text-xs">
            <li>• Your mobile money details are encrypted and stored securely</li>
            <li>• Payouts are processed through Paystack's secure infrastructure</li>
            <li>• Only verified mobile money accounts can receive payouts</li>
            <li>• You can switch between bank and mobile money anytime</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default MobileMoneySettings
