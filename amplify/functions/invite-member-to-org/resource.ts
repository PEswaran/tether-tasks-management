import { defineFunction } from "@aws-amplify/backend";

export const inviteMemberToOrgFn = defineFunction({
    name: "inviteMemberToOrg",
    entry: "./handler.ts",
    timeoutSeconds: 30,
});
