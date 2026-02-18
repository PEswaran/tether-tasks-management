/**
 * Extracts a display name from an email address.
 * "iparv8+owner_acme@gmail.com" → "iparv8+owner_acme"
 * Falls back to the full string if no @ is found.
 */
export function displayName(email: string | undefined | null): string {
    if (!email) return "—";
    const atIndex = email.indexOf("@");
    return atIndex > 0 ? email.substring(0, atIndex) : email;
}
