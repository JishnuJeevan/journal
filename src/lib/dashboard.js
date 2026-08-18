/**
 * Transforms LEDGER/index.json into the shape documented at the top of
 * dashboard-template.html: { generatedAt, features: [...] }.
 *
 * `relFromLedger(slug, step)` resolves a step to a link relative to
 * LEDGER/index.html — only called for the *current* version, since step
 * files are overwritten each version (historical versions link nowhere;
 * their SHA is still recorded and reachable via `git show`).
 */
export function buildDashboardData(index, { relFromLedger, generatedAt } = {}) {
  const features = Object.entries(index.features || {}).map(([slug, f]) => {
    const steps = f.steps || [];
    const pipelineSet = Boolean(f.steps);

    const versions = (f.versions || []).map((v) => {
      const isCurrent = v.version === f.currentVersion;
      const stepData = {};
      for (const step of steps) {
        const rec = v.steps[step];
        stepData[step] = {
          attribution: rec?.attribution || null,
          sha: rec?.commitSha || null,
          date: rec?.date || null,
          fileUrl: rec && isCurrent && relFromLedger ? relFromLedger(slug, step) : null,
        };
      }
      return { version: v.version, current: isCurrent, stepData };
    });

    return {
      slug,
      name: f.name,
      description: f.description,
      group: f.group || null,
      removed: Boolean(f.removed),
      codePaths: f.codePaths || [],
      steps,
      pipelineSet,
      versions,
      errors: f.errors || [],
    };
  });

  return { generatedAt: generatedAt || new Date().toISOString(), features };
}
