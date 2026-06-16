import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    const count = await prisma.user.count()
    console.log(`✅ DATABASE IS REACHABLE! Found ${count} users.`)
  } catch (err) {
    console.error(`❌ DATABASE NOT REACHABLE: ${err.message}`)
  } finally {
    await prisma.$disconnect()
  }
}

main()
