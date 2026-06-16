// Seed minimal et idempotent. Lancer : npm run db:seed
// Crée un deck public "pré-chargé" d'exemple (sans utilisateur réel,
// les vrais utilisateurs sont créés via Better-Auth).

import { prisma, DeckSource } from "../src/index";

async function main() {
  console.log("🌱 Seed Replang…");

  // Rôles de base (idempotent). À affiner plus tard.
  const roleDefs = [
    { name: "admin", description: "Accès complet à l'administration" },
    { name: "user", description: "Utilisateur standard (rôle par défaut)" },
    { name: "ia", description: "Accès aux fonctionnalités IA" },
    { name: "note", description: "Accès aux fonctionnalités de notes" },
  ];
  for (const r of roleDefs) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
  }
  console.log(`  ✓ ${roleDefs.length} rôles garantis`);

  // Utilisateur système porteur des contenus pré-chargés.
  const system = await prisma.user.upsert({
    where: { email: "system@replang.app" },
    update: {},
    create: {
      id: "system",
      name: "Replang",
      email: "system@replang.app",
      emailVerified: true,
    },
  });

  // L'utilisateur système est admin.
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: system.id, roleId: adminRole.id } },
    update: {},
    create: { userId: system.id, roleId: adminRole.id },
  });

  const existing = await prisma.deck.findFirst({
    where: { userId: system.id, title: "Starter — 100 mots essentiels" },
  });

  if (!existing) {
    await prisma.deck.create({
      data: {
        userId: system.id,
        title: "Starter — 100 mots essentiels",
        isPublic: true,
        generatedBy: DeckSource.user,
        cards: {
          create: [
            { front: "ephemeral", back: "éphémère" },
            { front: "to thrive", back: "prospérer / s'épanouir" },
            { front: "insight", back: "perspicacité / aperçu" },
            { front: "to tackle", back: "s'attaquer à" },
            { front: "thorough", back: "minutieux / approfondi" },
          ],
        },
      },
    });
    console.log("  ✓ Deck starter créé");
  } else {
    console.log("  · Deck starter déjà présent");
  }

  console.log("✅ Seed terminé");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
