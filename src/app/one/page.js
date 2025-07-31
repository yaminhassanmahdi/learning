'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import Stripe from 'stripe';
import { supabase } from "../lib/supabaseClient"; // Ensure this path is correct
import { CheckCircle, Shield, Clock, AlertTriangle, ArrowRight, Award, Tag, Loader2, X, Edit3, Bot, Sparkles, SpellCheck } from 'lucide-react'; // Added more icons
import { useAtomValue } from 'jotai';
import {
    // summaryState, // Removed unused imports
    // chat_id_supabase,
    // file_id_supabase,
    // file_contents_supabase,
    user_id_supabase // Keep used atom
} from "../../store/uploadAtoms"; // Ensure this path is correct

// --- Configuration ---

// Replace with your actual public keys
const STRIPE_PUBLIC_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

// 
let stripe;
stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
if (typeof window === 'undefined') { // Basic check to prevent client-side exposure, but backend is required
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
}

// Plans configuration - easily extensible via JSON
const PLANS = [
    {
        id: 'student_monthly', // Unique identifier for your system and DB
        productId: 'prod_S3tTtxnYoAvQTq', // Your Stripe Product ID
        name: 'Student Plan',
        description: 'Perfect for students and academic work',
        price: 4.99,
        currency: 'usd',
        billingPeriod: 'month',
        features: [
            { name: 'Quizzes', count: 30, icon: 'quiz' },
            { name: 'Paraphrases', count: 25, icon: 'paraphrase' },
            { name: 'AI Checks', count: 20, icon: 'aiCheck' },
            { name: 'Humanizer Uses', count: 20, icon: 'humanizer' },
            { name: 'Grammar Checks', count: 40, icon: 'grammar' }
        ],
        popularBadge: true, // Optional: highlight a plan
        limits: { // Structure matching Supabase columns for easier updates
            quiz_count: 30,
            paraphrase_count: 25,
            ai_check_count: 20,
            humanizer_count: 20,
            grammer_check_count: 40 // Ensure this matches your Supabase column name exactly
        }
    }
    // Add more plans here, e.g.:
    // { id: 'pro_monthly', productId: 'prod_...', name: 'Pro Plan', ... }
];

// Sample coupons - **Ideally, fetch these securely from your backend/database**
const VALID_COUPONS = {
    'STUDENT25': { discount: 0.25, type: 'percentage', description: '25% off' },
    'SPS2025': { discount: 1.00, type: 'percentage', description: '100% off' },
    'NEWUSER50': { discount: 0.50, type: 'percentage', description: '50% off' },
    'SAVE2': { discount: 2.00, type: 'fixed', description: '$2.00 off' }
};

// --- Backend Simulation Functions (MUST BE MOVED TO SECURE BACKEND) ---

// Server action for creating payment intent (MUST run server-side)
async function createPaymentIntent(planId, couponCode = null, userId) {
    console.log(`SERVER ACTION (SIMULATED): Creating PI for plan ${planId}, coupon ${couponCode}, user ${userId}`);
    if (!stripe) {
        throw new Error("Stripe secret key not configured server-side.");
    }

    // Find selected plan
    const selectedPlan = PLANS.find(plan => plan.id === planId);
    if (!selectedPlan) throw new Error('Invalid plan selected');

    // Calculate discount if coupon is valid
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

    // Ensure we have a minimum amount and round to 2 decimal places
    finalAmount = Math.round(finalAmount * 100) / 100;

    // For zero-amount payments due to coupon
    if (finalAmount <= 0 && isValidCoupon) {
        console.log("SERVER ACTION (SIMULATED): Coupon results in free order.");
        return {
            isFreeOrder: true,
            appliedDiscount: { // Use the structure from appliedCoupon
                ...appliedCoupon,
                originalPrice: selectedPlan.price,
                finalPrice: 0,
                discountAmount: selectedPlan.price
            },
            selectedPlan,
            clientSecret: null // No PI needed
        };
    }

    // For paid amounts, create a payment intent with Stripe
    finalAmount = Math.max(0.50, finalAmount); // Stripe minimum charge is $0.50 USD
    console.log(`SERVER ACTION (SIMULATED): Creating Stripe PI for amount ${finalAmount}`);

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalAmount * 100), // Amount in cents
            currency: selectedPlan.currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                productId: selectedPlan.productId,
                planId: selectedPlan.id,
                userId: userId || 'unknown', // Include user ID if available
                couponCode: isValidCoupon ? couponCode : 'none'
            }
            // Consider adding receipt_email or customer ID if available
        });

        console.log("SERVER ACTION (SIMULATED): PaymentIntent created successfully.");
        return {
            paymentIntent, // Return the full PI object
            clientSecret: paymentIntent.client_secret,
            isFreeOrder: false,
            appliedDiscount: isValidCoupon ? {
                ...appliedCoupon,
                originalPrice: selectedPlan.price,
                finalPrice: finalAmount,
                discountAmount: selectedPlan.price - finalAmount
            } : null,
            selectedPlan
        };
    } catch (error) {
        console.error("SERVER ACTION (SIMULATED): Stripe PaymentIntent creation failed:", error);
        throw new Error(`Failed to create payment intent: ${error.message}`);
    }
}

// Function to update user usage in Supabase (MUST run server-side or use RLS)
const updateUserUsage = async (userId, selectedPlan, paymentIntentId = null) => {
    console.log(`SERVER ACTION (SIMULATED): Updating DB for user ${userId}, plan ${selectedPlan.id}, PI: ${paymentIntentId}`);
    if (!userId) {
        throw new Error("User ID is required to update usage.");
    }
    if (!selectedPlan || !selectedPlan.limits) {
        throw new Error("Valid plan details are required to update usage.");
    }

    try {
        // First, get current user data
        const { data: userData, error: fetchError } = await supabase
            .from('user_usage') // Ensure this table name is correct
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(); // Use maybeSingle to handle users not existing yet

        if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'PGRST116' (No rows found) for upsert logic
            console.error("Supabase fetch error:", fetchError);
            throw new Error(`Failed to fetch user data: ${fetchError.message}`);
        }

        // Prepare updated data - ADDING to existing counts
        const dataToUpdate = {
            user_id: userId, // Include user_id for potential insert
            is_premium: true,
            quiz_count: (userData?.quiz_count || 0) + selectedPlan.limits.quiz_count,
            paraphrase_count: (userData?.paraphrase_count || 0) + selectedPlan.limits.paraphrase_count,
            ai_check_count: (userData?.ai_check_count || 0) + selectedPlan.limits.ai_check_count,
            humanizer_count: (userData?.humanizer_count || 0) + selectedPlan.limits.humanizer_count,
            grammer_check_count: (userData?.grammer_check_count || 0) + selectedPlan.limits.grammer_check_count,
            // last_reset: userData?.last_reset || new Date().toISOString(), // Decide on reset logic - usually not needed on upgrade
            subscription_date: new Date().toISOString(),
            plan_id: selectedPlan.id, // Store the subscribed plan ID
            last_payment_intent: paymentIntentId // Optional: Track the payment intent
        };

        // Upsert the data: Update if exists, Insert if not
        const { error: upsertError } = await supabase
            .from('user_usage')
            .upsert(dataToUpdate, { onConflict: 'user_id' }); // Specify the conflict column

        if (upsertError) {
            console.error("Supabase upsert error:", upsertError);
            throw new Error(`Failed to update user usage: ${upsertError.message}`);
        }
        console.log("SERVER ACTION (SIMULATED): User usage updated successfully in DB.");
        return { success: true };

    } catch (error) {
        console.error("Error in updateUserUsage:", error);
        // Rethrow the error for the calling component to handle
        throw error;
    }
};

// --- UI Components ---

// Spinner Component
const Spinner = ({ size = 'h-5 w-5', color = 'text-indigo-600 dark:text-indigo-400' }) => (
    <Loader2 className={`animate-spin ${size} ${color}`} />
);

// Feature Icon Mapper
const FeatureIcon = ({ name, className = "h-5 w-5 text-indigo-500 dark:text-indigo-400" }) => {
    switch (name?.toLowerCase()) {
        case 'quiz':
        case 'quizzes':
            return <Edit3 className={className} aria-label="Quiz icon" />;
        case 'paraphrase':
        case 'paraphrases':
            return <Sparkles className={className} aria-label="Paraphrase icon" />;
        case 'ai check':
        case 'ai checks':
            return <Bot className={className} aria-label="AI Check icon" />;
        case 'humanizer use':
        case 'humanizer uses':
            return <Award className={className} aria-label="Humanizer icon" />;
        case 'grammar check':
        case 'grammar checks':
            return <SpellCheck className={className} aria-label="Grammar Check icon" />;
        default:
            return <CheckCircle className={className} aria-label="Feature icon" />; // Default icon
    }
};


// Free checkout component for 100% discount
function FreeCheckoutForm({ userUuid, couponApplied, selectedPlan, onUpgradeSuccess }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    // Removed contactInfo state as it's often not needed for free upgrades if user is logged in
    // const [contactInfo, setContactInfo] = useState({ email: '', phone: '' });

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Process the free order - just update user usage
            await updateUserUsage(userUuid, selectedPlan); // No PI needed
            setSuccess(true);
            if (onUpgradeSuccess) onUpgradeSuccess(); // Notify parent if needed
        } catch (error) {
            console.error("Free upgrade failed:", error);
            setError(error.message || 'Failed to process free upgrade. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Removed input handler as inputs are removed

    if (success) {
        return (
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg shadow-sm border border-green-200 dark:border-green-700">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-green-800 dark:text-green-300">Upgrade Successful!</h3>
                    <p className="mt-2 text-green-600 dark:text-green-400">
                        Your account has been upgraded to the <span className="font-medium">{selectedPlan.name}</span>.
                    </p>
                    <div className="mt-6 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-sm w-full max-w-xs mx-auto">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2 text-sm">New limits added:</h4>
                        <ul className="space-y-1">
                            {Object.entries(selectedPlan.limits).map(([key, value]) => (
                                <li key={key} className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ').replace(' count', '').replace(' grammer', ' grammar')}:</span>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">+{value}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        onClick={() => window.location.reload()} // Reload to reflect new status
                        className="mt-6 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-offset-zinc-900"
                    >
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Coupon Applied Display */}
            <div className="p-4 rounded-md bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-green-700 dark:text-green-300 font-medium flex items-center text-sm">
                        <Tag className="h-4 w-4 mr-1.5 flex-shrink-0" /> Coupon {couponApplied.code} Applied!
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-green-100 text-green-800 rounded-full dark:bg-green-800 dark:text-green-200">100% OFF</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 ml-5">{couponApplied.description}</p>
                <div className="mt-2 border-t border-green-200 dark:border-green-700 pt-2 text-sm space-y-1">
                    <div className="flex justify-between ">
                        <span className="text-gray-600 dark:text-gray-400">Original price:</span>
                        <span className="text-gray-500 dark:text-gray-500 line-through">${selectedPlan.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                        <span className="text-green-700 dark:text-green-300">Price after discount:</span>
                        <span className="text-green-700 dark:text-green-300">$0.00</span>
                    </div>
                </div>
            </div>

            {/* Form (Minimal for free checkout) */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Optional: Add terms agreement checkbox if needed */}
                {/* <div className="flex items-center">
                    <input id="terms" name="terms" type="checkbox" required className="h-4 w-4 text-indigo-600 border-gray-300 rounded dark:bg-zinc-700 dark:border-zinc-600" />
                    <label htmlFor="terms" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        I agree to the <a href="/terms" target="_blank" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">Terms of Service</a>
                    </label>
                </div> */}

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Summary Before Confirming */}
                <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-md border border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Plan:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-200">{selectedPlan.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Total due:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">$0.00</span>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded-md flex justify-center items-center font-semibold text-base transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900
                    ${loading
                            ? 'bg-gray-400 dark:bg-zinc-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white focus:ring-indigo-500'
                        }`}
                >
                    {loading ? (
                        <Spinner size="h-5 w-5" color="text-white" />
                    ) : (
                        <span className="flex items-center">
                            Complete Free Upgrade <ArrowRight className="ml-2 h-4 w-4" />
                        </span>
                    )}
                </button>
            </form>
        </div>
    );
}

// Payment form component
function CheckoutForm({ userUuid, resetPaymentIntent, selectedPlan, initialCoupon, onPaymentSuccess }) {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [couponCode, setCouponCode] = useState(initialCoupon?.code || '');
    const [couponApplied, setCouponApplied] = useState(initialCoupon || null);
    const [applyingCoupon, setApplyingCoupon] = useState(false);

    const finalPrice = couponApplied ? couponApplied.finalPrice : selectedPlan.price;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage(null);

        if (!stripe || !elements) {
            setErrorMessage("Payment system is not ready. Please wait or refresh.");
            setLoading(false);
            return;
        }

        try {
            // Confirm the payment
            const { error: submitError, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    // return_url is mandatory but we handle success inline if redirect: 'if_required'
                    return_url: `${window.location.origin}/payment-success?plan=${selectedPlan.id}`,
                    // You might want to pass email here if collected separately
                    // receipt_email: userEmail,
                },
                redirect: 'if_required', // Handle success/failure client-side if possible
            });

            if (submitError) {
                console.error("Stripe confirmPayment error:", submitError);
                setErrorMessage(submitError.message || 'Payment failed. Please check your details or try a different card.');
                setLoading(false);
                return;
            }

            // If no redirect happened (payment succeeded client-side)
            if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
                console.log("Payment successful or processing, Payment Intent:", paymentIntent);
                // Update the usage in Supabase
                await updateUserUsage(userUuid, selectedPlan, paymentIntent.id);
                setSuccess(true);
                if (onPaymentSuccess) onPaymentSuccess(); // Notify parent
            } else if (paymentIntent) {
                // Handle other statuses if necessary (e.g., requires_action)
                console.warn("Payment intent status:", paymentIntent.status);
                setErrorMessage("Payment requires further action or has an unexpected status.");
            } else {
                // This case might happen if redirect occurred, handle on return_url page
                console.log("Redirecting for payment confirmation...");
                // No need to set success here, will be handled on the success page
            }

        } catch (error) {
            console.error("Payment submission error:", error);
            setErrorMessage(error.message || 'An unexpected error occurred during payment.');
        } finally {
            // Only set loading false if no redirect is expected
            if (!success) { // Avoid flicker if success state is set just before
                setLoading(false);
            }
        }
    };

    // Function to handle coupon application
    const handleApplyCoupon = async (e) => {
        e.preventDefault();
        const codeToApply = couponCode.trim().toUpperCase();

        if (!codeToApply) {
            setErrorMessage('Please enter a coupon code');
            return;
        }

        setApplyingCoupon(true);
        setErrorMessage(null);

        try {
            // **Crucially, validation should happen server-side ideally**
            // Here we check against the client-side list for demo purposes
            if (VALID_COUPONS[codeToApply]) {
                // Reset the payment intent with the new coupon
                // The reset function should handle PI creation and return applied coupon details
                const result = await resetPaymentIntent(codeToApply);
                if (result.appliedDiscount) {
                    setCouponApplied(result.appliedDiscount);
                    // If coupon makes it free, the parent component should handle switching forms
                    if (result.isFreeOrder) {
                        // Parent component will detect this via initializePaymentIntent's return value
                        console.log("Coupon applied makes order free. Parent should switch view.");
                    }
                } else {
                    // Handle case where coupon is valid but PI failed to update (shouldn't happen with current logic)
                    setErrorMessage('Coupon applied, but failed to update payment details. Please try removing and re-applying.');
                    setCouponApplied(null); // Clear coupon state if PI update fails
                }
            } else {
                setErrorMessage('Invalid coupon code');
                setCouponApplied(null);
            }
        } catch (error) {
            console.error('Coupon application error:', error);
            setErrorMessage(error.message || 'Error applying coupon. Please try again.');
            setCouponApplied(null); // Clear coupon state on error
        } finally {
            setApplyingCoupon(false);
        }
    };

    const handleRemoveCoupon = async () => {
        setApplyingCoupon(true); // Show loading while resetting PI
        setErrorMessage(null);
        try {
            await resetPaymentIntent(null); // Reset payment intent without coupon
            setCouponApplied(null);
            setCouponCode('');
        } catch (error) {
            console.error('Coupon removal error:', error);
            setErrorMessage(error.message || 'Error removing coupon. Please try again.');
            // Keep coupon applied state if reset fails? Or clear? Decide UX.
        } finally {
            setApplyingCoupon(false);
        }
    };

    if (success) {
        // Same success message as FreeCheckoutForm for consistency
        return (
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg shadow-sm border border-green-200 dark:border-green-700">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-green-800 dark:text-green-300">Payment Successful!</h3>
                    <p className="mt-2 text-green-600 dark:text-green-400">
                        Your account has been upgraded to the <span className="font-medium">{selectedPlan.name}</span>.
                    </p>
                    <div className="mt-6 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-sm w-full max-w-xs mx-auto">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2 text-sm">New limits added:</h4>
                        <ul className="space-y-1">
                            {Object.entries(selectedPlan.limits).map(([key, value]) => (
                                <li key={key} className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ').replace(' count', '').replace(' grammer', ' grammar')}:</span>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">+{value}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        onClick={() => window.location.reload()} // Reload to reflect new status
                        className="mt-6 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md flex items-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-offset-zinc-900"
                    >
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Coupon Section */}
            <div className="space-y-2">
                <label htmlFor="couponCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Coupon Code (Optional)
                </label>
                <div className="flex items-stretch gap-2">
                    <input
                        type="text"
                        id="couponCode"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Enter code"
                        className="flex-grow p-2 border border-gray-300 dark:border-zinc-600 rounded-md focus:ring-2 focus:ring-indigo-500 dark:focus:ring-zinc-400 focus:border-indigo-500 dark:focus:border-zinc-400 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-zinc-700"
                        disabled={!!couponApplied || applyingCoupon}
                        aria-describedby="coupon-status"
                    />
                    {couponApplied ? (
                        <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            disabled={applyingCoupon}
                            className="py-2 px-4 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                            aria-label="Remove coupon"
                        >
                            {applyingCoupon ? <Spinner size="h-4 w-4" color="text-gray-500 dark:text-gray-400" /> : <X className="h-4 w-4" />}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleApplyCoupon}
                            disabled={applyingCoupon || !couponCode.trim()}
                            className={`py-2 px-4 rounded-md transition-colors flex-shrink-0 flex items-center justify-center font-medium
                            ${applyingCoupon || !couponCode.trim()
                                    ? 'bg-gray-300 dark:bg-zinc-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white'
                                }`}
                        >
                            {applyingCoupon ? <Spinner size="h-5 w-5" color="text-white" /> : 'Apply'}
                        </button>
                    )}
                </div>

                {couponApplied && (
                    <div id="coupon-status" className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-green-700 dark:text-green-300 font-medium flex items-center">
                                <Tag className="h-4 w-4 mr-1.5 flex-shrink-0" /> Coupon {couponApplied.code} Applied!
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-green-100 text-green-800 rounded-full dark:bg-green-800 dark:text-green-200">
                                {couponApplied.type === 'percentage'
                                    ? `${couponApplied.discount * 100}% OFF`
                                    : `$${couponApplied.discountAmount} OFF`}
                            </span>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 ml-5">{couponApplied.description}</p>
                        <div className="mt-2 border-t border-green-200 dark:border-green-700 pt-2 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Original price:</span>
                                <span className="text-gray-500 dark:text-gray-500 line-through">${selectedPlan.price.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                                <span className="text-green-700 dark:text-green-300">Price after discount:</span>
                                <span className="text-green-700 dark:text-green-300">${couponApplied.finalPrice.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Payment Element Section */}
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-md border border-gray-200 dark:border-zinc-700 shadow-sm">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">Payment Method</h3>
                <PaymentElement options={{ layout: "tabs" }} /> {/* Consider layout options */}
            </div>

            {/* Error Message */}
            {errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Order Summary */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-md border border-gray-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Plan:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">{selectedPlan.name}</span>
                </div>
                {couponApplied && (
                    <div className="flex items-center justify-between mb-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Discount ({couponApplied.code}):</span>
                        <span className="font-medium text-green-600 dark:text-green-400">-${(selectedPlan.price - couponApplied.finalPrice).toFixed(2)}</span>
                    </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-300 dark:border-zinc-600 pt-2 mt-2">
                    <span className="text-base font-semibold text-gray-700 dark:text-gray-300">Total due:</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-gray-100">${finalPrice.toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 text-right mt-1">
                    Billed per {selectedPlan.billingPeriod} (USD)
                </div>
            </div>

            {/* Security Footer */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span>Secure payment processing by Stripe</span>
            </div>

            {/* Submit Button */}
            <button
                type="submit"
                disabled={!stripe || !elements || loading || applyingCoupon}
                className={`w-full py-3 px-4 rounded-md flex justify-center items-center font-semibold text-base transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900
                ${(!stripe || !elements || loading || applyingCoupon)
                        ? 'bg-gray-400 dark:bg-zinc-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white focus:ring-indigo-500'
                    }`}
            >
                {loading || applyingCoupon ? (
                    <Spinner size="h-5 w-5" color="text-white" />
                ) : (
                    <span className="flex items-center">
                        {`Pay $${finalPrice.toFixed(2)}`}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                )}
            </button>
        </form>
    );
}

// Main component that handles Stripe Elements setup
export default function StripePaymentComponent() {
    const userUuid = useAtomValue(user_id_supabase); // Get user ID from Jotai state

    const [selectedPlanId, setSelectedPlanId] = useState(PLANS[0]?.id || null); // Default to first plan if exists
    const [clientSecret, setClientSecret] = useState(null);
    const [loadingIntent, setLoadingIntent] = useState(true); // Loading state for initial PI fetch
    const [intentError, setIntentError] = useState(null);
    const [currentCoupon, setCurrentCoupon] = useState(null); // Stores the coupon object if applied
    const [isFreeOrder, setIsFreeOrder] = useState(false);
    const [selectedPlanDetails, setSelectedPlanDetails] = useState(PLANS.find(p => p.id === selectedPlanId));

    // State for checking premium status
    const [isPremium, setIsPremium] = useState(false);
    const [isLoadingPremiumStatus, setIsLoadingPremiumStatus] = useState(true);
    const [premiumCheckError, setPremiumCheckError] = useState(null);

    // Function to check user's premium status
    const checkPremiumStatus = useCallback(async () => {
        if (!userUuid) {
            setPremiumCheckError("User not identified. Please log in.");
            setIsLoadingPremiumStatus(false);
            return;
        }
        setIsLoadingPremiumStatus(true);
        setPremiumCheckError(null);
        try {
            const { data, error } = await supabase
                .from('user_usage')
                .select('is_premium, plan_id')
                .eq('user_id', userUuid)
                .maybeSingle();

            if (error) {
                console.error("Supabase premium check error:", error);
                throw new Error(`Failed to check subscription status: ${error.message}`);
            }

            if (data?.is_premium) {
                setIsPremium(true);
                // Optionally, find the plan details they are subscribed to
                const currentPlan = PLANS.find(p => p.id === data.plan_id);
                setSelectedPlanDetails(currentPlan || PLANS[0]); // Fallback needed
                console.log(`User ${userUuid} is already premium on plan ${data.plan_id || 'unknown'}.`);
            } else {
                setIsPremium(false);
            }
        } catch (err) {
            console.error("Error checking premium status:", err);
            setPremiumCheckError(err.message);
            setIsPremium(false); // Assume not premium if check fails
        } finally {
            setIsLoadingPremiumStatus(false);
        }
    }, [userUuid]);

    // Check premium status on component mount or when user ID changes
    useEffect(() => {
        checkPremiumStatus();
    }, [checkPremiumStatus]);

    // Function to initialize or update the PaymentIntent
    const initializePaymentIntent = useCallback(async (couponCode = null) => {
        if (!selectedPlanId) {
            setIntentError("No plan selected.");
            setLoadingIntent(false);
            return { success: false }; // Indicate failure
        }
        // Don't initialize if user is already premium
        if (isPremium) {
            setLoadingIntent(false);
            return { success: false };
        }

        setLoadingIntent(true);
        setIntentError(null);
        setIsFreeOrder(false); // Reset free order flag

        try {
            // **Call the BACKEND function here**
            const response = await createPaymentIntent(selectedPlanId, couponCode, userUuid);

            setSelectedPlanDetails(response.selectedPlan); // Update plan details from response

            if (response.isFreeOrder) {
                setIsFreeOrder(true);
                setCurrentCoupon(response.appliedDiscount); // Store free coupon details
                setClientSecret(null); // No client secret needed
            } else if (response.clientSecret) {
                setIsFreeOrder(false);
                setClientSecret(response.clientSecret);
                setCurrentCoupon(response.appliedDiscount); // Store potentially applied discount coupon
            } else {
                throw new Error("Payment initialization failed: No client secret received.");
            }
            console.log("Payment Intent Initialized/Updated. Is Free:", response.isFreeOrder, "Coupon:", response.appliedDiscount);
            return { success: true, ...response }; // Return full response on success

        } catch (err) {
            console.error('Error creating/updating payment intent:', err);
            setIntentError(`Failed to initialize payment: ${err.message}. Please refresh or try again later.`);
            setClientSecret(null); // Clear secret on error
            setCurrentCoupon(null);
            setIsFreeOrder(false);
            return { success: false }; // Indicate failure
        } finally {
            setLoadingIntent(false);
        }
    }, [selectedPlanId, userUuid, isPremium]); // Rerun if plan, user, or premium status changes

    // Initialize PaymentIntent when the component mounts (after premium check)
    useEffect(() => {
        // Only initialize if user is loaded, not premium, and plan is selected
        if (userUuid && !isPremium && !isLoadingPremiumStatus && selectedPlanId) {
            initializePaymentIntent();
        }
        // If user becomes premium (e.g., after successful payment), state will update and this won't run again needlessly
    }, [userUuid, isPremium, isLoadingPremiumStatus, selectedPlanId, initializePaymentIntent]);

    // Function passed to CheckoutForm to reset payment intent with a new coupon
    const resetPaymentIntent = async (couponCode) => {
        // Let initializePaymentIntent handle the logic
        const result = await initializePaymentIntent(couponCode);
        // If coupon made it free, the state update (isFreeOrder=true) will trigger re-render
        // If coupon applied but still paid, state update (clientSecret, currentCoupon) triggers re-render
        // Return the result so CheckoutForm knows the outcome
        return result;
    };

    // Function to handle successful upgrade (either paid or free)
    const handleUpgradeSuccess = () => {
        console.log("Upgrade successful! Re-checking premium status.");
        // Re-check status to update UI immediately without full reload
        checkPremiumStatus();
        // Optionally redirect or show further instructions
    };


    // --- Render Logic ---

    // Loading state while checking premium status
    if (isLoadingPremiumStatus) {
        return (
            <div className="flex justify-center items-center h-60 bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
                <div className="flex flex-col items-center text-gray-600 dark:text-gray-400">
                    <Spinner size="h-10 w-10" />
                    <p className="mt-4 text-sm">Checking your subscription status...</p>
                </div>
            </div>
        );
    }

    // Error checking premium status
    if (premiumCheckError) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg shadow-md">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold">Error Checking Status</h3>
                        <p className="text-sm">{premiumCheckError}</p>
                        <button
                            onClick={checkPremiumStatus} // Allow retry
                            className="mt-2 text-sm font-medium text-red-800 dark:text-red-200 hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // User is already premium
    if (isPremium && selectedPlanDetails) {
        return (
            <div className="max-w-lg mx-auto p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-zinc-800 dark:to-zinc-900 rounded-lg shadow-lg border border-indigo-200 dark:border-zinc-700">
                <div className="flex flex-col items-center text-center">
                    <Award className="h-12 w-12 text-indigo-500 dark:text-indigo-400 mb-4" />
                    <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">{`You're Already Subscribed!`}</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        You are currently on the <span className="font-semibold">{selectedPlanDetails.name}</span>.
                    </p>
                    {/* Optional: Display current limits or link to account management */}
                    {/* <div className="mt-4 p-4 bg-white dark:bg-zinc-700 rounded-lg w-full text-left"> ... </div> */}
                    <button
                        onClick={() => window.location.href = '/'} // Link to relevant dashboard page
                        className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-md flex items-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                    >
                        Go to Home <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Loading state while fetching the initial payment intent
    if (loadingIntent) {
        return (
            <div className="flex justify-center items-center h-60 bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
                <div className="flex flex-col items-center text-gray-600 dark:text-gray-400">
                    <Spinner size="h-10 w-10" />
                    <p className="mt-4 text-sm">Preparing your secure checkout...</p>
                </div>
            </div>
        );
    }

    // Error fetching the initial payment intent
    if (intentError) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg shadow-md">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold">Checkout Error</h3>
                        <p className="text-sm">{intentError}</p>
                        <button
                            onClick={() => initializePaymentIntent()} // Allow retry
                            className="mt-2 text-sm font-medium text-red-800 dark:text-red-200 hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Main Checkout Rendering ---
    if (!selectedPlanDetails) {
        // Should not happen if PLANS array is not empty and default state is set
        return <div className="text-center text-red-500 p-6">Selected plan details not found.</div>;
    }

    const stripeOptions = clientSecret ? { clientSecret, appearance: { theme: 'stripe' } } : {}; // Pass clientSecret to Elements

    return (
        <div className="max-w-full mx-auto p-4 sm:p-6 lg:p-8 bg-white dark:bg-zinc-900  shadow-xl border border-gray-200 dark:border-zinc-700">

            {/* Optional: Add Plan Selection UI here if multiple plans exist */}
            {/* For now, assumes the first plan is selected */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Side: Plan Details */}
                <div className="bg-gray-50 dark:bg-zinc-800 p-6 rounded-lg border border-gray-100 dark:border-zinc-700">
                    {selectedPlanDetails.popularBadge && (
                        <span className="inline-block bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                            Most Popular
                        </span>
                    )}
                    <h2 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">{selectedPlanDetails.name}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{selectedPlanDetails.description}</p>

                    <div className="mb-6">
                        <span className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">${selectedPlanDetails.price.toFixed(2)}</span>
                        <span className="ml-1 text-base font-medium text-gray-500 dark:text-gray-400">/ {selectedPlanDetails.billingPeriod}</span>
                    </div>

                    <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wide">{`What's included:`}</h3>
                    <ul className="space-y-3">
                        {selectedPlanDetails.features.map((feature) => (
                            <li key={feature.name} className="flex items-center text-sm">
                                <FeatureIcon name={feature.icon} className="h-5 w-5 mr-3 flex-shrink-0 text-indigo-500 dark:text-indigo-400" />
                                <span className="text-gray-700 dark:text-gray-300">{feature.count} {feature.name}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-6 text-xs text-gray-500 dark:text-gray-500">
                        Limits are added to your account upon successful upgrade.
                    </div>
                </div>

                {/* Right Side: Checkout Form (Free or Paid) */}
                <div>
                    {isFreeOrder && currentCoupon ? (
                        // Free order form for 100% discount
                        <FreeCheckoutForm
                            userUuid={userUuid}
                            couponApplied={currentCoupon}
                            selectedPlan={selectedPlanDetails}
                            onUpgradeSuccess={handleUpgradeSuccess}
                        />
                    ) : clientSecret ? (
                        // Standard payment form using Stripe Elements
                        <Elements stripe={stripePromise} options={stripeOptions}>
                            <CheckoutForm
                                userUuid={userUuid}
                                resetPaymentIntent={resetPaymentIntent}
                                selectedPlan={selectedPlanDetails}
                                initialCoupon={currentCoupon} // Pass applied coupon info if page reloads/resets
                                onPaymentSuccess={handleUpgradeSuccess}
                            />
                        </Elements>
                    ) : (
                        // Fallback if something went wrong but no error was caught (should be rare)
                        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-center text-yellow-700 dark:text-yellow-300">Could not load checkout. Please refresh the page.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}