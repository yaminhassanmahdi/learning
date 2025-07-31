import { useState } from "react";

export default function UsageModal(title = "none") {
    const [show, setShow] = useState(true);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md text-center">
                <h2 className="text-xl font-semibold mb-2">{title}</h2>
                <p className="text-gray-700 mb-4">Title limit reached</p>
                <button
                    onClick={() => setShow(false)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    Okay
                </button>
            </div>
        </div>
    );
}
