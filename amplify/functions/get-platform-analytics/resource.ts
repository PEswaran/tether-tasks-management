import { defineFunction } from "@aws-amplify/backend";

export const getPlatformAnalyticsFn = defineFunction({
    name: "getPlatformAnalytics",
    entry: "./handler.ts",
});
