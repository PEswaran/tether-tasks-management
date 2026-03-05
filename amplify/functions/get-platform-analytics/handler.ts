import { createSign } from "node:crypto";
import type { Schema } from "../../data/resource";

type LocationRow = {
    country: string;
    visitors: number;
};

type GAReportRow = {
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
};

type RunReportArgs = {
    propertyId: string;
    accessToken: string;
    startDate: string;
    endDate: string;
    metrics: string[];
    dimensions?: string[];
    orderByMetric?: string;
    limit?: number;
};

export const handler: Schema["getPlatformAnalytics"]["functionHandler"] = async (event) => {
    const propertyId = process.env.GA4_PROPERTY_ID;
    const clientEmail = process.env.GA_CLIENT_EMAIL;
    const privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!propertyId || !clientEmail || !privateKey) {
        return {
            success: false,
            message: "Google Analytics is not configured. Set GA4_PROPERTY_ID, GA_CLIENT_EMAIL, and GA_PRIVATE_KEY.",
            range: null,
            metrics: null,
            locations: [],
        };
    }

    const startDate = event.arguments.startDate || "30daysAgo";
    const endDate = event.arguments.endDate || "today";

    try {
        const token = await getGoogleAccessToken(clientEmail, privateKey);
        const totals = await runReport({
            propertyId,
            accessToken: token,
            startDate,
            endDate,
            metrics: ["activeUsers", "newUsers", "sessions"],
        });

        const locationsReport = await runReport({
            propertyId,
            accessToken: token,
            startDate,
            endDate,
            dimensions: ["country"],
            metrics: ["activeUsers"],
            orderByMetric: "activeUsers",
            limit: 8,
        });

        const metrics = {
            activeUsers: Number(totals.rows?.[0]?.metricValues?.[0]?.value || 0),
            newUsers: Number(totals.rows?.[0]?.metricValues?.[1]?.value || 0),
            sessions: Number(totals.rows?.[0]?.metricValues?.[2]?.value || 0),
        };

        const locations: LocationRow[] = ((locationsReport.rows as GAReportRow[]) || []).map((row) => ({
            country: row.dimensionValues?.[0]?.value || "Unknown",
            visitors: Number(row.metricValues?.[0]?.value || 0),
        }));

        return {
            success: true,
            message: null,
            range: { startDate, endDate },
            metrics,
            locations,
        };
    } catch (error: any) {
        console.error("getPlatformAnalytics error:", error);
        return {
            success: false,
            message: error?.message || "Failed to fetch Google Analytics data.",
            range: { startDate, endDate },
            metrics: null,
            locations: [],
        };
    }
};

function base64UrlEncode(value: string): string {
    return Buffer.from(value)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/analytics.readonly",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const unsigned = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const signature = signer
        .sign(privateKey, "base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");

    const assertion = `${unsigned}.${signature}`;
    const body = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google OAuth token request failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as { access_token?: string };
    if (!json.access_token) {
        throw new Error("Google OAuth token missing access_token");
    }
    return json.access_token;
}

async function runReport(args: RunReportArgs): Promise<any> {
    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${args.propertyId}:runReport`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${args.accessToken}`,
        },
        body: JSON.stringify({
            dateRanges: [{ startDate: args.startDate, endDate: args.endDate }],
            metrics: args.metrics.map((name) => ({ name })),
            dimensions: (args.dimensions || []).map((name) => ({ name })),
            orderBys: args.orderByMetric
                ? [{ metric: { metricName: args.orderByMetric }, desc: true }]
                : undefined,
            limit: args.limit,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`GA4 runReport failed: ${response.status} ${text}`);
    }

    return response.json();
}
