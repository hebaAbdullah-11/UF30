export const UF30_IMPACT_PHASES = [
  "baseline",
  "after_session_four",
  "after_two_months",
] as const;

export const UF30_MINIMUM_GROUP_SIZE = 10;

export type Uf30ImpactPhase = typeof UF30_IMPACT_PHASES[number];
export type Uf30ImpactMetrics = {
  onTimeCompletion: number;
  punctuality: number;
  managerRating: number;
  participantSatisfaction: number;
};
export type Uf30ImpactRow = Uf30ImpactMetrics & { phase: Uf30ImpactPhase };

type InstitutionDetails = { nameArabic: string; nameEnglish: string; discountPercent: number };

export function buildUf30InstitutionReport(
  institution: InstitutionDetails,
  enrolledCount: number,
  measurements: readonly Uf30ImpactRow[],
) {
  return {
    institution,
    enrolledCount,
    minimumGroupSize: UF30_MINIMUM_GROUP_SIZE as 10,
    phases: UF30_IMPACT_PHASES.map(phase => {
      const rows = measurements.filter(row => row.phase === phase);
      if (rows.length < UF30_MINIMUM_GROUP_SIZE) {
        return { phase, responseCount: null, suppressed: true, averages: null };
      }

      const mean = (key: keyof Uf30ImpactMetrics) =>
        Math.round((rows.reduce((total, row) => total + row[key], 0) / rows.length) * 10) / 10;
      return {
        phase,
        responseCount: rows.length,
        suppressed: false,
        averages: {
          onTimeCompletion: mean("onTimeCompletion"),
          punctuality: mean("punctuality"),
          managerRating: mean("managerRating"),
          participantSatisfaction: mean("participantSatisfaction"),
        },
      };
    }),
  };
}
