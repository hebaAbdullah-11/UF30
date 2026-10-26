import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  EnrollUf30ParticipantBody,
  EnrollUf30ParticipantResponse,
  GetUf30InstitutionParams,
  GetUf30InstitutionResponse,
  GetUf30InstitutionReportResponse,
  SaveUf30ImpactMeasurementBody,
} from "@workspace/api-zod";
import { getSessionUserId } from "../lib/session";
import {
  buildUf30InstitutionReport,
  type Uf30ImpactMetrics,
  type Uf30ImpactPhase,
  type Uf30ImpactRow,
} from "../services/uf30-impact-policy.ts";

type PublicInstitution = {
  slug: string;
  nameArabic: string;
  nameEnglish: string;
  discountPercent: number;
};
type ReportData = {
  institution: Omit<PublicInstitution, "slug">;
  enrolledCount: number;
  measurements: readonly Uf30ImpactRow[];
};

export type Uf30InstitutionRepository = {
  getPublicInstitution(slug: string): Promise<PublicInstitution | null>;
  getInvitationInstitution(slug: string): Promise<{ id: string; invitationCodeHash: string } | null>;
  createParticipant(institutionId: string, participantTokenHash: string): Promise<void>;
  saveMeasurement(input: {
    participantTokenHash: string;
    phase: Uf30ImpactPhase;
    metrics: Uf30ImpactMetrics;
  }): Promise<boolean>;
  getReportForMember(userId: string): Promise<ReportData | null>;
};

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const equalHashes = (left: string, right: string) => {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

export function createUf30InstitutionRouter(
  repository: Uf30InstitutionRepository,
  resolveUserId: (request: Parameters<typeof getSessionUserId>[0]) => string | null = getSessionUserId,
): IRouter {
  const router: IRouter = Router();

  router.get("/uf30/institutions/:slug", async (req, res): Promise<void> => {
    const parsed = GetUf30InstitutionParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid institution" });
      return;
    }
    const institution = await repository.getPublicInstitution(parsed.data.slug);
    if (!institution) {
      res.status(404).json({ error: "Institution not found" });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(GetUf30InstitutionResponse.parse(institution));
  });

  router.post("/uf30/institution-enrollments", async (req, res): Promise<void> => {
    const parsed = EnrollUf30ParticipantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid enrollment" });
      return;
    }
    const institution = await repository.getInvitationInstitution(parsed.data.slug);
    if (!institution || !equalHashes(hash(parsed.data.invitationCode), institution.invitationCodeHash)) {
      res.status(400).json({ error: "Invalid enrollment" });
      return;
    }

    const participantToken = randomBytes(32).toString("base64url");
    await repository.createParticipant(institution.id, hash(participantToken));
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json(EnrollUf30ParticipantResponse.parse({ participantToken }));
  });

  router.post("/uf30/impact-measurements", async (req, res): Promise<void> => {
    const parsed = SaveUf30ImpactMeasurementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid measurement" });
      return;
    }
    const saved = await repository.saveMeasurement({
      participantTokenHash: hash(parsed.data.participantToken),
      phase: parsed.data.phase,
      metrics: parsed.data.metrics,
    });
    if (!saved) {
      res.status(400).json({ error: "Invalid measurement" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(204).end();
  });

  router.get("/uf30/institution-reports", async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    const userId = resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const data = await repository.getReportForMember(userId);
    if (!data) {
      res.status(403).json({ error: "Institution reporting access required" });
      return;
    }
    const report = buildUf30InstitutionReport(data.institution, data.enrolledCount, data.measurements);
    res.json(GetUf30InstitutionReportResponse.parse(report));
  });

  return router;
}
