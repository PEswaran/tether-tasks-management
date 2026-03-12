import { defineFunction } from "@aws-amplify/backend";

export const deleteOrganizationFn = defineFunction({
    name: "deleteOrganization",
    entry: "./handler.ts",
    timeoutSeconds: 120,
});
