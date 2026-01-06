import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || process.env.NEXT_PUBLIC_PAYSTACK_SECRET_KEY
const PAYSTACK_API = 'https://api.paystack.co'

async function verifyWithPaystack(reference: string) {
    const resp = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
    })
    const json = await resp.json()
    return { ok: resp.ok, status: resp.status, json }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const reference = body?.reference
        if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

        if (!PAYSTACK_SECRET_KEY) {
            return NextResponse.json({ error: 'Paystack secret key not configured' }, { status: 500 })
        }

        const { ok, json } = await verifyWithPaystack(reference)
        if (!ok) return NextResponse.json({ error: json?.message || 'Verification failed', data: json }, { status: 502 })

        const paystackData = json.data

        // Try to persist order using Supabase service role, if configured
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            try {
                const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                const meta = paystackData.metadata || {}

                // Build order payload from metadata
                const orderPayload: any = {
                    buyer_id: meta.buyer_id || null,
                    buyer_email: meta.buyer_email || paystackData.customer?.email || null,
                    buyer_phone: meta.buyer_phone || null,
                    seller_id: meta.seller_id || null,
                    product_id: meta.product_id || null,
                    product_title: meta.product_title || null,
                    product_image: meta.product_image || null,
                    quantity: meta.quantity || 1,
                    unit_price: meta.unit_price || null,
                    total_amount: meta.total_amount || (paystackData.amount ? paystackData.amount / 100 : null),
                    currency: meta.currency || paystackData.currency || 'USD',
                    payment_status: paystackData.status === 'success' ? 'completed' : 'failed',
                    payment_method: 'paystack',
                    payment_reference: paystackData.reference,
                    paid_at: new Date().toISOString(),
                    shipping_address: meta.shipping_address || null,
                    notes: meta.notes || null,
                    status: paystackData.status === 'success' ? 'confirmed' : 'pending'
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
                        transaction_reference: paystackData.reference,
                        amount: orderPayload.total_amount,
                        currency: orderPayload.currency,
                        status: paystackData.status === 'success' ? 'success' : 'failed',
                        paystack_response: paystackData,
                        verified_at: new Date().toISOString()
                    })

                    // update product stock if product_id present
                    if (orderPayload.product_id && typeof orderPayload.quantity === 'number') {
                        await supabase
                            .from('products')
                            .update({ stock_quantity: Math.max(0, (meta.product_stock_quantity || 0) - orderPayload.quantity) })
                            .eq('id', orderPayload.product_id)
                    }
                }
            } catch (dbErr) {
                console.error('Error writing order to Supabase:', dbErr)
            }
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
        if (!reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
        // Delegate to POST handler logic
        const fakeReq = new Request(request.url, { method: 'POST', body: JSON.stringify({ reference }) })
        // NextResponse can't directly call POST, so call verifyWithPaystack here
        if (!PAYSTACK_SECRET_KEY) {
            return NextResponse.json({ error: 'Paystack secret key not configured' }, { status: 500 })
        }
        const { ok, json } = await verifyWithPaystack(reference)
        if (!ok) return NextResponse.json({ error: json?.message || 'Verification failed', data: json }, { status: 502 })
        return NextResponse.json({ success: true, data: json.data })
    } catch (error: any) {
        console.error('Error in GET verify:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
