import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import express from "express";
import { createUf30InstitutionRouter, type Uf30InstitutionRepository } from "../routes/uf30-institutions.ts";
import { setSessionCookie } from "../lib/session.ts";
import type { Uf30ImpactMetrics, Uf30ImpactPhase, Uf30ImpactRow } from "./uf30-impact-policy.ts";

const invitationCode = "a-private-invitation-code";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

test("institution API authorizes managers, suppresses small cohorts, and returns only aggregate measures", async t => {
  const previousSessionSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-uf30-session-secret";
  t.after(() => {
    if (previousSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSessionSecret;
  });
  const participants: { hash: string }[] = [];
  const entries: (Uf30ImpactRow & Record<string, unknown>)[] = [];
  const institution = { slug: "sample-institution", nameArabic: "جهة تجريبية", nameEnglish: "Sample Institution", discountPercent: 15 };
  const repository: Uf30InstitutionRepository = {
    async getPublicInstitution(slug) { return slug === institution.slug ? institution : null; },
    async getInvitationInstitution(slug) {
      return slug === institution.slug
        ? { id: "institution-id", invitationCodeHash: digest(invitationCode) }
        : null;
    },
    async createParticipant(_institutionId, participantTokenHash) {
      participants.push({ hash: participantTokenHash });
    },
    async saveMeasurement({ participantTokenHash, phase, metrics }) {
      if (!participants.some(participant => participant.hash === participantTokenHash)) return false;
      const existingIndex = entries.findIndex(row => row.privateParticipantId === participantTokenHash && row.phase === phase);
      const row = {
        ...metrics,
        phase,
        privateParticipantId: participantTokenHash,
        privateAnswerSentinel: "individual-answer-must-never-leak",
      } as Uf30ImpactRow & Record<string, unknown>;
      if (existingIndex >= 0) entries[existingIndex] = row;
      else entries.push(row);
      return true;
    },
    async getReportForMember(userId) {
      if (userId !== "institution-manager") return null;
      return {
        institution: {
          nameArabic: institution.nameArabic,
          nameEnglish: institution.nameEnglish,
          discountPercent: institution.discountPercent,
        },
        enrolledCount: participants.length,
        measurements: entries,
      };
    },
  };

  const app = express();
  app.use(express.json());
  app.get("/test-session/:userId", (request, response) => {
    const userId = Array.isArray(request.params.userId) ? request.params.userId[0]! : request.params.userId;
    setSessionCookie(request, response, userId);
    response.status(204).end();
  });
  app.use(createUf30InstitutionRouter(repository));
  const server = app.listen(0);
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.once("listening", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const makeSessionCookie = async (userId: string) => {
    const response = await fetch(`${base}/test-session/${userId}`);
    assert.equal(response.status, 204);
    return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  };
  const getReport = async (userId?: string) => fetch(`${base}/uf30/institution-reports`, {
    headers: userId ? { cookie: await makeSessionCookie(userId) } : {},
  });
  const postJson = (path: string, body: unknown) => fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  assert.equal((await getReport()).status, 401, "signed-out visitors cannot read reports");
  assert.equal((await getReport("participant-account")).status, 403, "a participant account has no institution role");
  const empty = await getReport("institution-manager");
  assert.equal(empty.status, 200);
  const emptyReport = await empty.json() as {
    enrolledCount: number;
    phases: { responseCount: number | null; suppressed: boolean; averages: unknown }[];
  };
  assert.equal(emptyReport.enrolledCount, 0);
  assert.equal(emptyReport.phases.length, 3);
  assert.ok(emptyReport.phases.every(phase => phase.suppressed && phase.responseCount === null && phase.averages === null));

  const publicInfo = await fetch(`${base}/uf30/institutions/${institution.slug}`);
  assert.equal(publicInfo.status, 200);
  const publicPayload = await publicInfo.json() as Record<string, unknown>;
  assert.deepEqual(Object.keys(publicPayload).sort(), ["discountPercent", "nameArabic", "nameEnglish", "slug"]);

  const enroll = async () => {
    const response = await postJson("/uf30/institution-enrollments", {
      slug: institution.slug,
      invitationCode,
    });
    assert.equal(response.status, 201);
    const body = await response.json() as { participantToken: string };
    assert.equal(body.participantToken.length, 43);
    assert.ok(participants.some(participant => participant.hash === digest(body.participantToken)));
    assert.ok(!participants.some(participant => participant.hash === body.participantToken), "only a token hash is persisted");
    return body.participantToken;
  };

  const firstToken = await enroll();
  const invalidMeasurement = await postJson("/uf30/impact-measurements", {
    participantToken: firstToken,
    phase: "baseline",
    metrics: { onTimeCompletion: 101, punctuality: 50, managerRating: 3, participantSatisfaction: 3 },
  });
  assert.equal(invalidMeasurement.status, 400, "metric values are range checked");
  const firstSaved = await postJson("/uf30/impact-measurements", {
    participantToken: firstToken,
    phase: "baseline",
    metrics: { onTimeCompletion: 50, punctuality: 40, managerRating: 4, participantSatisfaction: 5 },
  });
  assert.equal(firstSaved.status, 204);
  assert.equal(await firstSaved.text(), "", "individual values are not returned");
  const small = await getReport("institution-manager");
  const smallReport = await small.json() as typeof emptyReport;
  assert.equal(smallReport.enrolledCount, 1);
  assert.equal(smallReport.phases[0]?.responseCount, null);
  assert.equal(smallReport.phases[0]?.averages, null);

  const metrics: Uf30ImpactMetrics = {
    onTimeCompletion: 50,
    punctuality: 40,
    managerRating: 4,
    participantSatisfaction: 5,
  };
  for (let index = 1; index < 10; index += 1) {
    const token = await enroll();
    const response = await postJson("/uf30/impact-measurements", {
      participantToken: token,
      phase: "baseline" satisfies Uf30ImpactPhase,
      metrics,
    });
    assert.equal(response.status, 204);
  }

  const aggregateResponse = await getReport("institution-manager");
  const aggregateBody = await aggregateResponse.text();
  const aggregate = JSON.parse(aggregateBody) as {
    enrolledCount: number;
    phases: { responseCount: number | null; suppressed: boolean; averages: Record<string, number> | null }[];
  };
  assert.equal(aggregate.enrolledCount, 10);
  assert.equal(aggregate.phases[0]?.responseCount, 10);
  assert.equal(aggregate.phases[0]?.suppressed, false);
  assert.deepEqual(aggregate.phases[0]?.averages, metrics);
  assert.equal(aggregate.phases[1]?.responseCount, null, "missing follow-up results stay empty");
  assert.doesNotMatch(aggregateBody, /privateParticipantId|privateAnswerSentinel|individual-answer-must-never-leak/);
  assert.doesNotMatch(aggregateBody, /participantToken|institution-id/);
  assert.deepEqual(Object.keys(aggregate.phases[0]?.averages ?? {}).sort(), [
    "managerRating",
    "onTimeCompletion",
    "participantSatisfaction",
    "punctuality",
  ]);
});
