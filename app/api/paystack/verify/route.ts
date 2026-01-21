import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPaystackTransaction } from '@/features/marketplace/services/paystackService'
import { sendNewOrderNotificationEmail } from '@/shared/services/emailService'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
    console.log('Received GET request for Paystack verification')
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
        console.log('Paystack verification data (GET):', JSON.stringify(paystackData))
        console.log('Paystack metadata (GET):', JSON.stringify(paystackData?.metadata || {}))

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
            console.log('Existing order check (GET):', JSON.stringify(existingOrder))
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
            console.log('Creating order with payload (GET):', JSON.stringify(orderPayload))
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

            // Send email notifications (non-blocking)
            if (orderPayload.seller_id) {
                try {
                    // Fetch seller email from auth.users
                    let sellerEmail: string | null = null
                    try {
                        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(orderPayload.seller_id)
                        if (!authError && authUser?.user?.email) {
                            sellerEmail = authUser.user.email
                        }
                    } catch (err) {
                        console.error('Error fetching seller email:', err)
                    }

                    // Fetch seller name from profiles
                    let sellerName = 'Seller'
                    try {
                        const { data: sellerProfile } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', orderPayload.seller_id)
                            .single()
                        if (sellerProfile?.full_name) {
                            sellerName = sellerProfile.full_name
                        }
                    } catch (err) {
                        console.error('Error fetching seller profile:', err)
                    }

                    // Fetch buyer name from profiles
                    let buyerName = 'Customer'
                    if (orderPayload.buyer_id) {
                        try {
                            const { data: buyerProfile } = await supabase
                                .from('profiles')
                                .select('full_name')
                                .eq('id', orderPayload.buyer_id)
                                .single()
                            if (buyerProfile?.full_name) {
                                buyerName = buyerProfile.full_name
                            }
                        } catch (err) {
                            console.error('Error fetching buyer profile:', err)
                        }
                    }

                    if (sellerEmail) {
                        sendNewOrderNotificationEmail(sellerEmail, {
                            orderNumber: order.order_number,
                            productTitle: orderPayload.product_title || 'Product',
                            quantity: orderPayload.quantity,
                            totalAmount: orderPayload.total_amount,
                            currency: orderPayload.currency || 'USD',
                            buyerName,
                            sellerName,
                        }).catch(err => console.error('Failed to send seller notification email:', err))
                    } else {
                        console.warn('Could not send seller notification: seller email not found')
                    }
                } catch (emailErr) {
                    console.error('Error sending seller notification:', emailErr)
                    // Don't fail the order creation if email fails
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
