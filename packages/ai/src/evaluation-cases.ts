import type { AIEvaluationCase } from "./evaluation.js";

type Labels = Omit<AIEvaluationCase, "id" | "text">;

const noRecommendation: Pick<
  Labels,
  | "expectedAbstention"
  | "expectedRecommendationEligible"
  | "expectedRecommendationType"
  | "prohibitedRecommendationOutcomes"
> = {
  expectedAbstention: true,
  expectedRecommendationEligible: false,
  expectedRecommendationType: null,
  prohibitedRecommendationOutcomes: ["GENERIC_REVIEW", "AUTOMATIC_REASSIGNMENT"]
};

function testCase(id: string, text: string, labels: Labels): AIEvaluationCase {
  return { id, text, ...labels };
}

const routineProgress = [
  "Installed six runway edge lights today.",
  "Level 2 cable tray installation progressed this morning.",
  "Three pumps were installed in the plant room.",
  "Started painting the west corridor.",
  "Completed the planned housekeeping round.",
  "Tested two lighting circuits today.",
  "Finished unloading the normal material delivery.",
  "Progress update: ceiling framing is moving as planned.",
  "Commissioned the temporary site office printer.",
  "Installed labels on the completed distribution boards."
].map((text, index) =>
  testCase(`routine-${index + 1}`, text, {
    ...noRecommendation,
    expectedOperationalImpact: "LOW",
    expectedPrimaryCategory: text.includes("delivery") ? "DELIVERY" : "PROGRESS_UPDATE",
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: "NONE",
    expectedSecondarySignals: text.includes("delivery") ? ["PROGRESS_UPDATE"] : []
  })
);

const operationalIssues = [
  ["A live cable is exposed beside the access route and is unsafe.", "SAFETY_ISSUE", "CRITICAL"],
  ["The fire door closer is broken and needs rectification.", "DEFECT", "HIGH"],
  ["Concrete delivery is delayed by two days.", "DELAY", "HIGH", ["DELIVERY"]],
  ["The delivered panels are damaged on arrival.", "DEFECT", "HIGH", ["DELIVERY"]],
  ["Material shortage will delay the ceiling works.", "DELAY", "HIGH", ["MATERIAL_ISSUE"]],
  ["Crew shortage has delayed cable pulling.", "DELAY", "HIGH", ["MANPOWER_ISSUE"]],
  ["RFI: clarify which drawing applies to the riser.", "RFI", "HIGH"],
  [
    "Client approved the variation; proceed with the additional scope.",
    "CLIENT_APPROVAL",
    "HIGH",
    ["VARIATION_ORDER"]
  ],
  ["Water is leaking from the newly tested valve.", "DEFECT", "HIGH", ["PROGRESS_UPDATE"]],
  ["Worker observed without a harness at the roof edge.", "SAFETY_ISSUE", "CRITICAL"]
] as const;

const meaningful = operationalIssues.map(([text, primary, impact, secondary = []], index) =>
  testCase(`issue-${index + 1}`, text, {
    expectedAbstention: false,
    expectedOperationalImpact: impact,
    expectedPrimaryCategory: primary,
    expectedRecommendationEligible: true,
    expectedRecommendationType: "ACTION_ITEM",
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: text.toLowerCase().includes("clarify") ? "NONE" : "NONE",
    expectedSecondarySignals: [...secondary],
    prohibitedRecommendationOutcomes: ["AUTO_APPROVE", "CERTIFY_COMPLIANCE"]
  })
);

const partialCompletionTexts = [
  "Cable tray installed; cabling pending.",
  "All fittings installed, but cabling and testing are still pending.",
  "Panel installation completed except termination work.",
  "Runway lights installed; commissioning not yet complete.",
  "Finished the pipework, however pressure testing remains.",
  "Doors installed but ironmongery is remaining.",
  "Delivery completed but two pallets are still missing.",
  "Concrete pour completed except the final bay.",
  "Testing started but the failed circuit remains unresolved.",
  "Ceiling complete, pending consultant comments."
];

const partialCompletion = partialCompletionTexts.map((text, index) => {
  const hasMaterialIssue = index === 6 || index === 8;
  return testCase(`partial-${index + 1}`, text, {
    ...(hasMaterialIssue
      ? {
          expectedAbstention: false,
          expectedRecommendationEligible: true,
          expectedRecommendationType: "ACTION_ITEM" as const,
          prohibitedRecommendationOutcomes: ["INSPECTION", "MILESTONE_COMPLETION"]
        }
      : noRecommendation),
    expectedOperationalImpact: index === 8 ? "HIGH" : hasMaterialIssue ? "MEDIUM" : "LOW",
    expectedPrimaryCategory: text.toLowerCase().includes("failed")
      ? "DEFECT"
      : text.toLowerCase().includes("delivery")
        ? "DELIVERY"
        : "PROGRESS_UPDATE",
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: "NONE",
    expectedSecondarySignals: text.toLowerCase().includes("failed")
      ? ["PROGRESS_UPDATE"]
      : text.toLowerCase().includes("delivery")
        ? hasMaterialIssue
          ? ["MATERIAL_ISSUE"]
          : ["PROGRESS_UPDATE"]
        : [],
    prohibitedRecommendationOutcomes: ["INSPECTION", "MILESTONE_COMPLETION"]
  });
});

const inspections = [
  [
    "Taxiway A circuit installation and testing are complete. Please arrange consultant inspection.",
    true
  ],
  ["Punch-list items are closed; request final inspection for Pump Room A.", true],
  ["The fire alarm test passed. Please schedule the authority inspection.", true],
  ["CCR panel testing is complete and the consultant inspection is required.", true],
  ["Ready for inspection: Level 3 chilled water pipework.", true],
  ["Delivery completed.", false],
  ["Equipment installed.", false],
  ["Inspection discussed at the meeting.", false],
  ["Cable tray installed but cabling pending; inspection later.", false],
  ["Photo attached of the completed cabinet.", false]
] as const;

const inspectionCases = inspections.map(([text, eligible], index) =>
  testCase(`inspection-${index + 1}`, text, {
    expectedAbstention: !eligible,
    expectedOperationalImpact: eligible ? "HIGH" : "LOW",
    expectedPrimaryCategory: text.toLowerCase().includes("delivery")
      ? "DELIVERY"
      : text.toLowerCase().includes("inspection")
        ? "INSPECTION_REQUEST"
        : "PROGRESS_UPDATE",
    expectedRecommendationEligible: eligible,
    expectedRecommendationType: eligible ? "INSPECTION" : null,
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: text.toLowerCase().includes("please") ? "OPEN" : "NONE",
    expectedSecondarySignals:
      text.toLowerCase().includes("inspection") &&
      /complete|ready|closed|passed/.test(text.toLowerCase())
        ? ["PROGRESS_UPDATE"]
        : [],
    prohibitedRecommendationOutcomes: eligible ? ["AUTO_SCHEDULE"] : ["INSPECTION"]
  })
);

const acknowledgements = [
  "Okay.",
  "Okay noted.",
  "Noted",
  "Thanks",
  "Received",
  "Acknowledged",
  "Thank you"
];
const acknowledgementCases = acknowledgements.map((text, index) =>
  testCase(`ack-${index + 1}`, text, {
    ...noRecommendation,
    expectedOperationalImpact: "NONE",
    expectedPrimaryCategory: index === 0 ? "UNKNOWN" : "ACKNOWLEDGEMENT",
    expectedRelevance: index === 0 ? "AMBIGUOUS" : "NON_OPERATIONAL",
    expectedResponseExpectation: index === 0 ? "UNCLEAR" : "NONE",
    expectedSecondarySignals: [],
    prohibitedRecommendationOutcomes: ["CLIENT_APPROVAL", "ACTION_ITEM"]
  })
);

const ambiguousCases = ["Done", "Complete.", "Completed", "Finished."].map((text, index) =>
  testCase(`ambiguous-${index + 1}`, text, {
    ...noRecommendation,
    expectedOperationalImpact: "NONE",
    expectedPrimaryCategory: "UNKNOWN",
    expectedRelevance: "AMBIGUOUS",
    expectedResponseExpectation: "UNCLEAR",
    expectedSecondarySignals: [],
    prohibitedRecommendationOutcomes: ["MILESTONE_COMPLETION", "INSPECTION"]
  })
);

const expectations = [
  [
    "We will send the signed test sheet by Friday; it is now overdue.",
    true,
    "FOLLOW_UP",
    "COMMITMENT",
    ["DELAY"]
  ],
  [
    "Still waiting for the quotation due yesterday, please send it.",
    true,
    "FOLLOW_UP",
    "DELAY",
    ["QUESTION"]
  ],
  [
    "The requested approval is overdue; could you confirm today?",
    true,
    "FOLLOW_UP",
    "QUESTION",
    ["DECISION"]
  ],
  [
    "Please provide the delivery update by 18 July; it is not received.",
    true,
    "FOLLOW_UP",
    "DELAY",
    ["DELIVERY", "QUESTION"]
  ],
  ["Could you send current site photos?", false, null, "QUESTION", []],
  ["We will provide the method statement by Friday.", false, null, "COMMITMENT", []],
  ["The signed test sheet is attached as requested.", false, null, "GENERAL_NOTE", []],
  ["Quotation uploaded and confirmed as requested.", false, null, "ACKNOWLEDGEMENT", []],
  ["Can you confirm which drawing applies?", true, "ACTION_ITEM", "RFI", ["QUESTION"]],
  ["Please approve the sample when convenient.", false, null, "QUESTION", ["DECISION"]]
] as const;

const expectationCases = expectations.map(
  ([text, eligible, recommendationType, primaryCategory, secondarySignals], index) =>
    testCase(`expectation-${index + 1}`, text, {
      expectedAbstention: !eligible,
      expectedOperationalImpact: eligible ? "HIGH" : "LOW",
      expectedPrimaryCategory: primaryCategory,
      expectedRecommendationEligible: eligible,
      expectedRecommendationType: recommendationType,
      expectedRelevance: "OPERATIONAL",
      expectedResponseExpectation: /attached|uploaded|confirmed as requested/i.test(text)
        ? "RESOLVED"
        : "OPEN",
      expectedSecondarySignals: [...secondarySignals],
      prohibitedRecommendationOutcomes: eligible
        ? ["GENERIC_PROGRESS_REQUEST"]
        : ["PREMATURE_FOLLOW_UP"]
    })
);

const mixedEvidenceTexts = [
  "Voice transcript: material shortage will delay installation.",
  "Photo caption: damaged pallet from today's delivery.",
  "Photo caption: equipment cabinet visible on site.",
  "Lunch is at 12 today.",
  "Happy birthday team.",
  "Weather looks good this morning.",
  "Client approved the drawing; release the material order.",
  "Wrong material delivered and installation is delayed.",
  "No electrician available, so testing is delayed.",
  "Smoke seen near the faulty distribution board.",
  "Additional scope requested under a variation order.",
  "RFI response received and the clarification is resolved."
];

const mixedEvidence = mixedEvidenceTexts.map((text, index) => {
  const prediction = (() => {
    const lower = text.toLowerCase();
    if (/lunch|birthday|weather/.test(lower))
      return ["UNKNOWN", false, "NON_OPERATIONAL", []] as const;
    if (lower.includes("cabinet visible"))
      return ["UNKNOWN", false, "NON_OPERATIONAL", []] as const;
    if (lower.includes("client approved"))
      return ["CLIENT_APPROVAL", true, "OPERATIONAL", []] as const;
    if (lower.includes("smoke")) return ["SAFETY_ISSUE", true, "OPERATIONAL", ["DEFECT"]] as const;
    if (lower.includes("wrong material"))
      return ["DELAY", true, "OPERATIONAL", ["DELIVERY"]] as const;
    if (lower.includes("no electrician"))
      return ["DELAY", true, "OPERATIONAL", ["MANPOWER_ISSUE"]] as const;
    if (lower.includes("material shortage"))
      return ["DELAY", true, "OPERATIONAL", ["MATERIAL_ISSUE"]] as const;
    if (lower.includes("damaged pallet"))
      return ["DEFECT", true, "OPERATIONAL", ["DELIVERY"]] as const;
    if (lower.includes("variation")) return ["VARIATION_ORDER", true, "OPERATIONAL", []] as const;
    if (lower.includes("resolved")) return ["RFI", false, "OPERATIONAL", []] as const;
    return ["RFI", true, "OPERATIONAL", []] as const;
  })();
  return testCase(`mixed-${index + 1}`, text, {
    expectedAbstention: !prediction[1],
    expectedOperationalImpact: prediction[1]
      ? prediction[0] === "SAFETY_ISSUE"
        ? "CRITICAL"
        : "HIGH"
      : "LOW",
    expectedPrimaryCategory: prediction[0],
    expectedRecommendationEligible: prediction[1],
    expectedRecommendationType: prediction[1] ? "ACTION_ITEM" : null,
    expectedRelevance: prediction[2],
    expectedResponseExpectation: text.toLowerCase().includes("received") ? "RESOLVED" : "NONE",
    expectedSecondarySignals: [...prediction[3]],
    prohibitedRecommendationOutcomes: ["UNSUPPORTED_CONCLUSION"]
  });
});

const generalOperations = [
  ["The pump is faulty and the replacement delivery is late.", "DEFECT", ["DELAY", "DELIVERY"]],
  [
    "Unsafe access remains because the broken handrail was not repaired.",
    "SAFETY_ISSUE",
    ["DEFECT"]
  ],
  ["The change order adds lighting to the new service road.", "VARIATION_ORDER", []],
  ["Material shortage: the specified cable is out of stock.", "MATERIAL_ISSUE", []],
  ["No electrician is available for tonight's testing.", "MANPOWER_ISSUE", ["PROGRESS_UPDATE"]],
  ["Please clarify the containment detail in RFI-42.", "RFI", []],
  ["The valve failed during testing.", "DEFECT", ["PROGRESS_UPDATE"]],
  ["Shipment is delayed at customs.", "DELAY", ["DELIVERY"]]
] as const;

const generalOperationCases = generalOperations.map(([text, primary, secondary], index) =>
  testCase(`general-${index + 1}`, text, {
    expectedAbstention: false,
    expectedOperationalImpact: primary === "SAFETY_ISSUE" ? "CRITICAL" : "HIGH",
    expectedPrimaryCategory: primary,
    expectedRecommendationEligible: true,
    expectedRecommendationType: "ACTION_ITEM",
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: text.toLowerCase().includes("please") ? "OPEN" : "NONE",
    expectedSecondarySignals: [...secondary],
    prohibitedRecommendationOutcomes: ["AUTO_APPROVE", "UNGROUNDED_SCOPE"]
  })
);

const sequenceCases: AIEvaluationCase[] = [
  testCase("repeat-defect-1", "The fire door closer is broken and needs rectification.", {
    expectedAbstention: false,
    expectedOperationalImpact: "HIGH",
    expectedPrimaryCategory: "DEFECT",
    expectedRecommendationEligible: true,
    expectedRecommendationType: "ACTION_ITEM",
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: "NONE",
    expectedSecondarySignals: [],
    prohibitedRecommendationOutcomes: ["GENERIC_REVIEW"],
    scenarioKey: "fire-door-closer-defect"
  }),
  testCase("repeat-defect-2", "The fire door closer is broken and needs rectification.", {
    duplicateOf: "repeat-defect-1",
    expectedAbstention: true,
    expectedOperationalImpact: "HIGH",
    expectedPrimaryCategory: "DEFECT",
    expectedRecommendationEligible: false,
    expectedRecommendationType: null,
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: "NONE",
    expectedSecondarySignals: [],
    prohibitedRecommendationOutcomes: ["DUPLICATE_ACTION_ITEM"],
    recentMessages: [
      {
        body: "The fire door closer is broken and needs rectification.",
        direction: "INBOUND",
        occurredAt: "2026-07-20T01:00:00.000Z",
        relation: "PRECEDING",
        senderName: "Site Supervisor"
      }
    ],
    scenarioKey: "fire-door-closer-defect"
  }),
  testCase(
    "expectation-overdue-context",
    "The signed test sheet promised for 18 July has not arrived.",
    {
      expectedAbstention: false,
      expectedOperationalImpact: "HIGH",
      expectedPrimaryCategory: "COMMITMENT",
      expectedRecommendationEligible: true,
      expectedRecommendationType: "FOLLOW_UP",
      expectedRelevance: "OPERATIONAL",
      expectedResponseExpectation: "OPEN",
      expectedSecondarySignals: [],
      occurredAt: "2026-07-20T02:00:00.000Z",
      prohibitedRecommendationOutcomes: ["GENERIC_PROGRESS_REQUEST"],
      scenarioKey: "signed-test-sheet",
      unresolvedExpectations: [
        {
          dueAt: "2026-07-18T09:00:00.000Z",
          expectedResponder: "Alex",
          requestedItem: "signed test sheet",
          sourceMessageId: "signed-sheet-request",
          type: "DOCUMENT"
        }
      ]
    }
  ),
  testCase("expectation-resolved-context", "The signed test sheet is attached as requested.", {
    expectedAbstention: true,
    expectedOperationalImpact: "LOW",
    expectedPrimaryCategory: "UNKNOWN",
    expectedRecommendationEligible: false,
    expectedRecommendationType: null,
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: "RESOLVED",
    expectedSecondarySignals: [],
    occurredAt: "2026-07-20T03:00:00.000Z",
    prohibitedRecommendationOutcomes: ["FOLLOW_UP"],
    scenarioKey: "signed-test-sheet",
    unresolvedExpectations: [
      {
        dueAt: "2026-07-18T09:00:00.000Z",
        expectedResponder: "Alex",
        requestedItem: "signed test sheet",
        sourceMessageId: "signed-sheet-request",
        type: "DOCUMENT"
      }
    ]
  }),
  testCase("expectation-superseded-context", "Any update on the signed test sheet?", {
    expectedAbstention: true,
    expectedOperationalImpact: "LOW",
    expectedPrimaryCategory: "QUESTION",
    expectedRecommendationEligible: false,
    expectedRecommendationType: null,
    expectedRelevance: "OPERATIONAL",
    expectedResponseExpectation: "RESOLVED",
    expectedSecondarySignals: [],
    occurredAt: "2026-07-20T04:00:00.000Z",
    prohibitedRecommendationOutcomes: ["FOLLOW_UP"],
    recentMessages: [
      {
        body: "The signed test sheet is attached as requested.",
        direction: "INBOUND",
        occurredAt: "2026-07-20T03:00:00.000Z",
        relation: "PRECEDING",
        senderName: "Alex"
      }
    ],
    scenarioKey: "signed-test-sheet"
  })
];

export const aiEvaluationCases: AIEvaluationCase[] = [
  ...routineProgress,
  ...meaningful,
  ...partialCompletion,
  ...inspectionCases,
  ...acknowledgementCases,
  ...ambiguousCases,
  ...expectationCases,
  ...mixedEvidence,
  ...generalOperationCases,
  ...sequenceCases
];
