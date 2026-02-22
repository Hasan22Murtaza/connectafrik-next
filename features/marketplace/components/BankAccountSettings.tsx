import React, { useState, useEffect } from 'react'
import { Building2, Save, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getBanks, resolveBankAccount } from '@/features/marketplace/services/paystackService'

interface Bank {
  id: number
  name: string
  code: string
}

interface BankDetails {
  bank_name: string
  bank_code: string
  account_number: string
  account_name: string
}

const BankAccountSettings: React.FC = () => {
  const { user } = useAuth()
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_name: '',
    bank_code: '',
    account_number: '',
    account_name: ''
  })
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [loadingBanks, setLoadingBanks] = useState(true)

  useEffect(() => {
    loadBanks()
    loadUserBankDetails()
  }, [user?.id])

  const loadBanks = async () => {
    try {
      const banksData = await getBanks('nigeria')
      setBanks(banksData)
    } catch (error) {
      console.error('Error loading banks:', error)
      toast.error('Failed to load banks')
    } finally {
      setLoadingBanks(false)
    }
  }

  const loadUserBankDetails = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('bank_name, bank_code, account_number, account_name')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data && data.bank_name) {
        setBankDetails({
          bank_name: data.bank_name || '',
          bank_code: data.bank_code || '',
          account_number: data.account_number || '',
          account_name: data.account_name || ''
        })
        setIsVerified(!!data.account_name)
      }
    } catch (error) {
      console.error('Error loading bank details:', error)
    }
  }

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedBank = banks.find(b => b.code === e.target.value)
    if (selectedBank) {
      setBankDetails({
        ...bankDetails,
        bank_name: selectedBank.name,
        bank_code: selectedBank.code,
        account_name: '' // Reset account name when bank changes
      })
      setIsVerified(false)
    }
  }

  const handleVerifyAccount = async () => {
    if (!bankDetails.account_number || !bankDetails.bank_code) {
      toast.error('Please select bank and enter account number')
      return
    }

    if (bankDetails.account_number.length !== 10) {
      toast.error('Account number must be 10 digits')
      return
    }

    setIsVerifying(true)
    try {
      const result = await resolveBankAccount(
        bankDetails.account_number,
        bankDetails.bank_code
      )

      if (result) {
        setBankDetails({
          ...bankDetails,
          account_name: result.account_name
        })
        setIsVerified(true)
        toast.success('Account verified successfully!')
      } else {
        throw new Error('Failed to verify account number')
      }
    } catch (error: any) {
      console.error('Error verifying account:', error)
      toast.error(error.message || 'Failed to verify account number')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSave = async () => {
    if (!isVerified) {
      toast.error('Please verify your account number first')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          bank_name: bankDetails.bank_name,
          bank_code: bankDetails.bank_code,
          account_number: bankDetails.account_number,
          account_name: bankDetails.account_name,
          bank_details_updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)

      if (error) throw error

      toast.success('Bank details saved successfully!')
    } catch (error) {
      console.error('Error saving bank details:', error)
      toast.error('Failed to save bank details')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Bank Account Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              Required to receive automated payouts from marketplace sales
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Automated Payouts Enabled</p>
            <p className="text-blue-700">
              When a buyer confirms delivery, funds are automatically transferred to your bank account within 24 hours.
            </p>
          </div>
        </div>

        {/* Bank Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bank Name *
          </label>
          <select
            value={bankDetails.bank_code}
            onChange={handleBankChange}
            className="input-field"
            disabled={loadingBanks}
          >
            <option value="">
              {loadingBanks ? 'Loading banks...' : 'Select your bank'}
            </option>
            {banks.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Account Number *
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={bankDetails.account_number}
              onChange={(e) => {
                setBankDetails({
                  ...bankDetails,
                  account_number: e.target.value.replace(/\D/g, '').slice(0, 10)
                })
                setIsVerified(false)
              }}
              className="input-field flex-1"
              placeholder="Enter 10-digit account number"
              maxLength={10}
            />
            <button
              onClick={handleVerifyAccount}
              disabled={isVerifying || !bankDetails.bank_code || bankDetails.account_number.length !== 10}
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
        </div>

        {/* Account Name (after verification) */}
        {isVerified && bankDetails.account_name && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Account Verified</p>
                <p className="text-lg font-semibold text-green-900 mt-1">
                  {bankDetails.account_name}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  {bankDetails.bank_name} • {bankDetails.account_number}
                </p>
              </div>
            </div>
          </div>
        )}

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
                <span>Save Bank Details</span>
              </>
            )}
          </button>
        </div>

        {/* Security Note */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-900 mb-2">🔒 Security Notice</p>
          <ul className="space-y-1 text-xs">
            <li>• Your bank details are encrypted and stored securely</li>
            <li>• Only you and authorized admins can view this information</li>
            <li>• Changing bank details will trigger a security review</li>
            <li>• All transfers are verified through Paystack before processing</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default BankAccountSettings
