import { defineFunction } from "@aws-amplify/backend";

export const replaceTenantAdminFn = defineFunction({
    name: "replaceTenantAdmin",
    entry: "./handler.ts",
    timeoutSeconds: 30,
});
