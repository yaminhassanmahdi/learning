// CheckoutReturnLogic.js (or inside the same file)
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { stripe } from "../lib/stripe";
import { user_id_supabase } from "../../store/uploadAtoms";
import { supabase } from "../lib/supabaseClient";

export function CheckoutReturnLogic() {
    const [status, setStatus] = useState("loading");
    const USER_ID = useAtomValue(user_id_supabase);
    const searchParams = useSearchParams();
    const sessionId = searchParams?.get("session_id");
    const router = useRouter();

    const updateUserUsage = async (userId, selectedPlan, paymentIntentId = null) => {
        console.log(`SERVER ACTION (SIMULATED): Updating DB for user ${userId}, plan ${selectedPlan}, PI: ${paymentIntentId}`);
        if (!userId) {
            throw new Error("User ID is required to update usage.");
        }
        if (!selectedPlan) {
            throw new Error("Valid plan details are required to update usage.");
        }

        try {
            const dataToUpdate = {
                user_id: userId,
                is_premium: true,
                paraphrase_count: 100,
                ai_check_count: 100,
                humanizer_count: 100,
                grammer_check_count: 100,
                per_w_count: 100,
                summary_count: 100,
                ai_notes_count: 100,
                flashcard_count: 100,
                quiz_count: 100,
                chat_request_count: 100,
                exm_prep_count: 100,
                solver_chat_count: 100,
                general_chat_count: 100,
                meme_count: 100,
                subscription_date: new Date().toISOString(),
                plan_id: selectedPlan,
                last_payment_intent: paymentIntentId
            };

            const { error: upsertError } = await supabase
                .from('user_usage')
                .upsert(dataToUpdate, { onConflict: 'user_id' });

            if (upsertError) {
                console.error("Supabase upsert error:", upsertError);
                throw new Error(`Failed to update user usage: ${upsertError.message}`);
            }
            console.log("SERVER ACTION (SIMULATED): User usage updated successfully in DB.");
            return { success: true };

        } catch (error) {
            console.error("Error in updateUserUsage:", error);
            throw error;
        }
    };

    useEffect(() => {
        async function getSession(sessionId) {
            try {
                const session = await stripe.checkout.sessions.retrieve(sessionId);
                if (session?.status === "open") {
                    setStatus("open");
                } else if (session?.status === "complete") {
                    await updateUserUsage(USER_ID, 'test_plan_id_from_session_or_metadata', session.payment_intent);
                    console.log("USER PREMIUM --->", USER_ID);
                    setStatus("complete");
                    setTimeout(() => {
                        router.push("/");
                    }, 2000);
                } else {
                    setStatus("error");
                }
            } catch (err) {
                setStatus("error");
            }
        }

        if (sessionId) {
            getSession(sessionId);
        } else {
            setStatus("error");
        }
    }, [sessionId, USER_ID, router]); // Added router to dependency array

    if (status === "error") return <p>Error: Something went wrong! </p>;
    if (status === "open") return <p>Payment did not work.</p>;

    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background py-32" >
            <h1 className="text-4xl font-bold" > Thank you for your purchase! </h1>
            < h3 className="text-xl font-semibold" > You are now a pro user! </h3>
        </div>
    );
}