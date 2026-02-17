import { defineFunction } from "@aws-amplify/backend";

export const deleteTenantFn = defineFunction({
    name: "deleteTenant",
    entry: "./handler.ts",
    timeoutSeconds: 120,
});
