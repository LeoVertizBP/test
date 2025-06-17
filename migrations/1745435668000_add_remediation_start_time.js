module.exports = {
  async up(db) {
    await db.query(`
      ALTER TABLE flags
      ADD COLUMN remediation_start_time TIMESTAMP WITH TIME ZONE;
    `);
  },

  async down(db) {
    await db.query(`
      ALTER TABLE flags
      DROP COLUMN remediation_start_time;
    `);
  }
};
