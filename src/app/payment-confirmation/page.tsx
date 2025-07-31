// In your page file: /payment-confirmation/page.js

import { Suspense } from 'react';
import { CheckoutReturnLogic } from './CheckoutReturnLogic'; // Adjust path if needed

export default function CheckoutReturnPage() {
    return (
        <Suspense fallback={<p>Loading payment status...</p>}>
            <CheckoutReturnLogic />
        </Suspense>
    );
}