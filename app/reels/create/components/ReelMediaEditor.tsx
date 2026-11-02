'use client'

import React, { useMemo, useState } from 'react'
import { Camera, Crop, Scissors, SlidersHorizontal, Type, X } from '@/shared/icons'
import type { CapturedReelMedia } from './reelMediaUtils'
import ReelTrimEditor from './ReelTrimEditor'

export type ReelEditState = {
  textOverlay: string
  textColor: string
  filter: string
  isPublic: boolean
  cropX: number
  cropY: number
  cropZoom: number
}

const FILTERS: { id: string; label: string; css: string }[] = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'bright', label: 'Bright', css: 'contrast(1.15) saturate(1.25)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.1)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.25) saturate(1.2)' },
  { id: 'cool', label: 'Cool', css: 'hue-rotate(15deg) saturate(1.1)' },
]

type ToolId = 'text' | 'filters' | 'crop' | 'trim'

const TOOLS: { id: ToolId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'filters', label: 'Filters', Icon: SlidersHorizontal },
  { id: 'crop', label: 'Crop', Icon: Crop },
  { id: 'trim', label: 'Trim', Icon: Scissors },
]

type Props = {
  media: CapturedReelMedia
  edit: ReelEditState
  onChange: (patch: Partial<ReelEditState>) => void
  onMediaChange: (media: CapturedReelMedia) => void
  onClose: () => void
  onOpenCamera: () => void
  onContinue: () => void
}

export const DEFAULT_REEL_EDIT: ReelEditState = {
  textOverlay: '',
  textColor: '#FFFFFF',
  filter: 'none',
  isPublic: true,
  cropX: 50,
  cropY: 50,
  cropZoom: 1,
}

export default function ReelMediaEditor({
  media,
  edit,
  onChange,
  onMediaChange,
  onClose,
  onOpenCamera,
  onContinue,
}: Props) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null)
  const [showTrim, setShowTrim] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [textPos, setTextPos] = useState({ x: 50, y: 28 })

  const filterCss = useMemo(
    () => FILTERS.find((f) => f.id === edit.filter)?.css ?? 'none',
    [edit.filter]
  )

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTextPos({
      x: Math.min(90, Math.max(10, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(90, Math.max(8, ((e.clientY - rect.top) / rect.height) * 100)),
    })
  }

  const selectTool = (id: ToolId) => {
    if (id === 'trim') {
      setShowTrim(true)
      setActiveTool(null)
      return
    }
    setActiveTool(activeTool === id ? null : id)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
          <header
            className="relative flex h-12 shrink-0 items-center justify-center px-3"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <h1 className="text-[17px] font-semibold tracking-tight">New reel</h1>
            <button
              type="button"
              onClick={onOpenCamera}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5"
              aria-label="Open camera"
            >
              <Camera className="h-5 w-5" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 gap-1.5 px-2 pt-1">
            <div
              className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#111]"
              onPointerMove={onPointerMove}
              onPointerUp={() => setDragging(false)}
              onPointerLeave={() => setDragging(false)}
            >
              <video
                src={media.preview}
                className="h-full w-full object-cover"
                style={{
                  filter: filterCss,
                  objectPosition: `${edit.cropX}% ${edit.cropY}%`,
                  transform: `scale(${edit.cropZoom})`,
                  transformOrigin: `${edit.cropX}% ${edit.cropY}%`,
                }}
                autoPlay
                muted
                loop
                playsInline
              />

              {edit.textOverlay.trim() ? (
                <button
                  type="button"
                  className="absolute max-w-[82%] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none text-center text-[22px] font-bold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] active:cursor-grabbing"
                  style={{ left: `${textPos.x}%`, top: `${textPos.y}%`, color: edit.textColor }}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    setActiveTool('text')
                    setDragging(true)
                    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                  }}
                >
                  {edit.textOverlay}
                </button>
              ) : null}
            </div>

            <aside className="flex w-[58px] shrink-0 flex-col items-center gap-3.5 pt-3">
              {TOOLS.map(({ id, label, Icon }) => {
                const active = activeTool === id || (id === 'trim' && showTrim)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTool(id)}
                    className={`flex flex-col items-center gap-1 ${active ? 'text-white' : 'text-white/80'}`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        active ? 'bg-white/15' : ''
                      }`}
                    >
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="text-[10px] font-medium leading-none">{label}</span>
                  </button>
                )
              })}
            </aside>
          </div>

          <p className="shrink-0 px-4 py-2 text-center text-[12px] text-[#B0B3B8]">
            Tap a layer to edit it. Drag to move it.
          </p>

          {activeTool === 'text' && (
            <div className="shrink-0 border-t border-white/10 px-4 py-3">
              <input
                autoFocus
                value={edit.textOverlay}
                onChange={(e) => onChange({ textOverlay: e.target.value })}
                placeholder="Add text…"
                maxLength={120}
                className="w-full rounded-xl bg-[#1C1C1E] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35"
              />
              <div className="mt-2 flex gap-2">
                {['#FFFFFF', '#FACC15', '#FB7185', '#38BDF8', '#4ADE80'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ textColor: c })}
                    className={`h-7 w-7 rounded-full border-2 ${
                      edit.textColor === c ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTool === 'filters' && (
            <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 px-4 py-3">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChange({ filter: f.id })}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    edit.filter === f.id ? 'bg-white text-black' : 'bg-[#1C1C1E] text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {activeTool === 'crop' && (
            <div className="shrink-0 space-y-3 border-t border-white/10 px-4 py-3">
              <label className="block text-xs text-white/60">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={edit.cropZoom}
                  onChange={(e) => onChange({ cropZoom: parseFloat(e.target.value) })}
                  className="mt-1 w-full accent-[var(--african-orange)]"
                />
              </label>
              <label className="block text-xs text-white/60">
                Move horizontal
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={edit.cropX}
                  onChange={(e) => onChange({ cropX: parseInt(e.target.value, 10) })}
                  className="mt-1 w-full accent-[var(--african-orange)]"
                />
              </label>
              <label className="block text-xs text-white/60">
                Move vertical
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={edit.cropY}
                  onChange={(e) => onChange({ cropY: parseInt(e.target.value, 10) })}
                  className="mt-1 w-full accent-[var(--african-orange)]"
                />
              </label>
              <button
                type="button"
                onClick={() => onChange({ cropZoom: 1, cropX: 50, cropY: 50 })}
                className="text-xs font-semibold text-[var(--african-orange)]"
              >
                Reset crop
              </button>
            </div>
          )}

          <div
            className="shrink-0 px-4 pt-1"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={onContinue}
              className="w-full rounded-[10px] bg-[var(--african-orange)] py-[14px] text-[16px] font-bold text-white"
            >
              Continue
            </button>
          </div>
        </div>
      </div>

      {showTrim && (
        <ReelTrimEditor
          media={media}
          onCancel={() => setShowTrim(false)}
          onDone={(next) => {
            onMediaChange(next)
            setShowTrim(false)
          }}
        />
      )}
    </>
  )
}
