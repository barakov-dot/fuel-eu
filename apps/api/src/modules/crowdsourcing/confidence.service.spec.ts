import { ConfidenceService } from './confidence.service';
import { ReputationService } from './reputation.service';

describe('ConfidenceService', () => {
  const reputationService = {
    clampScore: (score: number) => Math.max(0, Math.min(100, score)),
    reputationToBaseConfidence: (score: number) => 0.3 + (score / 100) * 0.4,
  } as ReputationService;

  const service = new ConfidenceService(reputationService);

  it('classifies distance thresholds', () => {
    expect(service.classifyDistance(100)).toBe('near');
    expect(service.classifyDistance(1500)).toBe('plausible');
    expect(service.classifyDistance(5000)).toBe('far');
    expect(service.classifyDistance(null)).toBe('unknown');
  });

  it('flags anomaly when price deviates more than 50%', () => {
    expect(service.isAnomaly('2.8000', '1.8000')).toBe(true);
    expect(service.isAnomaly('1.8200', '1.8000')).toBe(false);
  });

  it('computes higher confidence for near trusted reporter', () => {
    const near = service.computeInitialConfidence({
      reputationScore: 60,
      distanceMeters: 200,
      reportedAt: new Date(),
      trustedReferencePrice: '1.8000',
      reportedPrice: '1.7900',
    });
    const far = service.computeInitialConfidence({
      reputationScore: 60,
      distanceMeters: 5000,
      reportedAt: new Date(),
      trustedReferencePrice: '1.8000',
      reportedPrice: '1.7900',
    });
    expect(near).toBeGreaterThan(far);
  });

  it('adds bounded boost for confirmed photo evidence', () => {
    const withoutPhoto = service.computeInitialConfidence({
      reputationScore: 60,
      distanceMeters: 200,
      reportedAt: new Date(),
      trustedReferencePrice: '1.8000',
      reportedPrice: '1.7900',
    });
    const withPhoto = service.computeInitialConfidence({
      reputationScore: 60,
      distanceMeters: 200,
      reportedAt: new Date(),
      trustedReferencePrice: '1.8000',
      reportedPrice: '1.7900',
      hasPhotoEvidence: true,
    });
    expect(withPhoto - withoutPhoto).toBeCloseTo(0.05, 4);
    expect(withPhoto).toBeLessThanOrEqual(1);
  });
});
