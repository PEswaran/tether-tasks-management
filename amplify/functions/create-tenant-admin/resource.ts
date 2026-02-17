import { defineFunction } from "@aws-amplify/backend";

export const createTenantAdminFn = defineFunction({
    name: "createTenantAdmin",
    entry: "./handler.ts",
});
