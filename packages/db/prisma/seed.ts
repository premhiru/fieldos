import { prisma } from "../src/client.js";

const seedOrganizationSlug = "fieldos-seed-ops";
const seedUserEmail = "seed@fieldos.local";
const seedPasswordHash = "$2b$12$aeTy0dwX67jQDnTJ7LdmzOG54fEBMe.yIKVQEQWjmpQj/lFAUwLK6";

const conversationTemplates = [
  {
    channel: "EMAIL" as const,
    externalId: "seed-email-dock-access",
    isGroup: false,
    title: "Dock access coordination"
  },
  {
    channel: "SMS" as const,
    externalId: "seed-sms-crew-check-in",
    isGroup: false,
    title: "Crew check-in"
  },
  {
    channel: "SLACK" as const,
    externalId: "seed-slack-dispatch-room",
    isGroup: true,
    title: "Dispatch room"
  },
  {
    channel: "TEAMS" as const,
    externalId: "seed-teams-safety-briefing",
    isGroup: true,
    title: "Safety briefing"
  },
  {
    channel: "WHATSAPP" as const,
    externalId: "seed-whatsapp-delivery-photos",
    isGroup: false,
    title: "Delivery photos"
  }
];

const messageBodies = [
  [
    "Can the crew access bay 4 at 08:00?",
    "Gate code confirmed.",
    "Driver has arrived.",
    "Unload complete."
  ],
  ["Crew is en route.", "ETA is 20 minutes.", "Arrived on site.", "Supervisor signed off."],
  [
    "Route changed because of traffic.",
    "Dispatch updated the stop order.",
    "Customer notified.",
    "All teams aligned."
  ],
  [
    "Safety checklist sent.",
    "Briefing acknowledged.",
    "One item needs review.",
    "Checklist complete."
  ],
  [
    "Photo received from loading dock.",
    "Document attached for review.",
    "Voice note logged.",
    "Delivery confirmed."
  ]
];

async function main() {
  const existingOrganization = await prisma.organization.findUnique({
    where: {
      slug: seedOrganizationSlug
    }
  });

  if (existingOrganization) {
    await prisma.organization.delete({
      where: {
        id: existingOrganization.id
      }
    });
  }

  const user = await prisma.user.upsert({
    create: {
      email: seedUserEmail,
      name: "FieldOS Seed User",
      passwordHash: seedPasswordHash
    },
    update: {
      name: "FieldOS Seed User",
      passwordHash: seedPasswordHash
    },
    where: {
      email: seedUserEmail
    }
  });

  const organization = await prisma.organization.create({
    data: {
      name: "FieldOS Seed Operations",
      slug: seedOrganizationSlug
    }
  });

  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      role: "OWNER",
      userId: user.id
    }
  });

  const projects = await Promise.all(
    [
      { code: "SEED-OPS", name: "Metro rollout", status: "ACTIVE" as const },
      { code: "SEED-SAFETY", name: "Safety audit", status: "PAUSED" as const },
      { code: "SEED-FLEET", name: "Fleet staging", status: "ACTIVE" as const }
    ].map((project) =>
      prisma.project.create({
        data: {
          ...project,
          organizationId: organization.id
        }
      })
    )
  );

  for (const [conversationIndex, template] of conversationTemplates.entries()) {
    const project = projects[conversationIndex % projects.length];
    const occurredAtBase = new Date(Date.UTC(2026, 5, 30, 8 + conversationIndex, 0, 0));
    const conversation = await prisma.conversation.create({
      data: {
        ...template,
        lastMessageAt: new Date(occurredAtBase.getTime() + 3 * 60_000),
        organizationId: organization.id,
        projectId: project?.id
      }
    });

    const fieldParticipant = await prisma.participant.create({
      data: {
        conversationId: conversation.id,
        displayName: "Field Crew",
        externalIdentifier: `field-crew-${conversationIndex}`,
        role: "field"
      }
    });
    const opsParticipant = await prisma.participant.create({
      data: {
        conversationId: conversation.id,
        displayName: "Operations Desk",
        externalIdentifier: `ops-desk-${conversationIndex}`,
        role: "operations"
      }
    });

    for (const [messageIndex, body] of messageBodies[conversationIndex]?.entries() ?? []) {
      const messageType = getMessageType(conversationIndex, messageIndex);
      const occurredAt = new Date(occurredAtBase.getTime() + messageIndex * 60_000);
      const message = await prisma.message.create({
        data: {
          body,
          conversationId: conversation.id,
          direction: messageIndex % 2 === 0 ? "INBOUND" : "OUTBOUND",
          externalMessageId: `seed-message-${conversationIndex}-${messageIndex}`,
          occurredAt,
          senderParticipantId: messageIndex % 2 === 0 ? fieldParticipant.id : opsParticipant.id,
          type: messageType
        }
      });

      if (messageType !== "TEXT" && messageType !== "SYSTEM") {
        await prisma.attachment.create({
          data: {
            conversationId: conversation.id,
            filename: getAttachmentFilename(messageType, conversationIndex, messageIndex),
            messageId: message.id,
            mimeType: getAttachmentMimeType(messageType),
            size: 64_000 + conversationIndex * 4096 + messageIndex * 512,
            storageKey: `seed/${conversation.id}/${message.id}`
          }
        });
      }
    }
  }

  console.log(`Seeded FieldOS messaging data for ${seedUserEmail}. Password: password123`);
}

function getMessageType(conversationIndex: number, messageIndex: number) {
  if (conversationIndex === 3 && messageIndex === 0) {
    return "DOCUMENT" as const;
  }

  if (conversationIndex === 4 && messageIndex === 0) {
    return "IMAGE" as const;
  }

  if (conversationIndex === 4 && messageIndex === 1) {
    return "DOCUMENT" as const;
  }

  if (conversationIndex === 4 && messageIndex === 2) {
    return "VOICE" as const;
  }

  return "TEXT" as const;
}

function getAttachmentFilename(
  type: "IMAGE" | "DOCUMENT" | "VOICE" | "VIDEO",
  conversationIndex: number,
  messageIndex: number
) {
  const extensionByType = {
    DOCUMENT: "pdf",
    IMAGE: "jpg",
    VIDEO: "mp4",
    VOICE: "mp3"
  };

  return `seed-${conversationIndex}-${messageIndex}.${extensionByType[type]}`;
}

function getAttachmentMimeType(type: "IMAGE" | "DOCUMENT" | "VOICE" | "VIDEO") {
  const mimeTypeByType = {
    DOCUMENT: "application/pdf",
    IMAGE: "image/jpeg",
    VIDEO: "video/mp4",
    VOICE: "audio/mpeg"
  };

  return mimeTypeByType[type];
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
