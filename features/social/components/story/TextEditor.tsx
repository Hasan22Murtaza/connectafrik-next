import React from 'react'
import { AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react'

export interface TextStyle {
  text: string
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor: string
  align: 'left' | 'center' | 'right'
  isBold: boolean
}

const FONT_FAMILIES = [
  { id: 'sans', name: 'Sans', family: 'ui-sans-serif, system-ui, sans-serif' },
  { id: 'serif', name: 'Serif', family: 'ui-serif, Georgia, serif' },
  { id: 'mono', name: 'Mono', family: 'ui-monospace, monospace' },
  { id: 'display', name: 'Display', family: '"Bebas Neue", Impact, sans-serif' },
  { id: 'handwriting', name: 'Script', family: '"Dancing Script", cursive, serif' }
] as const

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#EF4444', '#F97316', '#FACC15',
  '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'
] as const

const BG_COLORS = [
  'transparent', 'rgba(0,0,0,0.5)', 'rgba(255,255,255,0.5)',
  '#000000', '#FFFFFF', '#EF4444', '#3B82F6', '#22C55E'
] as const

const ALIGNMENT_OPTIONS = [
  { value: 'left' as const, Icon: AlignLeft },
  { value: 'center' as const, Icon: AlignCenter },
  { value: 'right' as const, Icon: AlignRight }
]

const MAX_TEXT_LENGTH = 200

interface TextEditorProps {
  style: TextStyle
  onChange: (style: Partial<TextStyle>) => void
}

const TextEditor: React.FC<TextEditorProps> = ({ style, onChange }) => {
  const getButtonClass = (isActive: boolean) =>
    `p-2 rounded-lg transition-colors border ${
      isActive
        ? 'bg-primary-500 text-white border-primary-500'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
    }`

  const getColorButtonClass = (isActive: boolean) =>
    `w-7 h-7 rounded-full border-2 transition-all hover:scale-110 shadow-sm ${
      isActive ? 'border-primary-500 ring-2 ring-primary-200 scale-110' : 'border-gray-200'
    }`

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Your Text</label>
        <textarea
          value={style.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Start typing..."
          maxLength={MAX_TEXT_LENGTH}
          className="w-full h-24 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{style.text.length}/{MAX_TEXT_LENGTH}</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Font Style</label>
        <div className="flex flex-wrap gap-2">
          {FONT_FAMILIES.map((font) => (
            <button
              key={font.id}
              onClick={() => onChange({ fontFamily: font.family })}
              style={{ fontFamily: font.family }}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                style.fontFamily === font.family
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              {font.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Size: {style.fontSize}px</label>
        <input
          type="range"
          min="14"
          max="48"
          value={style.fontSize}
          onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Alignment</label>
        <div className="flex gap-2">
          {ALIGNMENT_OPTIONS.map(({ value, Icon }) => (
            <button
              key={value}
              onClick={() => onChange({ align: value })}
              className={getButtonClass(style.align === value)}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
          <button
            onClick={() => onChange({ isBold: !style.isBold })}
            className={getButtonClass(style.isBold)}
          >
            <Bold className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Text Color</label>
        <div className="flex flex-wrap gap-2">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onChange({ color })}
              style={{ backgroundColor: color }}
              className={getColorButtonClass(style.color === color)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Text Background</label>
        <div className="flex flex-wrap gap-2">
          {BG_COLORS.map((color, index) => (
            <button
              key={index}
              onClick={() => onChange({ backgroundColor: color })}
              style={{ backgroundColor: color === 'transparent' ? undefined : color }}
              className={`${getColorButtonClass(style.backgroundColor === color)} ${color === 'transparent' ? 'bg-white relative overflow-hidden' : ''}`}
            >
              {color === 'transparent' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500 rotate-45" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TextEditor
