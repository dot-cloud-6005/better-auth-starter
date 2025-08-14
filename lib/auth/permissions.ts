import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from 'better-auth/plugins/organization/access';

const statement = {
    ...defaultStatements,
    project: ["create", "share", "update", "delete"],
} as const;

const ac = createAccessControl(statement);

const member = ac.newRole({
    project: ["create"],
    invitation: ["create"],
});

const admin = ac.newRole({
    project: ["create", "update"],
    // Admins can invite and cancel invitations
    invitation: ["create", "cancel"],
});

const owner = ac.newRole({
    project: ["create", "update", "delete"],
    organization: ["update", "delete"],
    // Owners can invite and cancel invitations
    invitation: ["create", "cancel"],
});

export { ac, admin, member, owner, statement };

