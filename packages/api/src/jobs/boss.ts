import PgBoss from "pg-boss";

let _boss: PgBoss | null = null;

export async function getBoss(connectionString: string): Promise<PgBoss> {
  if (_boss) return _boss;
  _boss = new PgBoss({ connectionString, noScheduling: true });
  await _boss.start();
  return _boss;
}
