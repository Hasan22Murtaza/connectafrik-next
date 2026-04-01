import React from 'react'
import { Check } from 'lucide-react'

export interface GradientOption {
  id: string
  name: string
  colors: [string, string]
}

export const STORY_GRADIENTS: GradientOption[] = [
  { id: 'primary-orange', name: 'ConnectAfrik', colors: ['#f97316', '#ea580c'] },
  { id: 'blue-purple', name: 'Ocean', colors: ['#2563eb', '#9333ea'] },
  { id: 'pink-orange', name: 'Sunset', colors: ['#ec4899', '#f97316'] },
  { id: 'green-teal', name: 'Forest', colors: ['#22c55e', '#14b8a6'] },
  { id: 'purple-pink', name: 'Candy', colors: ['#9333ea', '#ec4899'] },
  { id: 'red-orange', name: 'Fire', colors: ['#ef4444', '#f97316'] },
  { id: 'cyan-blue', name: 'Sky', colors: ['#06b6d4', '#2563eb'] },
  { id: 'yellow-orange', name: 'Golden', colors: ['#facc15', '#f97316'] },
  { id: 'indigo-purple', name: 'Galaxy', colors: ['#4f46e5', '#7c3aed'] },
  { id: 'rose-pink', name: 'Blush', colors: ['#f43f5e', '#ec4899'] },
  { id: 'emerald-cyan', name: 'Mint', colors: ['#10b981', '#06b6d4'] },
  { id: 'amber-red', name: 'Autumn', colors: ['#f59e0b', '#ef4444'] },
  { id: 'violet-indigo', name: 'Twilight', colors: ['#7c3aed', '#4f46e5'] },
  { id: 'slate-gray', name: 'Minimal', colors: ['#334155', '#1f2937'] },
]

interface GradientPickerProps {
  selectedGradientId: string
  onSelect: (gradient: GradientOption) => void
}

const GradientPicker: React.FC<GradientPickerProps> = ({ selectedGradientId, onSelect }) => {
  return (
    <div className="space-y-2 sm:space-y-3">
      <h4 className="text-xs sm:text-sm font-semibold text-gray-900">Background</h4>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {STORY_GRADIENTS.map((option) => {
          const [a, b] = option.colors
          const selected = selectedGradientId === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              title={option.name}
              className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all active:scale-95 sm:hover:scale-110 shadow-sm ${
                selected ? 'ring-2 ring-primary-500 ring-offset-1 sm:ring-offset-2 ring-offset-white scale-110' : 'sm:hover:shadow-md'
              }`}
              style={{ backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }}
            >
              {selected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white drop-shadow-lg" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default GradientPicker
