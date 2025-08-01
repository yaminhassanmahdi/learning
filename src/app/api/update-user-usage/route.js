import { NextResponse } from 'next/server';
import { supabase } from '../../lib/supabaseClient';

// This function handles updating the user's usage data in Supabase.
// It's designed to be called from a secure server environment.
async function updateUserUsageInSupabase(userId, selectedPlan, paymentIntentId = null) {
    if (!userId) {
        throw new Error("User ID is required to update usage.");
    }
    if (!selectedPlan || !selectedPlan.limits) {
        throw new Error("Valid plan details are required to update usage.");
    }

    try {
        // First, get current user data to correctly increment their limits
        const { data: userData, error: fetchError } = await supabase
            .from('user_usage')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        // Handle fetch errors, but allow 'PGRST116' (no rows found) for new users
        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error("Supabase fetch error:", fetchError);
            throw new Error(`Failed to fetch user data: ${fetchError.message}`);
        }

        // Prepare the data for upserting. We add the new limits to existing ones.
        const dataToUpdate = {
            user_id: userId,
            is_premium: true,
            quiz_count: (userData?.quiz_count || 0) + selectedPlan.limits.quiz_count,
            paraphrase_count: (userData?.paraphrase_count || 0) + selectedPlan.limits.paraphrase_count,
            ai_check_count: (userData?.ai_check_count || 0) + selectedPlan.limits.ai_check_count,
            humanizer_count: (userData?.humanizer_count || 0) + selectedPlan.limits.humanizer_count,
            grammer_check_count: (userData?.grammer_check_count || 0) + selectedPlan.limits.grammer_check_count,
            subscription_date: new Date().toISOString(),
            plan_id: selectedPlan.id,
            last_payment_intent: paymentIntentId
        };

        // Upsert the data: update if the user_id exists, otherwise insert a new row.
        const { error: upsertError } = await supabase
            .from('user_usage')
            .upsert(dataToUpdate, { onConflict: 'user_id' });

        if (upsertError) {
            console.error("Supabase upsert error:", upsertError);
            throw new Error(`Failed to update user usage: ${upsertError.message}`);
        }

        return { success: true, message: "User usage updated successfully." };

    } catch (error) {
        console.error("Error in updateUserUsageInSupabase:", error);
        // Re-throw to be caught by the POST handler
        throw error;
    }
}

export async function POST(request) {
    try {
        const { userId, selectedPlan, paymentIntentId } = await request.json();

        const result = await updateUserUsageInSupabase(userId, selectedPlan, paymentIntentId);

        return NextResponse.json(result);

    } catch (error) {
        console.error("API Error updating user usage:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
