// Authorization moved to a single permission/scope policy. No localhost bypass.
export {principal,requirePermission,scopeFor,assertPerson,capabilities} from './identity/authorization.mjs';
