import { useState } from "react";
import { X } from "lucide-react";
import { isDemoUser } from "../../config/demo";

export default function DemoBanner() {
    const [dismissed, setDismissed] = useState(false);

    if (!isDemoUser() || dismissed) return null;

    return (
        <div className="demo-banner">
            <span>
                You're exploring a demo environment. Data resets periodically.
            </span>
            <button
                className="demo-banner-dismiss"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss demo banner"
            >
                <X size={14} />
            </button>
        </div>
    );
}
