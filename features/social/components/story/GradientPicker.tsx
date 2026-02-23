import React from 'react'
import { Check } from 'lucide-react'

export interface GradientOption {
  id: string
  name: string
  gradient: string
  colors: string[]
}

export const STORY_GRADIENTS: GradientOption[] = [
  { id: 'primary-orange', name: 'ConnectAfrik', gradient: 'from-primary-500 to-orange-500', colors: ['#f97316', '#ea580c'] },
  { id: 'blue-purple', name: 'Ocean', gradient: 'from-blue-600 to-purple-600', colors: ['#2563eb', '#9333ea'] },
  { id: 'pink-orange', name: 'Sunset', gradient: 'from-pink-500 to-orange-500', colors: ['#ec4899', '#f97316'] },
  { id: 'green-teal', name: 'Forest', gradient: 'from-green-500 to-teal-500', colors: ['#22c55e', '#14b8a6'] },
  { id: 'purple-pink', name: 'Candy', gradient: 'from-purple-600 to-pink-500', colors: ['#9333ea', '#ec4899'] },
  { id: 'red-orange', name: 'Fire', gradient: 'from-red-500 to-orange-500', colors: ['#ef4444', '#f97316'] },
  { id: 'cyan-blue', name: 'Sky', gradient: 'from-cyan-500 to-blue-600', colors: ['#06b6d4', '#2563eb'] },
  { id: 'yellow-orange', name: 'Golden', gradient: 'from-yellow-400 to-orange-500', colors: ['#facc15', '#f97316'] },
  { id: 'indigo-purple', name: 'Galaxy', gradient: 'from-indigo-600 to-purple-700', colors: ['#4f46e5', '#7c3aed'] },
  { id: 'rose-pink', name: 'Blush', gradient: 'from-rose-500 to-pink-500', colors: ['#f43f5e', '#ec4899'] },
  { id: 'emerald-cyan', name: 'Mint', gradient: 'from-emerald-500 to-cyan-500', colors: ['#10b981', '#06b6d4'] },
  { id: 'amber-red', name: 'Autumn', gradient: 'from-amber-500 to-red-500', colors: ['#f59e0b', '#ef4444'] },
  { id: 'violet-indigo', name: 'Twilight', gradient: 'from-violet-600 to-indigo-600', colors: ['#7c3aed', '#4f46e5'] },
  { id: 'slate-gray', name: 'Minimal', gradient: 'from-slate-700 to-gray-800', colors: ['#334155', '#1f2937'] }
]

interface GradientPickerProps {
  selectedGradient: string
  onSelect: (gradient: GradientOption) => void
}

const GradientPicker: React.FC<GradientPickerProps> = ({ selectedGradient, onSelect }) => {
  const isSelected = (gradient: string) => selectedGradient === gradient

  return (
    <div className="space-y-2 sm:space-y-3">
      <h4 className="text-xs sm:text-sm font-semibold text-gray-900">Background</h4>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {STORY_GRADIENTS.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option)}
            title={option.name}
            className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${option.gradient} transition-all active:scale-95 sm:hover:scale-110 shadow-sm ${
              isSelected(option.gradient) ? 'ring-2 ring-primary-500 ring-offset-1 sm:ring-offset-2 ring-offset-white scale-110' : 'sm:hover:shadow-md'
            }`}
          >
            {isSelected(option.gradient) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white drop-shadow-lg" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default GradientPicker
