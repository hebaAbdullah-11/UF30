import { and, count, eq } from "drizzle-orm";
import {
  db,
  uf30ImpactMeasurementsTable,
  uf30InstitutionMembersTable,
  uf30InstitutionsTable,
  uf30ParticipantsTable,
} from "@workspace/db";
import type { Uf30InstitutionRepository } from "../routes/uf30-institutions";

export const uf30InstitutionRepository: Uf30InstitutionRepository = {
  async getPublicInstitution(slug) {
    const [institution] = await db.select({
      slug: uf30InstitutionsTable.slug,
      nameArabic: uf30InstitutionsTable.nameArabic,
      nameEnglish: uf30InstitutionsTable.nameEnglish,
      discountPercent: uf30InstitutionsTable.discountPercent,
    }).from(uf30InstitutionsTable).where(eq(uf30InstitutionsTable.slug, slug)).limit(1);
    return institution ?? null;
  },

  async getInvitationInstitution(slug) {
    const [institution] = await db.select({
      id: uf30InstitutionsTable.id,
      invitationCodeHash: uf30InstitutionsTable.invitationCodeHash,
    }).from(uf30InstitutionsTable).where(eq(uf30InstitutionsTable.slug, slug)).limit(1);
    return institution ?? null;
  },

  async createParticipant(institutionId, participantTokenHash) {
    await db.insert(uf30ParticipantsTable).values({ institutionId, participantTokenHash });
  },

  async saveMeasurement({ participantTokenHash, phase, metrics }) {
    const [participant] = await db.select({ id: uf30ParticipantsTable.id })
      .from(uf30ParticipantsTable)
      .where(eq(uf30ParticipantsTable.participantTokenHash, participantTokenHash))
      .limit(1);
    if (!participant) return false;

    await db.insert(uf30ImpactMeasurementsTable).values({
      participantId: participant.id,
      phase,
      ...metrics,
    }).onConflictDoUpdate({
      target: [uf30ImpactMeasurementsTable.participantId, uf30ImpactMeasurementsTable.phase],
      set: { ...metrics, submittedAt: new Date() },
    });
    return true;
  },

  async getReportForMember(userId) {
    const [membership] = await db.select({
      id: uf30InstitutionsTable.id,
      nameArabic: uf30InstitutionsTable.nameArabic,
      nameEnglish: uf30InstitutionsTable.nameEnglish,
      discountPercent: uf30InstitutionsTable.discountPercent,
    }).from(uf30InstitutionMembersTable)
      .innerJoin(uf30InstitutionsTable, eq(uf30InstitutionsTable.id, uf30InstitutionMembersTable.institutionId))
      .where(eq(uf30InstitutionMembersTable.userId, userId))
      .limit(1);
    if (!membership) return null;

    const [enrollmentCount] = await db.select({ value: count() })
      .from(uf30ParticipantsTable)
      .where(eq(uf30ParticipantsTable.institutionId, membership.id));
    const measurements = await db.select({
      phase: uf30ImpactMeasurementsTable.phase,
      onTimeCompletion: uf30ImpactMeasurementsTable.onTimeCompletion,
      punctuality: uf30ImpactMeasurementsTable.punctuality,
      managerRating: uf30ImpactMeasurementsTable.managerRating,
      participantSatisfaction: uf30ImpactMeasurementsTable.participantSatisfaction,
    }).from(uf30ImpactMeasurementsTable)
      .innerJoin(uf30ParticipantsTable, eq(uf30ParticipantsTable.id, uf30ImpactMeasurementsTable.participantId))
      .where(and(
        eq(uf30ParticipantsTable.institutionId, membership.id),
      ));

    return {
      institution: {
        nameArabic: membership.nameArabic,
        nameEnglish: membership.nameEnglish,
        discountPercent: membership.discountPercent,
      },
      enrolledCount: Number(enrollmentCount?.value ?? 0),
      measurements,
    };
  },
};
