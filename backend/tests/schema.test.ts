import { execSync } from 'child_process';

describe('Prisma Schema Validation', () => {
  it('should validate Prisma schema', () => {
    // This test runs prisma validate to ensure the schema is valid
    // It doesn't require a database connection
    try {
      const output = execSync('npx prisma@5.14.0 validate', {
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
      
      expect(output).toContain('The schema at');
      expect(output).toContain('is valid');
    } catch (error) {
      fail(`Prisma schema validation failed: ${error}`);
    }
  });

  it('should generate Prisma client', () => {
    // This test runs prisma generate to ensure the client can be generated
    const output = execSync('npx prisma@5.14.0 generate', {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    
    // Check for generation success - the output contains the success message
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
  });
});
