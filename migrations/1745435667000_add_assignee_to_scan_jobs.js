/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Add assignee_id column to scan_jobs table
  pgm.addColumns('scan_jobs', {
    assignee_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'The user assigned to handle this scan job'
    }
  });

  // Add index for the new column
  pgm.createIndex('scan_jobs', 'assignee_id', {
    name: 'scan_jobs_assignee_id_index'
  });
};

exports.down = pgm => {
  // Remove index
  pgm.dropIndex('scan_jobs', 'assignee_id', {
    name: 'scan_jobs_assignee_id_index'
  });

  // Remove column
  pgm.dropColumns('scan_jobs', ['assignee_id']);
};
