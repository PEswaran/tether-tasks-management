import { defineFunction } from "@aws-amplify/backend";

export const submitContactRequestFn = defineFunction({
    name: "submitContactRequest",
    entry: "./handler.ts",
    timeoutSeconds: 10,
});
