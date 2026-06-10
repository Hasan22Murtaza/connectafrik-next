'use client'

import React from 'react'
import { ArrowLeft, Lock, Minus, Plus, ShieldCheck } from 'lucide-react'
import { Product } from '@/shared/types'
import { formatProductPrice, getCurrencySymbol } from '@/features/marketplace/utils/productFormatting'

interface CheckoutPageShellProps {
  product: Product
  quantity: number
  onQuantityChange: (quantity: number) => void
  onBack: () => void
  children: React.ReactNode
  summaryFooter?: React.ReactNode
}

const CheckoutPageShell: React.FC<CheckoutPageShellProps> = ({
  product,
  quantity,
  onQuantityChange,
  onBack,
  children,
  summaryFooter,
}) => {
  const maxQuantity = product.stock_quantity ?? undefined
  const totalAmount = product.price * quantity
  const currencySymbol = getCurrencySymbol(product.currency || 'USD')

  const decreaseQuantity = () => {
    onQuantityChange(Math.max(1, quantity - 1))
  }

  const increaseQuantity = () => {
    const next = quantity + 1
    if (maxQuantity !== undefined && next > maxQuantity) return
    onQuantityChange(next)
  }

  return (
    <div className="min-h-screen bg-surface-canvas">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-content-secondary hover:text-content transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to item
          </button>
          <div className="inline-flex items-center gap-2 text-sm text-content-secondary">
            <Lock className="w-4 h-4" />
            Secure checkout
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-content">Checkout</h1>
          <p className="text-sm text-content-secondary mt-1">
            Review your order and complete payment in a few steps.
          </p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-8 items-start">
          <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-5 sm:p-6">
            {children}
          </section>

          <aside className="lg:sticky lg:top-24 space-y-4">
            <div className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-content uppercase tracking-wide">
                Order summary
              </h2>

              <div className="mt-4 flex gap-4">
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-20 h-20 rounded-xl object-cover bg-surface-secondary shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-surface-secondary shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-content line-clamp-2">{product.title}</p>
                  <p className="text-sm text-content-secondary mt-1">
                    Sold by {product.seller?.full_name || product.seller?.username || 'Seller'}
                  </p>
                  <p className="text-sm font-semibold text-primary-600 mt-2">
                    {formatProductPrice(product)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm text-content-secondary">Quantity</span>
                <div className="inline-flex items-center rounded-xl border border-border bg-surface-canvas">
                  <button
                    type="button"
                    onClick={decreaseQuantity}
                    disabled={quantity <= 1}
                    className="p-2 text-content-secondary hover:text-content disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-medium text-content">{quantity}</span>
                  <button
                    type="button"
                    onClick={increaseQuantity}
                    disabled={maxQuantity !== undefined && quantity >= maxQuantity}
                    className="p-2 text-content-secondary hover:text-content disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {maxQuantity !== undefined && (
                <p className="text-xs text-content-secondary mt-2 text-right">{maxQuantity} available</p>
              )}

              <div className="mt-5 pt-5 border-t border-border-subtle space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-secondary">
                    Subtotal ({quantity} item{quantity > 1 ? 's' : ''})
                  </span>
                  <span className="font-medium text-content">
                    {currencySymbol}
                    {totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-content">Total</span>
                  <span className="text-2xl font-bold text-primary-600">
                    {currencySymbol}
                    {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {summaryFooter}
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Buyer protection</p>
                  <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                    Your payment is held securely until you confirm delivery.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default CheckoutPageShell
