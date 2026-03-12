export const DEMO_EMAIL = "demo@tethertasks.com";
export const DEMO_PASSWORD = "DemoPass123!";
export const DEMO_TENANT_NAME = "Acme Holdings (Demo)";
export const DEMO_LOCALSTORAGE_KEY = "tethertasks_demo";

export function isDemoUser(): boolean {
    return localStorage.getItem(DEMO_LOCALSTORAGE_KEY) === "true";
}

export function setDemoFlag(): void {
    localStorage.setItem(DEMO_LOCALSTORAGE_KEY, "true");
}

export function clearDemoFlag(): void {
    localStorage.removeItem(DEMO_LOCALSTORAGE_KEY);
}
