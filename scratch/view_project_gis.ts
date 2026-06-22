import { prisma } from '../src/lib/prisma';

async function main() {
  const projectId = 'cmqoyvu9q0001l7045u9sx28o';
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });
  console.log('Project details:');
  console.log(JSON.stringify(project, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
