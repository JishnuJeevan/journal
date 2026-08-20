/**
 * Transforms JOURNAL/index.json into the shape documented at the top of
 * dashboard-template.html: { generatedAt, features: [...] }.
 *
 * `relFromJournal(slug, step)` resolves a step to a link relative to
 * JOURNAL/index.html — only called for the *current* version, since step
 * files are overwritten each version (historical versions link nowhere;
 * their SHA is still recorded and reachable via `git show`).
 */
export function buildDashboardData(index, { relFromJournal, generatedAt } = {}) {
  const features = Object.entries(index.features || {})
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .map(([slug, f]) => {
      const steps = f.steps || [];
      const pipelineSet = Boolean(f.steps);

      const versions = (f.versions || []).map((v) => {
        const isCurrent = v.version === f.currentVersion;
        const stepData = {};
        for (const step of steps) {
          const rec = v.steps[step];
          const fileUrl = rec && relFromJournal ? relFromJournal(slug, step, v.version, isCurrent) : null;
          // §6.3: step files are overwritten each version, so a non-current version
          // with no locally-archived file can only be viewed via its recorded SHA —
          // surfaced as a copyable `git show` hint instead of a dead link.
          const historicalHint =
            !isCurrent && !fileUrl && rec?.commitSha
              ? step === 'code' || step === 'test'
                ? `git show ${rec.commitSha}`
                : `git show ${rec.commitSha}:JOURNAL/features/${slug}/${step}/${step}.md`
              : null;
          stepData[step] = {
            attribution: rec?.attribution || null,
            identity: rec?.identity || null,
            sha: rec?.commitSha || null,
            date: rec?.date || null,
            fileUrl,
            historicalHint,
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
        libraries: f.libraries || [],
        dependsOn: f.dependsOn || [],
        steps,
        pipelineSet,
        versions,
        errors: f.errors || [],
      };
    });

  return { generatedAt: generatedAt || new Date().toISOString(), features };
}
