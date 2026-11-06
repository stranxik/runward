// A refusal of the build: a manifest, a policy or a view rule it cannot honour. The CLI turns it
// into exit 1 with nothing written; any other error is a defect and is thrown as is.
export class BuildError extends Error {}
