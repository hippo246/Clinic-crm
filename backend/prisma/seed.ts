import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Full system administrator',
      },
    }),
    prisma.role.upsert({
      where: { name: 'doctor' },
      update: {},
      create: {
        name: 'doctor',
        description: 'Medical doctor with clinical access',
      },
    }),
    prisma.role.upsert({
      where: { name: 'nurse' },
      update: {},
      create: {
        name: 'nurse',
        description: 'Nurse with clinical access',
      },
    }),
    prisma.role.upsert({
      where: { name: 'receptionist' },
      update: {},
      create: {
        name: 'receptionist',
        description: 'Front desk receptionist',
      },
    }),
    prisma.role.upsert({
      where: { name: 'billing' },
      update: {},
      create: {
        name: 'billing',
        description: 'Billing and finance staff',
      },
    }),
    prisma.role.upsert({
      where: { name: 'auditor' },
      update: {},
      create: {
        name: 'auditor',
        description: 'Audit and compliance staff',
      },
    }),
    prisma.role.upsert({
      where: { name: 'readonly' },
      update: {},
      create: {
        name: 'readonly',
        description: 'Read-only access',
      },
    }),
  ]);

  console.log('Created roles:', roles.map(r => r.name));

  // Create basic permissions (matching frontend permission model)
  const permissions = await Promise.all([
    prisma.permission.upsert({
      where: { key: 'patients.view' },
      update: {},
      create: {
        key: 'patients.view',
        description: 'View patient records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'patients.create' },
      update: {},
      create: {
        key: 'patients.create',
        description: 'Create patient records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'patients.edit' },
      update: {},
      create: {
        key: 'patients.edit',
        description: 'Edit patient records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'patients.delete' },
      update: {},
      create: {
        key: 'patients.delete',
        description: 'Delete patient records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'appointments.view' },
      update: {},
      create: {
        key: 'appointments.view',
        description: 'View appointments',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'appointments.create' },
      update: {},
      create: {
        key: 'appointments.create',
        description: 'Create appointments',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'appointments.edit' },
      update: {},
      create: {
        key: 'appointments.edit',
        description: 'Edit appointments',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'appointments.delete' },
      update: {},
      create: {
        key: 'appointments.delete',
        description: 'Delete appointments',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'billing.view' },
      update: {},
      create: {
        key: 'billing.view',
        description: 'View billing records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'billing.create' },
      update: {},
      create: {
        key: 'billing.create',
        description: 'Create billing records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'billing.edit' },
      update: {},
      create: {
        key: 'billing.edit',
        description: 'Edit billing records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'billing.delete' },
      update: {},
      create: {
        key: 'billing.delete',
        description: 'Delete billing records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'staff.view' },
      update: {},
      create: {
        key: 'staff.view',
        description: 'View staff records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'staff.create' },
      update: {},
      create: {
        key: 'staff.create',
        description: 'Create staff records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'staff.edit' },
      update: {},
      create: {
        key: 'staff.edit',
        description: 'Edit staff records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'staff.delete' },
      update: {},
      create: {
        key: 'staff.delete',
        description: 'Delete staff records',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'audit.view' },
      update: {},
      create: {
        key: 'audit.view',
        description: 'View audit logs',
      },
    }),
    prisma.permission.upsert({
      where: { key: 'settings.manage' },
      update: {},
      create: {
        key: 'settings.manage',
        description: 'Manage system settings',
      },
    }),
  ]);

  console.log('Created permissions:', permissions.map(p => p.key));

  // Assign permissions to admin role (all permissions)
  const adminRole = roles.find(r => r.name === 'admin');
  if (adminRole) {
    await prisma.role.update({
      where: { id: adminRole.id },
      data: {
        permissions: {
          connect: permissions.map(p => ({ id: p.id })),
        },
      },
    });
    console.log('Assigned all permissions to admin role');
  }

  // Create demo clinic settings
  await prisma.clinicSettings.upsert({
    where: { settingKey: 'clinic_name' },
    update: {},
    create: {
      settingKey: 'clinic_name',
      settingValue: 'Demo Clinic',
      description: 'Clinic name',
    },
  });

  await prisma.clinicSettings.upsert({
    where: { settingKey: 'clinic_address' },
    update: {},
    create: {
      settingKey: 'clinic_address',
      settingValue: '123 Demo Street, Demo City, DC 12345',
      description: 'Clinic address',
    },
  });

  await prisma.clinicSettings.upsert({
    where: { settingKey: 'clinic_phone' },
    update: {},
    create: {
      settingKey: 'clinic_phone',
      settingValue: '+1-555-DEMO-CLN',
      description: 'Clinic phone number',
    },
  });

  console.log('Created demo clinic settings');

  // Create demo admin user (placeholder - no real credentials)
  const demoUser = await prisma.user.upsert({
    where: { email: 'admin@demo.clinic' },
    update: {},
    create: {
      email: 'admin@demo.clinic',
      authId: 'demo-admin-auth-id-placeholder',
      authProvider: 'placeholder',
      status: 'ACTIVE',
    },
  });

  console.log('Created demo admin user:', demoUser.email);

  // Assign admin role to demo user
  if (adminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: demoUser.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: demoUser.id,
        roleId: adminRole.id,
      },
    });
    console.log('Assigned admin role to demo user');
  }

  // Create demo staff member linked to demo admin
  const demoStaff = await prisma.staffMember.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      employeeId: 'DEMO-001',
      firstName: 'Demo',
      lastName: 'Admin',
      email: 'admin@demo.clinic',
      department: 'Administration',
      status: 'ACTIVE',
    },
  });

  console.log('Created demo staff member:', demoStaff.employeeId);

  // Create default retention policy
  await prisma.retentionPolicy.upsert({
    where: { policyName: 'default' },
    update: {},
    create: {
      policyName: 'default',
      auditLogsRetentionDays: 365,
      securityEventsRetentionDays: 365,
      workflowActivityRetentionDays: 365,
      uiActivityRetentionDays: 365,
      backupArchivesRetentionDays: 2555, // 7 years
      isActive: true,
    },
  });

  console.log('Created default retention policy');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
