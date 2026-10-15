// Deterministic model of the smoke-build triggers in skills/muffy/references/run-profile.md.
// 3d (devops mode 2) runs only if one trigger is true. If you change the trigger list there,
// change it here and in evals/smoke-scenarios.json in the same commit.
export const SMOKE_TRIGGERS = {
  runtime_or_dependency_changed: 'contract adds or bumps a runtime, lockfile dependency, native/binary package or datastore',
  devops_files_changed: 'devops-owned files change (Dockerfile, base image, .nvmrc, compose)',
  no_passing_smoke_on_record: 'no passing smoke recorded for this stack (first feature, onboarding, last smoke failed)',
  staging_none: 'staging: none (no safety net at step 9)',
};

export function smokeRequired(signals = {}) {
  const reasons = Object.keys(SMOKE_TRIGGERS).filter((k) => signals[k] === true);
  return { required: reasons.length > 0, reasons };
}
