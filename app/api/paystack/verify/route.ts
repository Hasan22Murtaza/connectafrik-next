import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyPaystackTransaction } from '@/features/marketplace/services/paystackService'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const reference = body?.reference
        if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

        const verification = await verifyPaystackTransaction(reference)
        
        if (!verification.success) {
            return NextResponse.json({ error: 'Verification failed', data: verification }, { status: 502 })
        }

        const paystackData = verification.data

        // Try to persist order using Supabase
        try {
            const meta = paystackData?.metadata || {}

            // Build order payload from metadata
            const orderPayload: any = {
                buyer_id: meta.buyer_id || null,
                buyer_email: meta.buyer_email || paystackData?.customer?.email || null,
                buyer_phone: meta.buyer_phone || null,
                seller_id: meta.seller_id || null,
                product_id: meta.product_id || null,
                product_title: meta.product_title || null,
                product_image: meta.product_image || null,
                quantity: meta.quantity || 1,
                unit_price: meta.unit_price || null,
                total_amount: meta.total_amount || (verification.amount || 0),
                currency: meta.currency || verification.currency || 'USD',
                payment_status: verification.status === 'success' ? 'completed' : 'failed',
                payment_method: 'paystack',
                payment_reference: reference,
                paid_at: new Date().toISOString(),
                shipping_address: meta.shipping_address || null,
                notes: meta.notes || null,
                status: verification.status === 'success' ? 'confirmed' : 'pending'
            }

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert(orderPayload)
                .select()
                .single()

            if (orderError) {
                console.error('Failed to create order after verification:', orderError)
            } else {
                // create payment transaction
                await supabase.from('payment_transactions').insert({
                    order_id: order.id,
                    transaction_reference: reference,
                    amount: orderPayload.total_amount,
                    currency: orderPayload.currency,
                    status: verification.status === 'success' ? 'success' : 'failed',
                    paystack_response: paystackData,
                    verified_at: new Date().toISOString()
                })

                // update product stock if product_id present
                if (orderPayload.product_id && typeof orderPayload.quantity === 'number') {
                    // Fetch current product to get stock
                    const { data: product, error: productError } = await supabase
                        .from('products')
                        .select('stock_quantity')
                        .eq('id', orderPayload.product_id)
                        .single()

                    if (!productError && product && product.stock_quantity !== null && product.stock_quantity !== undefined) {
                        await supabase
                            .from('products')
                            .update({ stock_quantity: Math.max(0, product.stock_quantity - orderPayload.quantity) })
                            .eq('id', orderPayload.product_id)
                    }
                }
            }
        } catch (dbErr) {
            console.error('Error writing order to Supabase:', dbErr)
        }

        return NextResponse.json({ success: true, data: paystackData })
    } catch (error: any) {
        console.error('Error verifying Paystack transaction:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const reference = url.searchParams.get('reference')
        if (!reference) {
            return NextResponse.redirect(new URL('/marketplace?payment=error&message=Missing+reference', request.url))
        }

        const verification = await verifyPaystackTransaction(reference)
        
        if (!verification.success) {
            return NextResponse.redirect(new URL('/marketplace?payment=error&message=Verification+failed', request.url))
        }

        const paystackData = verification.data

        // Only proceed if payment was successful
        if (verification.status !== 'success') {
            return NextResponse.redirect(new URL('/marketplace?payment=error&message=Payment+not+successful', request.url))
        }

        // Create order using Supabase
        try {
            const meta = paystackData?.metadata || {}

            // Check if order already exists for this reference (prevent duplicates)
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('payment_reference', reference)
                .single()

            if (existingOrder) {
                // Order already exists, just redirect to success
                return NextResponse.redirect(new URL('/marketplace?payment=success', request.url))
            }

            // Build order payload from metadata
            const orderPayload: any = {
                buyer_id: meta.buyer_id || null,
                buyer_email: meta.buyer_email || paystackData?.customer?.email || null,
                buyer_phone: meta.buyer_phone || null,
                seller_id: meta.seller_id || null,
                product_id: meta.product_id || null,
                product_title: meta.product_title || null,
                product_image: meta.product_image || null,
                quantity: parseInt(meta.quantity) || 1,
                unit_price: parseFloat(meta.unit_price) || null,
                total_amount: parseFloat(meta.total_amount) || (verification.amount || 0),
                currency: meta.currency || verification.currency || 'USD',
                payment_status: 'completed',
                payment_method: 'paystack',
                payment_reference: reference,
                paid_at: new Date().toISOString(),
                shipping_address: meta.shipping_address || null,
                notes: meta.notes || null,
                status: 'confirmed'
            }

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert(orderPayload)
                .select()
                .single()

            if (orderError) {
                console.error('Failed to create order after verification:', orderError)
                return NextResponse.redirect(new URL('/marketplace?payment=error&message=Order+creation+failed', request.url))
            }

            // Create payment transaction
            const { error: transactionError } = await supabase.from('payment_transactions').insert({
                order_id: order.id,
                transaction_reference: reference,
                amount: orderPayload.total_amount,
                currency: orderPayload.currency,
                status: 'success',
                paystack_response: paystackData,
                verified_at: new Date().toISOString()
            })

            if (transactionError) {
                console.error('Failed to create payment transaction:', transactionError)
            }

            // Update product stock if product_id present
            if (orderPayload.product_id && typeof orderPayload.quantity === 'number') {
                // Fetch current product to get stock
                const { data: product, error: productError } = await supabase
                    .from('products')
                    .select('stock_quantity')
                    .eq('id', orderPayload.product_id)
                    .single()

                if (!productError && product && product.stock_quantity !== null && product.stock_quantity !== undefined) {
                    await supabase
                        .from('products')
                        .update({ stock_quantity: Math.max(0, product.stock_quantity - orderPayload.quantity) })
                        .eq('id', orderPayload.product_id)
                }
            }

            // Order and transaction created successfully - redirect to success
            return NextResponse.redirect(new URL('/marketplace?payment=success', request.url))
        } catch (dbErr) {
            console.error('Error writing order to Supabase:', dbErr)
            return NextResponse.redirect(new URL('/marketplace?payment=error&message=Database+error', request.url))
        }
    } catch (error: any) {
        console.error('Error in GET verify:', error)
        return NextResponse.redirect(new URL('/marketplace?payment=error&message=Internal+server+error', request.url))
    }
}
