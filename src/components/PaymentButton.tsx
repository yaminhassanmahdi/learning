"use client";

import { Button } from "@/components/ui/button";
import { RainbowButton } from "@/components/magicui/rainbow-button";
import { loadStripe } from "@stripe/stripe-js";
import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useCallback, useState } from "react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function ProButton() {
    const stripePromise = loadStripe(
        'pk_test_51R9leWRnC9IqMlBs0ZiVUTXXEoZ5pDEkhcIAJ8GmVT8PNa6a7oB6UEO2blaGcBok2ukacePsw4WUPnN0V6MaI4UO00v7TNXl31'
    );
    const [monthly, setMonthly] = useState(true)
    const fetchClientSecret = useCallback(async () => {
        try {
            const response = await fetch("/api/payment", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                // If your API route needs a body (e.g., cart items), add it here:
                // body: JSON.stringify({ /* your data */ }),
            });

            if (!response.ok) {
                // The server returned an error status code (4xx or 5xx)
                let errorData;
                try {
                    // Try to parse the error response body as JSON
                    errorData = await response.json();
                } catch (parseError) {
                    // If parsing the error JSON fails, fall back to status text
                    console.error("Failed to parse error response JSON:", parseError);
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
                // Throw an error with the message from the server's JSON response, or a default one
                console.error("API error:", errorData);
                throw new Error(errorData.message || errorData.error || `Server responded with status ${response.status}`);
            }

            // If response.ok is true, then proceed to parse the successful JSON response
            const data = await response.json();

            if (!data.client_secret) {
                // The request was successful, but client_secret is missing in the response
                console.error("Client secret not found in server response:", data);
                throw new Error("Client secret not found in server response.");
            }

            return data.client_secret;

        } catch (error) {
            // Catch any errors (network, parsing, or explicitly thrown)
            console.error("fetchClientSecret failed:", error);
            // It's important to re-throw the error or throw a new one so that
            // Stripe.js knows the operation failed and doesn't try to proceed with 'undefined'.
            throw error;
        }
    }, []);
    const fetchClientSecretForSubscription = useCallback(async () => {
        try {
            const response = await fetch("/api/payment-subscription", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                // If your API route needs a body (e.g., cart items), add it here:
                // body: JSON.stringify({ /* your data */ }),
            });

            if (!response.ok) {
                // The server returned an error status code (4xx or 5xx)
                let errorData;
                try {
                    // Try to parse the error response body as JSON
                    errorData = await response.json();
                } catch (parseError) {
                    // If parsing the error JSON fails, fall back to status text
                    console.error("Failed to parse error response JSON:", parseError);
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
                // Throw an error with the message from the server's JSON response, or a default one
                console.error("API error:", errorData);
                throw new Error(errorData.message || errorData.error || `Server responded with status ${response.status}`);
            }

            // If response.ok is true, then proceed to parse the successful JSON response
            const data = await response.json();

            if (!data.client_secret) {
                // The request was successful, but client_secret is missing in the response
                console.error("Client secret not found in server response:", data);
                throw new Error("Client secret not found in server response.");
            }

            return data.client_secret;

        } catch (error) {
            // Catch any errors (network, parsing, or explicitly thrown)
            console.error("fetchClientSecret failed:", error);
            // It's important to re-throw the error or throw a new one so that
            // Stripe.js knows the operation failed and doesn't try to proceed with 'undefined'.
            throw error;
        }
    }, []);

    const options = { fetchClientSecret };
    const subscription_options = { fetchClientSecret: fetchClientSecretForSubscription };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <RainbowButton type="submit" formMethod="post" className="rounded-lg" variant={"default"} data-pro-button="true">
                    Get Pro
                </RainbowButton>
            </DialogTrigger>
            <DialogContent className="my-4  py-2 xl:max-w-screen-xl scale-[.65] bg-transparent">
                <DialogTitle className="text-xl dark:text-white font-semibold">
                    Pro Membership
                </DialogTitle>
                <Button type="submit" onClick={() => { setMonthly(prev => !prev) }} formMethod="post" variant={"default"}>
                    {!monthly ? 'Return' : 'Free Pass?'}
                </Button>

                {!monthly && (
                    <EmbeddedCheckoutProvider stripe={stripePromise} options={options} >
                        <EmbeddedCheckout className="" />
                    </EmbeddedCheckoutProvider>
                )}
                {monthly && (
                    <EmbeddedCheckoutProvider stripe={stripePromise} options={subscription_options} >
                        <EmbeddedCheckout className="" />
                    </EmbeddedCheckoutProvider>
                )}




                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancel Payment
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}