// Backward-compatible domain entrypoint; PostgreSQL is the only runtime backend.
export {createPeopleService} from './people/service.mjs';
export {DomainError} from './core/errors.mjs';
