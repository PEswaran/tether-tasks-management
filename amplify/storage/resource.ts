import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'pilotAgreements',
    access: (allow) => ({
        'pilot-agreements/{entity_id}/*': [
            allow.groups(['PLATFORM_SUPER_ADMIN']).to(['read', 'write', 'delete']),
            allow.groups(['TENANT_ADMIN']).to(['read']),
        ],
        'signed-agreements/{entity_id}/*': [
            allow.entity('identity').to(['read', 'write']),
            allow.groups(['PLATFORM_SUPER_ADMIN']).to(['read']),
            allow.groups(['TENANT_ADMIN']).to(['read', 'write']),
        ],
    }),
});
