import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// --- Configuration (should be consistent with the frontend) ---
const PLANS = [
    {
        id: 'student_monthly',
        productId: 'prod_S3tTtxnYoAvQTq',
        name: 'Student Plan',
        price: 4.99,
        currency: 'usd',
        billingPeriod: 'month',
    }
];

const VALID_COUPONS = {
    'STUDENT25': { discount: 0.25, type: 'percentage', description: '25% off' },
    'SPS2025': { discount: 1.00, type: 'percentage', description: '100% off' },
    'NEWUSER50': { discount: 0.50, type: 'percentage', description: '50% off' },
    'SAVE2': { discount: 2.00, type: 'fixed', description: '$2.00 off' }
};

export async function POST(request) {
    try {
        const { planId, couponCode, userId } = await request.json();

        if (!stripe) {
            throw new Error("Stripe secret key not configured server-side.");
        }

        const selectedPlan = PLANS.find(plan => plan.id === planId);
        if (!selectedPlan) {
            return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
        }

        let finalAmount = selectedPlan.price;
        let appliedCoupon = null;
        let isValidCoupon = couponCode && VALID_COUPONS[couponCode];

        if (isValidCoupon) {
            const couponData = VALID_COUPONS[couponCode];
            appliedCoupon = {
                code: couponCode,
                type: couponData.type,
                discount: couponData.discount,
                description: couponData.description
            };

            if (couponData.type === 'percentage') {
                finalAmount = finalAmount * (1 - couponData.discount);
            } else if (couponData.type === 'fixed') {
                finalAmount = Math.max(0, finalAmount - couponData.discount);
            }
        }

        finalAmount = Math.round(finalAmount * 100) / 100;

        if (finalAmount <= 0 && isValidCoupon) {
            return NextResponse.json({
                isFreeOrder: true,
                appliedDiscount: {
                    ...appliedCoupon,
                    originalPrice: selectedPlan.price,
                    finalPrice: 0,
                    discountAmount: selectedPlan.price
                },
                selectedPlan,
                clientSecret: null
            });
        }

        finalAmount = Math.max(0.50, finalAmount);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalAmount * 100),
            currency: selectedPlan.currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                productId: selectedPlan.productId,
                planId: selectedPlan.id,
                userId: userId || 'unknown',
                couponCode: isValidCoupon ? couponCode : 'none'
            }
        });

        return NextResponse.json({
            paymentIntent,
            clientSecret: paymentIntent.client_secret,
            isFreeOrder: false,
            appliedDiscount: isValidCoupon ? {
                ...appliedCoupon,
                originalPrice: selectedPlan.price,
                finalPrice: finalAmount,
                discountAmount: selectedPlan.price - finalAmount
            } : null,
            selectedPlan
        });

    } catch (error) {
        console.error("Stripe PaymentIntent creation failed:", error);
        return NextResponse.json({ error: `Failed to create payment intent: ${error.message}` }, { status: 500 });
    }
}
