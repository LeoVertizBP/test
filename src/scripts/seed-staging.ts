import bcrypt from 'bcrypt';
import prisma from '../utils/prismaClient'; // Import shared prisma client

async function main() {
  console.log(`Start seeding ...`);

  const organizationName = '10xTravel';
  const adminUserName = 'Travis Cormier';
  const adminUserEmail = 'travis@10xtravel.com';
  const adminUserPassword = 'StagingP@sswOrd123!'; // IMPORTANT: Change this after first login
  const adminUserRole = 'ADMIN'; // Ensure this role string matches your application's expectation

  // 1. Create Organization
  let organization = await prisma.organizations.findFirst({
    where: { name: organizationName },
  });

  if (!organization) {
    organization = await prisma.organizations.create({
      data: {
        name: organizationName,
        // Add any other mandatory organization fields here if they exist and don't have defaults
        // e.g. settings: { initialSetting: true }
      },
    });
    console.log(`Created organization "${organizationName}" with id: ${organization.id}`);
  } else {
    console.log(`Organization "${organizationName}" already exists with id: ${organization.id}`);
  }

  // 2. Create Admin User
  const existingUser = await prisma.users.findUnique({
    where: { email: adminUserEmail },
  });

  if (!existingUser) {
    const saltRounds = 10; // Standard salt rounds for bcrypt
    const hashedPassword = await bcrypt.hash(adminUserPassword, saltRounds);

    const adminUser = await prisma.users.create({
      data: {
        name: adminUserName,
        email: adminUserEmail,
        password_hash: hashedPassword,
        role: adminUserRole,
        organization_id: organization.id,
        // Add any other mandatory user fields here if they exist and don't have defaults
      },
    });
    console.log(`Created admin user "${adminUserName}" with email "${adminUserEmail}" and id: ${adminUser.id}`);
  } else {
    console.log(`Admin user with email "${adminUserEmail}" already exists.`);
  }

  console.log(`Seeding finished.`);
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
