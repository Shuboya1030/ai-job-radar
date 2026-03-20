import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createSupabaseServerClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id || session.metadata?.user_id
      if (!userId) break

      // Activate subscription
      await db.from('user_profiles').update({
        stripe_customer_id: session.customer as string,
        subscription_status: 'active',
        subscription_expires_at: null,
      }).eq('id', userId)

      // Trigger two-stage matching (stage 1: fast 50)
      const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/resume/process`
      fetch(processUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, mode: 'stage1' }),
      }).catch(err => console.error('Failed to trigger matching:', err))
      break
    }

    case 'invoice.paid': {
      // Also handle invoice.paid as a fallback — some Stripe flows
      // send this instead of checkout.session.completed
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null
      if (!customerId) break

      // Check if user already active (avoid duplicate triggers)
      const { data: existing } = await db.from('user_profiles')
        .select('id, subscription_status')
        .eq('stripe_customer_id', customerId)
        .single()

      if (existing) {
        // Already have customer linked — just ensure active
        if (existing.subscription_status !== 'active') {
          await db.from('user_profiles').update({
            subscription_status: 'active',
            subscription_expires_at: null,
          }).eq('stripe_customer_id', customerId)

          // Trigger matching
          const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/resume/process`
          fetch(processUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: existing.id, mode: 'stage1' }),
          }).catch(err => console.error('Failed to trigger matching:', err))
        }
      } else {
        // First payment — try to find user by email from invoice
        const customerEmail = (invoice as any).customer_email
        if (customerEmail) {
          const { data: user } = await db.from('user_profiles')
            .select('id')
            .eq('email', customerEmail)
            .single()
          if (user) {
            await db.from('user_profiles').update({
              stripe_customer_id: customerId,
              subscription_status: 'active',
              subscription_expires_at: null,
            }).eq('id', user.id)

            const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/resume/process`
            fetch(processUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: user.id, mode: 'stage1' }),
            }).catch(err => console.error('Failed to trigger matching:', err))
          }
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      if (sub.status === 'active') {
        await db.from('user_profiles').update({
          subscription_status: 'active',
          subscription_expires_at: null,
        }).eq('stripe_customer_id', customerId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as any
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      const expiresAt = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : new Date().toISOString()
      await db.from('user_profiles').update({
        subscription_status: 'cancelled',
        subscription_expires_at: expiresAt,
      }).eq('stripe_customer_id', customerId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null
      if (customerId) {
        await db.from('user_profiles').update({
          subscription_status: 'cancelled',
          subscription_expires_at: new Date().toISOString(),
        }).eq('stripe_customer_id', customerId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
