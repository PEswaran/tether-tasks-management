import { fetchAuthSession } from "aws-amplify/auth";

export async function isAuthed() {
    try {
        const s = await fetchAuthSession();
        return !!s.tokens?.accessToken;
    } catch {
        return false;
    }
}