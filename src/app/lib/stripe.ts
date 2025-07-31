import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Only throw error if we're in a runtime environment (not during build)
if (!stripeSecretKey && typeof window === 'undefined') {
    console.warn('STRIPE_SECRET_KEY environment variable is not set');
}

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;